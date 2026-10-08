"""
Configurable fault injection for integration testing.
Disabled by default. Only active when FAULT_INJECTION_ENABLED=true.
These are mock-only features, not part of the assystREST contract.
"""
import asyncio
import random
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


async def apply_fault_injection() -> None:
    """Apply configured fault injection behaviors."""
    if not settings.FAULT_INJECTION_ENABLED:
        return

    if settings.FAULT_INJECTION_DELAY_MS > 0:
        await asyncio.sleep(settings.FAULT_INJECTION_DELAY_MS / 1000.0)
        logger.debug("Fault injection: added %dms delay", settings.FAULT_INJECTION_DELAY_MS)

    if settings.FAULT_INJECTION_ERROR_RATE > 0:
        if random.random() < settings.FAULT_INJECTION_ERROR_RATE:
            logger.warning("Fault injection: returning 500 error")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "type": "InternalServerError",
                    "message": "Simulated server error (fault injection active).",
                    "diagnostic": "FAULT_INJECTION_ENABLED=true",
                },
            )
