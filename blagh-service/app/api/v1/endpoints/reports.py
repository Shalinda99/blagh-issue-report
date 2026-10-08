"""
Public endpoint — called directly by blagh.js (the widget).
No authentication required. Project ID is validated via the X-Project-ID header.
"""

from fastapi import APIRouter, Depends, Header, Query, status
from minio import Minio
from pymongo.database import Database

from app.config import settings
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.session import get_db, get_minio
from app.schemas.project import ProjectCreate
from app.schemas.report import ReportCreate, ReportCreateResponse, ReportSummaryResponse
from app.services import project_service, report_service

router = APIRouter()


@router.get(
    "",
    response_model=list[ReportSummaryResponse],
    summary="Get reports submitted by a specific user (widget — no auth required)",
)
def get_my_reports(
    user_email: str = Query(..., description="Email of the logged-in user"),
    project_id: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
    x_project_id: str | None = Header(default=None, alias="X-Project-ID"),
    db: Database = Depends(get_db),
) -> list[ReportSummaryResponse]:
    """
    Called by blagh.js to display the user's own submitted reports.
    Filtered by user_email; optionally scoped to a project.
    """
    effective_project_id = x_project_id or project_id or None
    reports = report_service.get_reports_by_user(db, user_email, effective_project_id, limit)
    return [ReportSummaryResponse.model_validate(r) for r in reports]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=ReportCreateResponse,
    summary="Submit an issue report from the widget",
)
def submit_report(
    payload: ReportCreate,
    x_project_id: str | None = Header(default=None, alias="X-Project-ID"),
    db: Database = Depends(get_db),
    minio_client: Minio = Depends(get_minio),
) -> ReportCreateResponse:
    """
    Called by blagh.js on form submission.

    Validates the project exists and is active, then persists the report
    along with all captured diagnostics. Media files are stored in MinIO.
    """
    effective_project_id = x_project_id or payload.project_id

    try:
        project = project_service.get_project_by_app_id(db, effective_project_id)
    except NotFoundError:
        if settings.is_production:
            raise NotFoundError("Project", effective_project_id)
        # Auto-register unknown projects in development only
        project = project_service.create_project(
            db,
            ProjectCreate(app_id=effective_project_id, name=effective_project_id),
        )

    if not project["is_active"]:
        raise ForbiddenError(f"Project '{effective_project_id}' is not active.")

    payload.project_id = project["app_id"]
    report = report_service.create_report(db, payload, minio_client)

    return ReportCreateResponse(
        id=report["id"],
        ref_id=report["ref_id"],
        status=report["status"],
    )
