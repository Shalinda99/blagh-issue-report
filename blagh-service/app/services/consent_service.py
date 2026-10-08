"""
Service layer for user consent operations — backed by MongoDB.

Uses upsert semantics: one document per identified user per project, updated
in-place whenever the user re-acknowledges (e.g. after a policy update).
Lookup priority: email > user_id.
"""

from datetime import datetime, timezone

from pymongo import ReturnDocument
from pymongo.database import Database

from app.schemas.consent import ConsentCreate, ConsentStatusResponse


def _doc_to_dict(doc: dict) -> dict:
    result = dict(doc)
    result["id"] = str(result.pop("_id"))
    return result


def get_consent(
    db: Database, user_email: str, project_id: str
) -> ConsentStatusResponse:
    """
    Return the current consent status for a user+project pair (lookup by email).
    Returns consented=False if no record exists.
    """
    record = db.user_consents.find_one(
        {"user_email": user_email, "project_id": project_id}
    )
    if record is None:
        return ConsentStatusResponse(consented=False)
    return ConsentStatusResponse(
        consented=record["consented"],
        consented_at=record["consented_at"],
    )


def upsert_consent(
    db: Database, payload: ConsentCreate, ip_address: str | None = None
) -> dict:
    """
    Create a new consent document or update the existing one atomically.
    Lookup priority: email+project, then user_id+project (email-null docs).
    Returns the persisted consent document as a plain dict.
    """
    now = datetime.now(timezone.utc)

    if payload.user_email:
        query = {"user_email": payload.user_email, "project_id": payload.project_id}
    else:
        query = {
            "user_id": payload.user_id,
            "user_email": None,
            "project_id": payload.project_id,
        }

    set_fields: dict = {
        "consented": payload.consented,
        "consented_at": now,
        "updated_at": now,
    }
    if payload.user_id:
        set_fields["user_id"] = payload.user_id
    if payload.user_name:
        set_fields["user_name"] = payload.user_name
    if payload.user_role:
        set_fields["user_role"] = payload.user_role
    if payload.user_agent:
        set_fields["user_agent"] = payload.user_agent
    if ip_address:
        set_fields["ip_address"] = ip_address

    doc = db.user_consents.find_one_and_update(
        query,
        {
            "$set": set_fields,
            "$setOnInsert": {
                "user_email": payload.user_email,
                "project_id": payload.project_id,
                "created_at": now,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return _doc_to_dict(doc)
