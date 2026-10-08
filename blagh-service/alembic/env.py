"""
Alembic environment configuration.

Run migrations:
    alembic upgrade head          # apply all pending migrations
    alembic revision --autogenerate -m "description"  # create new migration
    alembic downgrade -1          # roll back one step
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.db.base import Base

# Import all models so Alembic can detect them during autogenerate
import app.models  # noqa: F401 — registers Project, Report, ConsoleLog, FailedAPICall

config = context.config


def render_item(obj_type: str, obj: object, autogen_context: object) -> str | bool:
    """Render UUIDType and JsonType as plain sa.String / sa.Text in migrations."""
    from app.models.base import JsonType, UUIDType

    if obj_type == "type":
        if isinstance(obj, UUIDType):
            return "sa.String(length=36)"
        if isinstance(obj, JsonType):
            return "sa.Text()"
    return False

# Override sqlalchemy.url with the value from .env
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations without a live database connection.
    Produces SQL scripts that can be reviewed and applied manually —
    useful for Oracle DBA-managed deployments.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        render_item=render_item,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations with a live database connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            render_item=render_item,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
