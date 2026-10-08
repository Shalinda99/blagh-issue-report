"""
Similarity engine — the brain of the service.

Combines THREE mechanisms, exactly as requested:
  1. Vector DB comparison (ChromaDB cosine similarity over embeddings)
  2. Rule-based scoring (Jaccard + priority/category bonuses)
  3. Optional LLM judge (final duplicate confirmation)

Flow:
  * `sync()` pulls assyst incidents, embeds them, writes them to the vector
    store and the SQLite metadata store, then runs duplicate detection and
    persists the resulting pairs.
  * Detection queries each assyst incident against the assyst collection so we
    catch duplicate incidents (including blagh-originated reports that were
    mirrored into assyst).
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from itertools import combinations

from app.config import settings
from app.connectors.assyst_connector import AssystConnector
from app.embeddings.embedder import build_embedder, cosine
from app.models import (
    CanonicalIssue, CheckMatch, CheckResult, CompareResult, DuplicatePair,
)
from app.similarity.groq_agent import GroqSimilarityAgent, IssueInput
from app.similarity.llm_judge import LLMJudge
from app.similarity.rules import rule_score
from app.store.metadata_store import MetadataStore
from app.store.vector_store import VectorStore

_logger = logging.getLogger(__name__)


class SimilarityEngine:
    def __init__(self) -> None:
        self.embedder = build_embedder(
            settings.EMBEDDER, settings.EMBEDDING_DIM, settings.ST_MODEL_NAME
        )
        self.vectors = VectorStore(settings.CHROMA_DIR)
        self.meta = MetadataStore(settings.SQLITE_PATH)
        self.llm = LLMJudge()
        self.agent = GroqSimilarityAgent()

    # ─── Sync ────────────────────────────────────────────────────────────────
    def sync(self, days: int | None = None, run_llm: bool | None = None) -> dict:
        days = days or settings.SYNC_WINDOW_DAYS
        run_id = self.meta.start_run()
        try:
            # assyst is the single source of truth: blagh-reported issues are
            # mirrored into assyst, so we only need to fetch assyst incidents.
            assyst_issues = AssystConnector().fetch(days)

            # Clear stale records so the result always reflects exactly the
            # requested window (switching 14→7 days removes old data).
            self.vectors.clear_source("assyst")
            self.meta.delete_by_source("assyst")

            if assyst_issues:
                embeddings = self.embedder.embed(
                    [i.embedding_text() for i in assyst_issues]
                )
                self.vectors.upsert(assyst_issues, embeddings)
                self.meta.upsert_issues(assyst_issues)

            pairs = self.detect_duplicates(run_llm=run_llm)
            self.meta.replace_pairs(pairs)

            self.meta.finish_run(
                run_id, "success", len(assyst_issues), len(pairs), None
            )
            return {
                "status": "success",
                "days": days,
                "assyst_count": len(assyst_issues),
                "pairs_found": len(pairs),
            }
        except Exception as exc:  # noqa: BLE001 - surface the failure to the client
            _logger.exception("sync failed")
            self.meta.finish_run(run_id, "error", 0, 0, str(exc))
            raise

    # ─── Duplicate detection ──────────────────────────────────────────────────
    def detect_duplicates(self, run_llm: bool | None = None) -> list[DuplicatePair]:
        issues = {row["uid"]: row for row in self.meta.all_issues_raw()}

        # LLM-only mode: when the user explicitly opts in, judge similarity purely
        # with the LLM (ignore vector/rule scores) so semantically-similar issues
        # with little lexical overlap are still caught.
        if run_llm and self.agent.enabled:
            return self._detect_with_llm(issues)

        use_llm = self.llm.enabled if run_llm is None else (run_llm and self.llm.enabled)

        seen: set[tuple[str, str]] = set()
        pairs: list[DuplicatePair] = []

        for uid, row in issues.items():
            source = row["source"]
            emb = self.vectors.get_embedding(source, uid)
            if emb is None:
                continue
            # Only assyst incidents are indexed → intra-assyst duplicate pairs.
            for target in ("assyst",):
                neighbours = self.vectors.query(
                    target, emb, settings.TOP_K, exclude_uid=uid
                )
                for n in neighbours:
                    other_uid = n["uid"]
                    if other_uid not in issues:
                        continue
                    key = tuple(sorted((uid, other_uid)))
                    if key in seen or key[0] == key[1]:
                        continue
                    seen.add(key)

                    a = issues[key[0]]
                    b = issues[key[1]]
                    pair = self._score_pair(a, b, n["score"])
                    if pair.combined_score >= settings.CANDIDATE_THRESHOLD:
                        pairs.append(pair)

        # Optional LLM confirmation on the strongest candidates.
        if use_llm:
            for pair in pairs:
                if pair.combined_score < settings.LLM_JUDGE_THRESHOLD:
                    continue
                a, b = issues[pair.uid_a], issues[pair.uid_b]
                verdict = self.llm.judge(
                    a["title"] or "", a["body"] or "", b["title"] or "", b["body"] or ""
                )
                if verdict:
                    pair.llm_verdict = verdict["verdict"]
                    pair.llm_confidence = verdict["confidence"]
                    pair.llm_reason = verdict["reason"]

        pairs.sort(key=lambda p: p.combined_score, reverse=True)
        return pairs

    def _score_pair(self, a: dict, b: dict, vector: float) -> DuplicatePair:
        # Recompute an exact cosine when both embeddings are available (robust to
        # which collection the neighbour query came from).
        emb_a = self.vectors.get_embedding(a["source"], a["uid"])
        emb_b = self.vectors.get_embedding(b["source"], b["uid"])
        if emb_a is not None and emb_b is not None:
            vector = max(0.0, min(1.0, cosine(emb_a, emb_b)))

        rule = rule_score(
            f"{a['title']} {a['body']}", f"{b['title']} {b['body']}",
            a["priority"], b["priority"], a["category"], b["category"],
        )
        combined = settings.VECTOR_WEIGHT * vector + settings.RULE_WEIGHT * rule
        # Title exact-match bonus: same title across different bodies is a strong
        # cross-system duplicate signal (e.g. "Sudden DB spike" in both sources).
        title_a = (a.get("title") or "").strip().lower()
        title_b = (b.get("title") or "").strip().lower()
        if title_a and title_a == title_b:
            combined = min(1.0, combined + 0.20)
        return DuplicatePair(
            source_a=a["source"], uid_a=a["uid"], title_a=a["title"] or "",
            source_b=b["source"], uid_b=b["uid"], title_b=b["title"] or "",
            cross_source=a["source"] != b["source"],
            vector_score=round(vector, 4), rule_score=round(rule, 4),
            combined_score=round(combined, 4),
            detected_at=datetime.now(timezone.utc).isoformat(),
        )

    # ─── LLM-only duplicate detection ──────────────────────────────────────────
    def _detect_with_llm(self, issues: dict) -> list[DuplicatePair]:
        """
        Compare every unique pair of issues with the LLM (no vector/rule scores).
        The LLM similarity (0-1) is stored in ``combined_score`` so the rest of the
        pipeline/UI treats it as the headline score. Only pairs at/above
        ``LLM_DETECT_MIN_SIMILARITY`` are kept.
        """
        rows = list(issues.values())
        all_pairs = list(combinations(rows, 2))
        if len(all_pairs) > settings.LLM_DETECT_MAX_PAIRS:
            _logger.warning(
                "LLM detect: %d pairs exceeds cap %d; truncating.",
                len(all_pairs), settings.LLM_DETECT_MAX_PAIRS,
            )
            all_pairs = all_pairs[: settings.LLM_DETECT_MAX_PAIRS]

        model = settings.llm_judge_model
        min_sim = settings.LLM_DETECT_MIN_SIMILARITY

        def judge(pair: tuple[dict, dict]) -> DuplicatePair | None:
            a, b = pair
            analysis = self.agent.compare(
                IssueInput(a.get("title") or "", a.get("body") or "",
                           a.get("priority"), a.get("category")),
                IssueInput(b.get("title") or "", b.get("body") or "",
                           b.get("priority"), b.get("category")),
                model=model,
            )
            if not analysis.get("ok"):
                return None
            sim = analysis["similarity"]
            if sim < min_sim:
                return None
            return DuplicatePair(
                source_a=a["source"], uid_a=a["uid"], title_a=a.get("title") or "",
                source_b=b["source"], uid_b=b["uid"], title_b=b.get("title") or "",
                cross_source=a["source"] != b["source"],
                vector_score=0.0, rule_score=0.0,
                combined_score=round(sim, 4),
                llm_verdict=analysis["verdict"],
                llm_confidence=analysis["confidence"],
                llm_reason=analysis["reason"],
                detected_at=datetime.now(timezone.utc).isoformat(),
            )

        pairs: list[DuplicatePair] = []
        workers = max(1, settings.LLM_DETECT_WORKERS)
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for result in pool.map(judge, all_pairs):
                if result is not None:
                    pairs.append(result)

        pairs.sort(key=lambda p: p.combined_score, reverse=True)
        return pairs

    # ─── Ad-hoc comparison ─────────────────────────────────────────────────────
    def compare(
        self,
        text_a: str, text_b: str,
        title_a=None, title_b=None,
        priority_a=None, priority_b=None, category_a=None, category_b=None,
        run_llm: bool = False,
    ) -> CompareResult:
        # Title + description together drive the vector / rule signals.
        full_a = "\n".join(p for p in (title_a, text_a) if p).strip()
        full_b = "\n".join(p for p in (title_b, text_b) if p).strip()
        emb_a, emb_b = self.embedder.embed([full_a, full_b])
        vector = max(0.0, min(1.0, cosine(emb_a, emb_b)))
        rule = rule_score(full_a, full_b, priority_a, priority_b, category_a, category_b)
        combined = settings.VECTOR_WEIGHT * vector + settings.RULE_WEIGHT * rule
        result = CompareResult(
            vector_score=round(vector, 4),
            rule_score=round(rule, 4),
            combined_score=round(combined, 4),
            is_duplicate=combined >= settings.DUPLICATE_THRESHOLD,
        )

        if run_llm:
            result.llm_used = True
            analysis = self.agent.compare(
                IssueInput(title=title_a or "", description=text_a,
                           priority=priority_a, category=category_a),
                IssueInput(title=title_b or "", description=text_b,
                           priority=priority_b, category=category_b),
            )
            if analysis.get("ok"):
                result.llm_similarity = analysis["similarity"]
                result.llm_verdict = analysis["verdict"]
                result.llm_confidence = analysis["confidence"]
                result.llm_reason = analysis["reason"]
                result.llm_matching_factors = analysis["matching_factors"]
                result.llm_differing_factors = analysis["differing_factors"]
                result.llm_model = analysis["model"]
                # When the LLM is consulted, its verdict drives the headline flag.
                result.is_duplicate = analysis["verdict"] == "duplicate"
            else:
                result.llm_error = analysis.get("error")
        return result

    # ─── Single-issue duplicate check ──────────────────────────────────────────
    def check(
        self,
        title: str,
        body: str,
        source_id: str | None = None,
        ref: str | None = None,
        priority: str | None = None,
        category: str | None = None,
        top_k: int | None = None,
        threshold: float | None = None,
        index: bool = True,
    ) -> CheckResult:
        """
        Compare one issue against the indexed assyst incidents and return the
        matches that look like duplicates. Optionally upsert the issue into the
        index afterwards (keyed by its assyst id) so later reports can match it.
        """
        top_k = top_k or settings.TOP_K
        threshold = settings.DUPLICATE_THRESHOLD if threshold is None else threshold

        issue = CanonicalIssue(
            source="assyst",
            source_id=source_id or (ref or "pending"),
            ref=ref,
            title=title or "",
            body=body or "",
            priority=priority,
            category=category,
        )
        self_uid = issue.uid
        emb = self.embedder.embed([issue.embedding_text()])[0]

        neighbours = self.vectors.query("assyst", emb, top_k, exclude_uid=self_uid)
        matches: list[CheckMatch] = []
        for n in neighbours:
            meta = n["metadata"] or {}
            vector = max(0.0, min(1.0, float(n["score"])))
            rule = rule_score(
                f"{issue.title} {issue.body}",
                f"{meta.get('title', '')} {n.get('document', '')}",
                issue.priority, meta.get("priority") or None,
                issue.category, meta.get("category") or None,
            )
            combined = settings.VECTOR_WEIGHT * vector + settings.RULE_WEIGHT * rule
            title_a = (issue.title or "").strip().lower()
            title_b = (meta.get("title") or "").strip().lower()
            if title_a and title_a == title_b:
                combined = min(1.0, combined + 0.20)
            matches.append(
                CheckMatch(
                    uid=n["uid"],
                    source_id=meta.get("source_id") or n["uid"].split(":", 1)[-1],
                    ref=meta.get("ref") or None,
                    title=meta.get("title") or "",
                    priority=meta.get("priority") or None,
                    category=meta.get("category") or None,
                    status=meta.get("status") or None,
                    vector_score=round(vector, 4),
                    rule_score=round(rule, 4),
                    combined_score=round(combined, 4),
                )
            )

        matches.sort(key=lambda m: m.combined_score, reverse=True)
        dupes = [m for m in matches if m.combined_score >= threshold]
        best = matches[0].combined_score if matches else 0.0

        indexed = False
        if index and source_id:
            self.vectors.upsert([issue], [emb])
            self.meta.upsert_issues([issue])
            indexed = True

        return CheckResult(
            is_duplicate=bool(dupes),
            threshold=round(threshold, 4),
            best_score=round(best, 4),
            matches=matches,
            duplicate_refs=[m.ref for m in dupes if m.ref],
            duplicate_ids=[m.source_id for m in dupes if m.source_id],
            indexed=indexed,
        )

    # ─── Stats / reset ─────────────────────────────────────────────────────────
    def stats(self) -> dict:
        latest = self.meta.latest_run()
        return {
            "assyst_count": self.meta.count_issues("assyst"),
            "total_issues": self.meta.count_issues(),
            "duplicate_pairs": self.meta.count_pairs(),
            "cross_source_pairs": len(self.meta.list_pairs(cross_source_only=True)),
            "embedder": settings.EMBEDDER,
            "llm_enabled": self.llm.enabled,
            "llm_available": self.agent.enabled,
            "llm_provider": settings.llm_provider,
            "llm_model": settings.llm_model,
            "llm_judge_model": settings.llm_judge_model,
            "duplicate_threshold": settings.DUPLICATE_THRESHOLD,
            "latest_run": latest.model_dump() if latest else None,
        }

    def reset(self) -> None:
        self.vectors.reset()
        self.meta.reset()


_engine: SimilarityEngine | None = None


def get_engine() -> SimilarityEngine:
    global _engine
    if _engine is None:
        _engine = SimilarityEngine()
    return _engine
