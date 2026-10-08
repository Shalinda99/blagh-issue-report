"""
HTTP API for the Similarity Check Index service.

Endpoints:
  POST /api/sync        — fetch both sources (last N days), embed, store, detect
  GET  /api/issues      — list stored issues (optionally by source)
  GET  /api/issues/{uid}— single issue detail (+ its nearest matches)
  GET  /api/duplicates  — detected duplicate pairs
  POST /api/compare     — ad-hoc compare of two free-text issues
  GET  /api/stats       — counts + last run + config
  POST /api/reset       — wipe the vector + metadata stores (POC convenience)
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.models import (
    CheckRequest, CheckResult, CompareRequest, CompareResult, DuplicatePair,
    IssueOut, Source, SyncRequest,
)
from app.similarity.engine import get_engine

router = APIRouter(prefix="/api", tags=["similarity"])


@router.post("/sync", summary="Fetch, embed and deduplicate issues from both sources")
def sync(body: SyncRequest | None = None) -> dict:
    body = body or SyncRequest()
    try:
        return get_engine().sync(days=body.days, run_llm=body.run_llm)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Sync failed: {exc}") from exc


@router.get("/issues", response_model=list[IssueOut], summary="List stored issues")
def list_issues(
    source: Optional[Source] = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    q: Optional[str] = Query(default=None, max_length=200, description="Search title/body"),
) -> list[IssueOut]:
    return get_engine().meta.list_issues(source=source, limit=limit, offset=offset, q=q)


@router.get("/issues/{uid:path}", summary="Issue detail with nearest matches")
def issue_detail(uid: str, top_k: int = Query(default=5, ge=1, le=20)) -> dict:
    engine = get_engine()
    issue = engine.meta.get_issue(uid)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue '{uid}' not found")

    matches: list[dict] = []
    emb = engine.vectors.get_embedding(issue["source"], uid)
    if emb is not None:
        for target in ("assyst",):
            for n in engine.vectors.query(target, emb, top_k, exclude_uid=uid):
                matches.append(
                    {
                        "uid": n["uid"],
                        "source": n["metadata"].get("source"),
                        "title": n["metadata"].get("title"),
                        "ref": n["metadata"].get("ref"),
                        "vector_score": round(n["score"], 4),
                    }
                )
        matches.sort(key=lambda m: m["vector_score"], reverse=True)
    issue.pop("raw_json", None)
    return {"issue": issue, "matches": matches[:top_k]}


@router.post("/detect", summary="Re-run duplicate detection on stored issues (no re-fetch)")
def detect(run_llm: bool = Query(default=False)) -> dict:
    engine = get_engine()
    pairs = engine.detect_duplicates(run_llm=run_llm)
    engine.meta.replace_pairs(pairs)
    return {"status": "success", "pairs_found": len(pairs)}


@router.get("/duplicates", response_model=list[DuplicatePair], summary="Detected duplicate pairs")
def duplicates(cross_source_only: bool = Query(default=False)) -> list[DuplicatePair]:
    return get_engine().meta.list_pairs(cross_source_only=cross_source_only)


@router.post(
    "/check",
    response_model=CheckResult,
    summary="Check one issue for duplicates against indexed assyst incidents",
)
def check(body: CheckRequest) -> CheckResult:
    return get_engine().check(
        title=body.title,
        body=body.body,
        source_id=body.source_id,
        ref=body.ref,
        priority=body.priority,
        category=body.category,
        top_k=body.top_k,
        threshold=body.threshold,
        index=body.index,
    )


@router.post("/compare", response_model=CompareResult, summary="Compare two free-text issues")
def compare(body: CompareRequest) -> CompareResult:
    return get_engine().compare(
        text_a=body.text_a, text_b=body.text_b,
        title_a=body.title_a, title_b=body.title_b,
        priority_a=body.priority_a, priority_b=body.priority_b,
        category_a=body.category_a, category_b=body.category_b,
        run_llm=body.run_llm,
    )


@router.get("/stats", summary="Service statistics and configuration")
def stats() -> dict:
    return get_engine().stats()


@router.post("/reset", summary="Wipe all stored issues, pairs and sync history")
def reset() -> dict:
    get_engine().reset()
    return {"status": "reset"}
