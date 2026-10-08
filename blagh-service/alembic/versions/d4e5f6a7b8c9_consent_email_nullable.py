"""make user_consents.user_email nullable; replace unique constraint with partial indexes

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-18 15:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop the old unique constraint (email + project_id)
    op.drop_constraint("uq_consent_user_project", "user_consents", type_="unique")

    # 2. Make user_email nullable
    op.alter_column(
        "user_consents",
        "user_email",
        existing_type=sa.String(length=300),
        nullable=True,
    )

    # 3. Add index on user_id (for the id-only lookup path)
    op.create_index(
        "ix_user_consents_user_id", "user_consents", ["user_id"], unique=False
    )

    # 4. Recreate uniqueness as two partial indexes (PostgreSQL / SQLite 3.8+)
    #    For Oracle or older DBs these are best-effort; the service layer
    #    enforces upsert semantics regardless.
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect in ("postgresql", "sqlite"):
        bind.execute(sa.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_uc_email_project "
            "ON user_consents (user_email, project_id) "
            "WHERE user_email IS NOT NULL"
        ))
        bind.execute(sa.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_uc_userid_project "
            "ON user_consents (user_id, project_id) "
            "WHERE user_email IS NULL AND user_id IS NOT NULL"
        ))


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect in ("postgresql", "sqlite"):
        bind.execute(sa.text("DROP INDEX IF EXISTS ix_uc_userid_project"))
        bind.execute(sa.text("DROP INDEX IF EXISTS ix_uc_email_project"))

    op.drop_index("ix_user_consents_user_id", table_name="user_consents")

    op.alter_column(
        "user_consents",
        "user_email",
        existing_type=sa.String(length=300),
        nullable=False,
    )

    op.create_unique_constraint(
        "uq_consent_user_project", "user_consents", ["user_email", "project_id"]
    )
