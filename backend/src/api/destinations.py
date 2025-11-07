from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..db import get_db
from ..models_geo import Destination
from .schemas_geo import DestinationIn, DestinationOut

router = APIRouter(prefix="/destinations", tags=["destinations"])

@router.get("", response_model=List[DestinationOut])
def list_destinations(
    query: Optional[str] = Query(None, description="Filter by name prefix"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """List destinations, optionally filtered by query string."""
    q = db.query(Destination)
    if query:
        # Case-insensitive prefix match
        q = q.filter(func.lower(Destination.name).like(func.lower(f"{query}%")))
    q = q.order_by(Destination.name).limit(limit)
    return q.all()

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

