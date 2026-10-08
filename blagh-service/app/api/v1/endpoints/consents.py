"""
Public consent endpoint — called by blagh.js.
No authentication required.  Rate-limiting should be enforced at the BFF/gateway layer.
"""

from fastapi import APIRouter, Depends, Header, Query, Request, status
from pymongo.database import Database

from app.db.session import get_db
from app.schemas.consent import ConsentCreate, ConsentResponse, ConsentStatusResponse
from app.services import consent_service

router = APIRouter()


@router.get(
    "",
    response_model=ConsentStatusResponse,
    summary="Check whether a user has already acknowledged the privacy notice",
)
def check_consent(
    user_email: str = Query(..., description="Email of the logged-in user"),
    project_id: str = Query(..., description="Project / app ID"),
    db: Database = Depends(get_db),
) -> ConsentStatusResponse:
    """
    Called by blagh.js on widget load (when the user is identified) to determine
    whether the privacy consent dialog needs to be shown.

    Returns consented=false if no record exists for this user+project pair.
    """
    return consent_service.get_consent(db, user_email, project_id)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=ConsentResponse,
    summary="Record a user's privacy acknowledgment",
)
def record_consent(
    payload: ConsentCreate,
    request: Request,
    x_project_id: str | None = Header(default=None, alias="X-Project-ID"),
    db: Database = Depends(get_db),
) -> ConsentResponse:
    """
    Called by blagh.js when the user ticks the consent checkbox and clicks
    "I Agree".  Creates or updates the consent record for this user+project pair.

    The client IP is captured for audit purposes.
    """
    if x_project_id:
        payload.project_id = x_project_id

    client_ip: str | None = None
    if request.client:
        client_ip = request.client.host

    record = consent_service.upsert_consent(db, payload, ip_address=client_ip)
    return ConsentResponse.model_validate(record)
