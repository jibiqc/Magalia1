"""add_timestamp_to_audit_logs

Revision ID: 78004edfbc6c
Revises: fe58fce715ac
Create Date: 2025-11-10 18:19:17.971915

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '78004edfbc6c'
down_revision: Union[str, Sequence[str], None] = 'fe58fce715ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Check if audit_logs table exists, if not create it
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if 'audit_logs' not in inspector.get_table_names():
        # Create the table if it doesn't exist
        op.create_table('audit_logs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('actor', sa.String(), nullable=False),
            sa.Column('action', sa.String(), nullable=False),
            sa.Column('entity_type', sa.String(), nullable=False),
            sa.Column('entity_id', sa.Integer(), nullable=True),
            sa.Column('field', sa.String(), nullable=True),
            sa.Column('old_value', sa.Text(), nullable=True),
            sa.Column('new_value', sa.Text(), nullable=True),
            sa.Column('timestamp', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.PrimaryKeyConstraint('id')
        )
    else:
        # Table exists, check if timestamp column exists
        columns = [col['name'] for col in inspector.get_columns('audit_logs')]
        if 'timestamp' not in columns:
            # SQLite limitation: cannot add NOT NULL column with non-constant default
            # So we add it as nullable first, update existing rows, then make it NOT NULL
            op.add_column('audit_logs', sa.Column('timestamp', sa.DateTime(), nullable=True))
            # Update existing rows with current timestamp
            op.execute("UPDATE audit_logs SET timestamp = datetime('now') WHERE timestamp IS NULL")
            # Now make it NOT NULL (SQLite doesn't support ALTER COLUMN, so we need to recreate the table)
            # But for simplicity, we'll just leave it nullable and handle it in the model
            # Actually, let's use a workaround: alter the column to NOT NULL with a default
            # Since SQLite doesn't support ALTER COLUMN, we'll use a different approach
            # For SQLite, we'll just leave it nullable and the model will handle the default


def downgrade() -> None:
    """Downgrade schema."""
    # Remove timestamp column from audit_logs table
    op.drop_column('audit_logs', 'timestamp')
