import logging
from datetime import date as dt_date
import math
from decimal import Decimal, ROUND_HALF_UP

from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response

from sqlalchemy.orm import Session

from sqlalchemy import desc

from ..db import get_db

from ..models_quote import Quote, QuoteDay, QuoteLine, QuoteVersion

from .schemas_quote import QuoteIn, QuoteOut, DestinationRangePatch, QuoteDayOut, QuoteVersionIn, QuoteVersionOut, QuoteVersionDetailOut, QuoteVersionListOut, QuoteVersionPatch
from typing import List, Optional, Dict

from ..models.prod_models import ServiceImage

from ..api.auth import get_current_user
from ..services.quote_versioning import (
    build_quote_snapshot,
    compute_total_price,
    get_next_version_label,
    apply_snapshot_to_quote,
    create_before_restore_version,
    VERSION_TYPE_MANUAL
)

logger = logging.getLogger(__name__)



router = APIRouter(prefix="/quotes", tags=["quotes"])



def _to_date(v):

    if v is None: return None

    if isinstance(v, str):

        try: return dt_date.fromisoformat(v)

        except ValueError: return None

    return v



def _date_str(v):

    return v.isoformat() if isinstance(v, dt_date) else (v or None)


def _days_count(q):
    """Calcule le nombre de jours à partir de la liste des jours ou de la différence de dates."""
    if q.days:
        return len(q.days)
    # sinon on tombe sur le diff de dates inclusif
    try:
        d0 = q.start_date if isinstance(q.start_date, dt_date) else dt_date.fromisoformat(q.start_date)
        d1 = q.end_date   if isinstance(q.end_date,   dt_date) else dt_date.fromisoformat(q.end_date)
        return max(0, (d1 - d0).days + 1)
    except Exception:
        return 0


def compute_onspot(q):
    """Calcule le montant Onspot avec minimum 3 jours par carte."""
    pax = q.pax or 0
    cards = max(1, math.ceil((pax or 1) / 6))
    trip_days = _days_count(q)
    effective_days = max(trip_days, 3)  # **minimum 3 jours par carte**
    auto_val = cards * 9 * effective_days
    return q.onspot_manual if q.onspot_manual is not None else Decimal(str(auto_val))



def _to_out(q: Quote, db: Optional[Session] = None, include_first_image: bool = False) -> QuoteOut:

    days = []

    # Optional enrichment: prefetch first image URL per service_id in one pass
    first_img_by_service: Dict[int, str] = {}
    if include_first_image and db is not None:
        try:
            service_ids = []
            for d in q.days or []:
                for l in d.lines or []:
                    if getattr(l, "service_id", None):
                        service_ids.append(int(l.service_id))
            # dedupe to limit query
            service_ids = list({sid for sid in service_ids})
            if service_ids:
                imgs = (
                    db.query(ServiceImage)
                    .filter(ServiceImage.service_id.in_(service_ids))
                    .order_by(ServiceImage.service_id.asc(), ServiceImage.id.asc())
                    .all()
                )
                for img in imgs:
                    sid = getattr(img, "service_id", None)
                    url = getattr(img, "url", None)
                    if sid and url and sid not in first_img_by_service:
                        first_img_by_service[sid] = url
        except Exception:
            # Fail silently; exporter will tolerate missing images
            first_img_by_service = {}

    for d in sorted(q.days, key=lambda x: x.position or 0):

        lines = []

        for l in sorted(d.lines, key=lambda x: x.position or 0):
            # Optional first image url per line
            first_image_url = None
            if include_first_image and first_img_by_service and getattr(l, "service_id", None):
                first_image_url = first_img_by_service.get(int(l.service_id))

            lines.append(dict(

                id=l.id, position=l.position, service_id=l.service_id, category=l.category,

                title=l.title, supplier_name=l.supplier_name, visibility=l.visibility,

                achat_eur=float(l.achat_eur) if l.achat_eur is not None else None,

                achat_usd=float(l.achat_usd) if l.achat_usd is not None else None,

                vente_usd=float(l.vente_usd) if l.vente_usd is not None else None,

                fx_rate=float(l.fx_rate) if l.fx_rate is not None else None,

                currency=l.currency, base_net_amount=float(l.base_net_amount) if l.base_net_amount is not None else None,

                raw_json=l.raw_json,

                **({"first_image_url": first_image_url} if include_first_image else {})

            ))

        days.append(dict(

            id=d.id, position=d.position, date=_date_str(d.date), destination=d.destination,

            decorative_images=(d.decorative_images or []), lines=lines

        ))

    # Forcer le fallback pour margin_pct si null (pour d'anciens enregistrements)
    margin_pct = float(q.margin_pct) if q.margin_pct is not None else 0.1627

    return QuoteOut(

        id=q.id, title=q.title, pax=q.pax,

        display_title=q.display_title,

        hero_photo_1=q.hero_photo_1,

        hero_photo_2=q.hero_photo_2,

        start_date=_date_str(q.start_date), end_date=_date_str(q.end_date), days=days,

        # New fields
        travel_agency=q.travel_agency,
        travel_advisor=q.travel_advisor,
        client_name=q.client_name,
        fx_rate=float(q.fx_rate) if q.fx_rate is not None else None,
        internal_note=q.internal_note,

        margin_pct=margin_pct,

        onspot_manual=float(q.onspot_manual) if q.onspot_manual is not None else None,

        hassle_manual=float(q.hassle_manual) if q.hassle_manual is not None else None,

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

    # Preserve raw_json first to check for buff_pct
    raw_json = li.raw_json if li.raw_json is not None else {}
    
    # Check if buff_pct is present - if so, don't auto-recalculate FX
    has_buff_pct = raw_json and isinstance(raw_json, dict) and raw_json.get("buff_pct") is not None
    
    # compute fx if both provided (>0) AND no buff_pct is present
    # If buff_pct is present, preserve the fx_rate from input (or existing value)
    if has_buff_pct:
        # Preserve fx_rate from input if provided, otherwise keep existing
        if li.fx_rate is not None:
            l.fx_rate = Decimal(str(li.fx_rate)).quantize(Decimal("0.000001"))
        # else: keep existing fx_rate (don't overwrite)
    elif l.achat_eur and l.achat_usd and l.achat_usd != 0:
        # Only auto-calculate FX if no buff_pct and both values provided
        l.fx_rate = (l.achat_eur / l.achat_usd).quantize(Decimal("0.000001"))
    else:
        # Use fx_rate from input if provided, otherwise None
        if li.fx_rate is not None:
            l.fx_rate = Decimal(str(li.fx_rate)).quantize(Decimal("0.000001"))
        else:
            l.fx_rate = None

    l.currency = li.currency

    l.base_net_amount = Decimal(str(li.base_net_amount)) if li.base_net_amount is not None else None

    # PRESERVE raw_json exactly as received (don't replace with {} if None)
    # This ensures all fields from frontend are preserved
    if li.raw_json is not None:
        l.raw_json = li.raw_json
    else:
        l.raw_json = {}



@router.post("", response_model=QuoteOut)

def create_quote(payload: QuoteIn, db: Session = Depends(get_db)):

    q = Quote(

        title=payload.title, pax=payload.pax,

        display_title=payload.display_title,

        hero_photo_1=payload.hero_photo_1,

        hero_photo_2=payload.hero_photo_2,

        start_date=_to_date(payload.start_date), end_date=_to_date(payload.end_date),

        # New fields
        travel_agency=payload.travel_agency,
        travel_advisor=payload.travel_advisor,
        client_name=payload.client_name,
        fx_rate=Decimal(str(payload.fx_rate)) if payload.fx_rate is not None else None,
        internal_note=payload.internal_note,

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
            # DEBUG: Log raw_json before saving
            if li.raw_json and li.category in ("Flight", "Train", "Ferry", "Car Rental", "Trip info"):
                logger.debug(f"[create_quote] Line {li_idx} ({li.category}): raw_json keys = {list(li.raw_json.keys())}")
                logger.debug(f"[create_quote] Full raw_json: {li.raw_json}")
            
            line = QuoteLine(quote_day_id=day.id, position=li_idx)

            _upd_line(line, li); db.add(line)

    db.commit(); db.refresh(q)
    
    # Create initial automatic version
    try:
        from ..services.quote_versioning import create_auto_version, VERSION_TYPE_AUTO_INITIAL
        # Note: create_quote doesn't have request context, so created_by will be None
        create_auto_version(
            quote=q,
            version_type=VERSION_TYPE_AUTO_INITIAL,
            db=db,
            created_by=None
        )
        # Commit version creation (separate transaction to not break quote creation)
        db.commit()
    except Exception as e:
        # Log but don't fail quote creation if version creation fails
        logger.warning(f"Failed to create initial version for quote {q.id}: {e}")
        db.rollback()  # Rollback only the version creation attempt

    return _to_out(q)



@router.get("/recent")

def recent_quotes(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):

    qs = db.query(Quote).order_by(desc(Quote.updated_at)).limit(limit).all()

    return {"items":[{"id":q.id,"title":q.title,"pax":q.pax,

                      "start_date":_date_str(q.start_date),"end_date":_date_str(q.end_date),

                      "updated_at":(q.updated_at.isoformat() if q.updated_at else None)} for q in qs]}


@router.get("/search")
def search_quotes(
    query: str = Query(..., description="Search query for quote title"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Search quotes by title (case-insensitive, prefix and word fragment matching).
    """
    if not query or not query.strip():
        return []
    
    search_term = query.strip().lower()
    
    # Search by prefix first (most relevant)
    prefix_matches = db.query(Quote).filter(
        Quote.title.ilike(f"{search_term}%")
    ).order_by(desc(Quote.updated_at)).limit(limit).all()
    
    # If we have fewer results than limit, also search by word fragments
    results = {q.id: q for q in prefix_matches}
    
    if len(results) < limit:
        # Search for quotes where title contains the search term as a word fragment
        fragment_matches = db.query(Quote).filter(
            Quote.title.ilike(f"%{search_term}%")
        ).order_by(desc(Quote.updated_at)).limit(limit * 2).all()
        
        for q in fragment_matches:
            if q.id not in results:
                results[q.id] = q
                if len(results) >= limit:
                    break
    
    return [
        {
            "id": q.id,
            "name": q.title or f"quote_{q.id}",
            "created_at": q.created_at.isoformat() if q.created_at else None,
            "updated_at": q.updated_at.isoformat() if q.updated_at else None,
        }
        for q in list(results.values())[:limit]
    ]


@router.get("/{quote_id}/export/word")
def export_quote_word(quote_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Export a quote to Word format (.docx).
    Returns the Word document as a downloadable file.
    Automatically creates a version after successful export.
    """
    # Import here to avoid circular import
    from ..exports.word import build_docx_for_quote
    from ..services.quote_versioning import create_auto_version, VERSION_TYPE_AUTO_EXPORT_WORD, EXPORT_TYPE_WORD
    import re
    
    q = db.query(Quote).filter(Quote.id == quote_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    try:
        buf = build_docx_for_quote(db, quote_id)
        # Generate filename from quote title only (no date)
        base_name = q.title or f"quote_{quote_id}"
        # Clean filename: remove invalid characters
        safe_name = re.sub(r'[<>:"/\\|?*]', '_', base_name)
        safe_name = safe_name.strip()[:200]  # Limit length
        filename = f"{safe_name}.docx"
        
        # Create automatic version after successful export
        try:
            user = get_current_user(request, db)
            created_by = user.email if user else None
            create_auto_version(
                quote=q,
                version_type=VERSION_TYPE_AUTO_EXPORT_WORD,
                db=db,
                created_by=created_by,
                export_type=EXPORT_TYPE_WORD,
                export_file_name=filename
            )
            db.commit()
        except Exception as e:
            # Log but don't fail export if version creation fails
            logger.warning(f"Failed to create auto version after Word export for quote {quote_id}: {e}")
            db.rollback()
        
        return Response(
            content=buf.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        logger.error(f"ERROR in export_quote_word: {e}\n{error_detail}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{quote_id}/export/excel")
def export_quote_excel(
    quote_id: int,
    request: Request,
    create_version: bool = Query(False, description="Create an automatic version after export"),
    db: Session = Depends(get_db)
):
    """
    Export a quote to Excel format (.xlsx).
    Returns the Excel file as a downloadable file.
    Optionally creates a version if create_version=true.
    """
    from ..exports.excel import build_xlsx_for_quote
    from ..services.quote_versioning import create_auto_version, VERSION_TYPE_AUTO_EXPORT_EXCEL, EXPORT_TYPE_EXCEL
    import re
    
    q = db.query(Quote).filter(Quote.id == quote_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    try:
        buf = build_xlsx_for_quote(db, quote_id)
        # Generate filename from quote title only (no date)
        base_name = q.title or f"quote_{quote_id}"
        # Clean filename: remove invalid characters
        safe_name = re.sub(r'[<>:"/\\|?*]', '_', base_name)
        safe_name = safe_name.strip()[:200]  # Limit length
        filename = f"{safe_name}.xlsx"
        
        # Create automatic version if requested
        if create_version:
            try:
                user = get_current_user(request, db)
                created_by = user.email if user else None
                create_auto_version(
                    quote=q,
                    version_type=VERSION_TYPE_AUTO_EXPORT_EXCEL,
                    db=db,
                    created_by=created_by,
                    export_type=EXPORT_TYPE_EXCEL,
                    export_file_name=filename
                )
                db.commit()
            except Exception as e:
                # Log but don't fail export if version creation fails
                logger.warning(f"Failed to create auto version after Excel export for quote {quote_id}: {e}")
                db.rollback()
        
        return Response(
            content=buf.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        logger.error(f"ERROR in export_quote_excel: {e}\n{error_detail}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{quote_id}", response_model=QuoteOut)

def get_quote(quote_id: int, db: Session = Depends(get_db)):

    q = db.query(Quote).filter(Quote.id==quote_id).first()

    if not q: raise HTTPException(status_code=404, detail="Quote not found")

    # Preserve current API shape: do NOT include first_image_url here
    return _to_out(q, db=None, include_first_image=False)



@router.put("/{quote_id}", response_model=QuoteOut)

def upsert_quote(quote_id: int, payload: QuoteIn, db: Session = Depends(get_db)):

    q = db.query(Quote).filter(Quote.id==quote_id).first()

    if not q:

        q = Quote(id=quote_id); db.add(q); db.flush()

    q.title = payload.title

    # Header fields
    q.display_title = payload.display_title

    q.hero_photo_1 = payload.hero_photo_1

    q.hero_photo_2 = payload.hero_photo_2

    q.pax = payload.pax

    q.start_date = _to_date(payload.start_date)

    q.end_date = _to_date(payload.end_date)

    # New fields
    if payload.travel_agency is not None:
        q.travel_agency = payload.travel_agency
    if payload.travel_advisor is not None:
        q.travel_advisor = payload.travel_advisor
    if payload.client_name is not None:
        q.client_name = payload.client_name
    if payload.fx_rate is not None:
        q.fx_rate = Decimal(str(payload.fx_rate))
    if payload.internal_note is not None:
        q.internal_note = payload.internal_note

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
            # DEBUG: Log raw_json before saving
            if li.raw_json and li.category in ("Flight", "Train", "Ferry", "Car Rental", "Trip info"):
                logger.debug(f"[upsert_quote] Line {li_idx} ({li.category}): raw_json keys = {list(li.raw_json.keys())}")
                logger.debug(f"[upsert_quote] Full raw_json: {li.raw_json}")
            
            line = QuoteLine(quote_day_id=day.id, position=li_idx)

            _upd_line(line, li); db.add(line)



    db.commit(); db.refresh(q)
    
    # DEBUG: Log what we're returning
    result = _to_out(q)
    for day in (result.days or []):
        for line in (day.lines or []):
            if line.category in ("Flight", "Train", "Ferry", "Car Rental", "Trip info"):
                logger.debug(f"[upsert_quote] Returning line ({line.category}): raw_json keys = {list(line.raw_json.keys()) if line.raw_json else []}")
    
    return result



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

    # Compute onspot using new logic
    onspot_total = compute_onspot(q)
    
    # Calculate total_days and cards for response
    total_days = _days_count(q)
    pax = q.pax or 0
    cards = max(1, math.ceil((pax or 1) / 6))

    hassle_auto = pax * 150
    hassle_total = float(q.hassle_manual) if q.hassle_manual is not None else hassle_auto

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

    achats_total = round(float(onspot_total) + achats_sum, 2)
    margin = float(q.margin_pct) if q.margin_pct is not None else 0.1627
    commission_total = round(achats_total * margin, 2)
    ventes_total = round(ventes_sum + hassle_total, 2)
    grand_total = round(achats_total + commission_total + ventes_total, 2)

    return {
        "quote_id": q.id,
        "pax": pax,
        "days": total_days,
        "onspot_cards": cards,
        "margin_pct": margin,
        "onspot_total": float(onspot_total),
        "hassle_total": hassle_total,
        "achats_total": achats_total,
        "commission_total": commission_total,
        "ventes_total": ventes_total,
        "grand_total": grand_total
    }


@router.patch("/{quote_id}/days", response_model=List[QuoteDayOut])
def patch_days_by_range(
    quote_id: int,
    payload: DestinationRangePatch,
    db: Session = Depends(get_db)
):
    """Batch update destination for N nights starting from a date."""
    import traceback
    try:
        try:
            from ..services.audit import log_change
        except ImportError as e:
            logger.warning(f"Cannot import log_change: {e}")
            # Create a no-op function if audit is not available
            def log_change(*args, **kwargs):
                pass
        
        from ..models_geo import Destination
        from sqlalchemy import func
        
        # Validate quote exists
        q = db.query(Quote).filter(Quote.id == quote_id).first()
        if not q:
            raise HTTPException(status_code=404, detail="Quote not found")
        
        # Ensure destination exists in destinations table (create if needed)
        dest_name_clean = payload.destination.strip()
        existing_dest = db.query(Destination).filter(
            func.lower(Destination.name) == func.lower(dest_name_clean)
        ).first()
        
        if existing_dest:
            dest_name = existing_dest.name
        else:
            new_dest = Destination(name=dest_name_clean)
            db.add(new_dest)
            db.flush()
            dest_name = new_dest.name
        
        # Determine start date: use day_id if provided, otherwise use start_date
        start_date = None
        if payload.day_id:
            # Find the day by ID and get its date
            start_day = db.query(QuoteDay).filter(
                QuoteDay.id == payload.day_id,
                QuoteDay.quote_id == quote_id
            ).first()
            if not start_day:
                raise HTTPException(status_code=404, detail=f"Day with ID {payload.day_id} not found in quote {quote_id}")
            start_date = start_day.date
        elif payload.start_date:
            # Convert ISO string to date object
            start_date = _to_date(payload.start_date)
            if not start_date:
                raise HTTPException(status_code=400, detail=f"Invalid start_date format: {payload.start_date}")
        else:
            raise HTTPException(status_code=400, detail="Either day_id or start_date must be provided")
        
        if not start_date:
            raise HTTPException(status_code=400, detail="Cannot determine start date: day has no date and start_date not provided")
        
        # Query days where date >= start_date, ordered by date
        days_to_update = db.query(QuoteDay).filter(
            QuoteDay.quote_id == quote_id,
            QuoteDay.date >= start_date
        ).order_by(QuoteDay.date).limit(payload.nights).all()
        
        # Update each day
        updated_days = []
        for day in days_to_update:
            try:
                old_dest = day.destination
                if payload.overwrite:
                    day.destination = dest_name
                # Log the change
                try:
                    log_change(
                        db,
                        actor="system",
                        entity_type="quote_day",
                        entity_id=day.id,
                        field="destination",
                        old_value=(old_dest or ""),
                        new_value=(day.destination or ""),
                    )
                except Exception:
                    pass
                updated_days.append(day)
            except Exception as e:
                logger.error(f"ERROR updating day {day.id}: {e}")
                raise
        
        db.commit()
        
        # Refresh and return as QuoteDayOut
        result = []
        for day in updated_days:
            db.refresh(day)
            lines = []
            for l in sorted(day.lines, key=lambda x: x.position or 0):
                lines.append(dict(
                    id=l.id, position=l.position, service_id=l.service_id, category=l.category,
                    title=l.title, supplier_name=l.supplier_name, visibility=l.visibility,
                    achat_eur=float(l.achat_eur) if l.achat_eur is not None else None,
                    achat_usd=float(l.achat_usd) if l.achat_usd is not None else None,
                    vente_usd=float(l.vente_usd) if l.vente_usd is not None else None,
                    fx_rate=float(l.fx_rate) if l.fx_rate is not None else None,
                    currency=l.currency, base_net_amount=float(l.base_net_amount) if l.base_net_amount is not None else None,
                    raw_json=l.raw_json
                ))
            result.append(QuoteDayOut(
                id=day.id,
                position=day.position,
                date=_date_str(day.date),
                destination=day.destination,
                decorative_images=(day.decorative_images or []),
                lines=lines
            ))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        error_detail = traceback.format_exc()
        logger.error(f"ERROR in patch_days_by_range: {e}\n{error_detail}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# --------- Quote Versioning endpoints ----------

@router.get("/{quote_id}/versions", response_model=QuoteVersionListOut)
def list_quote_versions(
    quote_id: int,
    limit: int = Query(10, ge=1, le=100, description="Number of versions per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    include_archived: bool = Query(False, description="Include archived versions"),
    db: Session = Depends(get_db)
):
    """
    List versions for a quote (paginated, sorted by newest first).
    By default, excludes archived versions.
    """
    # Verify quote exists
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Build query
    query = db.query(QuoteVersion).filter(QuoteVersion.quote_id == quote_id)
    
    # Exclude archived by default
    if not include_archived:
        query = query.filter(QuoteVersion.archived_at.is_(None))
    
    # Get total count
    total = query.count()
    
    # Get paginated results (newest first)
    versions = (
        query
        .order_by(desc(QuoteVersion.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    # Convert to output format
    items = []
    for v in versions:
        items.append(QuoteVersionOut(
            id=v.id,
            quote_id=v.quote_id,
            label=v.label,
            comment=v.comment,
            created_at=v.created_at.isoformat() if v.created_at else None,
            created_by=v.created_by,
            type=v.type,
            export_type=v.export_type,
            export_file_name=v.export_file_name,
            total_price=float(v.total_price) if v.total_price is not None else None,
            archived_at=v.archived_at.isoformat() if v.archived_at else None
        ))
    
    has_more = (offset + len(items)) < total
    
    return QuoteVersionListOut(
        items=items,
        total=total,
        has_more=has_more
    )


@router.get("/{quote_id}/versions/{version_id}", response_model=QuoteVersionDetailOut)
def get_quote_version(
    quote_id: int,
    version_id: int,
    db: Session = Depends(get_db)
):
    """
    Get full details of a specific version, including the complete snapshot JSON.
    """
    # Verify quote exists
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Get version
    version = (
        db.query(QuoteVersion)
        .filter(
            QuoteVersion.id == version_id,
            QuoteVersion.quote_id == quote_id
        )
        .first()
    )
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Return with snapshot
    return QuoteVersionDetailOut(
        id=version.id,
        quote_id=version.quote_id,
        label=version.label,
        comment=version.comment,
        created_at=version.created_at.isoformat() if version.created_at else None,
        created_by=version.created_by,
        type=version.type,
        export_type=version.export_type,
        export_file_name=version.export_file_name,
        total_price=float(version.total_price) if version.total_price is not None else None,
        archived_at=version.archived_at.isoformat() if version.archived_at else None,
        snapshot_json=version.snapshot_json or {}
    )


@router.post("/{quote_id}/versions", response_model=QuoteVersionOut)
def create_quote_version(
    quote_id: int,
    payload: QuoteVersionIn,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Create a manual version of a quote.
    Requires a comment and creates a full snapshot of the current quote state.
    """
    # Verify quote exists
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Get current user (optional, for created_by field)
    user = get_current_user(request, db)
    created_by = user.email if user else None
    
    # Build snapshot
    snapshot_json = build_quote_snapshot(quote, db=db)
    
    # Compute total price
    total_price = compute_total_price(quote)
    
    # Get next version label
    label = get_next_version_label(db, quote_id)
    
    # Create version
    version = QuoteVersion(
        quote_id=quote_id,
        label=label,
        comment=payload.comment,
        created_by=created_by,
        type=VERSION_TYPE_MANUAL,
        total_price=Decimal(str(total_price)) if total_price is not None else None,
        snapshot_json=snapshot_json
    )
    
    db.add(version)
    db.commit()
    db.refresh(version)
    
    # Return created version
    return QuoteVersionOut(
        id=version.id,
        quote_id=version.quote_id,
        label=version.label,
        comment=version.comment,
        created_at=version.created_at.isoformat() if version.created_at else None,
        created_by=version.created_by,
        type=version.type,
        export_type=version.export_type,
        export_file_name=version.export_file_name,
        total_price=float(version.total_price) if version.total_price is not None else None,
        archived_at=version.archived_at.isoformat() if version.archived_at else None
    )


@router.patch("/{quote_id}/versions/{version_id}", response_model=QuoteVersionOut)
def update_quote_version(
    quote_id: int,
    version_id: int,
    payload: QuoteVersionPatch,
    db: Session = Depends(get_db)
):
    """
    Update a version's label and/or comment.
    """
    # Verify quote exists
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Get version
    version = (
        db.query(QuoteVersion)
        .filter(
            QuoteVersion.id == version_id,
            QuoteVersion.quote_id == quote_id
        )
        .first()
    )
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Update fields if provided
    if payload.label is not None:
        version.label = payload.label
    if payload.comment is not None:
        version.comment = payload.comment
    
    db.commit()
    db.refresh(version)
    
    # Return updated version
    return QuoteVersionOut(
        id=version.id,
        quote_id=version.quote_id,
        label=version.label,
        comment=version.comment,
        created_at=version.created_at.isoformat() if version.created_at else None,
        created_by=version.created_by,
        type=version.type,
        export_type=version.export_type,
        export_file_name=version.export_file_name,
        total_price=float(version.total_price) if version.total_price is not None else None,
        archived_at=version.archived_at.isoformat() if version.archived_at else None
    )


@router.post("/{quote_id}/versions/{version_id}/archive", response_model=QuoteVersionOut)
def archive_quote_version(
    quote_id: int,
    version_id: int,
    db: Session = Depends(get_db)
):
    """
    Archive a version (soft delete by setting archived_at).
    Archived versions are excluded from default list view.
    """
    # Verify quote exists
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Get version
    version = (
        db.query(QuoteVersion)
        .filter(
            QuoteVersion.id == version_id,
            QuoteVersion.quote_id == quote_id
        )
        .first()
    )
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Archive (set archived_at)
    from datetime import datetime, timezone
    version.archived_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(version)
    
    # Return archived version
    return QuoteVersionOut(
        id=version.id,
        quote_id=version.quote_id,
        label=version.label,
        comment=version.comment,
        created_at=version.created_at.isoformat() if version.created_at else None,
        created_by=version.created_by,
        type=version.type,
        export_type=version.export_type,
        export_file_name=version.export_file_name,
        total_price=float(version.total_price) if version.total_price is not None else None,
        archived_at=version.archived_at.isoformat() if version.archived_at else None
    )


@router.post("/{quote_id}/versions/{version_id}/restore", response_model=QuoteOut)
def restore_quote_version(
    quote_id: int,
    version_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Restore a quote to a previous version.
    
    This operation:
    1. Creates an automatic "before restore" version of the current state
    2. Applies the snapshot from the specified version to the quote
    3. Returns the restored quote
    
    The "before restore" version ensures you can always undo the restore.
    """
    # Verify quote exists
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    
    # Get version to restore
    version = (
        db.query(QuoteVersion)
        .filter(
            QuoteVersion.id == version_id,
            QuoteVersion.quote_id == quote_id
        )
        .first()
    )
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Get current user (for before-restore version)
    user = get_current_user(request, db)
    created_by = user.email if user else None
    
    # Step 1: Create "before restore" version
    before_restore_version = create_before_restore_version(
        quote=quote,
        original_version=version,
        db=db,
        created_by=created_by
    )
    
    # Step 2: Apply snapshot to quote
    snapshot_json = version.snapshot_json or {}
    if not snapshot_json:
        raise HTTPException(status_code=400, detail="Version snapshot is empty or invalid")
    
    apply_snapshot_to_quote(quote, snapshot_json, db)
    
    # Commit all changes
    db.commit()
    db.refresh(quote)
    
    # Return restored quote
    return _to_out(quote, db=db, include_first_image=False)

