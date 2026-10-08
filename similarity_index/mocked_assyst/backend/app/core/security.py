import base64
import binascii
from fastapi import HTTPException, Request, status
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def decode_basic_auth(authorization: str) -> tuple[str, str]:
    """Decode a Basic Authorization header. Returns (username, password)."""
    if not authorization.startswith("Basic "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"type": "UnauthorizedException", "message": "Basic authentication required.", "diagnostic": ""},
            headers={"WWW-Authenticate": "Basic realm=\"assystREST\""},
        )
    try:
        encoded = authorization[6:]
        decoded = base64.b64decode(encoded).decode("utf-8")
        username, password = decoded.split(":", 1)
        return username, password
    except (binascii.Error, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"type": "UnauthorizedException", "message": "Invalid Basic authentication credentials.", "diagnostic": ""},
            headers={"WWW-Authenticate": "Basic realm=\"assystREST\""},
        )


def verify_credentials(username: str, password: str) -> bool:
    """Verify credentials against configured mock credentials."""
    return (
        username == settings.MOCK_AUTH_USERNAME
        and password == settings.MOCK_AUTH_PASSWORD
    )


def authenticate_request(request: Request) -> str:
    """
    Authenticate an incoming request.
    Returns the authenticated username.
    Raises HTTP 401 if authentication fails.
    """
    if not settings.MOCK_AUTH_ENABLED:
        return "anonymous"

    if settings.MOCK_AUTH_BYPASS and settings.APP_ENV == "development":
        return settings.MOCK_AUTH_USERNAME

    authorization = request.headers.get("Authorization", "")
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"type": "UnauthorizedException", "message": "Authentication required.", "diagnostic": ""},
            headers={"WWW-Authenticate": "Basic realm=\"assystREST\""},
        )

    username, password = decode_basic_auth(authorization)
    if not verify_credentials(username, password):
        logger.warning("Failed authentication attempt for user: %s", username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"type": "UnauthorizedException", "message": "Invalid username or password.", "diagnostic": ""},
            headers={"WWW-Authenticate": "Basic realm=\"assystREST\""},
        )

    return username
