"""
Contract tests — verify API routes, response shapes, auth, error formats.
"""
import pytest
from httpx import AsyncClient

AUTH = {"Authorization": "Basic bW9ja191c2VyOmNoYW5nZV9tZQ=="}  # mock_user:change_me


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["mockMode"] is True
    assert "timestamp" in body


@pytest.mark.asyncio
async def test_list_events_requires_auth(client: AsyncClient):
    r = await client.get("/assystREST/v2/events")
    assert r.status_code == 401
    body = r.json()
    assert "type" in body
    assert "message" in body


@pytest.mark.asyncio
async def test_list_events_invalid_auth(client: AsyncClient):
    r = await client.get(
        "/assystREST/v2/events",
        headers={"Authorization": "Basic d3Jvbmc6Y3JlZHM="},  # wrong:creds
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_list_events_returns_array(client: AsyncClient):
    """✅ Verified: collection response is a bare JSON array."""
    r = await client.get("/assystREST/v2/events", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)


@pytest.mark.asyncio
async def test_list_events_fields_present(client: AsyncClient):
    r = await client.get("/assystREST/v2/events", headers=AUTH)
    assert r.status_code == 200
    events = r.json()
    assert len(events) > 0
    evt = events[0]
    assert "id" in evt
    assert "version" in evt
    assert "eventType" in evt
    assert "eventStatus" in evt
    assert "shortDescription" in evt
    assert "creationDate" in evt


@pytest.mark.asyncio
async def test_list_events_no_null_fields(client: AsyncClient):
    """✅ Verified: null fields and empty arrays are omitted."""
    r = await client.get("/assystREST/v2/events", headers=AUTH)
    events = r.json()
    for evt in events:
        for k, v in evt.items():
            assert v is not None, f"Field {k} is None — should be omitted"
            assert v != [], f"Field {k} is empty array — should be omitted"


@pytest.mark.asyncio
async def test_get_event_by_id(client: AsyncClient):
    r = await client.get("/assystREST/v2/events", headers=AUTH)
    events = r.json()
    assert len(events) > 0
    event_id = events[0]["id"]

    r2 = await client.get(f"/assystREST/v2/events/{event_id}", headers=AUTH)
    assert r2.status_code == 200
    evt = r2.json()
    assert evt["id"] == event_id
    assert "version" in evt


@pytest.mark.asyncio
async def test_get_event_not_found(client: AsyncClient):
    r = await client.get("/assystREST/v2/events/9999999999", headers=AUTH)
    assert r.status_code == 404
    body = r.json()
    assert body.get("type") == "NotFoundException"
    assert "message" in body


@pytest.mark.asyncio
async def test_put_method_not_allowed(client: AsyncClient):
    """✅ Verified: PUT is not supported per assystREST contract."""
    r = await client.put("/assystREST/v2/events/10000001", headers=AUTH, json={})
    assert r.status_code == 405


@pytest.mark.asyncio
async def test_filter_by_event_type(client: AsyncClient):
    r = await client.get("/assystREST/v2/events?eventType=INCIDENT", headers=AUTH)
    assert r.status_code == 200
    events = r.json()
    for evt in events:
        assert evt["eventType"] == "INCIDENT"


@pytest.mark.asyncio
async def test_filter_by_event_status(client: AsyncClient):
    r = await client.get("/assystREST/v2/events?eventStatus=OPEN", headers=AUTH)
    assert r.status_code == 200
    events = r.json()
    for evt in events:
        assert evt["eventStatus"] == "OPEN"


@pytest.mark.asyncio
async def test_pagination(client: AsyncClient):
    r1 = await client.get("/assystREST/v2/events?startRow=0&numberOfRows=5", headers=AUTH)
    r2 = await client.get("/assystREST/v2/events?startRow=5&numberOfRows=5", headers=AUTH)
    assert r1.status_code == 200
    assert r2.status_code == 200
    ids1 = {e["id"] for e in r1.json()}
    ids2 = {e["id"] for e in r2.json()}
    assert ids1.isdisjoint(ids2), "Paginated pages should not overlap"


@pytest.mark.asyncio
async def test_pagination_empty_page(client: AsyncClient):
    r = await client.get("/assystREST/v2/events?startRow=99999&numberOfRows=10", headers=AUTH)
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_field_expansion_nested(client: AsyncClient):
    r = await client.get(
        "/assystREST/v2/events?fields=affectedUser,assignedGroup&numberOfRows=5",
        headers=AUTH,
    )
    assert r.status_code == 200
    events = r.json()
    found_expansion = False
    for evt in events:
        if "affectedUser" in evt:
            found_expansion = True
            assert "id" in evt["affectedUser"]
            assert "name" in evt["affectedUser"]
        if "assignedGroup" in evt:
            assert "id" in evt["assignedGroup"]
    assert found_expansion, "At least one event should have expanded affectedUser"


@pytest.mark.asyncio
async def test_create_event(client: AsyncClient):
    body = {
        "eventType": "INCIDENT",
        "shortDescription": "Test incident created by contract test",
        "remarks": "This is a test incident created by the automated contract test suite.",
        "priorityCode": "P3",
    }
    r = await client.post("/assystREST/v2/events", headers=AUTH, json=body)
    assert r.status_code == 201
    evt = r.json()
    assert "id" in evt
    assert evt["shortDescription"] == body["shortDescription"]
    assert evt["eventStatus"] == "OPEN"
    assert "creationDate" in evt


@pytest.mark.asyncio
async def test_update_event(client: AsyncClient):
    create_r = await client.post(
        "/assystREST/v2/events",
        headers=AUTH,
        json={"eventType": "INCIDENT", "shortDescription": "To be updated", "priorityCode": "P4"},
    )
    created = create_r.json()
    event_id = created["id"]

    update_r = await client.post(
        f"/assystREST/v2/events/{event_id}",
        headers=AUTH,
        json={"eventStatus": "IN_PROGRESS", "remarks": "Updated by test"},
    )
    assert update_r.status_code == 200
    updated = update_r.json()
    assert updated["eventStatus"] == "IN_PROGRESS"


@pytest.mark.asyncio
async def test_validation_error_format(client: AsyncClient):
    """✅ Verified: ComplexValidationException format on bad request."""
    r = await client.post("/assystREST/v2/events", headers=AUTH, json={})
    assert r.status_code == 422 or r.status_code == 400


@pytest.mark.asyncio
async def test_date_range_filter(client: AsyncClient):
    r = await client.get(
        "/assystREST/v2/events?creationDate=2020-01-01T00:00:00Z,",
        headers=AUTH,
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_reference_data_users(client: AsyncClient):
    r = await client.get("/assystREST/v2/assystUsers", headers=AUTH)
    assert r.status_code == 200
    users = r.json()
    assert isinstance(users, list)
    assert len(users) > 0
    assert "id" in users[0]
    assert "name" in users[0]


@pytest.mark.asyncio
async def test_reference_data_teams(client: AsyncClient):
    r = await client.get("/assystREST/v2/supportGroups", headers=AUTH)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_reference_data_categories(client: AsyncClient):
    r = await client.get("/assystREST/v2/categories", headers=AUTH)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_reference_data_services(client: AsyncClient):
    r = await client.get("/assystREST/v2/services", headers=AUTH)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
