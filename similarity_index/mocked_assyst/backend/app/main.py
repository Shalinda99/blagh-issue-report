from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.database.mongo import connect_db, close_db, get_db
from app.database.indexes import create_indexes
from app.api.events import router as events_router, admin_router
from app.api.health import router as health_router

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    db = get_db()
    await create_indexes(db)

    if settings.SEED_DATA_ENABLED:
        from app.database.repositories import (
            EventRepository, UserRepository,
            TeamRepository, CategoryRepository, ServiceRepository,
        )
        from app.services.seed_service import SeedService
        seed_svc = SeedService(
            EventRepository(db), UserRepository(db),
            TeamRepository(db), CategoryRepository(db),
            ServiceRepository(db),
        )
        if not await seed_svc.is_seeded():
            logger.info("Database empty — running initial seed")
            await seed_svc.seed_reference_data()
            await seed_svc.seed_events(settings.SEED_DATA_COUNT)
        else:
            count = await EventRepository(db).count_all()
            logger.info("Database already seeded (%d events)", count)

    yield
    await close_db()


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Mock IFS assyst REST API server for the Similarity Check Index POC. "
        "Implements the assystREST v2 API contract for incident retrieval, "
        "filtering, pagination and incremental synchronization. "
        "**This is a development mock — not the real IFS assyst product.**"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for e in exc.errors():
        field = ".".join(str(loc) for loc in e.get("loc", []))
        errors.append({
            "rule": "validationError",
            "field": field,
            "message": e.get("msg", "Invalid value."),
            "diagnostic": str(e.get("type", "")),
        })
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "type": "ComplexValidationException",
            "message": "A complex validation error has been detected by the application.",
            "errors": errors,
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "type": "InternalServerError",
            "message": "An unrecoverable application error occurred.",
            "diagnostic": str(exc) if settings.APP_ENV == "development" else "",
        },
    )


app.include_router(health_router)
app.include_router(events_router)
app.include_router(admin_router)


@app.get("/", include_in_schema=False)
async def root():
    return {
        "service": settings.APP_NAME,
        "mockEnvironment": True,
        "apiBase": settings.ASSYST_BASE_PATH,
        "docs": "/docs",
        "health": "/health",
    }
