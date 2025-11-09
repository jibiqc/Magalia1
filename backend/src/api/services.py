from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, desc, func
from sqlalchemy import inspect

from ..db import get_db
from ..models.prod_models import ServiceCatalog, ServicePopularity, Supplier
from .schemas_services import ServiceOut
from typing import List, Optional


router = APIRouter(prefix="/services", tags=["services"])


# --- Excel extras → normalized fields ----------------------------------------
CANON = {
    # Common
    "URL (Image) (File)": "image_url",
    "Image": "image_url",
    "Important Quote": "important_quote",
    "Provider Service URL": "provider_service_url",
    "Full Description": "full_description",
    "Brief Description": "brief_description",
    "Client Black Notes": "client_black_notes",
    "Client Red Notes": "client_red_notes",
    "NoteDoc": "note_doc",
    "NoteResa": "note_resa",
    "Operational Comments": "operational_comments",
    # Activities
    "Activity Contact Info": "activity_contact_info",
    "Activity Duration": "activity_duration",
    "Activity Meeting Point": "activity_meeting_point",
    "Start Time": "start_time",
    "End Time": "end_time",
    # Hotels
    "Hotel Stars": "hotel_stars",
    "Hotel URL": "hotel_url",
    "Hotel Check-out time (Company) (Company)": "hotel_check_out_time",
    "Hotel Check-in time (Company) (Company)": "hotel_check_in_time",
    "Meal 1": "meal_1",
    "Email (Company) (Company)": "email_company",
    "Website (Company) (Company)": "website_company",
    "Address 1 (Company) (Company)": "address1_company",
}


def extract_excel_fields(extras: dict) -> dict:
    if not isinstance(extras, dict):
        return {}
    out = {}
    for k, v in extras.items():
        if k in CANON:
            out[CANON[k]] = v
    return out


def serialize_sa_row(row):
    """Serialize SQLAlchemy row to dict with best-effort normalization."""
    if row is None:
        return None
    mapper = inspect(row.__class__)
    data = {}
    for col in mapper.columns:
        v = getattr(row, col.key)
        # best-effort normalization
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        elif v.__class__.__name__ in ("Decimal",):
            v = float(v)
        data[col.key] = v
    return data


# Map high-level groups to concrete category values in DB
CATEGORY_GROUPS: dict[str, list[str]] = {
    "Activity": ["Small Group", "Private", "Private Chauffeur", "Tickets"],
    # extend later: "Transport": ["Private Transfer", "Train", "Flight", "Ferry"], etc.
}


def apply_category_filter(qs, category: str | None, categories: list[str] | None):
    """Apply category filtering: expand groups and combine with explicit categories."""
    cats: set[str] = set()
    if category:
        cats.update(CATEGORY_GROUPS.get(category, [category]))
    if categories:
        cats.update(categories)
    if cats:
        qs = qs.filter(ServiceCatalog.category.in_(list(cats)))
    return qs


@router.get("/popular", response_model=List[ServiceOut])
def get_popular_services(
    dest: Optional[str] = Query(None, description="Filter by destination (start_destination)"),
    category: Optional[str] = Query(None, description="Filter by category group or single category"),
    categories: Optional[List[str]] = Query(default=None, description="Filter by multiple categories"),
    limit: int = Query(12, ge=1, le=50, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """
    Get popular services, optionally filtered by destination and category.
    Popular = top-used in last 24 months (count_365d) or ORDER BY usage_count DESC NULLS LAST.
    """
    # Base query: join ServiceCatalog with ServicePopularity and Supplier
    query = db.query(ServiceCatalog).outerjoin(
        ServicePopularity, ServiceCatalog.id == ServicePopularity.service_id
    ).outerjoin(
        Supplier, ServiceCatalog.supplier_id == Supplier.id
    )
    
    # Filter by destination if provided (case-insensitive)
    dest_col = getattr(ServiceCatalog, "start_destination", None) or getattr(ServiceCatalog, "destination", None)
    if dest and dest_col is not None:
        query = query.filter(func.lower(dest_col) == func.lower(dest))
    
    # Apply category filter (handles groups and multi-cat)
    query = apply_category_filter(query, category, categories)
    
    # Order by popularity (count_365d DESC, then total_count DESC, then NULLS LAST)
    query = query.order_by(
        desc(ServicePopularity.count_365d),
        desc(ServicePopularity.total_count),
        ServiceCatalog.id
    )
    
    # Limit results
    services = query.limit(limit).all()
    
    # Convert to ServiceOut format
    result = []
    for s in services:
        # Get supplier name if available
        supplier_name = None
        if s.supplier_id and s.supplier:
            supplier_name = s.supplier.name
        elif s.company:
            supplier_name = s.company
        
        result.append(ServiceOut(
            id=s.id,
            name=s.name,
            category=s.category,
            supplier_name=supplier_name,
            city=s.city,
            destination=s.start_destination,
            price_currency=s.currency,
            price_value=float(s.net_amount) if s.net_amount is not None else None
        ))
    
    return result


@router.get("/search", response_model=List[ServiceOut])
def search_services(
    q: str = Query(..., min_length=1, description="Search query"),
    dest: Optional[str] = Query(None, description="Filter by destination (start_destination)"),
    category: Optional[str] = Query(None, description="Filter by category group or single category"),
    categories: Optional[List[str]] = Query(default=None, description="Filter by multiple categories"),
    limit: int = Query(20, ge=1, le=50, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """
    Search services by name and supplier.
    Uses ILIKE for case-insensitive matching on name and company/supplier.
    Optional filters by destination and category (supports groups and multi-cat).
    """
    # Base query
    query = db.query(ServiceCatalog).outerjoin(
        Supplier, ServiceCatalog.supplier_id == Supplier.id
    )
    
    # Search: ILIKE on name and supplier (company or supplier.name)
    search_term = f"%{q}%"
    query = query.filter(
        or_(
            ServiceCatalog.name.ilike(search_term),
            ServiceCatalog.company.ilike(search_term),
            Supplier.name.ilike(search_term)
        )
    )
    
    # Optional destination filter (case-insensitive)
    dest_col = getattr(ServiceCatalog, "start_destination", None) or getattr(ServiceCatalog, "destination", None)
    if dest and dest_col is not None:
        query = query.filter(func.lower(dest_col) == func.lower(dest))
    
    # Apply category filter (handles groups and multi-cat)
    query = apply_category_filter(query, category, categories)
    
    # Order by relevance (could be improved with full-text search)
    # For now, order by name for consistency
    query = query.order_by(ServiceCatalog.name)
    
    # Limit results
    services = query.limit(limit).all()
    
    # Convert to ServiceOut format
    result = []
    for s in services:
        # Get supplier name if available
        supplier_name = None
        if s.supplier_id and s.supplier:
            supplier_name = s.supplier.name
        elif s.company:
            supplier_name = s.company
        
        result.append(ServiceOut(
            id=s.id,
            name=s.name,
            category=s.category,
            supplier_name=supplier_name,
            city=s.city,
            destination=s.start_destination,
            price_currency=s.currency,
            price_value=float(s.net_amount) if s.net_amount is not None else None
        ))
    
    return result


@router.get("/{service_id}")
def get_service_by_id(service_id: int, db: Session = Depends(get_db)):
    """Get full service details by ID, including supplier and popularity."""
    svc = (
        db.query(ServiceCatalog)
        .options(joinedload(ServiceCatalog.supplier))
        .filter(ServiceCatalog.id == service_id)
        .first()
    )
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    out = serialize_sa_row(svc)
    # Prefer already-serialized extras if present
    extras = out.get("extras") or getattr(svc, "extras", None) or {}
    # Debug: ensure extras is a dict
    if extras and not isinstance(extras, dict):
        extras = {}
    # Extract normalized fields from extras
    fields = extract_excel_fields(extras) if extras else {}
    out["fields"] = fields
    if getattr(svc, "supplier", None) is not None:
        out["supplier"] = serialize_sa_row(svc.supplier)
    # Popularity if model exists
    try:
        pop = (
            db.query(ServicePopularity)
            .filter(ServicePopularity.service_id == service_id)
            .one_or_none()
        )
        if pop:
            out["popularity"] = serialize_sa_row(pop)
    except Exception:
        pass
    return out

