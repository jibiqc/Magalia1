"""add_quote_metadata_fields

Revision ID: 206782af2af6
Revises: 7cc8b7347c27
Create Date: 2025-11-12 14:25:51.282943

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '206782af2af6'
down_revision: Union[str, Sequence[str], None] = '7cc8b7347c27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add new fields to quotes table
    op.add_column('quotes', sa.Column('travel_agency', sa.String(), nullable=True))
    op.add_column('quotes', sa.Column('travel_advisor', sa.String(), nullable=True))
    op.add_column('quotes', sa.Column('client_name', sa.String(), nullable=True))
    op.add_column('quotes', sa.Column('fx_rate', sa.Numeric(14, 6), nullable=True))
    op.add_column('quotes', sa.Column('internal_note', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove new fields from quotes table
    op.drop_column('quotes', 'internal_note')
    op.drop_column('quotes', 'fx_rate')
    op.drop_column('quotes', 'client_name')
    op.drop_column('quotes', 'travel_advisor')
    op.drop_column('quotes', 'travel_agency')
