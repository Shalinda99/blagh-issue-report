"""
Integration tests for /api/v1/admin endpoints.
Covers: login, report listing/get/status-update.
"""
import pytest
from fastapi import status

from app.config import settings


# ─── /api/v1/admin/login ──────────────────────────────────────────────────────

class TestAdminLogin:
    def test_login_success(self, client):
        response = client.post(
            "/api/v1/admin/login",
            json={"email": settings.INITIAL_ADMIN_EMAIL, "password": settings.INITIAL_ADMIN_PASSWORD},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client):
        response = client.post(
            "/api/v1/admin/login",
            json={"email": settings.INITIAL_ADMIN_EMAIL, "password": "totally_wrong"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_wrong_email(self, client):
        response = client.post(
            "/api/v1/admin/login",
            json={"email": "nobody@example.com", "password": settings.INITIAL_ADMIN_PASSWORD},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_both_wrong(self, client):
        response = client.post(
            "/api/v1/admin/login",
            json={"email": "x@y.com", "password": "bad"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_missing_fields_returns_422(self, client):
        response = client.post("/api/v1/admin/login", json={})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_login_token_is_usable(self, client):
        """The returned token must authenticate subsequent requests."""
        login_resp = client.post(
            "/api/v1/admin/login",
            json={"email": settings.INITIAL_ADMIN_EMAIL, "password": settings.INITIAL_ADMIN_PASSWORD},
        )
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        list_resp = client.get("/api/v1/admin/reports", headers=headers)
        assert list_resp.status_code == status.HTTP_200_OK


# ─── GET /api/v1/admin/reports ────────────────────────────────────────────────

class TestAdminListReports:
    def test_requires_auth(self, client):
        response = client.get("/api/v1/admin/reports")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_invalid_token_rejected(self, client):
        response = client.get(
            "/api/v1/admin/reports",
            headers={"Authorization": "Bearer bad.token.here"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_returns_paginated_structure(self, client, admin_headers):
        response = client.get("/api/v1/admin/reports", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "pages" in data

    def test_empty_db_returns_zero_total(self, client, admin_headers):
        response = client.get("/api/v1/admin/reports", headers=admin_headers)
        assert response.json()["total"] == 0
        assert response.json()["pages"] == 0

    def test_submitted_report_appears_in_list(self, client, admin_headers, submitted_report_ref):
        response = client.get("/api/v1/admin/reports", headers=admin_headers)
        assert response.json()["total"] == 1
        assert response.json()["items"][0]["ref_id"] == submitted_report_ref

    def test_filter_by_project_id(self, client, admin_headers, submitted_report_ref):
        response = client.get(
            "/api/v1/admin/reports",
            headers=admin_headers,
            params={"project_id": "test-app"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["total"] == 1

    def test_filter_by_unknown_project_returns_empty(self, client, admin_headers, submitted_report_ref):
        response = client.get(
            "/api/v1/admin/reports",
            headers=admin_headers,
            params={"project_id": "nonexistent"},
        )
        assert response.json()["total"] == 0

    def test_filter_by_status_open(self, client, admin_headers, submitted_report_ref):
        response = client.get(
            "/api/v1/admin/reports",
            headers=admin_headers,
            params={"status": "open"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["total"] == 1

    def test_filter_by_status_resolved_returns_empty(self, client, admin_headers, submitted_report_ref):
        response = client.get(
            "/api/v1/admin/reports",
            headers=admin_headers,
            params={"status": "resolved"},
        )
        assert response.json()["total"] == 0

    def test_pagination_page_size(self, client, admin_headers):
        response = client.get(
            "/api/v1/admin/reports",
            headers=admin_headers,
            params={"page": 1, "page_size": 5},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 5

    def test_days_zero_disables_date_filter(self, client, admin_headers, submitted_report_ref):
        response = client.get(
            "/api/v1/admin/reports",
            headers=admin_headers,
            params={"days": 0},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["total"] == 1

    def test_days_filter_applied(self, client, admin_headers, submitted_report_ref):
        response = client.get(
            "/api/v1/admin/reports",
            headers=admin_headers,
            params={"days": 14},
        )
        assert response.status_code == status.HTTP_200_OK


# ─── GET /api/v1/admin/reports/{ref_id} ──────────────────────────────────────

class TestAdminGetReport:
    def test_requires_auth(self, client, submitted_report_ref):
        response = client.get(f"/api/v1/admin/reports/{submitted_report_ref}")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_success(self, client, admin_headers, submitted_report_ref):
        response = client.get(
            f"/api/v1/admin/reports/{submitted_report_ref}",
            headers=admin_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["ref_id"] == submitted_report_ref
        assert data["status"] == "open"
        assert "description" in data
        assert "console_logs" in data
        assert "failed_api_calls" in data
        assert "screenshots" in data

    def test_not_found(self, client, admin_headers):
        response = client.get("/api/v1/admin/reports/REF-XXXXXX", headers=admin_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_detail_contains_user_info(self, client, admin_headers, submitted_report_ref):
        response = client.get(
            f"/api/v1/admin/reports/{submitted_report_ref}",
            headers=admin_headers,
        )
        data = response.json()
        assert data["user_email"] == "test@example.com"


# ─── PATCH /api/v1/admin/reports/{ref_id}/status ─────────────────────────────

class TestAdminUpdateStatus:
    def test_requires_auth(self, client, submitted_report_ref):
        response = client.patch(
            f"/api/v1/admin/reports/{submitted_report_ref}/status",
            params={"value": "resolved"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.parametrize("new_status", ["in_progress", "resolved", "closed", "duplicate"])
    def test_valid_status_transitions(self, client, admin_headers, submitted_report_ref, new_status):
        response = client.patch(
            f"/api/v1/admin/reports/{submitted_report_ref}/status",
            headers=admin_headers,
            params={"value": new_status},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == new_status

    def test_invalid_status_returns_422(self, client, admin_headers, submitted_report_ref):
        response = client.patch(
            f"/api/v1/admin/reports/{submitted_report_ref}/status",
            headers=admin_headers,
            params={"value": "nonsense_status"},
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_not_found_returns_404(self, client, admin_headers):
        response = client.patch(
            "/api/v1/admin/reports/REF-XXXXXX/status",
            headers=admin_headers,
            params={"value": "resolved"},
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_missing_value_param_returns_422(self, client, admin_headers, submitted_report_ref):
        response = client.patch(
            f"/api/v1/admin/reports/{submitted_report_ref}/status",
            headers=admin_headers,
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
