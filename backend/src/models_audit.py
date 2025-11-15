from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime, timezone
from .models.db import Base

def utcnow():
    return datetime.now(timezone.utc)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True)
    ts = Column("ts", DateTime, nullable=False)  # Legacy column name - NO default, must be set explicitly
    actor = Column(String, nullable=True)  # Actually nullable in DB
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(Integer, nullable=False)  # Actually NOT NULL in DB
    field = Column(String, nullable=False)  # Actually NOT NULL in DB
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utcnow, nullable=True)  # New column (nullable for SQLite compatibility)


