from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


class SuccessResponse(BaseModel):
    status: str = "success"
    message: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
