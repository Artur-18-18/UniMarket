from pydantic import BaseModel
from typing import List

class OrderCreate(BaseModel):
    items: List[int]

class PurchaseOut(BaseModel):
    id: int
    car_id: int
    buyer_id: int
    price: float

    class Config:
        from_attributes = True
