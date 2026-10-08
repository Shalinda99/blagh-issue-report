"""
Similarity Check Index — FastAPI entry point.

An isolated microservice that pulls recently reported incidents from the mock
IFS assyst API, stores them in a vector DB (ChromaDB) + relational DB (SQLite),
and surfaces duplicate / similar incidents. (Issues reported through blagh are
mirrored into assyst, so assyst is the single source of truth.)
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import settings

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Isolated similarity / de-duplication index over IFS assyst incidents."
    ),
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health", tags=["health"])
def health() -> dict:
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "embedder": settings.EMBEDDER,
    }


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"service": settings.APP_NAME, "docs": "/docs"}
