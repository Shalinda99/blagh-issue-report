"""
Optional LLM judge (OpenAI-compatible chat completions).

Given a candidate pair that already scored highly on vector + rule signals, the
LLM makes a final yes/no duplicate call with a confidence and a short reason.
This is strictly optional: if disabled or misconfigured it degrades gracefully
to a `None` verdict and the pipeline keeps working on vector + rules alone.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

import httpx

from app.config import settings

_logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are a meticulous IT service-desk analyst. You decide whether two issue "
    "reports describe the SAME underlying problem (a duplicate), even if they are "
    "worded differently or come from different systems. Respond with STRICT JSON: "
    '{"verdict": "duplicate" | "not_duplicate", "confidence": 0.0-1.0, '
    '"reason": "<=200 chars"}. Judge the root problem, not superficial wording.'
)


class LLMJudge:
    def __init__(self) -> None:
        self.enabled = settings.LLM_ENABLED and bool(settings.llm_api_key)
        self.base_url = settings.llm_base_url.rstrip("/")
        self.model = settings.llm_judge_model
        self.api_key = settings.llm_api_key

    def judge(
        self, title_a: str, body_a: str, title_b: str, body_b: str
    ) -> Optional[dict]:
        if not self.enabled:
            return None
        user_prompt = (
            f"Issue A:\nTitle: {title_a}\nDetails: {body_a[:1500]}\n\n"
            f"Issue B:\nTitle: {title_b}\nDetails: {body_b[:1500]}\n\n"
            "Are these duplicates? Reply with the required JSON only."
        )
        try:
            resp = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                timeout=settings.LLM_TIMEOUT,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            data = json.loads(content)
            verdict = data.get("verdict")
            if verdict not in ("duplicate", "not_duplicate"):
                return None
            return {
                "verdict": verdict,
                "confidence": float(data.get("confidence", 0.0)),
                "reason": str(data.get("reason", ""))[:300],
            }
        except (httpx.HTTPError, KeyError, ValueError, json.JSONDecodeError) as exc:
            _logger.warning("LLM judge failed: %s", exc)
            return None
