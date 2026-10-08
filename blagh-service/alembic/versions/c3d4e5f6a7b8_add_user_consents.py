"""add user_consents table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-18 09:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_consents",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_email", sa.String(length=300), nullable=False),
        sa.Column("user_id", sa.String(length=100), nullable=True),
        sa.Column("user_name", sa.String(length=200), nullable=True),
        sa.Column("user_role", sa.String(length=100), nullable=True),
        sa.Column("project_id", sa.String(length=100), nullable=False),
        sa.Column("consented", sa.Boolean(), nullable=False),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=60), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_email", "project_id", name="uq_consent_user_project"),
    )
    op.create_index(
        op.f("ix_user_consents_user_email"), "user_consents", ["user_email"], unique=False
    )
    op.create_index(
        op.f("ix_user_consents_project_id"), "user_consents", ["project_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_consents_project_id"), table_name="user_consents")
    op.drop_index(op.f("ix_user_consents_user_email"), table_name="user_consents")
    op.drop_table("user_consents")
