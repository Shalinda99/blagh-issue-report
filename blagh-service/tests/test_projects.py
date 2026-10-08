"""
Integration tests for /api/v1/projects endpoints.
All project endpoints require a valid admin JWT.
"""
import pytest
from fastapi import status


# ─── POST /api/v1/projects ────────────────────────────────────────────────────

class TestCreateProject:
    def test_requires_auth(self, client):
        response = client.post(
            "/api/v1/projects",
            json={"app_id": "my-app", "name": "My App"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_success(self, client, admin_headers):
        response = client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"app_id": "my-app", "name": "My App"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["app_id"] == "my-app"
        assert data["name"] == "My App"
        assert data["is_active"] is True
        assert "id" in data
        assert "created_at" in data

    def test_create_with_origin_url(self, client, admin_headers):
        response = client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"app_id": "my-app-2", "name": "My App 2", "origin_url": "https://example.com"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["origin_url"] == "https://example.com"

    def test_duplicate_app_id_returns_409(self, client, admin_headers):
        client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"app_id": "dupe-app", "name": "First"},
        )
        response = client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"app_id": "dupe-app", "name": "Second"},
        )
        assert response.status_code == status.HTTP_409_CONFLICT

    def test_invalid_app_id_pattern_returns_422(self, client, admin_headers):
        response = client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"app_id": "Has Spaces!", "name": "Bad"},
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_empty_app_id_returns_422(self, client, admin_headers):
        response = client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"app_id": "", "name": "Bad"},
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_empty_name_returns_422(self, client, admin_headers):
        response = client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"app_id": "good-app", "name": ""},
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_app_id_allows_hyphens_and_underscores(self, client, admin_headers):
        response = client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"app_id": "my_app-v2", "name": "My App v2"},
        )
        assert response.status_code == status.HTTP_201_CREATED


# ─── GET /api/v1/projects ─────────────────────────────────────────────────────

class TestListProjects:
    def test_requires_auth(self, client):
        assert client.get("/api/v1/projects").status_code == status.HTTP_401_UNAUTHORIZED

    def test_empty_returns_list(self, client, admin_headers):
        response = client.get("/api/v1/projects", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_created_project_appears(self, client, admin_headers):
        client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"app_id": "list-test", "name": "List Test"},
        )
        response = client.get("/api/v1/projects", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["app_id"] == "list-test"

    def test_multiple_projects_returned(self, client, admin_headers):
        for i in range(3):
            client.post(
                "/api/v1/projects",
                headers=admin_headers,
                json={"app_id": f"app-{i}", "name": f"App {i}"},
            )
        response = client.get("/api/v1/projects", headers=admin_headers)
        assert len(response.json()) == 3


# ─── GET /api/v1/projects/{app_id} ────────────────────────────────────────────

class TestGetProject:
    def test_requires_auth(self, client):
        assert client.get("/api/v1/projects/any-app").status_code == status.HTTP_401_UNAUTHORIZED

    def test_success(self, client, admin_headers):
        client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"app_id": "get-test", "name": "Get Test"},
        )
        response = client.get("/api/v1/projects/get-test", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["app_id"] == "get-test"

    def test_not_found_returns_404(self, client, admin_headers):
        response = client.get("/api/v1/projects/nonexistent", headers=admin_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ─── PATCH /api/v1/projects/{app_id} ─────────────────────────────────────────

class TestUpdateProject:
    def test_requires_auth(self, client):
        assert (
            client.patch("/api/v1/projects/any-app", json={"name": "New"}).status_code
            == status.HTTP_401_UNAUTHORIZED
        )

    def test_update_name(self, client, admin_headers):
        client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"app_id": "upd-app", "name": "Old Name"},
        )
        response = client.patch(
            "/api/v1/projects/upd-app",
            headers=admin_headers,
            json={"name": "New Name"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "New Name"

    def test_update_is_active_false(self, client, admin_headers):
        client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"app_id": "deact-app", "name": "Deactivate Me"},
        )
        response = client.patch(
            "/api/v1/projects/deact-app",
            headers=admin_headers,
            json={"is_active": False},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["is_active"] is False

    def test_update_origin_url(self, client, admin_headers):
        client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"app_id": "url-app", "name": "URL App"},
        )
        response = client.patch(
            "/api/v1/projects/url-app",
            headers=admin_headers,
            json={"origin_url": "https://neworigin.com"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["origin_url"] == "https://neworigin.com"

    def test_empty_update_returns_unchanged(self, client, admin_headers):
        client.post(
            "/api/v1/projects",
            headers=admin_headers,
            json={"app_id": "noop-app", "name": "No-Op"},
        )
        response = client.patch(
            "/api/v1/projects/noop-app",
            headers=admin_headers,
            json={},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "No-Op"

    def test_not_found_returns_404(self, client, admin_headers):
        response = client.patch(
            "/api/v1/projects/ghost-app",
            headers=admin_headers,
            json={"name": "Ghost"},
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
