import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import settings
from app.core.exceptions import add_exception_handlers
from app.db.minio_client import ensure_bucket_exists
from app.db.mongo import close_client, init_indexes

_logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler — runs on startup and shutdown."""
    # Startup: create MongoDB indexes (idempotent)
    init_indexes()
    # Startup: ensure MinIO bucket exists (idempotent)
    try:
        ensure_bucket_exists()
    except Exception:
        _logger.warning(
            "Could not connect to MinIO on startup — media uploads will fail until MinIO is available."
        )
    yield
    # Shutdown: close the shared MongoClient
    close_client()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# Allow all origins in development; restrict to ALLOWED_ORIGINS in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS if settings.is_production else ["*"],
    allow_credentials=settings.is_production,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ─── Exception handlers ───────────────────────────────────────────────────────
add_exception_handlers(app)

# ─── Routes ───────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")


@app.get("/", include_in_schema=False)
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": settings.APP_NAME, "version": settings.APP_VERSION}
