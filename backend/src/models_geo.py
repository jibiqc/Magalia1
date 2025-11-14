from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from .models.db import Base
from datetime import datetime, timezone

def utcnow():
    return datetime.now(timezone.utc)

class Destination(Base):
    __tablename__ = "destinations"
    
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True, index=True)


class DestinationPhoto(Base):
    __tablename__ = "destination_photos"
    __table_args__ = (UniqueConstraint("dest_id", "photo_url", name="uq_destination_photos_dest_url"),)
    
    id = Column(Integer, primary_key=True)
    dest_id = Column(Integer, ForeignKey("destinations.id", ondelete="CASCADE"), nullable=False, index=True)
    photo_url = Column(String, nullable=False)
    usage_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=utcnow)



