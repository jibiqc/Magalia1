"""add_destination_photos

Revision ID: 7cc8b7347c27
Revises: 7426b0c8e996
Create Date: 2025-01-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7cc8b7347c27'
down_revision: Union[str, Sequence[str], None] = '7426b0c8e996'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "destination_photos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("dest_id", sa.Integer(), nullable=False),
        sa.Column("photo_url", sa.String(), nullable=False),
        sa.Column("usage_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["dest_id"], ["destinations.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("dest_id", "photo_url", name="uq_destination_photos_dest_url"),
    )
    op.create_index("ix_destination_photos_dest_id", "destination_photos", ["dest_id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_destination_photos_dest_url", "destination_photos", type_="unique")
    op.drop_index("ix_destination_photos_dest_id", table_name="destination_photos")
    op.drop_table("destination_photos")

