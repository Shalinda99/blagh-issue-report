from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone

from app.api.dependencies import get_database
from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/health", summary="Health check")
async def health(db: AsyncIOMotorDatabase = Depends(get_database)):
    try:
        await db.command("ping")
        db_status = "ok"
    except Exception:
        db_status = "error"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "service": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "database": db_status,
        "apiVersion": settings.ASSYST_API_VERSION,
        "mockMode": True,
    }
