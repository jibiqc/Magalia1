from typing import Optional
from pydantic import BaseModel


class ServiceOut(BaseModel):
    """Minimal service fields for right-rail display."""
    id: int
    name: str
    category: str
    supplier_name: Optional[str] = None
    city: Optional[str] = None
    destination: Optional[str] = None  # start_destination
    price_currency: Optional[str] = None
    price_value: Optional[float] = None

    class Config:
        from_attributes = True





