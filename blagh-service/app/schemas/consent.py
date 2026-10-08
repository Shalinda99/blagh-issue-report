"""
Pydantic v2 schemas for the user consent/privacy acknowledgment endpoint.
"""

from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class ConsentCreate(BaseModel):
    """POST body sent by the widget when a user acknowledges the privacy notice."""

    user_email: str | None = Field(default=None, max_length=300)
    user_id: str | None = Field(default=None, max_length=100)
    user_name: str | None = Field(default=None, max_length=200)
    user_role: str | None = Field(default=None, max_length=100)
    project_id: str = Field(..., min_length=1, max_length=100)
    consented: bool = True
    user_agent: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def require_email_or_id(self) -> "ConsentCreate":
        if not self.user_email and not self.user_id:
            raise ValueError("At least one of user_email or user_id must be provided.")
        return self


class ConsentResponse(BaseModel):
    """Returned for both GET (consent check) and POST (record consent)."""

    id: str
    user_email: str | None
    project_id: str
    consented: bool
    consented_at: datetime

    model_config = {"from_attributes": True}


class ConsentStatusResponse(BaseModel):
    """Lightweight response for the GET check — avoids exposing PII unnecessarily."""

    consented: bool
    consented_at: datetime | None = None
