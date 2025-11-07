from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from .models.db import Base

def utcnow():
    return datetime.now(timezone.utc)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    ts = Column(DateTime, default=utcnow, nullable=False, index=True)
    actor = Column(String, nullable=True, default="system")
    action = Column(String, nullable=False)  # e.g., "update"
    entity_type = Column(String, nullable=False)  # e.g., "quote_day"
    entity_id = Column(Integer, nullable=False, index=True)
    field = Column(String, nullable=False)  # e.g., "destination"
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    meta = Column(JSON, nullable=True)

