from datetime import datetime, date, timezone

from decimal import Decimal

from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Numeric, Text, JSON, func

from sqlalchemy.orm import relationship

from .models.db import Base

def utcnow():
    return datetime.now(timezone.utc)



DEC2 = Numeric(14, 2)

DEC6 = Numeric(14, 6)



class Quote(Base):

    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String, nullable=True)

    pax = Column(Integer, nullable=True)

    start_date = Column(Date, nullable=True)

    end_date = Column(Date, nullable=True)



    # ---- Cost fields (quote-level) ----

    margin_pct = Column(DEC6, nullable=False, server_default="0.1627")   # 16.27%

    onspot_manual = Column(DEC2, nullable=True)   # if set, overrides calc

    hassle_manual = Column(DEC2, nullable=True)   # if set, overrides calc



    # persisted last computation (for Excel/preview)

    onspot_total = Column(DEC2, nullable=False, default=Decimal("0.00"))

    hassle_total = Column(DEC2, nullable=False, default=Decimal("0.00"))

    commissionable_net = Column(DEC2, nullable=False, default=Decimal("0.00"))  # achats côté net (incl. Onspot)

    commission_total = Column(DEC2, nullable=False, default=Decimal("0.00"))

    sell_total = Column(DEC2, nullable=False, default=Decimal("0.00"))

    grand_total = Column(DEC2, nullable=False, default=Decimal("0.00"))



    created_at = Column(DateTime, default=utcnow, nullable=False)

    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)



    days = relationship("QuoteDay", back_populates="quote", cascade="all, delete-orphan", order_by="QuoteDay.position")



class QuoteDay(Base):

    __tablename__ = "quote_days"

    id = Column(Integer, primary_key=True)

    quote_id = Column(Integer, ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False, index=True)

    position = Column(Integer, nullable=True)

    date = Column(Date, nullable=True)

    destination = Column(String, nullable=True)

    decorative_images = Column(JSON, nullable=True)



    quote = relationship("Quote", back_populates="days")

    lines = relationship("QuoteLine", back_populates="day", cascade="all, delete-orphan", order_by="QuoteLine.position")



class QuoteLine(Base):

    __tablename__ = "quote_lines"

    id = Column(Integer, primary_key=True)

    quote_day_id = Column(Integer, ForeignKey("quote_days.id", ondelete="CASCADE"), nullable=False, index=True)

    position = Column(Integer, nullable=True)



    # Catalog linkage (optional)

    service_id = Column(Integer, nullable=True)



    # Classification

    category = Column(String, nullable=True)       # "Trip info", "Internal", "Activity", "Hotel", etc.

    title = Column(String, nullable=False)

    supplier_name = Column(String, nullable=True)

    visibility = Column(String, nullable=True, default="client")  # "client" | "internal" | "cost_only"



    # 3 user-editable price boxes (free values)

    achat_eur = Column(DEC2, nullable=True)       # "Prix d'achat €"

    achat_usd = Column(DEC2, nullable=True)       # "Prix d'achat $"

    vente_usd = Column(DEC2, nullable=True)       # "Prix de vente"

    fx_rate = Column(DEC6, nullable=True)         # derived = achat_usd / achat_eur (if both present)



    currency = Column(String, nullable=True)      # keep if you already used it; otherwise harmless

    base_net_amount = Column(DEC2, nullable=True) # legacy / not used by cost engine

    raw_json = Column(JSON, nullable=True)



    day = relationship("QuoteDay", back_populates="lines")



