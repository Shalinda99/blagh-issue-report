"""
MongoDB repository layer. Handles all database operations.
Keeps internal storage structures separate from API response schema.
"""
from __future__ import annotations
from typing import Any, Optional
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument
from app.core.logging import get_logger

logger = get_logger(__name__)


def _parse_date_range(value: str) -> dict:
    """
    Parse an assystREST date range string into a MongoDB query dict.
    Format: "startISO,endISO" — either part may be omitted.
    ✅ Verified format from assystREST documentation.
    """
    parts = value.split(",", 1)
    query: dict = {}
    start = parts[0].strip() if parts[0].strip() else None
    end = parts[1].strip() if len(parts) > 1 and parts[1].strip() else None
    if start:
        query["$gte"] = start
    if end:
        query["$lte"] = end
    return query


class EventRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self._col = db["events"]

    async def find_many(
        self,
        *,
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
    ) -> list[dict]:
        query: dict[str, Any] = {}

        if event_type:
            values = [v.strip().upper() for v in event_type.split(",")]
            query["eventType"] = {"$in": values}

        if event_status:
            values = [v.strip().upper() for v in event_status.split(",")]
            query["eventStatus"] = {"$in": values}

        if priority_code:
            values = [v.strip().upper() for v in priority_code.split(",")]
            query["priorityCode"] = {"$in": values}

        if creation_date:
            query["creationDate"] = _parse_date_range(creation_date)

        if last_modified_date:
            query["lastModifiedDate"] = _parse_date_range(last_modified_date)

        if resolved_date:
            query["resolvedDate"] = _parse_date_range(resolved_date)

        if assigned_group_id is not None:
            query["assignedGroupId"] = assigned_group_id

        if service_id is not None:
            query["serviceId"] = service_id

        if affected_user_id is not None:
            query["affectedUserId"] = affected_user_id

        if category_id is not None:
            query["categoryId"] = category_id

        cursor = (
            self._col.find(query, {"_id": 0})
            .sort(sort_field, sort_order)
            .skip(start_row)
            .limit(number_of_rows)
        )
        return await cursor.to_list(length=number_of_rows)

    async def count(self, **kwargs) -> int:
        query: dict[str, Any] = {}
        if kwargs.get("event_type"):
            query["eventType"] = {"$in": [v.strip().upper() for v in kwargs["event_type"].split(",")]}
        if kwargs.get("event_status"):
            query["eventStatus"] = {"$in": [v.strip().upper() for v in kwargs["event_status"].split(",")]}
        if kwargs.get("creation_date"):
            query["creationDate"] = _parse_date_range(kwargs["creation_date"])
        if kwargs.get("last_modified_date"):
            query["lastModifiedDate"] = _parse_date_range(kwargs["last_modified_date"])
        return await self._col.count_documents(query)

    async def find_by_id(self, event_id: int) -> Optional[dict]:
        return await self._col.find_one({"id": event_id}, {"_id": 0})

    async def find_by_ref(self, event_ref: str) -> Optional[dict]:
        return await self._col.find_one({"eventRef": event_ref}, {"_id": 0})

    async def insert(self, doc: dict) -> dict:
        await self._col.insert_one(doc)
        doc.pop("_id", None)
        return doc

    async def upsert(self, event_id: int, doc: dict) -> dict:
        doc.pop("_id", None)
        result = await self._col.find_one_and_update(
            {"id": event_id},
            {"$set": doc},
            upsert=True,
            return_document=ReturnDocument.AFTER,
            projection={"_id": 0},
        )
        return result

    async def update(self, event_id: int, updates: dict) -> Optional[dict]:
        updates["lastModifiedDate"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        result = await self._col.find_one_and_update(
            {"id": event_id},
            {"$set": updates, "$inc": {"version": 1}},
            return_document=ReturnDocument.AFTER,
            projection={"_id": 0},
        )
        return result

    async def delete(self, event_id: int) -> bool:
        result = await self._col.delete_one({"id": event_id})
        return result.deleted_count > 0

    async def get_next_id(self) -> int:
        doc = await self._col.find_one({}, {"id": 1}, sort=[("id", -1)])
        return (doc["id"] + 1) if doc else 10000001

    async def count_all(self) -> int:
        return await self._col.count_documents({})

    async def add_attachment(self, event_id: int, attachment: dict) -> Optional[dict]:
        """Append an attachment sub-document to an event and bump its version.
        Returns the updated event document, or None if the event is absent."""
        return await self._col.find_one_and_update(
            {"id": event_id},
            {
                "$push": {"attachments": attachment},
                "$set": {
                    "lastModifiedDate": datetime.now(timezone.utc).strftime(
                        "%Y-%m-%dT%H:%M:%SZ"
                    )
                },
                "$inc": {"version": 1},
            },
            return_document=ReturnDocument.AFTER,
            projection={"_id": 0},
        )

    async def list_attachments(self, event_id: int) -> Optional[list[dict]]:
        """Return an event's attachments (without binary content), or None if
        the event does not exist."""
        doc = await self._col.find_one(
            {"id": event_id}, {"_id": 0, "attachments": 1}
        )
        if doc is None:
            return None
        return doc.get("attachments", []) or []

    async def get_attachment(self, event_id: int, attachment_id: int) -> Optional[dict]:
        """Return a single attachment sub-document (including base64 content)."""
        doc = await self._col.find_one(
            {"id": event_id}, {"_id": 0, "attachments": 1}
        )
        if doc is None:
            return None
        for att in doc.get("attachments", []) or []:
            if att.get("id") == attachment_id:
                return att
        return None


class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self._col = db["users"]

    async def find_many(self, start_row: int = 0, number_of_rows: int = 25, name_like: Optional[str] = None) -> list[dict]:
        query: dict = {}
        if name_like:
            query["name"] = {"$regex": f"^{name_like}", "$options": "i"}
        cursor = self._col.find(query, {"_id": 0}).skip(start_row).limit(number_of_rows)
        return await cursor.to_list(length=number_of_rows)

    async def find_by_id(self, user_id: int) -> Optional[dict]:
        return await self._col.find_one({"id": user_id}, {"_id": 0})

    async def upsert(self, doc: dict) -> None:
        doc.pop("_id", None)
        await self._col.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)

    async def count_all(self) -> int:
        return await self._col.count_documents({})


class TeamRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self._col = db["teams"]

    async def find_many(self, start_row: int = 0, number_of_rows: int = 25) -> list[dict]:
        cursor = self._col.find({}, {"_id": 0}).skip(start_row).limit(number_of_rows)
        return await cursor.to_list(length=number_of_rows)

    async def find_by_id(self, team_id: int) -> Optional[dict]:
        return await self._col.find_one({"id": team_id}, {"_id": 0})

    async def upsert(self, doc: dict) -> None:
        doc.pop("_id", None)
        await self._col.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)

    async def count_all(self) -> int:
        return await self._col.count_documents({})


class CategoryRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self._col = db["categories"]

    async def find_many(self, start_row: int = 0, number_of_rows: int = 50) -> list[dict]:
        cursor = self._col.find({}, {"_id": 0}).skip(start_row).limit(number_of_rows)
        return await cursor.to_list(length=number_of_rows)

    async def find_by_id(self, cat_id: int) -> Optional[dict]:
        return await self._col.find_one({"id": cat_id}, {"_id": 0})

    async def upsert(self, doc: dict) -> None:
        doc.pop("_id", None)
        await self._col.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)


class ServiceRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self._col = db["services"]

    async def find_many(self, start_row: int = 0, number_of_rows: int = 50) -> list[dict]:
        cursor = self._col.find({}, {"_id": 0}).skip(start_row).limit(number_of_rows)
        return await cursor.to_list(length=number_of_rows)

    async def find_by_id(self, svc_id: int) -> Optional[dict]:
        return await self._col.find_one({"id": svc_id}, {"_id": 0})

    async def upsert(self, doc: dict) -> None:
        doc.pop("_id", None)
        await self._col.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
