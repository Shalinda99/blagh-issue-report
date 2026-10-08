"""
Integration tests — incremental sync, full pagination, duplicate prevention.
"""
import pytest
from httpx import AsyncClient

AUTH = {"Authorization": "Basic bW9ja191c2VyOmNoYW5nZV9tZQ=="}


async def _fetch_all_pages(client: AsyncClient, page_size: int = 5) -> list[dict]:
    """Fetch all events using pagination until empty page."""
    all_events = []
    start = 0
    while True:
        r = await client.get(
            f"/assystREST/v2/events?startRow={start}&numberOfRows={page_size}",
            headers=AUTH,
        )
        assert r.status_code == 200
        page = r.json()
        if not page:
            break
        all_events.extend(page)
        start += page_size
        if len(page) < page_size:
            break
    return all_events


@pytest.mark.asyncio
async def test_full_pagination_no_duplicates(client: AsyncClient):
    """Fetching all pages should produce no duplicate event IDs."""
    all_events = await _fetch_all_pages(client, page_size=5)
    ids = [e["id"] for e in all_events]
    assert len(ids) == len(set(ids)), "Duplicate event IDs found across pagination pages"


@pytest.mark.asyncio
async def test_full_pagination_covers_all_events(client: AsyncClient):
    """All pages combined should return at least the seeded count."""
    all_events = await _fetch_all_pages(client, page_size=10)
    assert len(all_events) >= 20


@pytest.mark.asyncio
async def test_incremental_sync_using_last_modified_date(client: AsyncClient):
    """
    Simulates the Similarity Check Index incremental sync strategy.
    Step 1: Fetch all events (initial sync).
    Step 2: Create a new event (simulates new activity).
    Step 3: Fetch events modified after initial sync start — new event should appear.
    """
    from datetime import datetime, timezone
    cursor = datetime.now(timezone.utc)
    cursor_str = cursor.strftime("%Y-%m-%dT%H:%M:%SZ")

    r = await client.post(
        "/assystREST/v2/events",
        headers=AUTH,
        json={
            "eventType": "INCIDENT",
            "shortDescription": "New incident for incremental sync test",
            "priorityCode": "P3",
        },
    )
    assert r.status_code == 201
    new_id = r.json()["id"]

    r2 = await client.get(
        f"/assystREST/v2/events?lastModifiedDate={cursor_str},&startRow=0&numberOfRows=50",
        headers=AUTH,
    )
    assert r2.status_code == 200
    ids = [e["id"] for e in r2.json()]
    assert new_id in ids, "Newly created event should be returned by incremental sync query"


@pytest.mark.asyncio
async def test_updated_event_appears_in_incremental_sync(client: AsyncClient):
    """Updated events must be returned by a lastModifiedDate filter."""
    from datetime import datetime, timezone, timedelta
    r = await client.get("/assystREST/v2/events?numberOfRows=1", headers=AUTH)
    event_id = r.json()[0]["id"]

    cursor = datetime.now(timezone.utc) - timedelta(seconds=2)
    cursor_str = cursor.strftime("%Y-%m-%dT%H:%M:%SZ")

    await client.post(
        f"/assystREST/v2/events/{event_id}",
        headers=AUTH,
        json={"remarks": "Updated for incremental sync test"},
    )

    r2 = await client.get(
        f"/assystREST/v2/events?lastModifiedDate={cursor_str},&numberOfRows=50",
        headers=AUTH,
    )
    ids = [e["id"] for e in r2.json()]
    assert event_id in ids


@pytest.mark.asyncio
async def test_idempotent_ingestion(client: AsyncClient):
    """Re-fetching the same event by ID should return stable data."""
    r = await client.get("/assystREST/v2/events?numberOfRows=1", headers=AUTH)
    event_id = r.json()[0]["id"]

    r1 = await client.get(f"/assystREST/v2/events/{event_id}", headers=AUTH)
    r2 = await client.get(f"/assystREST/v2/events/{event_id}", headers=AUTH)
    assert r1.json()["id"] == r2.json()["id"]
    assert r1.json()["eventRef"] == r2.json()["eventRef"]


@pytest.mark.asyncio
async def test_status_transition_resolved(client: AsyncClient):
    r = await client.post(
        "/assystREST/v2/events",
        headers=AUTH,
        json={"eventType": "INCIDENT", "shortDescription": "Resolve me", "priorityCode": "P3"},
    )
    event_id = r.json()["id"]

    r2 = await client.post(
        f"/assystREST/v2/events/{event_id}",
        headers=AUTH,
        json={"eventStatus": "RESOLVED", "resolutionRemarks": "Fixed by restarting service"},
    )
    assert r2.status_code == 200
    updated = r2.json()
    assert updated["eventStatus"] == "RESOLVED"
    assert "resolvedDate" in updated


@pytest.mark.asyncio
async def test_similarity_scenarios_seeded(client: AsyncClient):
    """
    Verify that the seeded data includes incidents with similar descriptions
    (the employee portal login cluster).
    """
    r = await client.get(
        "/assystREST/v2/events?categoryId=201&numberOfRows=25",
        headers=AUTH,
    )
    assert r.status_code == 200
    events = r.json()
    descriptions = [e.get("shortDescription", "").lower() for e in events]
    portal_incidents = [d for d in descriptions if "portal" in d or "login" in d or "staff" in d]
    assert len(portal_incidents) >= 2, "Expected similarity cluster incidents to be seeded"
