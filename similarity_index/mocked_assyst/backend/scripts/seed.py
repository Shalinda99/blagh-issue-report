"""
Standalone seed script. Run directly with:
  python -m scripts.seed [--count N]
"""
import asyncio
import argparse
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import settings
from app.core.logging import setup_logging
from app.database.mongo import connect_db, close_db, get_db
from app.database.indexes import create_indexes
from app.database.repositories import (
    EventRepository, UserRepository,
    TeamRepository, CategoryRepository, ServiceRepository,
)
from app.services.seed_service import SeedService


async def main(count: int) -> None:
    setup_logging()
    await connect_db()
    db = get_db()
    await create_indexes(db)

    svc = SeedService(
        EventRepository(db), UserRepository(db),
        TeamRepository(db), CategoryRepository(db),
        ServiceRepository(db),
    )
    await svc.seed_reference_data()
    inserted = await svc.seed_events(count)
    print(f"Seed complete: {inserted} events inserted/updated")
    await close_db()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed mock assyst data")
    parser.add_argument("--count", type=int, default=settings.SEED_DATA_COUNT)
    args = parser.parse_args()
    asyncio.run(main(args.count))
