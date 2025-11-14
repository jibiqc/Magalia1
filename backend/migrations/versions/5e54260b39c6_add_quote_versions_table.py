"""add_quote_versions_table

Revision ID: 5e54260b39c6
Revises: 69b9b9828eee
Create Date: 2025-11-14 17:31:10.703728

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '5e54260b39c6'
down_revision: Union[str, Sequence[str], None] = '69b9b9828eee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('quote_versions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('quote_id', sa.Integer(), nullable=False),
    sa.Column('label', sa.String(length=50), nullable=False),
    sa.Column('comment', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('created_by', sa.String(length=255), nullable=True),
    sa.Column('type', sa.String(length=50), nullable=False),
    sa.Column('export_type', sa.String(length=20), nullable=True),
    sa.Column('export_file_name', sa.String(length=255), nullable=True),
    sa.Column('total_price', sa.Numeric(precision=14, scale=2), nullable=True),
    sa.Column('snapshot_json', sa.JSON(), nullable=False),
    sa.Column('archived_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['quote_id'], ['quotes.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_quote_versions_archived_at'), 'quote_versions', ['archived_at'], unique=False)
    op.create_index(op.f('ix_quote_versions_id'), 'quote_versions', ['id'], unique=False)
    op.create_index(op.f('ix_quote_versions_quote_id'), 'quote_versions', ['quote_id'], unique=False)
    # Add index on created_at for sorting
    op.create_index('ix_quote_versions_created_at', 'quote_versions', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_quote_versions_created_at', table_name='quote_versions')
    op.drop_index(op.f('ix_quote_versions_quote_id'), table_name='quote_versions')
    op.drop_index(op.f('ix_quote_versions_id'), table_name='quote_versions')
    op.drop_index(op.f('ix_quote_versions_archived_at'), table_name='quote_versions')
    op.drop_table('quote_versions')
