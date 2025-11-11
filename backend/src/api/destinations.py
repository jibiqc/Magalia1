from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

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
    """
    List all destinations, optionally filtered by name prefix.
    """
    qs = db.query(Destination)
    
    if query:
        qs = qs.filter(func.lower(Destination.name).like(f"%{query.lower()}%"))
    
    qs = qs.order_by(Destination.name).limit(limit)
    
    results = qs.all()
    return [DestinationOut(id=d.id, name=d.name) for d in results]


@router.post("", response_model=DestinationOut)
def create_destination(
    payload: DestinationIn,
    db: Session = Depends(get_db)
):
    """
    Create a new destination.
    """
    # Check if destination already exists (case-insensitive)
    existing = db.query(Destination).filter(
        func.lower(Destination.name) == func.lower(payload.name.strip())
    ).first()
    
    if existing:
        return DestinationOut(id=existing.id, name=existing.name)
    
    new_dest = Destination(name=payload.name.strip())
    db.add(new_dest)
    db.commit()
    db.refresh(new_dest)
    
    return DestinationOut(id=new_dest.id, name=new_dest.name)



