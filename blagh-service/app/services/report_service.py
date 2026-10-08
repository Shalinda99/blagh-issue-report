"""
Report service — all business logic for creating and querying issue reports.
Backed by MongoDB. Media files (screenshots, voice, video) are stored in MinIO;
only the MinIO object key is persisted in the MongoDB report document.
Diagnostics (console logs, failed API calls) are embedded sub-documents.
"""

import base64
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from io import BytesIO

from bson import ObjectId
from minio import Minio
from pymongo import DESCENDING
from pymongo.database import Database

from app.config import settings
from app.core.exceptions import NotFoundError
from app.schemas.report import ReportCreate
from app.services import assyst_service

_logger = logging.getLogger(__name__)
_MAX_MEDIA_BYTES = 10 * 1024 * 1024  # 10 MB per file

_REF_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

# ─── Projection: exclude heavy fields from list queries ───────────────────────
_LIST_PROJECTION = {
    "screenshot_keys": 0,
    "voice_recording_keys": 0,
    "video_recording_keys": 0,
    "screenshot_ids": 0,        # legacy GridFS field — kept for backward compat
    "voice_recording_ids": 0,   # legacy GridFS field — kept for backward compat
    "video_recording_ids": 0,   # legacy GridFS field — kept for backward compat
    "console_logs": 0,
    "failed_api_calls": 0,
    "description": 0,
}


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _doc_to_dict(doc: dict) -> dict:
    """Convert a MongoDB document to a plain serialisable dict."""
    result = dict(doc)
    result["id"] = str(result.pop("_id"))
    return result


def _generate_ref_id(db: Database) -> str:
    """
    Generate a cryptographically secure reference ID, e.g. REF-A3K9PZ.
    Retries up to 5 times to avoid the extremely unlikely collision.
    """
    for _ in range(5):
        ref_id = "REF-" + "".join(secrets.choice(_REF_ALPHABET) for _ in range(6))
        if not db.reports.find_one({"ref_id": ref_id}, {"_id": 1}):
            return ref_id
    raise RuntimeError("Could not generate a unique ref_id after 5 attempts.")


def _upload_media(minio_client: Minio, data_url: str, prefix: str = "media") -> str:
    """
    Decode a base64 data URL and upload the raw bytes to MinIO.
    Returns the MinIO object key (e.g. 'screenshots/uuid.png').
    Supports images, audio (webm/ogg), and video (webm/mp4).
    """
    if "," in data_url:
        header, encoded = data_url.split(",", 1)
        content_type = (
            header.split(":")[1].split(";")[0] if ":" in header else "application/octet-stream"
        )
    else:
        encoded = data_url
        content_type = "application/octet-stream"

    raw_bytes = base64.b64decode(encoded)
    if len(raw_bytes) > _MAX_MEDIA_BYTES:
        raise ValueError(
            f"Media file exceeds the {_MAX_MEDIA_BYTES // (1024 * 1024)} MB size limit."
        )
    ext = content_type.split("/")[-1].split(";")[0]  # e.g. "webm", "png", "ogg"
    key = f"{prefix}/{uuid.uuid4()}.{ext}"
    minio_client.put_object(
        settings.MINIO_BUCKET,
        key,
        BytesIO(raw_bytes),
        length=len(raw_bytes),
        content_type=content_type,
    )
    scheme = "https" if settings.MINIO_SECURE else "http"
    return f"{scheme}://{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET}/{key}"


def _get_media_url(minio_client: Minio, url_or_key: str) -> str:
    """
    Generate a presigned GET URL for the given MinIO object.
    Accepts either a full MinIO URL (http://host/bucket/key) or a bare key.
    The URL is valid for MINIO_PRESIGN_EXPIRES_HOURS hours.
    Returns an empty string if URL generation fails.
    """
    bucket_prefix = f"/{settings.MINIO_BUCKET}/"
    if bucket_prefix in url_or_key:
        key = url_or_key.split(bucket_prefix, 1)[1]
    else:
        key = url_or_key
    try:
        return minio_client.presigned_get_object(
            settings.MINIO_BUCKET,
            key,
            expires=timedelta(hours=settings.MINIO_PRESIGN_EXPIRES_HOURS),
        )
    except Exception:
        _logger.exception("Failed to generate presigned URL for MinIO key %s", key)
        return ""


# ─── Public service functions ─────────────────────────────────────────────────

def create_report(db: Database, payload: ReportCreate, minio_client: Minio) -> dict:
    """
    Persist a new report document. Media files (screenshots, voice, video) are
    uploaded to MinIO; only the object key is stored in MongoDB.
    Console logs and failed API calls are embedded sub-documents.
    Returns the created report as a plain dict.
    """
    now = datetime.now(timezone.utc)

    screenshot_keys: list[str] = []
    for data_url in payload.diagnostics.screenshots or []:
        try:
            screenshot_keys.append(_upload_media(minio_client, data_url, "screenshots"))
        except Exception:
            _logger.warning("Skipped a screenshot — upload failed or data URL malformed.")

    voice_recording_keys: list[str] = []
    for data_url in payload.diagnostics.voice_recordings or []:
        try:
            voice_recording_keys.append(_upload_media(minio_client, data_url, "voice"))
        except Exception:
            _logger.warning("Skipped a voice recording — upload failed or data URL malformed.")

    video_recording_keys: list[str] = []
    for data_url in payload.diagnostics.video_recordings or []:
        try:
            video_recording_keys.append(_upload_media(minio_client, data_url, "videos"))
        except Exception:
            _logger.warning("Skipped a video recording — upload failed or data URL malformed.")

    console_logs = [
        {
            "id": str(ObjectId()),
            "level": log.level,
            "message": log.message,
            "source": log.source or None,
            "line_number": log.line_number,
            "captured_at": log.timestamp or None,
        }
        for log in (payload.diagnostics.console_errors + payload.diagnostics.console_warnings)
    ]

    failed_api_calls = [
        {
            "id": str(ObjectId()),
            "url": call.url,
            "method": call.method.upper(),
            "status_code": call.status_code,
            "status_text": call.status_text or None,
            "duration_ms": call.duration_ms,
            "captured_at": call.timestamp or None,
        }
        for call in payload.diagnostics.failed_api_calls
    ]

    doc = {
        "ref_id": _generate_ref_id(db),
        "project_id": payload.project_id,
        "summary": payload.summary,
        "description": payload.description,
        "priority": payload.priority,
        "category": None,
        "status": "open",
        "user_id": payload.who.user_id or None,
        "user_name": payload.who.user_name or None,
        "user_email": payload.who.user_email or None,
        "user_role": payload.who.user_role or None,
        "user_agent": payload.who.user_agent or None,
        "page_url": payload.where.url or None,
        "page_title": payload.where.page_title or None,
        "referrer": payload.where.referrer or None,
        "browser": payload.where.browser or None,
        "os": payload.where.os or None,
        "device": payload.where.device or None,
        "viewport": payload.where.viewport or None,
        "screen_resolution": payload.where.screen_resolution or None,
        "reported_at_utc": payload.when.utc_timestamp or None,
        "reported_at_local": payload.when.local_timestamp or None,
        "timezone": payload.when.timezone or None,
        "screenshot_keys": screenshot_keys,
        "voice_recording_keys": voice_recording_keys,
        "video_recording_keys": video_recording_keys,
        "console_logs": console_logs,
        "failed_api_calls": failed_api_calls,
        "assyst_event_id": None,
        "assyst_event_ref": None,
        "created_at": now,
        "updated_at": now,
    }

    result = db.reports.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Mirror the report into assyst as an INCIDENT (best-effort — a failure here
    # must never prevent the report from being saved).
    mirror = assyst_service.mirror_report_to_assyst(doc, payload)
    if mirror:
        doc["assyst_event_id"] = mirror.get("id")
        doc["assyst_event_ref"] = mirror.get("ref")
        db.reports.update_one(
            {"_id": result.inserted_id},
            {"$set": {
                "assyst_event_id": doc["assyst_event_id"],
                "assyst_event_ref": doc["assyst_event_ref"],
            }},
        )

    return _doc_to_dict(doc)


def get_report_by_ref(db: Database, ref_id: str, minio_client: Minio) -> dict:
    """
    Return full report details including presigned MinIO URLs for all media.
    """
    doc = db.reports.find_one({"ref_id": ref_id})
    if not doc:
        raise NotFoundError("Report", ref_id)
    result = _doc_to_dict(doc)
    result["screenshots"] = [
        _get_media_url(minio_client, key)
        for key in result.pop("screenshot_keys", [])
        if key
    ]
    result["voice_recordings"] = [
        _get_media_url(minio_client, key)
        for key in result.pop("voice_recording_keys", [])
        if key
    ]
    result["video_recordings"] = [
        _get_media_url(minio_client, key)
        for key in result.pop("video_recording_keys", [])
        if key
    ]
    result.pop("screenshot_ids", None)
    result.pop("voice_recording_ids", None)
    result.pop("video_recording_ids", None)
    return result


def get_reports(
    db: Database,
    project_id: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
    created_after: datetime | None = None,
) -> tuple[list[dict], int]:
    """Return a paginated list of report summaries with the total count."""
    query: dict = {}
    if project_id:
        query["project_id"] = project_id
    if status:
        query["status"] = status
    if created_after:
        query["created_at"] = {"$gte": created_after}

    total: int = db.reports.count_documents(query)
    cursor = (
        db.reports.find(query, _LIST_PROJECTION)
        .sort("created_at", DESCENDING)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    return [_doc_to_dict(doc) for doc in cursor], total


def get_reports_by_user(
    db: Database,
    user_email: str,
    project_id: str | None = None,
    limit: int = 10,
) -> list[dict]:
    """Return the most recent reports submitted by a specific user email."""
    query: dict = {"user_email": user_email}
    if project_id:
        query["project_id"] = project_id
    cursor = (
        db.reports.find(query, _LIST_PROJECTION)
        .sort("created_at", DESCENDING)
        .limit(limit)
    )
    return [_doc_to_dict(doc) for doc in cursor]


def update_report_status(db: Database, ref_id: str, status_value: str) -> dict:
    """Update the status field of a report and return the updated document."""
    now = datetime.now(timezone.utc)
    doc = db.reports.find_one_and_update(
        {"ref_id": ref_id},
        {"$set": {"status": status_value, "updated_at": now}},
        projection=_LIST_PROJECTION,
        return_document=True,
    )
    if not doc:
        raise NotFoundError("Report", ref_id)
    return _doc_to_dict(doc)
