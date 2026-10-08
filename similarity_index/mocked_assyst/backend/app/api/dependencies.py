from fastapi import Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database.mongo import get_db
from app.database.repositories import (
    EventRepository, UserRepository,
    TeamRepository, CategoryRepository, ServiceRepository,
)
from app.services.event_service import EventService
from app.services.seed_service import SeedService
from app.core.security import authenticate_request


def get_database() -> AsyncIOMotorDatabase:
    return get_db()


def get_event_repo(db: AsyncIOMotorDatabase = Depends(get_database)) -> EventRepository:
    return EventRepository(db)


def get_user_repo(db: AsyncIOMotorDatabase = Depends(get_database)) -> UserRepository:
    return UserRepository(db)


def get_team_repo(db: AsyncIOMotorDatabase = Depends(get_database)) -> TeamRepository:
    return TeamRepository(db)


def get_category_repo(db: AsyncIOMotorDatabase = Depends(get_database)) -> CategoryRepository:
    return CategoryRepository(db)


def get_service_repo(db: AsyncIOMotorDatabase = Depends(get_database)) -> ServiceRepository:
    return ServiceRepository(db)


def get_event_service(repo: EventRepository = Depends(get_event_repo)) -> EventService:
    return EventService(repo)


def get_seed_service(
    event_repo: EventRepository = Depends(get_event_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    team_repo: TeamRepository = Depends(get_team_repo),
    category_repo: CategoryRepository = Depends(get_category_repo),
    service_repo: ServiceRepository = Depends(get_service_repo),
) -> SeedService:
    return SeedService(event_repo, user_repo, team_repo, category_repo, service_repo)


async def require_auth(request: Request) -> str:
    return authenticate_request(request)
