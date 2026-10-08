"""
Groq-backed LLM similarity agent.

A small orchestrator: given two issues (title, description, priority, category)
it asks an OpenAI-compatible chat model (Groq by default) to reason about whether
they describe the SAME underlying problem and returns a structured similarity
analysis as strict JSON.

Groq exposes an OpenAI-compatible Chat Completions API, so the same client works
for OpenAI by switching ``LLM_PROVIDER`` in the settings.

The agent degrades gracefully: on misconfiguration or any transport/parse error
it returns ``{"ok": False, "error": "..."}`` so callers can fall back to the
vector + rule scores without crashing.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from app.config import settings

_logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are an expert IT service-desk triage agent. You compare two incident "
    "reports and decide how similar they are - i.e. whether they describe the "
    "SAME underlying problem (a duplicate), even when worded differently or "
    "logged by different people.\n\n"
    "Weigh these signals explicitly:\n"
    "- Title and description: the core symptom and likely root cause.\n"
    "- Priority: how close the urgency / business impact is.\n"
    "- Category: whether they belong to the same problem area.\n\n"
    "Return STRICT JSON ONLY, matching exactly this shape:\n"
    "{\n"
    '  "similarity": <float 0.0-1.0>,\n'
    '  "verdict": "duplicate" | "not_duplicate",\n'
    '  "confidence": <float 0.0-1.0>,\n'
    '  "reason": "<=240 characters, plain English",\n'
    '  "matching_factors": ["short phrase", ...],\n'
    '  "differing_factors": ["short phrase", ...]\n'
    "}\n"
    "Judge the ROOT problem, not superficial wording. `similarity` is your "
    "overall 0-1 duplicate likelihood and should agree with `verdict`."
)


@dataclass
class IssueInput:
    """Structured issue fields fed to the agent."""

    title: str = ""
    description: str = ""
    priority: Optional[str] = None
    category: Optional[str] = None

    def as_prompt_block(self, label: str) -> str:
        return (
            f"Issue {label}:\n"
            f"  Title: {self.title or '(none)'}\n"
            f"  Priority: {self.priority or '(unspecified)'}\n"
            f"  Category: {self.category or '(unspecified)'}\n"
            f"  Description: {(self.description or '(none)')[:2000]}"
        )


class GroqSimilarityAgent:
    """On-demand LLM similarity using an OpenAI-compatible (Groq) chat model."""

    def __init__(self, model: Optional[str] = None) -> None:
        self.provider = settings.llm_provider
        self.base_url = settings.llm_base_url.rstrip("/")
        self.model = model or settings.llm_model
        self.api_key = settings.llm_api_key
        self.timeout = settings.LLM_TIMEOUT

    @property
    def enabled(self) -> bool:
        """Available whenever an API key is configured for the active provider."""
        return bool(self.api_key)

    def compare(self, a: IssueInput, b: IssueInput, model: Optional[str] = None) -> dict[str, Any]:
        """
        Compare two issues. Returns a dict with ``ok=True`` and the analysis, or
        ``ok=False`` with an ``error`` message that is safe to show to the user.
        ``model`` overrides the default model for this single call.
        """
        if not self.enabled:
            return {
                "ok": False,
                "error": (
                    f"LLM provider '{self.provider}' has no API key configured. "
                    "Set GROQ_API_KEY (or OPENAI_API_KEY) in the service .env."
                ),
            }

        user_prompt = (
            f"{a.as_prompt_block('A')}\n\n"
            f"{b.as_prompt_block('B')}\n\n"
            "Compare Issue A and Issue B. Reply with the required JSON only."
        )
        try:
            resp = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": model or self.model,
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                timeout=self.timeout,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return self._normalize(json.loads(content), model or self.model)
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:200] if exc.response is not None else ""
            msg = f"{exc.response.status_code} from {self.provider}: {detail}"
            _logger.warning("Groq agent HTTP error: %s", msg)
            return {"ok": False, "error": msg}
        except (httpx.HTTPError, KeyError, ValueError, json.JSONDecodeError) as exc:
            _logger.warning("Groq agent failed: %s", exc)
            return {"ok": False, "error": f"LLM request failed: {exc}"}

    def _normalize(self, data: dict[str, Any], model: str) -> dict[str, Any]:
        verdict = data.get("verdict")
        similarity = _clamp(data.get("similarity"))
        if verdict not in ("duplicate", "not_duplicate"):
            verdict = "duplicate" if (similarity or 0.0) >= 0.6 else "not_duplicate"
        if similarity is None:
            similarity = 1.0 if verdict == "duplicate" else 0.0
        return {
            "ok": True,
            "similarity": round(similarity, 4),
            "verdict": verdict,
            "confidence": _clamp(data.get("confidence")) or 0.0,
            "reason": str(data.get("reason", ""))[:400],
            "matching_factors": _as_str_list(data.get("matching_factors")),
            "differing_factors": _as_str_list(data.get("differing_factors")),
            "model": model,
            "provider": self.provider,
        }


def _clamp(value: Any) -> Optional[float]:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return max(0.0, min(1.0, f))


def _as_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(x)[:120] for x in value if str(x).strip()][:8]
