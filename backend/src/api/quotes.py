from datetime import date as dt_date

from decimal import Decimal, ROUND_HALF_UP

from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query

from sqlalchemy.orm import Session

from sqlalchemy import desc

from ..db import get_db

from ..models_quote import Quote, QuoteDay, QuoteLine

from .schemas_quote import QuoteIn, QuoteOut



router = APIRouter(prefix="/quotes", tags=["quotes"])



def _to_date(v):

    if v is None: return None

    if isinstance(v, str):

        try: return dt_date.fromisoformat(v)

        except ValueError: return None

    return v



def _date_str(v):

    return v.isoformat() if isinstance(v, dt_date) else (v or None)



def _to_out(q: Quote) -> QuoteOut:

    days = []

    for d in sorted(q.days, key=lambda x: x.position or 0):

        lines = []

        for l in sorted(d.lines, key=lambda x: x.position or 0):

            lines.append(dict(

                position=l.position, service_id=l.service_id, category=l.category,

                title=l.title, supplier_name=l.supplier_name, visibility=l.visibility,

                achat_eur=float(l.achat_eur) if l.achat_eur is not None else None,

                achat_usd=float(l.achat_usd) if l.achat_usd is not None else None,

                vente_usd=float(l.vente_usd) if l.vente_usd is not None else None,

                fx_rate=float(l.fx_rate) if l.fx_rate is not None else None,

                currency=l.currency, base_net_amount=float(l.base_net_amount) if l.base_net_amount is not None else None,

                raw_json=l.raw_json

            ))

        days.append(dict(

            position=d.position, date=_date_str(d.date), destination=d.destination,

            decorative_images=(d.decorative_images or []), lines=lines

        ))

    return QuoteOut(

        id=q.id, title=q.title, pax=q.pax,

        start_date=_date_str(q.start_date), end_date=_date_str(q.end_date), days=days,

        margin_pct=float(q.margin_pct) if q.margin_pct is not None else None,

        onspot_total=float(q.onspot_total) if q.onspot_total is not None else None,

        hassle_total=float(q.hassle_total) if q.hassle_total is not None else None,

        commissionable_net=float(q.commissionable_net) if q.commissionable_net is not None else None,

        commission_total=float(q.commission_total) if q.commission_total is not None else None,

        sell_total=float(q.sell_total) if q.sell_total is not None else None,

        grand_total=float(q.grand_total) if q.grand_total is not None else None,

    )



def _upd_line(l: QuoteLine, li):

    l.service_id = li.service_id

    l.category = li.category

    l.title = li.title

    l.supplier_name = li.supplier_name

    l.visibility = li.visibility or "client"

    l.achat_eur = Decimal(str(li.achat_eur)) if li.achat_eur is not None else None

    l.achat_usd = Decimal(str(li.achat_usd)) if li.achat_usd is not None else None

    l.vente_usd = Decimal(str(li.vente_usd)) if li.vente_usd is not None else None

    # compute fx if both provided (>0)

    if l.achat_eur and l.achat_usd and l.achat_eur != 0:

        l.fx_rate = (l.achat_usd / l.achat_eur).quantize(Decimal("0.000001"))

    else:

        l.fx_rate = None

    l.currency = li.currency

    l.base_net_amount = Decimal(str(li.base_net_amount)) if li.base_net_amount is not None else None

    l.raw_json = li.raw_json or {}



@router.post("", response_model=QuoteOut)

def create_quote(payload: QuoteIn, db: Session = Depends(get_db)):

    q = Quote(

        title=payload.title, pax=payload.pax,

        start_date=_to_date(payload.start_date), end_date=_to_date(payload.end_date),

        margin_pct=Decimal(str(payload.margin_pct)) if payload.margin_pct is not None else Decimal("0.1627"),

        onspot_manual=Decimal(str(payload.onspot_manual)) if payload.onspot_manual is not None else None,

        hassle_manual=Decimal(str(payload.hassle_manual)) if payload.hassle_manual is not None else None,

    )

    db.add(q); db.flush()

    for idx, d in enumerate(payload.days or []):

        day = QuoteDay(quote_id=q.id, position=idx, date=_to_date(d.date),

                       destination=d.destination, decorative_images=d.decorative_images or [])

        db.add(day); db.flush()

        for li_idx, li in enumerate(d.lines or []):

            line = QuoteLine(quote_day_id=day.id, position=li_idx)

            _upd_line(line, li); db.add(line)

    db.commit(); db.refresh(q)

    return _to_out(q)



@router.get("/recent")

def recent_quotes(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):

    qs = db.query(Quote).order_by(desc(Quote.updated_at)).limit(limit).all()

    return {"items":[{"id":q.id,"title":q.title,"pax":q.pax,

                      "start_date":_date_str(q.start_date),"end_date":_date_str(q.end_date),

                      "updated_at":(q.updated_at.isoformat() if q.updated_at else None)} for q in qs]}



@router.get("/{quote_id}", response_model=QuoteOut)

def get_quote(quote_id: int, db: Session = Depends(get_db)):

    q = db.query(Quote).filter(Quote.id==quote_id).first()

    if not q: raise HTTPException(status_code=404, detail="Quote not found")

    return _to_out(q)



@router.put("/{quote_id}", response_model=QuoteOut)

def upsert_quote(quote_id: int, payload: QuoteIn, db: Session = Depends(get_db)):

    q = db.query(Quote).filter(Quote.id==quote_id).first()

    if not q:

        q = Quote(id=quote_id); db.add(q); db.flush()

    q.title = payload.title

    q.pax = payload.pax

    q.start_date = _to_date(payload.start_date)

    q.end_date = _to_date(payload.end_date)

    if payload.margin_pct is not None: q.margin_pct = Decimal(str(payload.margin_pct))

    q.onspot_manual = Decimal(str(payload.onspot_manual)) if payload.onspot_manual is not None else q.onspot_manual

    q.hassle_manual = Decimal(str(payload.hassle_manual)) if payload.hassle_manual is not None else q.hassle_manual



    # replace days/lines

    for d in list(q.days): db.delete(d)

    db.flush()

    for idx, d in enumerate(payload.days or []):

        day = QuoteDay(quote_id=q.id, position=idx, date=_to_date(d.date),

                       destination=d.destination, decorative_images=d.decorative_images or [])

        db.add(day); db.flush()

        for li_idx, li in enumerate(d.lines or []):

            line = QuoteLine(quote_day_id=day.id, position=li_idx)

            _upd_line(line, li); db.add(line)



    db.commit(); db.refresh(q)

    return _to_out(q)



# --------- Reprice endpoint (applies your business rules) ----------

@router.post("/{quote_id}/reprice")
async def reprice_quote(quote_id: int, db: Session = Depends(get_db)):
    import math
    from datetime import date

    def _to_date(v):
        if not v: return None
        if isinstance(v, date): return v
        try: return date.fromisoformat(str(v))
        except: return None

    q = db.query(Quote).filter(Quote.id == quote_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quote not found")

    # compute days
    sd = _to_date(q.start_date)
    ed = _to_date(q.end_date)
    if sd and ed and ed >= sd:
        total_days = (ed - sd).days + 1
    else:
        total_days = max(len(q.days), 0)

    pax = q.pax or 0
    cards = math.ceil(pax/6) if pax>0 else 0
    onspot_auto = cards * 9 * total_days
    onspot_total = q.onspot_manual if q.onspot_manual is not None else onspot_auto

    hassle_auto = pax * 150
    hassle_total = q.hassle_manual if q.hassle_manual is not None else hassle_auto

    # paid lines only
    paid_lines = []
    for d in q.days:
        for l in d.lines:
            c = (l.category or "").lower()
            if c in ("trip info","internal"): 
                continue
            paid_lines.append(l)

    achats_sum = sum(float(l.achat_usd or 0) for l in paid_lines)
    ventes_sum = sum(float(l.vente_usd or 0) for l in paid_lines)

    achats_total = round(onspot_total + achats_sum, 2)
    margin = float(q.margin_pct or 0.1627)
    commission_total = round(achats_total * margin, 2)
    ventes_total = round(ventes_sum + hassle_total, 2)
    grand_total = round(achats_total + commission_total + ventes_total, 2)

    return {
        "quote_id": q.id,
        "pax": pax,
        "days": total_days,
        "onspot_cards": cards,
        "margin_pct": margin,
        "onspot_total": onspot_total,
        "hassle_total": hassle_total,
        "achats_total": achats_total,
        "commission_total": commission_total,
        "ventes_total": ventes_total,
        "grand_total": grand_total
    }
