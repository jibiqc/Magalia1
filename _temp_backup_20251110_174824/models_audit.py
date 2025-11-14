from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime, timezone
from .models.db import Base

def utcnow():
    return datetime.now(timezone.utc)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True)
    actor = Column(String, nullable=False)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(Integer, nullable=True)
    field = Column(String, nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utcnow, nullable=False)

