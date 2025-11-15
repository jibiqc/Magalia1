from typing import List, Optional
from datetime import date
from pydantic import BaseModel, conint, constr



class QuoteLineIn(BaseModel):

    position: Optional[int] = None

    service_id: Optional[int] = None

    category: Optional[str] = None

    title: Optional[str] = None

    supplier_name: Optional[str] = None

    visibility: Optional[str] = "client"



    achat_eur: Optional[float] = None

    achat_usd: Optional[float] = None

    vente_usd: Optional[float] = None

    fx_rate: Optional[float] = None



    currency: Optional[str] = None

    base_net_amount: Optional[float] = None

    raw_json: Optional[dict] = None



class QuoteDayIn(BaseModel):

    position: Optional[int] = None

    date: Optional[str] = None

    destination: Optional[str] = None

    decorative_images: Optional[list] = None

    lines: Optional[List[QuoteLineIn]] = None



class QuoteIn(BaseModel):

    title: Optional[str] = None

    display_title: Optional[str] = None

    hero_photo_1: Optional[str] = None

    hero_photo_2: Optional[str] = None

    pax: Optional[int] = None

    start_date: Optional[str] = None

    end_date: Optional[str] = None

    # New fields
    travel_agency: Optional[str] = None
    travel_advisor: Optional[str] = None
    client_name: Optional[str] = None
    fx_rate: Optional[float] = None
    internal_note: Optional[str] = None

    days: Optional[List[QuoteDayIn]] = None



    # quote-level cost controls

    margin_pct: Optional[float] = 0.1627

    onspot_manual: Optional[float] = None

    hassle_manual: Optional[float] = None



class QuoteLineOut(BaseModel):

    id: Optional[int] = None

    position: Optional[int] = None

    service_id: Optional[int] = None

    category: Optional[str] = None

    title: Optional[str] = None

    supplier_name: Optional[str] = None

    visibility: Optional[str] = "client"



    achat_eur: Optional[float] = None

    achat_usd: Optional[float] = None

    vente_usd: Optional[float] = None

    fx_rate: Optional[float] = None



    currency: Optional[str] = None

    base_net_amount: Optional[float] = None

    raw_json: Optional[dict] = None



class QuoteDayOut(BaseModel):

    id: Optional[int] = None

    position: Optional[int] = None

    date: Optional[str] = None

    destination: Optional[str] = None

    decorative_images: Optional[list] = None

    lines: Optional[List[QuoteLineOut]] = None



class QuoteOut(BaseModel):

    id: int

    title: Optional[str] = None

    display_title: Optional[str] = None

    hero_photo_1: Optional[str] = None

    hero_photo_2: Optional[str] = None

    pax: Optional[int] = None

    start_date: Optional[str] = None

    end_date: Optional[str] = None

    # New fields
    travel_agency: Optional[str] = None
    travel_advisor: Optional[str] = None
    client_name: Optional[str] = None
    fx_rate: Optional[float] = None
    internal_note: Optional[str] = None

    days: Optional[List[QuoteDayOut]] = None



    # quote-level cost controls

    margin_pct: Optional[float] = None

    onspot_manual: Optional[float] = None

    hassle_manual: Optional[float] = None

    # computed / stored totals (optional for UI now)

    onspot_total: Optional[float] = None

    hassle_total: Optional[float] = None

    commissionable_net: Optional[float] = None

    commission_total: Optional[float] = None

    sell_total: Optional[float] = None

    grand_total: Optional[float] = None


class DestinationRangePatch(BaseModel):
    start_date: Optional[str] = None  # Accept ISO string, will be converted to date in endpoint
    day_id: Optional[int] = None  # ID du jour cible (prioritaire sur start_date)
    nights: conint(ge=1)
    destination: constr(strip_whitespace=True, min_length=1)
    overwrite: bool = True



# QuoteVersion schemas

class QuoteVersionIn(BaseModel):
    """Schema for creating a manual version (requires comment)."""
    comment: str  # Mandatory for manual versions


class QuoteVersionPatch(BaseModel):
    """Schema for updating version metadata (label and/or comment)."""
    label: Optional[str] = None
    comment: Optional[str] = None


class QuoteVersionOut(BaseModel):
    """Schema for reading a version (full metadata, snapshot excluded from list view)."""
    id: int
    quote_id: int
    label: str
    comment: Optional[str] = None
    created_at: str  # ISO format datetime
    created_by: Optional[str] = None  # Email
    type: str
    export_type: Optional[str] = None
    export_file_name: Optional[str] = None
    total_price: Optional[float] = None
    archived_at: Optional[str] = None  # ISO format datetime


class QuoteVersionDetailOut(QuoteVersionOut):
    """Schema for reading a version with full snapshot JSON."""
    snapshot_json: dict  # Full quote snapshot


class QuoteVersionListOut(BaseModel):
    """Schema for paginated version list response."""
    items: List[QuoteVersionOut]
    total: int
    has_more: bool



