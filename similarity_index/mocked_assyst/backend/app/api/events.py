"""
assystREST-compatible event endpoints.
Base path: /assystREST/v2/events

✅ Verified routes: GET /events, GET /events/{id}, POST /events, POST /events/{id}, DELETE /events/{id}
⚠️ Pagination params (startRow, numberOfRows) are provisional.
"""
from __future__ import annotations
import base64
from typing import Optional, Annotated, Any
from fastapi import (
    APIRouter, Depends, Query, HTTPException, status, Request, Path, Response,
    UploadFile, File,
)

from app.api.dependencies import (
    get_event_service, get_user_repo, get_team_repo,
    get_category_repo, get_service_repo, get_seed_service, require_auth,
)
from app.services.event_service import EventService
from app.services.seed_service import SeedService
from app.database.repositories import (
    UserRepository, TeamRepository, CategoryRepository, ServiceRepository,
)
from app.contracts.event_models import EventCreateRequest, EventUpdateRequest
from app.contracts.serializers import doc_to_user, doc_to_team, doc_to_category, doc_to_service
from app.mock.fault_injection import apply_fault_injection
from app.core.config import settings

router = APIRouter(tags=["events"])
admin_router = APIRouter(tags=["mock-admin"])


@router.get(
    "/assystREST/v2/events",
    summary="List events",
    description="Retrieve a list of events (incidents) with optional filtering, pagination and sorting. "
                "Returns a bare JSON array per the verified assystREST collection format.",
)
async def list_events(
    request: Request,
    eventType: Optional[str] = Query(None, description="Filter by event type (e.g. INCIDENT). Comma-separated values supported."),
    eventStatus: Optional[str] = Query(None, description="Filter by event status (e.g. OPEN,IN_PROGRESS)."),
    priorityCode: Optional[str] = Query(None, description="Filter by priority code (e.g. P1,P2)."),
    creationDate: Optional[str] = Query(None, description="Date range filter — ISO 8601 UTC, e.g. 2024-01-01T00:00:00Z,2024-06-01T00:00:00Z"),
    lastModifiedDate: Optional[str] = Query(None, description="Date range filter for last modification."),
    resolvedDate: Optional[str] = Query(None, description="Date range filter for resolution date."),
    assignedGroupId: Optional[int] = Query(None, description="Filter by assigned support group ID."),
    serviceId: Optional[int] = Query(None, description="Filter by service ID."),
    affectedUserId: Optional[int] = Query(None, description="Filter by affected user ID."),
    categoryId: Optional[int] = Query(None, description="Filter by category ID."),
    startRow: int = Query(0, ge=0, description="⚠️ Provisional: zero-based row offset for pagination."),
    numberOfRows: int = Query(
        settings.PAGINATION_DEFAULT_SIZE, ge=1,
        le=settings.PAGINATION_MAX_SIZE,
        description="⚠️ Provisional: maximum rows to return.",
    ),
    sortField: str = Query("creationDate", description="Field to sort by."),
    sortOrder: str = Query("desc", description="Sort direction: asc or desc."),
    fields: Optional[str] = Query(None, description="✅ Comma-separated list of nested objects to expand, e.g. affectedUser,assignedGroup"),
    _: str = Depends(require_auth),
    svc: EventService = Depends(get_event_service),
) -> list[dict]:
    await apply_fault_injection()
    order = -1 if sortOrder.lower() == "desc" else 1
    return await svc.list_events(
        event_type=eventType,
        event_status=eventStatus,
        priority_code=priorityCode,
        creation_date=creationDate,
        last_modified_date=lastModifiedDate,
        resolved_date=resolvedDate,
        assigned_group_id=assignedGroupId,
        service_id=serviceId,
        affected_user_id=affectedUserId,
        category_id=categoryId,
        start_row=startRow,
        number_of_rows=numberOfRows,
        sort_field=sortField,
        sort_order=order,
        fields=fields,
    )


@router.get(
    "/assystREST/v2/events/{eventId}",
    summary="Get event by ID",
)
async def get_event(
    eventId: Annotated[int, Path(description="Unique numeric event ID")],
    fields: Optional[str] = Query(None),
    _: str = Depends(require_auth),
    svc: EventService = Depends(get_event_service),
) -> dict:
    await apply_fault_injection()
    return await svc.get_event(eventId, fields=fields)


@router.post(
    "/assystREST/v2/events",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new event",
    description="✅ POST used for creation per assystREST contract (PUT is not supported).",
)
async def create_event(
    body: EventCreateRequest,
    _: str = Depends(require_auth),
    svc: EventService = Depends(get_event_service),
) -> dict:
    await apply_fault_injection()
    return await svc.create_event(body)


@router.post(
    "/assystREST/v2/events/{eventId}",
    summary="Update an existing event",
    description="✅ POST used for updates per assystREST contract. Partial update supported.",
)
async def update_event(
    eventId: Annotated[int, Path()],
    body: EventUpdateRequest,
    _: str = Depends(require_auth),
    svc: EventService = Depends(get_event_service),
) -> dict:
    await apply_fault_injection()
    return await svc.update_event(eventId, body)


@router.delete(
    "/assystREST/v2/events/{eventId}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an event",
)
async def delete_event(
    eventId: Annotated[int, Path()],
    _: str = Depends(require_auth),
    svc: EventService = Depends(get_event_service),
) -> Response:
    await apply_fault_injection()
    await svc.delete_event(eventId)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Event attachments (documents)
# ⚠️ Provisional paths: assystREST exposes event documents/attachments; the
# exact contract varies by instance. Modelled here as multipart file uploads.
# ---------------------------------------------------------------------------

@router.post(
    "/assystREST/v2/events/{eventId}/attachments",
    status_code=status.HTTP_201_CREATED,
    summary="Attach a file (e.g. screenshot) to an event",
)
async def add_event_attachment(
    eventId: Annotated[int, Path(description="Unique numeric event ID")],
    file: UploadFile = File(..., description="Binary file to attach."),
    _: str = Depends(require_auth),
    svc: EventService = Depends(get_event_service),
) -> dict:
    await apply_fault_injection()
    content = await file.read()
    return await svc.add_attachment(
        eventId,
        file_name=file.filename or "attachment",
        content_type=file.content_type,
        content=content,
    )


@router.get(
    "/assystREST/v2/events/{eventId}/attachments",
    summary="List an event's attachments (metadata only)",
)
async def list_event_attachments(
    eventId: Annotated[int, Path(description="Unique numeric event ID")],
    _: str = Depends(require_auth),
    svc: EventService = Depends(get_event_service),
) -> list[dict]:
    await apply_fault_injection()
    return await svc.list_attachments(eventId)


@router.get(
    "/assystREST/v2/events/{eventId}/attachments/{attachmentId}",
    summary="Download a single attachment's binary content",
)
async def download_event_attachment(
    eventId: Annotated[int, Path(description="Unique numeric event ID")],
    attachmentId: Annotated[int, Path(description="Attachment ID within the event")],
    _: str = Depends(require_auth),
    svc: EventService = Depends(get_event_service),
) -> Response:
    await apply_fault_injection()
    attachment = await svc.get_attachment(eventId, attachmentId)
    raw = base64.b64decode(attachment.get("content") or "")
    return Response(
        content=raw,
        media_type=attachment.get("contentType") or "application/octet-stream",
        headers={
            "Content-Disposition": (
                f'inline; filename="{attachment.get("fileName") or "attachment"}"'
            )
        },
    )


# ---------------------------------------------------------------------------
# Reference data endpoints (⚠️ Provisional paths)
# ---------------------------------------------------------------------------

@router.get("/assystREST/v2/assystUsers", summary="List users", tags=["reference-data"])
async def list_users(
    startRow: int = Query(0, ge=0),
    numberOfRows: int = Query(25, ge=1, le=100),
    _: str = Depends(require_auth),
    repo: UserRepository = Depends(get_user_repo),
) -> list[dict]:
    docs = await repo.find_many(start_row=startRow, number_of_rows=numberOfRows)
    return [doc_to_user(d) for d in docs]


@router.get("/assystREST/v2/assystUsers/{userId}", tags=["reference-data"])
async def get_user(
    userId: int,
    _: str = Depends(require_auth),
    repo: UserRepository = Depends(get_user_repo),
) -> dict:
    doc = await repo.find_by_id(userId)
    if not doc:
        raise HTTPException(status_code=404, detail={"type": "NotFoundException", "message": f"User {userId} not found.", "diagnostic": ""})
    return doc_to_user(doc)


@router.get("/assystREST/v2/supportGroups", summary="List support groups / teams", tags=["reference-data"])
async def list_teams(
    startRow: int = Query(0, ge=0),
    numberOfRows: int = Query(25, ge=1, le=100),
    _: str = Depends(require_auth),
    repo: TeamRepository = Depends(get_team_repo),
) -> list[dict]:
    docs = await repo.find_many(start_row=startRow, number_of_rows=numberOfRows)
    return [doc_to_team(d) for d in docs]


@router.get("/assystREST/v2/categories", summary="List incident categories", tags=["reference-data"])
async def list_categories(
    startRow: int = Query(0, ge=0),
    numberOfRows: int = Query(50, ge=1, le=200),
    _: str = Depends(require_auth),
    repo: CategoryRepository = Depends(get_category_repo),
) -> list[dict]:
    docs = await repo.find_many(start_row=startRow, number_of_rows=numberOfRows)
    return [doc_to_category(d) for d in docs]


@router.get("/assystREST/v2/services", summary="List services", tags=["reference-data"])
async def list_services(
    startRow: int = Query(0, ge=0),
    numberOfRows: int = Query(50, ge=1, le=200),
    _: str = Depends(require_auth),
    repo: ServiceRepository = Depends(get_service_repo),
) -> list[dict]:
    docs = await repo.find_many(start_row=startRow, number_of_rows=numberOfRows)
    return [doc_to_service(d) for d in docs]


# ---------------------------------------------------------------------------
# Mock-only admin endpoints (NOT part of the assystREST contract)
# ---------------------------------------------------------------------------

@admin_router.get("/mock/admin/stats", summary="Mock DB stats", tags=["mock-admin"])
async def admin_stats(
    _: str = Depends(require_auth),
    event_repo=Depends(get_event_repo := __import__("app.api.dependencies", fromlist=["get_event_repo"]).get_event_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    team_repo: TeamRepository = Depends(get_team_repo),
) -> dict:
    return {
        "eventCount": await event_repo.count_all(),
        "userCount": await user_repo.count_all(),
        "teamCount": await team_repo.count_all(),
        "mockOnly": True,
    }


@admin_router.post("/mock/admin/seed", summary="Seed mock data", tags=["mock-admin"])
async def admin_seed(
    count: int = Query(settings.SEED_DATA_COUNT, ge=1, le=10000),
    _: str = Depends(require_auth),
    seed_svc: SeedService = Depends(get_seed_service),
) -> dict:
    await seed_svc.seed_reference_data()
    inserted = await seed_svc.seed_events(count)
    return {"seeded": inserted, "mockOnly": True}


@admin_router.post("/mock/admin/reset", summary="Reset and reseed database", tags=["mock-admin"])
async def admin_reset(
    count: int = Query(settings.SEED_DATA_COUNT, ge=1, le=10000),
    _: str = Depends(require_auth),
    seed_svc: SeedService = Depends(get_seed_service),
) -> dict:
    await seed_svc.reset()
    return {"reset": True, "seeded": count, "mockOnly": True}


@admin_router.get("/mock/admin/config", summary="View mock configuration", tags=["mock-admin"])
async def admin_config(_: str = Depends(require_auth)) -> dict:
    from app.mock.mock_auth import get_mock_credentials
    from app.mock.fault_injection import settings as fs
    return {
        "appName": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "apiVersion": settings.ASSYST_API_VERSION,
        "basePath": settings.ASSYST_BASE_PATH,
        "auth": get_mock_credentials(),
        "faultInjection": {
            "enabled": settings.FAULT_INJECTION_ENABLED,
            "errorRate": settings.FAULT_INJECTION_ERROR_RATE,
            "delayMs": settings.FAULT_INJECTION_DELAY_MS,
        },
        "pagination": {
            "defaultSize": settings.PAGINATION_DEFAULT_SIZE,
            "maxSize": settings.PAGINATION_MAX_SIZE,
        },
        "mockOnly": True,
    }
