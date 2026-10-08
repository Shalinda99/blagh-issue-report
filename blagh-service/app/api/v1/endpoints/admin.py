"""
Admin endpoints — authentication + report management for the dashboard.
"""

import hmac
import math
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, status
from minio import Minio
from pymongo.database import Database

from app.config import settings
from app.core.exceptions import UnauthorizedError
from app.core.security import create_access_token, get_current_admin
from app.db.session import get_db, get_minio
from app.models.report import ReportStatus
from app.schemas.common import PaginatedResponse, TokenResponse
from app.schemas.project import AdminLoginRequest
from app.schemas.report import ReportDetailResponse, ReportSummaryResponse
from app.services import report_service

router = APIRouter()


# ─── Auth ─────────────────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Admin login — returns a JWT for dashboard access",
)
def admin_login(payload: AdminLoginRequest) -> TokenResponse:
    """
    Phase 1 uses a single admin credential from environment variables.
    Phase 2 will replace this with a proper admin_users table lookup.
    """
    email_match = hmac.compare_digest(payload.email, settings.INITIAL_ADMIN_EMAIL)
    password_match = hmac.compare_digest(payload.password, settings.INITIAL_ADMIN_PASSWORD)
    if not email_match or not password_match:
        raise UnauthorizedError("Invalid admin credentials.")

    token = create_access_token(subject=payload.email)
    return TokenResponse(access_token=token)


# ─── Report management ────────────────────────────────────────────────────────

@router.get(
    "/reports",
    response_model=PaginatedResponse[ReportSummaryResponse],
    dependencies=[Depends(get_current_admin)],
    summary="List all reports with optional filters",
)
def list_reports(
    project_id: str | None = Query(default=None),
    report_status: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    days: int = Query(default=14, ge=0, description="Return reports from the last N days. Pass 0 to disable the date filter."),
    db: Database = Depends(get_db),
) -> PaginatedResponse[ReportSummaryResponse]:
    created_after: datetime | None = (
        datetime.now(timezone.utc) - timedelta(days=days) if days > 0 else None
    )
    reports, total = report_service.get_reports(
        db, project_id=project_id, status=report_status, page=page, page_size=page_size,
        created_after=created_after,
    )
    return PaginatedResponse(
        items=[ReportSummaryResponse.model_validate(r) for r in reports],
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total else 0,
    )


@router.get(
    "/reports/{ref_id}",
    response_model=ReportDetailResponse,
    dependencies=[Depends(get_current_admin)],
    summary="Get full details of a single report",
)
def get_report(
    ref_id: str,
    db: Database = Depends(get_db),
    minio_client: Minio = Depends(get_minio),
) -> ReportDetailResponse:
    report = report_service.get_report_by_ref(db, ref_id, minio_client)
    return ReportDetailResponse.model_validate(report)


@router.patch(
    "/reports/{ref_id}/status",
    response_model=ReportSummaryResponse,
    dependencies=[Depends(get_current_admin)],
    summary="Update report status (open → in_progress → resolved → closed)",
)
def update_status(
    ref_id: str,
    new_status: ReportStatus = Query(..., alias="value"),
    db: Database = Depends(get_db),
) -> ReportSummaryResponse:
    report = report_service.update_report_status(db, ref_id, new_status.value)
    return ReportSummaryResponse.model_validate(report)
