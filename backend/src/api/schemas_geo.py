from typing import Optional
from pydantic import BaseModel, constr

class DestinationIn(BaseModel):
    name: constr(strip_whitespace=True, min_length=1)

class DestinationOut(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True

