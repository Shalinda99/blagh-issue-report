from collections.abc import Generator

from minio import Minio
from pymongo.database import Database

from app.db.minio_client import get_minio_client
from app.db.mongo import get_database


def get_db() -> Generator[Database, None, None]:
    """
    FastAPI dependency — yields the shared MongoDB Database handle.

    Usage:
        @router.get("/example")
        def example(db: Database = Depends(get_db)):
            ...
    """
    yield get_database()


def get_minio() -> Generator[Minio, None, None]:
    """
    FastAPI dependency — yields the shared MinIO client for object storage
    (screenshots, voice recordings, video recordings).

    Usage:
        @router.post("/example")
        def example(minio_client: Minio = Depends(get_minio)):
            ...
    """
    yield get_minio_client()
