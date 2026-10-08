"""
Integration tests for the report submission endpoint.
"""

from fastapi import status

VALID_PAYLOAD = {
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
        "console_errors": [
            {
                "level": "error",
                "message": "Uncaught TypeError: Cannot read properties of undefined",
                "source": "dashboard.js",
                "line_number": 42,
                "timestamp": "2026-09-11T06:29:58Z",
            }
        ],
        "console_warnings": [],
        "failed_api_calls": [
            {
                "url": "https://api.internal/v1/session",
                "method": "GET",
                "status_code": 503,
                "status_text": "Service Unavailable",
                "duration_ms": 5021,
                "timestamp": "2026-09-11T06:29:59Z",
            }
        ],
    },
}


def test_submit_report_returns_201(client):
    response = client.post("/api/v1/reports", json=VALID_PAYLOAD)
    assert response.status_code == status.HTTP_201_CREATED


def test_submit_report_response_contains_ref_id(client):
    response = client.post("/api/v1/reports", json=VALID_PAYLOAD)
    data = response.json()
    assert "ref_id" in data
    assert data["ref_id"].startswith("REF-")


def test_submit_report_status_is_open(client):
    response = client.post("/api/v1/reports", json=VALID_PAYLOAD)
    data = response.json()
    assert data["status"] == "open"


def test_submit_report_missing_summary_returns_422(client):
    payload = {**VALID_PAYLOAD, "summary": ""}
    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_submit_report_missing_description_returns_422(client):
    payload = {**VALID_PAYLOAD, "description": ""}
    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_submit_report_with_x_project_id_header(client):
    payload = {**VALID_PAYLOAD, "project_id": "test-app"}
    response = client.post(
        "/api/v1/reports",
        json=payload,
        headers={"X-Project-ID": "test-app"},
    )
    assert response.status_code == status.HTTP_201_CREATED


def test_submit_report_without_diagnostics(client):
    payload = {**VALID_PAYLOAD}
    payload.pop("diagnostics")
    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == status.HTTP_201_CREATED


def test_submit_report_without_optional_priority(client):
    payload = {**VALID_PAYLOAD, "priority": None}
    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == status.HTTP_201_CREATED


def test_health_check(client):
    response = client.get("/")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "ok"


# ─── GET /api/v1/reports ──────────────────────────────────────────────────────

def test_get_my_reports_requires_user_email(client):
    response = client.get("/api/v1/reports")
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_get_my_reports_returns_list(client):
    client.post("/api/v1/reports", json=VALID_PAYLOAD)
    response = client.get(
        "/api/v1/reports",
        params={"user_email": "test@example.com"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["user_email"] == "test@example.com"


def test_get_my_reports_empty_for_unknown_user(client):
    client.post("/api/v1/reports", json=VALID_PAYLOAD)
    response = client.get(
        "/api/v1/reports",
        params={"user_email": "nobody@example.com"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []


def test_get_my_reports_filtered_by_project(client):
    client.post("/api/v1/reports", json=VALID_PAYLOAD)
    response = client.get(
        "/api/v1/reports",
        params={"user_email": "test@example.com", "project_id": "test-app"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) == 1


def test_get_my_reports_filtered_by_project_no_match(client):
    client.post("/api/v1/reports", json=VALID_PAYLOAD)
    response = client.get(
        "/api/v1/reports",
        params={"user_email": "test@example.com", "project_id": "other-app"},
    )
    assert response.json() == []


def test_get_my_reports_with_x_project_id_header(client):
    client.post("/api/v1/reports", json=VALID_PAYLOAD)
    response = client.get(
        "/api/v1/reports",
        params={"user_email": "test@example.com"},
        headers={"X-Project-ID": "test-app"},
    )
    assert response.status_code == status.HTTP_200_OK


def test_get_my_reports_limit_respected(client):
    for _ in range(5):
        client.post("/api/v1/reports", json=VALID_PAYLOAD)
    response = client.get(
        "/api/v1/reports",
        params={"user_email": "test@example.com", "limit": 3},
    )
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) <= 3


# ─── Validation edge cases ────────────────────────────────────────────────────

def test_submit_report_description_too_long_returns_422(client):
    payload = {**VALID_PAYLOAD, "description": "x" * 10001}
    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_submit_report_summary_too_long_returns_422(client):
    payload = {**VALID_PAYLOAD, "summary": "x" * 501}
    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_submit_report_project_id_too_long_returns_422(client):
    payload = {**VALID_PAYLOAD, "project_id": "x" * 101}
    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# ─── Diagnostics embedding ────────────────────────────────────────────────────

def test_submit_report_with_console_errors(client):
    response = client.post("/api/v1/reports", json=VALID_PAYLOAD)
    assert response.status_code == status.HTTP_201_CREATED


def test_submit_report_with_failed_api_calls(client):
    response = client.post("/api/v1/reports", json=VALID_PAYLOAD)
    assert response.status_code == status.HTTP_201_CREATED


def test_submit_report_with_screenshot_base64(client):
    import base64
    tiny_png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00"
        b"\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18"
        b"\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    data_url = "data:image/png;base64," + base64.b64encode(tiny_png).decode()
    payload = {
        **VALID_PAYLOAD,
        "diagnostics": {**VALID_PAYLOAD.get("diagnostics", {}), "screenshots": [data_url]},
    }
    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == status.HTTP_201_CREATED


def test_submit_report_screenshot_oversized_is_skipped(client):
    """Screenshots exceeding the 10 MB limit should be skipped, not crash the request."""
    import base64
    oversized = base64.b64encode(b"x" * (11 * 1024 * 1024)).decode()
    data_url = f"data:image/png;base64,{oversized}"
    payload = {
        **VALID_PAYLOAD,
        "diagnostics": {"screenshots": [data_url], "console_errors": [], "console_warnings": [], "failed_api_calls": []},
    }
    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == status.HTTP_201_CREATED


# ─── Inactive project ─────────────────────────────────────────────────────────

def test_submit_report_to_inactive_project_returns_403(client, admin_headers):
    from tests.conftest import _BASE_REPORT_PAYLOAD
    client.post(
        "/api/v1/projects",
        headers=admin_headers,
        json={"app_id": "inactive-app", "name": "Inactive App"},
    )
    client.patch(
        "/api/v1/projects/inactive-app",
        headers=admin_headers,
        json={"is_active": False},
    )
    payload = {**VALID_PAYLOAD, "project_id": "inactive-app"}
    response = client.post("/api/v1/reports", json=payload)
    assert response.status_code == status.HTTP_403_FORBIDDEN
