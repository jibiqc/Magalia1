from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel, constr

from ..db import get_db
from ..models_geo import Destination, DestinationPhoto
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


# ---- Destination photos endpoints ----

class DestinationPhotoIn(BaseModel):
    dest_id: int
    photo_url: constr(strip_whitespace=True, min_length=1, max_length=500)
    increment: Optional[bool] = False

class DestinationPhotoOut(BaseModel):
    id: int
    dest_id: int
    photo_url: str
    usage_count: int

@router.get("/photos", response_model=List[DestinationPhotoOut])
def list_destination_photos(
    dest_id: int = Query(..., description="Destination ID"),
    limit: int = Query(5, ge=1, le=50),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(DestinationPhoto)
        .filter(DestinationPhoto.dest_id == dest_id)
        .order_by(DestinationPhoto.usage_count.desc(), DestinationPhoto.id.asc())
        .limit(limit)
        .all()
    )
    return [
        DestinationPhotoOut(
            id=r.id, dest_id=r.dest_id, photo_url=r.photo_url, usage_count=r.usage_count
        )
        for r in rows
    ]

@router.post("/photos", response_model=DestinationPhotoOut)
def upsert_destination_photo(payload: DestinationPhotoIn, db: Session = Depends(get_db)):
    # Find or create (dest_id, photo_url)
    row = (
        db.query(DestinationPhoto)
        .filter(
            DestinationPhoto.dest_id == payload.dest_id,
            func.lower(DestinationPhoto.photo_url) == func.lower(payload.photo_url),
        )
        .one_or_none()
    )
    if not row:
        row = DestinationPhoto(dest_id=payload.dest_id, photo_url=payload.photo_url, usage_count=0)
        db.add(row)
        db.flush()
    if payload.increment:
        row.usage_count = int(row.usage_count or 0) + 1
    db.commit()
    db.refresh(row)
    return DestinationPhotoOut(
        id=row.id, dest_id=row.dest_id, photo_url=row.photo_url, usage_count=row.usage_count
    )


