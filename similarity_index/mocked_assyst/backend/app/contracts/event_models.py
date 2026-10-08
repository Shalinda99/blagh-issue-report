"""
Event (incident) resource models.

Field names and structure follow assystREST naming conventions (camelCase).
Simple attributes are verified against the assystREST documentation.
Nested object field names are provisional (marked with comments).
Source: https://wiki.axiossystems.com/assyst11-5Wiki/index.php/Integrations:assystREST
"""
from __future__ import annotations
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from enum import Enum
from datetime import datetime


class EventType(str, Enum):
    """
    ⚠️ Provisional: Exact enum values not listed in public docs.
    Based on assyst UI labels and RAML convention.
    """
    INCIDENT = "INCIDENT"
    PROBLEM = "PROBLEM"
    CHANGE = "CHANGE"
    SERVICE_REQUEST = "SERVICE_REQUEST"
    ORDER = "ORDER"
    TASK = "TASK"
    DECISION = "DECISION"


class EventStatus(str, Enum):
    """
    ⚠️ Provisional: Exact enum values not listed in public docs.
    Based on assyst UI labels and naming conventions.
    """
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    PENDING = "PENDING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"


class PriorityCode(str, Enum):
    """⚠️ Provisional: Based on common assyst configurations."""
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"


class UserDto(BaseModel):
    """⚠️ Provisional nested object structure."""
    model_config = ConfigDict(populate_by_name=True)
    id: int
    shortCode: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None


class GroupDto(BaseModel):
    """⚠️ Provisional nested object structure."""
    id: int
    shortCode: Optional[str] = None
    name: Optional[str] = None


class TechnicianDto(BaseModel):
    """⚠️ Provisional nested object structure."""
    id: int
    shortCode: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None


class ServiceDto(BaseModel):
    """⚠️ Provisional nested object structure."""
    id: int
    shortCode: Optional[str] = None
    name: Optional[str] = None


class CategoryDto(BaseModel):
    """⚠️ Provisional nested object structure."""
    id: int
    shortCode: Optional[str] = None
    name: Optional[str] = None


class SubCategoryDto(BaseModel):
    """⚠️ Provisional nested object structure."""
    id: int
    shortCode: Optional[str] = None
    name: Optional[str] = None


class EventRefDto(BaseModel):
    """⚠️ Provisional: Reference to a related event."""
    id: int
    eventRef: Optional[str] = None
    shortDescription: Optional[str] = None


class EventResponse(BaseModel):
    """
    assystREST event resource response.
    Simple attributes always returned; nested objects only when expanded via ?fields=.
    ✅ id, version always returned per API contract.
    ⚠️ Field names are provisional for event-specific fields.
    """
    model_config = ConfigDict(populate_by_name=True)

    id: int
    version: int
    eventRef: Optional[str] = None
    eventType: Optional[EventType] = None
    eventStatus: Optional[EventStatus] = None
    shortDescription: Optional[str] = None
    remarks: Optional[str] = None
    priorityCode: Optional[str] = None
    priorityDescription: Optional[str] = None
    impact: Optional[int] = None
    urgency: Optional[int] = None
    creationDate: Optional[str] = None
    lastModifiedDate: Optional[str] = None
    resolvedDate: Optional[str] = None
    closedDate: Optional[str] = None
    requiredDate: Optional[str] = None
    resolutionCode: Optional[str] = None
    resolutionRemarks: Optional[str] = None

    affectedUserId: Optional[int] = None
    assignedGroupId: Optional[int] = None
    assignedTechId: Optional[int] = None
    serviceId: Optional[int] = None
    categoryId: Optional[int] = None
    subCategoryId: Optional[int] = None

    affectedUser: Optional[UserDto] = None
    assignedGroup: Optional[GroupDto] = None
    assignedTech: Optional[TechnicianDto] = None
    service: Optional[ServiceDto] = None
    category: Optional[CategoryDto] = None
    subCategory: Optional[SubCategoryDto] = None
    parentEvent: Optional[EventRefDto] = None
    linkedEvents: Optional[list[EventRefDto]] = None

    def model_post_init(self, __context) -> None:
        pass


class EventCreateRequest(BaseModel):
    """
    Request body for creating a new event.
    ⚠️ Provisional: exact mandatory fields depend on instance configuration.
    """
    model_config = ConfigDict(populate_by_name=True)

    eventType: EventType = EventType.INCIDENT
    shortDescription: str
    remarks: Optional[str] = None
    priorityCode: Optional[str] = "P3"
    affectedUserId: Optional[int] = None
    assignedGroupId: Optional[int] = None
    assignedTechId: Optional[int] = None
    serviceId: Optional[int] = None
    categoryId: Optional[int] = None
    subCategoryId: Optional[int] = None


class EventUpdateRequest(BaseModel):
    """
    Request body for updating an existing event (partial update supported).
    ⚠️ Provisional: POST used for updates per assystREST contract.
    """
    model_config = ConfigDict(populate_by_name=True)

    version: Optional[int] = None
    eventStatus: Optional[EventStatus] = None
    shortDescription: Optional[str] = None
    remarks: Optional[str] = None
    priorityCode: Optional[str] = None
    assignedGroupId: Optional[int] = None
    assignedTechId: Optional[int] = None
    resolutionCode: Optional[str] = None
    resolutionRemarks: Optional[str] = None


class AttachmentResponse(BaseModel):
    """
    Attachment (document) descriptor for an event.
    ⚠️ Provisional: assystREST exposes event documents/attachments; exact field
    names vary by instance. Binary content is NOT returned in the descriptor.
    """
    model_config = ConfigDict(populate_by_name=True)

    id: int
    eventId: int
    fileName: str
    contentType: Optional[str] = None
    size: int = 0
    createdDate: Optional[str] = None


class UserResponse(BaseModel):
    """Mock user/contact user resource."""
    id: int
    shortCode: str
    name: str
    email: Optional[str] = None
    version: int = 1


class TeamResponse(BaseModel):
    """Mock support group resource."""
    id: int
    shortCode: str
    name: str
    version: int = 1


class CategoryResponse(BaseModel):
    """Mock category resource."""
    id: int
    shortCode: str
    name: str
    version: int = 1
    subCategories: Optional[list[SubCategoryDto]] = None


class ServiceResponse(BaseModel):
    """Mock service resource."""
    id: int
    shortCode: str
    name: str
    version: int = 1
