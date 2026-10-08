"""
Error response models matching the verified assystREST API contract.
Source: https://wiki.axiossystems.com/assyst11-5Wiki/index.php/Integrations:assystREST
"""
from pydantic import BaseModel
from typing import Optional


class AssystError(BaseModel):
    """Standard assystREST error response. Verified format."""
    type: str
    message: str
    diagnostic: Optional[str] = ""


class ValidationErrorDetail(BaseModel):
    """Single field validation error. Verified format."""
    rule: str
    field: str
    message: str
    diagnostic: Optional[str] = ""


class AssystValidationError(BaseModel):
    """Validation error response (HTTP 400). Verified format."""
    type: str = "ComplexValidationException"
    message: str = "A complex validation error has been detected by the application."
    errors: list[ValidationErrorDetail] = []
