"""
Connector for the mock IFS assyst REST API.

Pulls recent incidents via the verified assystREST contract:
  GET /assystREST/v2/events?eventType=INCIDENT
      &creationDate=<from>,<to>
      &fields=affectedUser,assignedGroup,service,category
      &startRow=&numberOfRows=

Basic Auth is used (mock_user:change_me by default). Results are a bare JSON
array. Each event is mapped into a `CanonicalIssue`.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.config import settings
from app.models import CanonicalIssue

_logger = logging.getLogger(__name__)

_EXPAND_FIELDS = "affectedUser,assignedGroup,assignedTech,service,category,subCategory"


class AssystConnector:
    def __init__(
        self,
        base_url: str | None = None,
        username: str | None = None,
        password: str | None = None,
        event_type: str | None = None,
    ) -> None:
        self.base_url = (base_url or settings.ASSYST_BASE_URL).rstrip("/")
        self.username = username or settings.ASSYST_USERNAME
        self.password = password or settings.ASSYST_PASSWORD
        self.event_type = event_type or settings.ASSYST_EVENT_TYPE

    def fetch(self, days: int) -> list[CanonicalIssue]:
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=days)
        creation_range = f"{_iso(start)},{_iso(now)}"

        issues: list[CanonicalIssue] = []
        page_size = min(settings.FETCH_PAGE_SIZE, 100)
        start_row = 0
        with httpx.Client(
            timeout=30.0, auth=httpx.BasicAuth(self.username, self.password)
        ) as client:
            while True:
                params: dict[str, Any] = {
                    "eventType": self.event_type,
                    "creationDate": creation_range,
                    "fields": _EXPAND_FIELDS,
                    "startRow": start_row,
                    "numberOfRows": page_size,
                    "sortField": "creationDate",
                    "sortOrder": "desc",
                }
                resp = client.get(
                    f"{self.base_url}/assystREST/v2/events", params=params
                )
                resp.raise_for_status()
                events = resp.json()
                if not isinstance(events, list):
                    events = events.get("items", []) if isinstance(events, dict) else []
                for ev in events:
                    issues.append(self._to_canonical(ev))
                if len(events) < page_size:
                    break
                start_row += page_size
        _logger.info("assyst connector fetched %d events (last %d days)", len(issues), days)
        return issues

    @staticmethod
    def _to_canonical(ev: dict[str, Any]) -> CanonicalIssue:
        category = ev.get("category") or {}
        affected = ev.get("affectedUser") or {}
        return CanonicalIssue(
            source="assyst",
            source_id=str(ev.get("id")),
            ref=ev.get("eventRef"),
            title=ev.get("shortDescription") or "",
            body=ev.get("remarks") or ev.get("shortDescription") or "",
            priority=ev.get("priorityCode"),
            category=category.get("name") if isinstance(category, dict) else None,
            status=ev.get("eventStatus"),
            reporter=affected.get("name") or affected.get("email")
            if isinstance(affected, dict)
            else None,
            url=None,
            created_at=ev.get("creationDate"),
            raw=ev,
        )


def _iso(dt: datetime) -> str:
    """assystREST expects ISO 8601 UTC with a trailing Z."""
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
