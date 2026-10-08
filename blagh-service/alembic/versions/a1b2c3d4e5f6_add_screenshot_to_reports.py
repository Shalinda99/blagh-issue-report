"""add screenshot to reports

Revision ID: a1b2c3d4e5f6
Revises: 72b8527405a4
Create Date: 2026-09-14 12:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "72b8527405a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reports", sa.Column("screenshot", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("reports", "screenshot")
