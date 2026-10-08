import pytest
import pytest_asyncio
import asyncio
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient

from app.main import app
from app.core.config import settings
from app.database import mongo as mongo_module

TEST_DB = "mock_assyst_test"
AUTH_HEADERS = {
    "Authorization": "Basic bW9ja191c2VyOmNoYW5nZV9tZQ=="  # mock_user:change_me
}


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[TEST_DB]
    mongo_module._client = client
    mongo_module._db = db

    from app.database.indexes import create_indexes
    from app.database.repositories import (
        EventRepository, UserRepository,
        TeamRepository, CategoryRepository, ServiceRepository,
    )
    from app.services.seed_service import SeedService

    await create_indexes(db)
    svc = SeedService(
        EventRepository(db), UserRepository(db),
        TeamRepository(db), CategoryRepository(db),
        ServiceRepository(db),
    )
    await svc.seed_reference_data()
    await svc.seed_events(30)

    yield

    await client[TEST_DB].client.drop_database(TEST_DB)
    client.close()


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c
