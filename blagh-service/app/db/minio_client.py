"""
MinIO object-storage client singleton.

Provides a lazily-initialised Minio client and a startup helper
that ensures the application bucket exists before the first upload.
"""

import logging

from minio import Minio

from app.config import settings

_logger = logging.getLogger(__name__)

_client: Minio | None = None


def get_minio_client() -> Minio:
    """Return (or lazily create) the shared Minio client singleton."""
    global _client
    if _client is None:
        _client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
    return _client


def ensure_bucket_exists() -> None:
    """
    Create the application bucket if it does not already exist.
    Safe to call on every startup — MinIO ignores requests for buckets
    that already exist.
    """
    client = get_minio_client()
    if not client.bucket_exists(settings.MINIO_BUCKET):
        client.make_bucket(settings.MINIO_BUCKET)
        _logger.info("Created MinIO bucket: %s", settings.MINIO_BUCKET)
    else:
        _logger.info("MinIO bucket already exists: %s", settings.MINIO_BUCKET)
