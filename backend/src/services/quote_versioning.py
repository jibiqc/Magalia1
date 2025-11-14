"""
Utilities for quote versioning: snapshot creation, label generation, and version type management.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from ..models_quote import Quote, QuoteVersion


# Version type constants
VERSION_TYPE_MANUAL = "manual"
VERSION_TYPE_AUTO_EXPORT_WORD = "auto_export_word"
VERSION_TYPE_AUTO_EXPORT_PDF = "auto_export_pdf"
VERSION_TYPE_AUTO_EXPORT_EXCEL = "auto_export_excel"
VERSION_TYPE_AUTO_INITIAL = "auto_initial"

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

