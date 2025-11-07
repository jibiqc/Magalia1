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

    pax: Optional[int] = None

    start_date: Optional[str] = None

    end_date: Optional[str] = None

    days: Optional[List[QuoteDayIn]] = None



    # quote-level cost controls

    margin_pct: Optional[float] = 0.1627

    onspot_manual: Optional[float] = None

    hassle_manual: Optional[float] = None



class QuoteLineOut(BaseModel):

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

    position: Optional[int] = None

    date: Optional[str] = None

    destination: Optional[str] = None

    decorative_images: Optional[list] = None

    lines: Optional[List[QuoteLineOut]] = None



class QuoteOut(BaseModel):

    id: int

    title: Optional[str] = None

    pax: Optional[int] = None

    start_date: Optional[str] = None

    end_date: Optional[str] = None

    days: Optional[List[QuoteDayOut]] = None



    # computed / stored totals (optional for UI now)

    margin_pct: Optional[float] = None

    onspot_total: Optional[float] = None

    hassle_total: Optional[float] = None

    commissionable_net: Optional[float] = None

    commission_total: Optional[float] = None

    sell_total: Optional[float] = None

    grand_total: Optional[float] = None


class DestinationRangePatch(BaseModel):
    start_date: date
    nights: conint(ge=1)
    destination: constr(strip_whitespace=True, min_length=1)
    overwrite: bool = True
