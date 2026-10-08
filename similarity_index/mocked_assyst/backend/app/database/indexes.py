from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, IndexModel
from app.core.logging import get_logger

logger = get_logger(__name__)


async def create_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create all required MongoDB indexes."""
    events = db["events"]
    await events.create_indexes([
        IndexModel([("id", ASCENDING)], unique=True, name="idx_event_id"),
        IndexModel([("eventRef", ASCENDING)], unique=True, name="idx_event_ref"),
        IndexModel([("eventType", ASCENDING)], name="idx_event_type"),
        IndexModel([("eventStatus", ASCENDING)], name="idx_event_status"),
        IndexModel([("priorityCode", ASCENDING)], name="idx_priority"),
        IndexModel([("creationDate", DESCENDING)], name="idx_creation_date"),
        IndexModel([("lastModifiedDate", DESCENDING)], name="idx_last_modified"),
        IndexModel([("resolvedDate", DESCENDING)], name="idx_resolved_date"),
        IndexModel([("assignedGroup.id", ASCENDING)], name="idx_assigned_group"),
        IndexModel([("affectedUser.id", ASCENDING)], name="idx_affected_user"),
        IndexModel([("service.id", ASCENDING)], name="idx_service"),
        IndexModel([("category.id", ASCENDING)], name="idx_category"),
    ])
    logger.info("Created indexes on events collection")

    users = db["users"]
    await users.create_indexes([
        IndexModel([("id", ASCENDING)], unique=True, name="idx_user_id"),
        IndexModel([("shortCode", ASCENDING)], unique=True, name="idx_user_shortcode"),
    ])

    teams = db["teams"]
    await teams.create_indexes([
        IndexModel([("id", ASCENDING)], unique=True, name="idx_team_id"),
        IndexModel([("shortCode", ASCENDING)], unique=True, name="idx_team_shortcode"),
    ])

    categories = db["categories"]
    await categories.create_indexes([
        IndexModel([("id", ASCENDING)], unique=True, name="idx_category_id"),
    ])

    services = db["services"]
    await services.create_indexes([
        IndexModel([("id", ASCENDING)], unique=True, name="idx_service_id"),
    ])

    logger.info("All MongoDB indexes created successfully")
