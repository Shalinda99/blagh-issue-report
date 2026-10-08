"""
Mock-only authentication helpers and admin credential management.
Separate from the real assystREST authentication contract.
"""
from app.core.config import settings


def get_mock_credentials() -> dict:
    """Return mock credentials info (never the password itself)."""
    return {
        "authEnabled": settings.MOCK_AUTH_ENABLED,
        "username": settings.MOCK_AUTH_USERNAME,
        "bypassEnabled": settings.MOCK_AUTH_BYPASS and settings.APP_ENV == "development",
    }
