"""
Pydantic v2 schemas that map directly to the JSON payload sent by blagh.js.
"""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


# ─── Nested inbound schemas (widget payload sub-objects) ─────────────────────

class WhoSchema(BaseModel):
    user_id: str = ""
    user_name: str = ""
    user_email: str = ""
    user_role: str = ""
    user_agent: str = ""


class WhereSchema(BaseModel):
    url: str = ""
    page_title: str = ""
    referrer: str = ""
    browser: str = ""
    os: str = ""
    device: str = ""
    viewport: str = ""
    screen_resolution: str = ""


class WhenSchema(BaseModel):
    utc_timestamp: str = ""
    local_timestamp: str = ""
    timezone: str = ""


class ConsoleLogSchema(BaseModel):
    level: str
    message: str
    source: str = ""
    line_number: int | None = None
    timestamp: str = ""
    page_url: str = ""  # captured per-entry by the widget; accepted but not yet persisted


class FailedAPICallSchema(BaseModel):
    url: str
    method: str
    status_code: int
    status_text: str = ""
    duration_ms: int | None = None
    timestamp: str = ""
    page_url: str = ""  # captured per-entry by the widget; accepted but not yet persisted


class DiagnosticsSchema(BaseModel):
    console_errors: list[ConsoleLogSchema] = Field(default_factory=list)
    console_warnings: list[ConsoleLogSchema] = Field(default_factory=list)
    failed_api_calls: list[FailedAPICallSchema] = Field(default_factory=list)
    screenshots: list[str] = Field(default_factory=list)
    voice_recordings: list[str] = Field(default_factory=list)
    video_recordings: list[str] = Field(default_factory=list)


# ─── Main inbound schema (POST /api/v1/reports) ───────────────────────────────

class ReportCreate(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=100)
    summary: str = Field(..., min_length=1, max_length=500)
    description: str = Field(..., min_length=1, max_length=10000)
    priority: str | None = Field(default=None, max_length=20)
    who: WhoSchema = Field(default_factory=WhoSchema)
    where: WhereSchema = Field(default_factory=WhereSchema)
    when: WhenSchema = Field(default_factory=WhenSchema)
    diagnostics: DiagnosticsSchema = Field(default_factory=DiagnosticsSchema)


# ─── Outbound schemas ─────────────────────────────────────────────────────────

class ConsoleLogResponse(BaseModel):
    id: str
    level: str
    message: str
    source: str | None
    line_number: int | None
    captured_at: str | None

    model_config = {"from_attributes": True}


class FailedAPICallResponse(BaseModel):
    id: str
    url: str
    method: str
    status_code: int
    status_text: str | None
    duration_ms: int | None
    captured_at: str | None

    model_config = {"from_attributes": True}


class ReportSummaryResponse(BaseModel):
    """Lightweight response for list endpoints."""

    id: str
    ref_id: str
    project_id: str
    summary: str
    priority: str | None
    category: str | None
    status: str
    user_name: str | None
    user_email: str | None
    page_url: str | None
    reported_at_utc: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportDetailResponse(ReportSummaryResponse):
    """Full response including all diagnostic data."""

    description: str
    user_id: str | None
    user_role: str | None
    user_agent: str | None
    page_title: str | None
    referrer: str | None
    browser: str | None
    os: str | None
    device: str | None
    viewport: str | None
    screen_resolution: str | None
    reported_at_local: str | None
    timezone: str | None
    console_logs: list[ConsoleLogResponse]
    failed_api_calls: list[FailedAPICallResponse]
    screenshots: list[str] = []
    voice_recordings: list[str] = []
    video_recordings: list[str] = []
    assyst_event_id: int | None = None
    assyst_event_ref: str | None = None

    @field_validator("screenshots", "voice_recordings", "video_recordings", mode="before")
    @classmethod
    def coerce_none_to_list(cls, v: object) -> list:
        """DB stores NULL for documents created before these fields existed."""
        return v if v is not None else []

    model_config = {"from_attributes": True}


class ReportCreateResponse(BaseModel):
    """Response returned immediately after a widget submission."""

    id: str
    ref_id: str
    status: str
    message: str = "Your issue has been reported. Our team will investigate shortly."
