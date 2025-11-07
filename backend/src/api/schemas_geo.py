from typing import Optional
from pydantic import BaseModel, constr

class DestinationIn(BaseModel):
    name: constr(strip_whitespace=True, min_length=1)

class DestinationOut(BaseModel):
    id: Optional[int] = None  # Allow None for catalog-only destinations
    name: str
    
    class Config:
        from_attributes = True

