from sqlalchemy import Column, Integer, String, Date, Float, Text, DateTime, JSON
from datetime import datetime
from .db import Base

class StgService(Base):
    __tablename__ = "stg_services"
    id = Column(Integer, primary_key=True)

    # Minimal normalized fields to support BK + canonicalization
    name = Column(String, nullable=False)
    company = Column(String, nullable=False)
    cost_category = Column(String, nullable=False)
    start_destination = Column(String, nullable=False)

    # Frequently-used fields (optional)
    hotel_stars = Column(Integer, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    image_url_primary = Column(String, nullable=True)  # URL (Image) (File)
    image_url_fallback = Column(String, nullable=True) # Image

    # Provenance & determinism
    _source_file = Column(String)
    _source_sheet = Column(String)
    _row_hash = Column(String, index=True, unique=True)
    _ingested_at = Column(DateTime, default=datetime.utcnow)

    # Keep ALL original columns here (exactly as found in Excel)
    raw_json = Column(JSON, nullable=False)

class StgImage(Base):
    __tablename__ = "stg_images"
    id = Column(Integer, primary_key=True)

    # Core fields
    url = Column(String, nullable=False)
    name = Column(String, nullable=True)
    company = Column(String, nullable=True)
    start_destination = Column(String, nullable=True)
    ef_code = Column(String, nullable=True)
    caption = Column(String, nullable=True)

    # Provenance & determinism
    _source_file = Column(String)
    _source_sheet = Column(String)
    _row_hash = Column(String, index=True, unique=True)
    _ingested_at = Column(DateTime, default=datetime.utcnow)

    # Keep ALL original columns here (exactly as found in Excel)
    raw_json = Column(JSON, nullable=False)

class StgItineraryEvent(Base):
    __tablename__ = "stg_itinerary_events"
    id = Column(Integer, primary_key=True)

    # Core fields
    departure_code = Column(String, nullable=False)
    date = Column(String, nullable=False)  # ISO format date string
    service_title = Column(String, nullable=False)
    city = Column(String, nullable=True)
    supplier = Column(String, nullable=True)
    category = Column(String, nullable=True)
    ef_code = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    # Provenance & determinism
    _source_file = Column(String)
    _source_sheet = Column(String)
    _row_hash = Column(String, index=True, unique=True)
    _ingested_at = Column(DateTime, default=datetime.utcnow)

    # Keep ALL original columns here (exactly as found in Excel)
    raw_json = Column(JSON, nullable=False)
