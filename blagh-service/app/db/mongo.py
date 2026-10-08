"""
MongoDB connection management.

Provides a module-level singleton MongoClient and helper functions
for obtaining a database handle and bootstrapping collection indexes
on startup.
"""

from pymongo import ASCENDING, MongoClient
from pymongo.database import Database

from app.config import settings

_client: MongoClient | None = None


def get_client() -> MongoClient:
    """Return (or lazily create) the shared MongoClient singleton."""
    global _client
    if _client is None:
        _client = MongoClient(settings.MONGODB_URL)
    return _client


def get_database() -> Database:
    """Return the application database from the shared client."""
    return get_client()[settings.MONGODB_DB_NAME]


def init_indexes() -> None:
    """
    Create all required indexes. Safe to call on every startup —
    MongoDB ignores index creation requests for indexes that already exist.
    """
    db = get_database()

    db.projects.create_index("app_id", unique=True)
    db.projects.create_index([("created_at", ASCENDING)])

    db.reports.create_index("ref_id", unique=True)
    db.reports.create_index([("project_id", ASCENDING)])
    db.reports.create_index([("status", ASCENDING)])
    db.reports.create_index([("user_email", ASCENDING)])
    db.reports.create_index([("created_at", ASCENDING)])

    db.user_consents.create_index(
        [("user_email", ASCENDING), ("project_id", ASCENDING)]
    )
    db.user_consents.create_index(
        [("user_id", ASCENDING), ("project_id", ASCENDING)]
    )


def close_client() -> None:
    """Close the shared MongoClient (called on application shutdown)."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
