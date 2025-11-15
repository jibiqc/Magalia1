"""add source to service_images

Revision ID: 20251115_095925
Revises: 
Create Date: 2025-11-15 09:59:25.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251115_095925'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # For SQLite, we need to handle unique constraint removal carefully
    # SQLite stores unique constraints as indexes, so we drop and recreate the index
    
    # Step 1: Drop the unique index on url if it exists
    # SQLite creates an index automatically for unique=True, typically named 'ix_service_images_url'
    # Use IF EXISTS to avoid errors if index doesn't exist
    op.execute("DROP INDEX IF EXISTS ix_service_images_url")
    
    # Step 2: Create a non-unique index on url for performance
    op.create_index('ix_service_images_url', 'service_images', ['url'], unique=False)
    
    # Step 3: Add the source column with default value
    op.add_column('service_images', sa.Column('source', sa.String(), nullable=False, server_default='import'))
    
    # Step 4: Update existing rows to ensure they all have source='import'
    # (This is redundant if server_default works, but ensures data consistency)
    op.execute("UPDATE service_images SET source = 'import' WHERE source IS NULL OR source = ''")


def downgrade():
    # Remove the source column
    op.drop_column('service_images', 'source')
    
    # Recreate the unique index on url
    op.drop_index('ix_service_images_url', table_name='service_images')
    op.create_index('ix_service_images_url', 'service_images', ['url'], unique=True)

