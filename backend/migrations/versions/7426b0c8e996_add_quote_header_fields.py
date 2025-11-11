"""add_quote_header_fields

Revision ID: 7426b0c8e996
Revises: 78004edfbc6c
Create Date: 2025-01-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7426b0c8e996'
down_revision: Union[str, Sequence[str], None] = '78004edfbc6c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("quotes") as batch:
        batch.add_column(sa.Column("display_title", sa.String(), nullable=True))
        batch.add_column(sa.Column("hero_photo_1", sa.String(), nullable=True))
        batch.add_column(sa.Column("hero_photo_2", sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("quotes") as batch:
        batch.drop_column("hero_photo_2")
        batch.drop_column("hero_photo_1")
        batch.drop_column("display_title")

