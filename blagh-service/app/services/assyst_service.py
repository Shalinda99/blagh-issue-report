"""
Assyst mirroring service.

Every blagh report is mirrored into assyst (the IT service desk) as an
INCIDENT so that assyst remains the single source of truth consumed by the
similarity index. The incident reuses the report's title (summary) and
description, attaches any screenshots, and embeds a deep link back to the
admin UI report page so staff can inspect the full captured metadata
(console logs, failed API calls, recordings).

All operations are best-effort: a mirroring failure must never prevent the
blagh report itself from being persisted. Failures are logged and surfaced
via the returned result dict.
"""

import base64
import logging

import httpx

from app.config import settings
from app.schemas.report import ReportCreate

_logger = logging.getLogger(__name__)

# blagh priority label → assystREST priority code
_PRIORITY_MAP = {
    "critical": "P1",
    "urgent": "P1",
    "high": "P2",
    "medium": "P3",
    "normal": "P3",
    "low": "P4",
}
_DEFAULT_PRIORITY_CODE = "P3"

_EXT_BY_CONTENT_TYPE = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
}


def _map_priority(priority: str | None) -> str:
    """Map a blagh priority label to an assystREST priority code."""
    if not priority:
        return _DEFAULT_PRIORITY_CODE
    return _PRIORITY_MAP.get(priority.strip().lower(), _DEFAULT_PRIORITY_CODE)


def _report_detail_url(ref_id: str) -> str:
    """Build the admin UI deep link for a report's full diagnostics."""
    base = settings.ADMIN_UI_BASE_URL.rstrip("/")
    return f"{base}/reports/{ref_id}"


def _build_remarks(report: dict) -> str:
    """
    Compose the incident remarks: the original description followed by a
    metadata footer. The footer carries the reporter/context summary plus a
    deep link to the admin UI where the full captured metadata (console logs,
    failed API calls, screenshots, recordings) can be reviewed.
    """
    lines: list[str] = [report.get("description") or ""]

    console_count = len(report.get("console_logs") or [])
    failed_api_count = len(report.get("failed_api_calls") or [])
    screenshot_count = len(report.get("screenshot_keys") or [])

    footer: list[str] = [
        "",
        "────────────────────────────────────────",
        "Reported via the Blagh issue widget.",
        f"Reference: {report.get('ref_id')}",
    ]

    reporter_bits = [
        report.get("user_name"),
        f"<{report.get('user_email')}>" if report.get("user_email") else None,
        f"({report.get('user_role')})" if report.get("user_role") else None,
    ]
    reporter = " ".join(b for b in reporter_bits if b)
    if reporter:
        footer.append(f"Reporter: {reporter}")

    if report.get("page_url"):
        footer.append(f"Page: {report['page_url']}")
    if report.get("page_title"):
        footer.append(f"Page title: {report['page_title']}")

    env_bits = [report.get("browser"), report.get("os"), report.get("device")]
    env = " / ".join(b for b in env_bits if b)
    if env:
        footer.append(f"Environment: {env}")

    footer.append(
        f"Captured diagnostics: {console_count} console log(s), "
        f"{failed_api_count} failed API call(s), {screenshot_count} screenshot(s)."
    )
    footer.append("")
    footer.append(
        "Full diagnostics (console logs, failed API calls, screenshots, recordings):"
    )
    footer.append(_report_detail_url(report.get("ref_id", "")))

    return "\n".join(lines + footer)


def _decode_data_url(data_url: str) -> tuple[bytes, str, str]:
    """
    Decode a base64 data URL into (raw_bytes, content_type, filename).
    Raises ValueError if the data URL is malformed.
    """
    if "," in data_url:
        header, encoded = data_url.split(",", 1)
        content_type = (
            header.split(":")[1].split(";")[0]
            if ":" in header
            else "application/octet-stream"
        )
    else:
        encoded = data_url
        content_type = "application/octet-stream"

    raw = base64.b64decode(encoded)
    ext = _EXT_BY_CONTENT_TYPE.get(content_type, content_type.split("/")[-1] or "bin")
    return raw, content_type, f"screenshot.{ext}"


def mirror_report_to_assyst(report: dict, payload: ReportCreate) -> dict | None:
    """
    Mirror a persisted blagh report into assyst as an INCIDENT.

    Returns a dict with the created assyst event's `id` and `ref` on success,
    or None if mirroring is disabled or fails. Never raises — this is a
    best-effort side effect of report creation.
    """
    if not settings.ASSYST_MIRROR_ENABLED:
        return None

    base_url = settings.ASSYST_BASE_URL.rstrip("/")
    auth = httpx.BasicAuth(settings.ASSYST_USERNAME, settings.ASSYST_PASSWORD)
    ref_id = report.get("ref_id")

    body = {
        "eventType": settings.ASSYST_EVENT_TYPE,
        "shortDescription": report.get("summary") or "(no summary)",
        "remarks": _build_remarks(report),
        "priorityCode": _map_priority(report.get("priority")),
    }

    try:
        with httpx.Client(timeout=settings.ASSYST_TIMEOUT_SECONDS, auth=auth) as client:
            resp = client.post(f"{base_url}/assystREST/v2/events", json=body)
            resp.raise_for_status()
            event = resp.json()
            event_id = event.get("id")
            event_ref = event.get("eventRef")

            if event_id is not None:
                _attach_screenshots(client, base_url, event_id, payload)

        _logger.info(
            "Mirrored report %s into assyst incident %s (id=%s).",
            ref_id, event_ref, event_id,
        )
        return {"id": event_id, "ref": event_ref}
    except Exception:
        _logger.exception("Failed to mirror report %s into assyst.", ref_id)
        return None


def _attach_screenshots(
    client: httpx.Client, base_url: str, event_id: int, payload: ReportCreate
) -> None:
    """Upload each report screenshot as an assyst event attachment (best-effort)."""
    for index, data_url in enumerate(payload.diagnostics.screenshots or [], start=1):
        try:
            raw, content_type, filename = _decode_data_url(data_url)
            filename = f"screenshot-{index}{filename[filename.rfind('.'):]}"
            client.post(
                f"{base_url}/assystREST/v2/events/{event_id}/attachments",
                files={"file": (filename, raw, content_type)},
            ).raise_for_status()
        except Exception:
            _logger.warning(
                "Skipped mirroring screenshot %d for assyst event %s.", index, event_id
            )
