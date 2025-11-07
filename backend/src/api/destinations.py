from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from ..db import get_db
from ..models_geo import Destination
from ..models.prod_models import ServiceCatalog
from .schemas_geo import DestinationIn, DestinationOut

router = APIRouter(prefix="/destinations", tags=["destinations"])

@router.get("", response_model=List[DestinationOut])
def list_destinations(
    query: Optional[str] = Query(None, description="Filter by name prefix"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """List destinations, optionally filtered by query string.
    Unions destinations table with distinct start_destination values from ServiceCatalog.
    """
    # Source A: destinations table
    src_a = db.query(Destination.name)
    if query:
        pattern = f"{query}%"
        src_a = src_a.filter(func.lower(Destination.name).like(func.lower(pattern)))
    names_a = {row[0] for row in src_a.all()}
    
    # Source B: ServiceCatalog.start_destination (distinct, non-null)
    src_b = db.query(distinct(ServiceCatalog.start_destination).label("name")).filter(
        ServiceCatalog.start_destination.isnot(None),
        ServiceCatalog.start_destination != ""
    )
    if query:
        pattern = f"{query}%"
        src_b = src_b.filter(func.lower(ServiceCatalog.start_destination).like(func.lower(pattern)))
    names_b = {row[0] for row in src_b.all() if row[0]}
    
    # Union both sets
    all_names = sorted(names_a | names_b)
    
    # Limit and return as DestinationOut (with id=None for catalog-only destinations)
    results = []
    for name in all_names[:limit]:
        # Try to get the actual Destination record if it exists
        dest_record = db.query(Destination).filter(
            func.lower(Destination.name) == func.lower(name)
        ).first()
        if dest_record:
            results.append(DestinationOut(id=dest_record.id, name=dest_record.name))
        else:
            # Catalog-only destination (no id)
            results.append(DestinationOut(id=None, name=name))
    
    return results

@router.post("", response_model=DestinationOut)
def create_destination(
    payload: DestinationIn,
    db: Session = Depends(get_db)
):
    """Create a destination if it doesn't exist (case-insensitive check)."""
    # Normalize: trim and check case-insensitive uniqueness
    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Destination name cannot be empty")
    
    # Check if exists (case-insensitive)
    existing = db.query(Destination).filter(
        func.lower(Destination.name) == func.lower(name_clean)
    ).first()
    
    if existing:
        return existing
    
    # Create new
    dest = Destination(name=name_clean)
    db.add(dest)
    db.commit()
    db.refresh(dest)
    return dest

