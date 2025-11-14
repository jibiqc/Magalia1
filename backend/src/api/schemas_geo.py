from typing import Optional
from pydantic import BaseModel


class DestinationIn(BaseModel):
    name: str


class DestinationOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True





