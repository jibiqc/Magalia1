from sqlalchemy import Column, Integer, String, Date, Float, Text, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from .db import Base

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True, index=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address1 = Column(String, nullable=True)
    address2 = Column(String, nullable=True)
    city = Column(String, nullable=True)
    country = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    services = relationship("ServiceCatalog", back_populates="supplier", cascade="all,delete-orphan")

class ServiceCatalog(Base):
    __tablename__ = "service_catalog"
    id = Column(Integer, primary_key=True)
    # BK (Business Key) fields
    name = Column(String, nullable=False, index=True)              # from "Name"
    company = Column(String, nullable=False, index=True)           # supplier label as in source (strict)
    start_destination = Column(String, nullable=False, index=True) # from "Start Destination"

    # Canonical attributes
    category = Column(String, index=True, nullable=False)  # strict taxonomy (Hotel, Private Transfer, Private, Small Group, Tickets, Trip info, Train, Flight, Ferry, Apartment, Villa)
    city = Column(String, nullable=True)                   # if you want to keep a city field separate from start_destination (optional)
    country = Column(String, nullable=True)

    # Supplier link (master)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    supplier = relationship("Supplier", back_populates="services")

    # Financials / logistics (optional, from source when present)
    pax_count = Column(Integer, nullable=True)
    net_amount = Column(Float, nullable=True)
    currency = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    hotel_stars = Column(Integer, nullable=True)
    duration_minutes = Column(Integer, nullable=True)

    # Free text
    full_description = Column(Text, nullable=True)
    brief_description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    # Keep EVERYTHING else here so we don't lose columns (you asked to import all columns)
    extras = Column(JSON, nullable=True)

class ServiceImage(Base):
    __tablename__ = "service_images"
    id = Column(Integer, primary_key=True)
    service_id = Column(Integer, ForeignKey("service_catalog.id"), nullable=True, index=True)
    url = Column(String, nullable=False, index=True)  # Removed unique=True to allow same URL on multiple services
    caption = Column(String, nullable=True)
    source = Column(String, nullable=False, default="import")  # "import" or "manual"

class ItineraryEvent(Base):
    __tablename__ = "itinerary_events"
    id = Column(Integer, primary_key=True)
    
    # BK fields
    departure_code = Column(String, nullable=False, index=True)
    date = Column(String, nullable=False, index=True)  # ISO format date string
    service_title = Column(String, nullable=False, index=True)
    
    # Attributes
    city = Column(String, nullable=True)
    supplier = Column(String, nullable=True)
    category = Column(String, nullable=True, index=True)
    ef_code = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Link to service catalog
    service_id = Column(Integer, ForeignKey("service_catalog.id"), nullable=True, index=True)
    service = relationship("ServiceCatalog", foreign_keys=[service_id])

class ServicePopularity(Base):
    __tablename__ = "service_popularity"
    id = Column(Integer, primary_key=True)
    service_id = Column(Integer, ForeignKey("service_catalog.id"), nullable=False, unique=True, index=True)
    service = relationship("ServiceCatalog", foreign_keys=[service_id])
    
    total_count = Column(Integer, nullable=False, default=0)
    count_365d = Column(Integer, nullable=False, default=0)
    last_used = Column(String, nullable=True)  # ISO format date string
    distinct_departures = Column(Integer, nullable=False, default=0)
    updated_at = Column(Date, nullable=False)
