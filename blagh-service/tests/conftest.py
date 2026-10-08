"""
Test fixtures — uses mongomock for an in-memory MongoDB and a FakeMinioClient
for object storage so tests run without any external service dependency.
"""

import mongomock
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.core.security import create_access_token
from app.db.session import get_db, get_minio
from app.main import app


class FakeMinioClient:
    """
    In-memory MinIO substitute for tests.

    Implements the subset of the Minio client interface used by report_service:
      - put_object(bucket, key, data, length, content_type)
      - presigned_get_object(bucket, key, expires)
    """

    def __init__(self) -> None:
        self._objects: dict[str, dict] = {}

    def put_object(
        self,
        bucket_name: str,
        object_name: str,
        data: object,
        length: int,
        content_type: str = "application/octet-stream",
        **kwargs: object,
    ) -> None:
        self._objects[object_name] = {
            "data": data.read() if hasattr(data, "read") else data,
            "content_type": content_type,
        }

    def presigned_get_object(
        self,
        bucket_name: str,
        object_name: str,
        expires: object = None,
        **kwargs: object,
    ) -> str:
        return f"http://localhost:9000/{bucket_name}/{object_name}?token=test"


def _make_mock_db():
    """Return a fresh mongomock database with the required indexes."""
    client = mongomock.MongoClient()
    db = client["test_csi"]
    db.projects.create_index("app_id", unique=True)
    db.reports.create_index("ref_id", unique=True)
    return db


@pytest.fixture(autouse=True)
def override_dependencies():
    """
    Replace the real MongoDB and MinIO dependencies with in-memory substitutes
    for the duration of each test, then restore originals.
    """
    mock_db = _make_mock_db()
    mock_minio = FakeMinioClient()

    def _get_db():
        yield mock_db

    def _get_minio():
        yield mock_minio

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[get_minio] = _get_minio
    yield
    app.dependency_overrides.clear()


@pytest.fixture()
def client(override_dependencies):
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def admin_token() -> str:
    """Return a valid admin JWT signed with the current SECRET_KEY."""
    return create_access_token(subject=settings.INITIAL_ADMIN_EMAIL)


@pytest.fixture()
def admin_headers(admin_token) -> dict:
    """Return HTTP headers carrying a valid admin Bearer token."""
    return {"Authorization": f"Bearer {admin_token}"}


_BASE_REPORT_PAYLOAD: dict = {
    "project_id": "test-app",
    "summary": "Login button not responding on dashboard",
    "description": "After clicking the login button nothing happens. No error shown.",
    "priority": "High",
    "who": {
        "user_id": "U001",
        "user_name": "Test User",
        "user_email": "test@example.com",
        "user_role": "Manager",
        "user_agent": "Mozilla/5.0 (Test)",
    },
    "where": {
        "url": "http://localhost:5174/dashboard",
        "page_title": "Dashboard",
        "referrer": "",
        "browser": "Chrome 128",
        "os": "Windows",
        "device": "desktop",
        "viewport": "1920x1080",
        "screen_resolution": "1920x1080",
    },
    "when": {
        "utc_timestamp": "2026-09-11T06:30:00Z",
        "local_timestamp": "11/09/2026, 12:00:00",
        "timezone": "Asia/Kolkata",
    },
    "diagnostics": {
        "console_errors": [],
        "console_warnings": [],
        "failed_api_calls": [],
    },
}


@pytest.fixture()
def submitted_report_ref(client) -> str:
    """Submit one report and return its ref_id."""
    resp = client.post("/api/v1/reports", json=_BASE_REPORT_PAYLOAD)
    assert resp.status_code == 201
    return resp.json()["ref_id"]
