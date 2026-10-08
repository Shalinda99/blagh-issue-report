"""
Integration tests for /api/v1/consents endpoints.
These are public endpoints — no admin auth required.
"""
import pytest
from fastapi import status


_CONSENT_PAYLOAD = {
    "user_email": "user@example.com",
    "user_id": "U001",
    "user_name": "Test User",
    "project_id": "my-project",
    "consented": True,
    "user_agent": "Mozilla/5.0",
}


# ─── GET /api/v1/consents ─────────────────────────────────────────────────────

class TestCheckConsent:
    def test_no_existing_consent_returns_false(self, client):
        response = client.get(
            "/api/v1/consents",
            params={"user_email": "nobody@example.com", "project_id": "proj-x"},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["consented"] is False
        assert data["consented_at"] is None

    def test_after_record_returns_true(self, client):
        client.post("/api/v1/consents", json=_CONSENT_PAYLOAD)
        response = client.get(
            "/api/v1/consents",
            params={"user_email": "user@example.com", "project_id": "my-project"},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["consented"] is True
        assert data["consented_at"] is not None

    def test_missing_user_email_returns_422(self, client):
        response = client.get("/api/v1/consents", params={"project_id": "proj-x"})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_missing_project_id_returns_422(self, client):
        response = client.get(
            "/api/v1/consents",
            params={"user_email": "user@example.com"},
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_different_project_returns_false(self, client):
        client.post("/api/v1/consents", json=_CONSENT_PAYLOAD)
        response = client.get(
            "/api/v1/consents",
            params={"user_email": "user@example.com", "project_id": "different-project"},
        )
        assert response.json()["consented"] is False


# ─── POST /api/v1/consents ────────────────────────────────────────────────────

class TestRecordConsent:
    def test_success_returns_201(self, client):
        response = client.post("/api/v1/consents", json=_CONSENT_PAYLOAD)
        assert response.status_code == status.HTTP_201_CREATED

    def test_response_contains_required_fields(self, client):
        response = client.post("/api/v1/consents", json=_CONSENT_PAYLOAD)
        data = response.json()
        assert "id" in data
        assert data["consented"] is True
        assert data["user_email"] == "user@example.com"
        assert data["project_id"] == "my-project"
        assert "consented_at" in data

    def test_upsert_updates_existing_record(self, client):
        client.post("/api/v1/consents", json=_CONSENT_PAYLOAD)
        updated = {**_CONSENT_PAYLOAD, "consented": False}
        response = client.post("/api/v1/consents", json=updated)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["consented"] is False

    def test_upsert_returns_same_id(self, client):
        resp1 = client.post("/api/v1/consents", json=_CONSENT_PAYLOAD)
        resp2 = client.post("/api/v1/consents", json=_CONSENT_PAYLOAD)
        assert resp1.json()["id"] == resp2.json()["id"]

    def test_with_x_project_id_header_overrides_payload(self, client):
        response = client.post(
            "/api/v1/consents",
            json=_CONSENT_PAYLOAD,
            headers={"X-Project-ID": "override-project"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["project_id"] == "override-project"

    def test_consent_with_only_user_id_no_email(self, client):
        payload = {
            "user_id": "anon-user-99",
            "project_id": "anon-project",
            "consented": True,
        }
        response = client.post("/api/v1/consents", json=payload)
        assert response.status_code == status.HTTP_201_CREATED

    def test_missing_both_email_and_id_returns_422(self, client):
        payload = {"project_id": "my-project", "consented": True}
        response = client.post("/api/v1/consents", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_missing_project_id_returns_422(self, client):
        payload = {"user_email": "user@example.com", "consented": True}
        response = client.post("/api/v1/consents", json=payload)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_consent_false_is_recorded(self, client):
        payload = {**_CONSENT_PAYLOAD, "consented": False}
        response = client.post("/api/v1/consents", json=payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["consented"] is False

    def test_upsert_by_user_id_only(self, client):
        payload_1 = {"user_id": "uid-1", "project_id": "proj-1", "consented": True}
        payload_2 = {"user_id": "uid-1", "project_id": "proj-1", "consented": False}
        r1 = client.post("/api/v1/consents", json=payload_1)
        r2 = client.post("/api/v1/consents", json=payload_2)
        assert r1.json()["id"] == r2.json()["id"]
        assert r2.json()["consented"] is False
