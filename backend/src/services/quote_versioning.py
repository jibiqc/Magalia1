"""
Utilities for quote versioning: snapshot creation, label generation, and version type management.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from ..models_quote import Quote, QuoteVersion

logger = logging.getLogger(__name__)


# Version type constants
VERSION_TYPE_MANUAL = "manual"
VERSION_TYPE_AUTO_EXPORT_WORD = "auto_export_word"
VERSION_TYPE_AUTO_EXPORT_PDF = "auto_export_pdf"
VERSION_TYPE_AUTO_EXPORT_EXCEL = "auto_export_excel"
VERSION_TYPE_AUTO_INITIAL = "auto_initial"
VERSION_TYPE_AUTO_BEFORE_RESTORE = "auto_before_restore"

# Export type constants
EXPORT_TYPE_WORD = "word"
EXPORT_TYPE_PDF = "pdf"
EXPORT_TYPE_EXCEL = "excel"


def build_quote_snapshot(quote: Quote, db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Build a complete JSON snapshot of a quote in QuoteOut format.
    
    This snapshot contains all quote metadata, days, lines, and computed totals,
    sufficient to fully restore the quote later.
    
    Args:
        quote: The Quote instance to snapshot
        db: Optional database session (for image enrichment if needed)
    
    Returns:
        Dictionary representation of the quote (same format as QuoteOut API response)
    """
    # Import here to avoid circular dependency
    from ..api.quotes import _to_out
    quote_out = _to_out(quote, db=db, include_first_image=False)
    # Convert Pydantic model to dict for JSON storage
    return quote_out.model_dump()


def compute_total_price(quote: Quote) -> Optional[float]:
    """
    Compute the total selling price (grand_total) for a quote snapshot.
    
    Uses the stored grand_total from the quote, which should already be computed.
    
    Args:
        quote: The Quote instance
    
    Returns:
        The grand_total as float, or None if not available
    """
    if quote.grand_total is not None:
        return float(quote.grand_total)
    return None


def get_next_version_label(db: Session, quote_id: int) -> str:
    """
    Generate the next version label (v1, v2, v3, ...) for a quote.
    
    Finds the highest version number among non-archived versions and increments it.
    
    Args:
        db: Database session
        quote_id: ID of the quote
    
    Returns:
        Next version label (e.g., "v1", "v2", "v3")
    """
    # Find the last non-archived version for this quote
    last_version = (
        db.query(QuoteVersion)
        .filter(
            QuoteVersion.quote_id == quote_id,
            QuoteVersion.archived_at.is_(None)
        )
        .order_by(QuoteVersion.created_at.desc())
        .first()
    )
    
    if not last_version:
        return "v1"
    
    # Extract number from label (e.g., "v5" -> 5)
    import re
    match = re.match(r'v(\d+)', last_version.label)
    if match:
        next_num = int(match.group(1)) + 1
    else:
        # If label doesn't match pattern, start from 1
        next_num = 1
    
    return f"v{next_num}"


def should_create_auto_version(db: Session, quote_id: int, version_type: str) -> bool:
    """
    Check if an automatic version should be created (throttle: max 1 per hour per quote/type).
    
    Args:
        db: Database session
        quote_id: ID of the quote
        version_type: Type of version (e.g., VERSION_TYPE_AUTO_EXPORT_WORD)
    
    Returns:
        True if version should be created, False if throttled
    """
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    
    recent_version = (
        db.query(QuoteVersion)
        .filter(
            QuoteVersion.quote_id == quote_id,
            QuoteVersion.type == version_type,
            QuoteVersion.created_at >= one_hour_ago,
            QuoteVersion.archived_at.is_(None)
        )
        .first()
    )
    
    # If no recent version exists, allow creation
    return recent_version is None


def apply_snapshot_to_quote(quote: Quote, snapshot_json: Dict[str, Any], db: Session) -> None:
    """
    Apply a snapshot JSON to a quote, replacing all fields, days, and lines.
    
    This function overwrites the quote's current state with the snapshot data,
    following the same pattern as upsert_quote (delete all days, recreate from snapshot).
    
    Args:
        quote: The Quote instance to update
        snapshot_json: The snapshot dictionary (QuoteOut format)
        db: Database session
    """
    from decimal import Decimal
    from datetime import date as dt_date
    from ..models_quote import QuoteDay, QuoteLine
    from ..api.quotes import QuoteLineIn, _upd_line
    
    def _to_date(v):
        if v is None:
            return None
        if isinstance(v, str):
            try:
                return dt_date.fromisoformat(v)
            except ValueError:
                return None
        return v
    
    # Update quote-level fields
    quote.title = snapshot_json.get("title")
    quote.display_title = snapshot_json.get("display_title")
    quote.hero_photo_1 = snapshot_json.get("hero_photo_1")
    quote.hero_photo_2 = snapshot_json.get("hero_photo_2")
    quote.pax = snapshot_json.get("pax")
    quote.start_date = _to_date(snapshot_json.get("start_date"))
    quote.end_date = _to_date(snapshot_json.get("end_date"))
    quote.travel_agency = snapshot_json.get("travel_agency")
    quote.travel_advisor = snapshot_json.get("travel_advisor")
    quote.client_name = snapshot_json.get("client_name")
    quote.fx_rate = Decimal(str(snapshot_json["fx_rate"])) if snapshot_json.get("fx_rate") is not None else None
    quote.internal_note = snapshot_json.get("internal_note")
    
    # Cost fields
    if snapshot_json.get("margin_pct") is not None:
        quote.margin_pct = Decimal(str(snapshot_json["margin_pct"]))
    quote.onspot_manual = Decimal(str(snapshot_json["onspot_manual"])) if snapshot_json.get("onspot_manual") is not None else None
    quote.hassle_manual = Decimal(str(snapshot_json["hassle_manual"])) if snapshot_json.get("hassle_manual") is not None else None
    
    # Replace all days/lines (same pattern as upsert_quote)
    for d in list(quote.days):
        db.delete(d)
    db.flush()
    
    # Recreate days and lines from snapshot
    days_data = snapshot_json.get("days") or []
    for idx, day_data in enumerate(days_data):
        day = QuoteDay(
            quote_id=quote.id,
            position=idx,
            date=_to_date(day_data.get("date")),
            destination=day_data.get("destination"),
            decorative_images=day_data.get("decorative_images") or []
        )
        db.add(day)
        db.flush()
        
        # Recreate lines
        lines_data = day_data.get("lines") or []
        for li_idx, line_data in enumerate(lines_data):
            # Create QuoteLineIn from snapshot data
            line_in = QuoteLineIn(
                position=line_data.get("position"),
                service_id=line_data.get("service_id"),
                category=line_data.get("category"),
                title=line_data.get("title"),
                supplier_name=line_data.get("supplier_name"),
                visibility=line_data.get("visibility"),
                achat_eur=line_data.get("achat_eur"),
                achat_usd=line_data.get("achat_usd"),
                vente_usd=line_data.get("vente_usd"),
                fx_rate=line_data.get("fx_rate"),
                currency=line_data.get("currency"),
                base_net_amount=line_data.get("base_net_amount"),
                raw_json=line_data.get("raw_json")
            )
            
            line = QuoteLine(quote_day_id=day.id, position=li_idx)
            _upd_line(line, line_in)
            db.add(line)


def create_before_restore_version(
    quote: Quote,
    original_version: QuoteVersion,
    db: Session,
    created_by: Optional[str] = None
) -> QuoteVersion:
    """
    Create an automatic version capturing the current state before restoring another version.
    
    Args:
        quote: The Quote instance (current state)
        original_version: The version that will be restored
        db: Database session
        created_by: Email of the user performing the restore
    
    Returns:
        The created QuoteVersion instance
    """
    # Build snapshot of current state
    snapshot_json = build_quote_snapshot(quote, db=db)
    total_price = compute_total_price(quote)
    
    # Generate label
    label = get_next_version_label(db, quote.id)
    
    # Create version with auto comment
    comment = f"Auto: state before restore from {original_version.label}"
    
    from decimal import Decimal
    version = QuoteVersion(
        quote_id=quote.id,
        label=label,
        comment=comment,
        created_by=created_by,
        type=VERSION_TYPE_AUTO_BEFORE_RESTORE,
        total_price=Decimal(str(total_price)) if total_price is not None else None,
        snapshot_json=snapshot_json
    )
    
    db.add(version)
    db.flush()
    
    return version


def create_auto_version(
    quote: Quote,
    version_type: str,
    db: Session,
    created_by: Optional[str] = None,
    export_type: Optional[str] = None,
    export_file_name: Optional[str] = None,
    comment: Optional[str] = None
) -> Optional[QuoteVersion]:
    """
    Create an automatic version for a quote.
    
    This function checks throttling and creates a version if allowed.
    Returns None if throttled or if creation fails (non-blocking).
    
    Args:
        quote: The Quote instance
        version_type: Type of version (e.g., VERSION_TYPE_AUTO_EXPORT_WORD)
        db: Database session
        created_by: Email of the user (optional)
        export_type: Type of export (word, pdf, excel) if applicable
        export_file_name: Name of the exported file if applicable
        comment: Custom comment (if None, uses default based on type)
    
    Returns:
        The created QuoteVersion instance, or None if throttled/failed
    """
    try:
        # Check throttle for auto versions (except initial, which should always be created)
        if version_type != VERSION_TYPE_AUTO_INITIAL:
            if not should_create_auto_version(db, quote.id, version_type):
                logger.debug(f"Skipping auto version creation for quote {quote.id}, type {version_type} (throttled)")
                return None
        
        # Build snapshot
        snapshot_json = build_quote_snapshot(quote, db=db)
        total_price = compute_total_price(quote)
        
        # Generate label
        label = get_next_version_label(db, quote.id)
        
        # Default comment if not provided
        if comment is None:
            if version_type == VERSION_TYPE_AUTO_INITIAL:
                comment = "Initial version on quote creation"
            elif version_type == VERSION_TYPE_AUTO_EXPORT_WORD:
                comment = "Auto version on Word export"
            elif version_type == VERSION_TYPE_AUTO_EXPORT_PDF:
                comment = "Auto version on PDF export"
            elif version_type == VERSION_TYPE_AUTO_EXPORT_EXCEL:
                comment = "Auto version on Excel export"
            else:
                comment = f"Auto version ({version_type})"
        
        # Create version
        from decimal import Decimal
        version = QuoteVersion(
            quote_id=quote.id,
            label=label,
            comment=comment,
            created_by=created_by,
            type=version_type,
            export_type=export_type,
            export_file_name=export_file_name,
            total_price=Decimal(str(total_price)) if total_price is not None else None,
            snapshot_json=snapshot_json
        )
        
        db.add(version)
        db.flush()
        
        return version
    except Exception as e:
        # Log error but don't break the calling operation
        logger.error(f"Failed to create auto version for quote {quote.id}, type {version_type}: {e}", exc_info=True)
        return None

