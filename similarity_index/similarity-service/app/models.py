"""
Shared Pydantic models.

`CanonicalIssue` is the normalized representation that the assyst connector maps
its native assystREST payloads into. The rest of the pipeline (embedding,
storage, similarity) only ever deals with canonical issues so the source schema
stays decoupled from the similarity logic.
"""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

Source = Literal["assyst"]


class CanonicalIssue(BaseModel):
    """Source-agnostic issue used across the whole similarity pipeline."""

    source: Source
    source_id: str                       # native primary id (stringified)
    ref: Optional[str] = None            # human ref (ref_id / eventRef)
    title: str = ""                      # summary / shortDescription
    body: str = ""                       # description / remarks
    priority: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    reporter: Optional[str] = None
    url: Optional[str] = None
    created_at: Optional[str] = None     # ISO 8601
    raw: dict[str, Any] = Field(default_factory=dict)

    @property
    def uid(self) -> str:
        """Globally unique id across sources, used as the vector-store key."""
        return f"{self.source}:{self.source_id}"

    def embedding_text(self) -> str:
        parts = [self.title.strip(), self.body.strip()]
        if self.category:
            parts.append(f"category: {self.category}")
        return "\n".join(p for p in parts if p)


class IssueOut(BaseModel):
    uid: str
    source: Source
    source_id: str
    ref: Optional[str] = None
    title: str = ""
    body: str = ""
    priority: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    reporter: Optional[str] = None
    url: Optional[str] = None
    created_at: Optional[str] = None
    synced_at: Optional[str] = None


class DuplicatePair(BaseModel):
    id: Optional[int] = None
    source_a: Source
    uid_a: str
    title_a: str = ""
    source_b: Source
    uid_b: str
    title_b: str = ""
    cross_source: bool = False
    vector_score: float = 0.0
    rule_score: float = 0.0
    combined_score: float = 0.0
    llm_verdict: Optional[str] = None        # "duplicate" | "not_duplicate" | None
    llm_confidence: Optional[float] = None
    llm_reason: Optional[str] = None
    detected_at: Optional[str] = None


class SyncRun(BaseModel):
    id: Optional[int] = None
    started_at: str
    finished_at: Optional[str] = None
    status: str = "running"              # running | success | error
    assyst_count: int = 0
    pairs_found: int = 0
    message: Optional[str] = None


class SyncRequest(BaseModel):
    days: Optional[int] = None          # overrides SYNC_WINDOW_DAYS
    run_llm: Optional[bool] = None      # overrides LLM_ENABLED for this run


class CompareRequest(BaseModel):
    text_a: str                          # description / body of issue A
    text_b: str                          # description / body of issue B
    title_a: Optional[str] = None
    title_b: Optional[str] = None
    priority_a: Optional[str] = None
    priority_b: Optional[str] = None
    category_a: Optional[str] = None
    category_b: Optional[str] = None
    run_llm: bool = False                # also run the Groq LLM similarity agent


class CompareResult(BaseModel):
    vector_score: float
    rule_score: float
    combined_score: float
    is_duplicate: bool
    # LLM (Groq) similarity agent output
    llm_used: bool = False
    llm_similarity: Optional[float] = None
    llm_verdict: Optional[str] = None
    llm_confidence: Optional[float] = None
    llm_reason: Optional[str] = None
    llm_matching_factors: list[str] = Field(default_factory=list)
    llm_differing_factors: list[str] = Field(default_factory=list)
    llm_model: Optional[str] = None
    llm_error: Optional[str] = None


class CheckRequest(BaseModel):
    """
    Check a single (usually freshly reported) issue for duplicates against the
    indexed assyst incidents. If `source_id`/`ref` identify an assyst incident,
    the issue is also upserted into the index after the check so future reports
    can match against it.
    """

    source_id: Optional[str] = None     # assyst event id of the just-created incident
    ref: Optional[str] = None           # assyst eventRef of the just-created incident
    title: str = ""
    body: str = ""
    priority: Optional[str] = None
    category: Optional[str] = None
    top_k: int = 5
    threshold: Optional[float] = None   # overrides DUPLICATE_THRESHOLD for the match filter
    index: bool = True                  # upsert this issue into the index after checking


class CheckMatch(BaseModel):
    uid: str
    source_id: str
    ref: Optional[str] = None
    title: str = ""
    priority: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    vector_score: float = 0.0
    rule_score: float = 0.0
    combined_score: float = 0.0


class CheckResult(BaseModel):
    is_duplicate: bool = False
    threshold: float = 0.0
    best_score: float = 0.0
    matches: list[CheckMatch] = Field(default_factory=list)
    duplicate_refs: list[str] = Field(default_factory=list)
    duplicate_ids: list[str] = Field(default_factory=list)
    indexed: bool = False
