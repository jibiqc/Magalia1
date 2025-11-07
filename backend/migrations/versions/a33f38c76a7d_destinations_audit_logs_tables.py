"""destinations + audit_logs tables

Revision ID: a33f38c76a7d
Revises: d85d0ee84c91
Create Date: 2025-11-07 10:48:39.592938

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a33f38c76a7d'
down_revision: Union[str, Sequence[str], None] = 'd85d0ee84c91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create destinations table
    op.create_table(
        'destinations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_destinations_id'), 'destinations', ['id'], unique=False)
    op.create_index(op.f('ix_destinations_name'), 'destinations', ['name'], unique=True)
    
    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('ts', sa.DateTime(), nullable=False),
        sa.Column('actor', sa.String(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('entity_type', sa.String(), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('field', sa.String(), nullable=False),
        sa.Column('old_value', sa.Text(), nullable=True),
        sa.Column('new_value', sa.Text(), nullable=True),
        sa.Column('meta', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)
    op.create_index(op.f('ix_audit_logs_ts'), 'audit_logs', ['ts'], unique=False)
    op.create_index(op.f('ix_audit_logs_entity_id'), 'audit_logs', ['entity_id'], unique=False)
    
    # Seed destinations from existing quote_days.destination (distinct non-null values)
    connection = op.get_bind()
    result = connection.execute(sa.text("SELECT DISTINCT destination FROM quote_days WHERE destination IS NOT NULL AND destination != ''"))
    destinations = [row[0] for row in result]
    
    if destinations:
        # Insert unique destinations (case-insensitive deduplication in Python)
        seen_lower = set()
        unique_dests = []
        for dest in destinations:
            dest_clean = dest.strip()
            if dest_clean and dest_clean.lower() not in seen_lower:
                seen_lower.add(dest_clean.lower())
                unique_dests.append(dest_clean)
        
        if unique_dests:
            for dest_name in unique_dests:
                # Use INSERT OR IGNORE for SQLite, or ON CONFLICT for PostgreSQL
                try:
                    connection.execute(
                        sa.text("INSERT INTO destinations (name) VALUES (:name)"),
                        {"name": dest_name}
                    )
                except Exception:
                    # Ignore duplicates (if unique constraint fails)
                    pass
            connection.commit()


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_audit_logs_entity_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_ts'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_id'), table_name='audit_logs')
    op.drop_table('audit_logs')
    
    op.drop_index(op.f('ix_destinations_name'), table_name='destinations')
    op.drop_index(op.f('ix_destinations_id'), table_name='destinations')
    op.drop_table('destinations')
