"""
Serialization helpers: convert MongoDB documents to API response models.
Null fields and empty arrays are omitted per the verified assystREST contract.
"""
from typing import Any
from app.contracts.event_models import (
    EventResponse, UserResponse, TeamResponse,
    CategoryResponse, ServiceResponse,
    UserDto, GroupDto, TechnicianDto, ServiceDto,
    CategoryDto, SubCategoryDto, EventRefDto,
)


def _omit_none(d: dict) -> dict:
    """Remove None values and empty lists from a dict (verified API behavior)."""
    return {k: v for k, v in d.items() if v is not None and v != [] and v != {}}


def doc_to_event(doc: dict[str, Any], expand_fields: list[str] | None = None) -> dict:
    """
    Convert a MongoDB event document to the assystREST response format.
    Nested objects are only included when requested via the fields parameter.
    """
    expand = set(expand_fields or [])

    event: dict[str, Any] = {
        "id": doc["id"],
        "version": doc.get("version", 1),
        "eventRef": doc.get("eventRef"),
        "eventType": doc.get("eventType"),
        "eventStatus": doc.get("eventStatus"),
        "shortDescription": doc.get("shortDescription"),
        "remarks": doc.get("remarks"),
        "priorityCode": doc.get("priorityCode"),
        "priorityDescription": doc.get("priorityDescription"),
        "impact": doc.get("impact"),
        "urgency": doc.get("urgency"),
        "creationDate": doc.get("creationDate"),
        "lastModifiedDate": doc.get("lastModifiedDate"),
        "resolvedDate": doc.get("resolvedDate"),
        "closedDate": doc.get("closedDate"),
        "requiredDate": doc.get("requiredDate"),
        "resolutionCode": doc.get("resolutionCode"),
        "resolutionRemarks": doc.get("resolutionRemarks"),
        "affectedUserId": doc.get("affectedUserId"),
        "assignedGroupId": doc.get("assignedGroupId"),
        "assignedTechId": doc.get("assignedTechId"),
        "serviceId": doc.get("serviceId"),
        "categoryId": doc.get("categoryId"),
        "subCategoryId": doc.get("subCategoryId"),
    }

    if "affectedUser" in expand and doc.get("affectedUser"):
        event["affectedUser"] = doc["affectedUser"]
    if "assignedGroup" in expand and doc.get("assignedGroup"):
        event["assignedGroup"] = doc["assignedGroup"]
    if "assignedTech" in expand and doc.get("assignedTech"):
        event["assignedTech"] = doc["assignedTech"]
    if "service" in expand and doc.get("service"):
        event["service"] = doc["service"]
    if "category" in expand and doc.get("category"):
        event["category"] = doc["category"]
    if "subCategory" in expand and doc.get("subCategory"):
        event["subCategory"] = doc["subCategory"]
    if "parentEvent" in expand and doc.get("parentEvent"):
        event["parentEvent"] = doc["parentEvent"]
    if "linkedEvents" in expand and doc.get("linkedEvents"):
        event["linkedEvents"] = doc["linkedEvents"]

    return _omit_none(event)


def doc_to_attachment(doc: dict[str, Any]) -> dict:
    """Convert a stored attachment sub-document to its public descriptor.
    The base64 ``content`` field is deliberately excluded."""
    return _omit_none({
        "id": doc["id"],
        "eventId": doc.get("eventId"),
        "fileName": doc.get("fileName"),
        "contentType": doc.get("contentType"),
        "size": doc.get("size", 0),
        "createdDate": doc.get("createdDate"),
    })


def doc_to_user(doc: dict[str, Any]) -> dict:
    return _omit_none({
        "id": doc["id"],
        "shortCode": doc.get("shortCode"),
        "name": doc.get("name"),
        "email": doc.get("email"),
        "version": doc.get("version", 1),
    })


def doc_to_team(doc: dict[str, Any]) -> dict:
    return _omit_none({
        "id": doc["id"],
        "shortCode": doc.get("shortCode"),
        "name": doc.get("name"),
        "version": doc.get("version", 1),
    })


def doc_to_category(doc: dict[str, Any]) -> dict:
    result = {
        "id": doc["id"],
        "shortCode": doc.get("shortCode"),
        "name": doc.get("name"),
        "version": doc.get("version", 1),
    }
    if doc.get("subCategories"):
        result["subCategories"] = doc["subCategories"]
    return _omit_none(result)


def doc_to_service(doc: dict[str, Any]) -> dict:
    return _omit_none({
        "id": doc["id"],
        "shortCode": doc.get("shortCode"),
        "name": doc.get("name"),
        "version": doc.get("version", 1),
    })
