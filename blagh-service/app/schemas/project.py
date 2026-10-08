from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    app_id: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9_-]+$")
    name: str = Field(..., min_length=1, max_length=200)
    origin_url: str | None = Field(default=None, max_length=500)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    origin_url: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


class ProjectResponse(BaseModel):
    id: str
    app_id: str
    name: str
    origin_url: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminLoginRequest(BaseModel):
    email: str
    password: str
