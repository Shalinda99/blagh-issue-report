"""
Event service layer — business logic between API routes and repositories.
"""
from __future__ import annotations
import base64
from datetime import datetime, timezone
from typing import Optional, Any
from fastapi import HTTPException, status

from app.database.repositories import EventRepository
from app.contracts.event_models import EventCreateRequest, EventUpdateRequest, EventType
from app.contracts.serializers import doc_to_event, doc_to_attachment
from app.core.logging import get_logger

logger = get_logger(__name__)


def _now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_fields_param(fields: Optional[str]) -> list[str]:
    """
    Parse the assystREST ?fields= parameter into a list of expand targets.
    Simple field names that reference nested objects trigger expansion.
    ✅ Based on verified field expansion behavior.
    """
    if not fields:
        return []
    return [f.strip().split("[")[0].split(".")[0] for f in fields.split(",")]


NESTED_FIELDS = {
    "affectedUser", "assignedGroup", "assignedTech",
    "service", "category", "subCategory", "parentEvent", "linkedEvents",
}


def _resolve_expand(fields: Optional[str]) -> list[str]:
    parsed = _parse_fields_param(fields)
    return [f for f in parsed if f in NESTED_FIELDS]


class EventService:
    def __init__(self, repo: EventRepository):
        self._repo = repo

    async def list_events(
        self,
        event_type: Optional[str] = None,
        event_status: Optional[str] = None,
        priority_code: Optional[str] = None,
        creation_date: Optional[str] = None,
        last_modified_date: Optional[str] = None,
        resolved_date: Optional[str] = None,
        assigned_group_id: Optional[int] = None,
        service_id: Optional[int] = None,
        affected_user_id: Optional[int] = None,
        category_id: Optional[int] = None,
        start_row: int = 0,
        number_of_rows: int = 25,
        sort_field: str = "creationDate",
        sort_order: int = -1,
        fields: Optional[str] = None,
    ) -> list[dict]:
        expand = _resolve_expand(fields)
        docs = await self._repo.find_many(
            event_type=event_type,
            event_status=event_status,
            priority_code=priority_code,
            creation_date=creation_date,
            last_modified_date=last_modified_date,
            resolved_date=resolved_date,
            assigned_group_id=assigned_group_id,
            service_id=service_id,
            affected_user_id=affected_user_id,
            category_id=category_id,
            start_row=start_row,
            number_of_rows=number_of_rows,
            sort_field=sort_field,
            sort_order=sort_order,
        )
        return [doc_to_event(doc, expand) for doc in docs]

    async def get_event(self, event_id: int, fields: Optional[str] = None) -> dict:
        doc = await self._repo.find_by_id(event_id)
        if doc is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "type": "NotFoundException",
                    "message": f"Event with id {event_id} was not found.",
                    "diagnostic": "",
                },
            )
        expand = _resolve_expand(fields)
        return doc_to_event(doc, expand)

    async def create_event(self, req: EventCreateRequest) -> dict:
        next_id = await self._repo.get_next_id()
        now = _now_utc()
        event_ref = f"INC{next_id:010d}"

        doc: dict[str, Any] = {
            "id": next_id,
            "version": 1,
            "eventRef": event_ref,
            "eventType": req.eventType.value,
            "eventStatus": "OPEN",
            "shortDescription": req.shortDescription,
            "remarks": req.remarks,
            "priorityCode": req.priorityCode or "P3",
            "priorityDescription": _priority_label(req.priorityCode or "P3"),
            "creationDate": now,
            "lastModifiedDate": now,
        }

        if req.affectedUserId is not None:
            doc["affectedUserId"] = req.affectedUserId
        if req.assignedGroupId is not None:
            doc["assignedGroupId"] = req.assignedGroupId
        if req.assignedTechId is not None:
            doc["assignedTechId"] = req.assignedTechId
        if req.serviceId is not None:
            doc["serviceId"] = req.serviceId
        if req.categoryId is not None:
            doc["categoryId"] = req.categoryId
        if req.subCategoryId is not None:
            doc["subCategoryId"] = req.subCategoryId

        await self._repo.insert(doc)
        logger.info("Created event id=%d ref=%s", next_id, event_ref)
        return doc_to_event(doc)

    async def update_event(self, event_id: int, req: EventUpdateRequest) -> dict:
        existing = await self._repo.find_by_id(event_id)
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "type": "NotFoundException",
                    "message": f"Event with id {event_id} was not found.",
                    "diagnostic": "",
                },
            )

        if req.version is not None and req.version != existing.get("version"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "type": "OptimisticLockException",
                    "message": "The resource has been updated by another user.",
                    "diagnostic": f"Expected version {req.version}, current is {existing.get('version')}",
                },
            )

        updates: dict[str, Any] = {}
        if req.eventStatus is not None:
            updates["eventStatus"] = req.eventStatus.value
            if req.eventStatus.value == "RESOLVED" and not existing.get("resolvedDate"):
                updates["resolvedDate"] = _now_utc()
            if req.eventStatus.value == "CLOSED" and not existing.get("closedDate"):
                updates["closedDate"] = _now_utc()
        if req.shortDescription is not None:
            updates["shortDescription"] = req.shortDescription
        if req.remarks is not None:
            updates["remarks"] = req.remarks
        if req.priorityCode is not None:
            updates["priorityCode"] = req.priorityCode
            updates["priorityDescription"] = _priority_label(req.priorityCode)
        if req.assignedGroupId is not None:
            updates["assignedGroupId"] = req.assignedGroupId
        if req.assignedTechId is not None:
            updates["assignedTechId"] = req.assignedTechId
        if req.resolutionCode is not None:
            updates["resolutionCode"] = req.resolutionCode
        if req.resolutionRemarks is not None:
            updates["resolutionRemarks"] = req.resolutionRemarks

        updated = await self._repo.update(event_id, updates)
        logger.info("Updated event id=%d", event_id)
        return doc_to_event(updated)

    async def delete_event(self, event_id: int) -> None:
        deleted = await self._repo.delete(event_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "type": "NotFoundException",
                    "message": f"Event with id {event_id} was not found.",
                    "diagnostic": "",
                },
            )

    # ─── Attachments ────────────────────────────────────────────────────────
    async def add_attachment(
        self,
        event_id: int,
        file_name: str,
        content_type: Optional[str],
        content: bytes,
    ) -> dict:
        """Store a binary attachment against an event (base64-encoded in Mongo)
        and return its public descriptor."""
        existing = await self._repo.list_attachments(event_id)
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "type": "NotFoundException",
                    "message": f"Event with id {event_id} was not found.",
                    "diagnostic": "",
                },
            )

        attachment = {
            "id": len(existing) + 1,
            "eventId": event_id,
            "fileName": file_name or "attachment",
            "contentType": content_type or "application/octet-stream",
            "size": len(content),
            "content": base64.b64encode(content).decode("ascii"),
            "createdDate": _now_utc(),
        }
        await self._repo.add_attachment(event_id, attachment)
        logger.info(
            "Added attachment id=%d (%s, %d bytes) to event id=%d",
            attachment["id"], attachment["fileName"], attachment["size"], event_id,
        )
        return doc_to_attachment(attachment)

    async def list_attachments(self, event_id: int) -> list[dict]:
        attachments = await self._repo.list_attachments(event_id)
        if attachments is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "type": "NotFoundException",
                    "message": f"Event with id {event_id} was not found.",
                    "diagnostic": "",
                },
            )
        return [doc_to_attachment(a) for a in attachments]

    async def get_attachment(self, event_id: int, attachment_id: int) -> dict:
        """Return a single attachment including its raw (decoded) content under
        the ``_raw`` key for download handlers."""
        attachment = await self._repo.get_attachment(event_id, attachment_id)
        if attachment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "type": "NotFoundException",
                    "message": (
                        f"Attachment {attachment_id} on event {event_id} "
                        "was not found."
                    ),
                    "diagnostic": "",
                },
            )
        return attachment


def _priority_label(code: str) -> str:
    labels = {"P1": "Critical", "P2": "High", "P3": "Medium", "P4": "Low"}
    return labels.get(code.upper(), code)
