from pydantic import BaseModel
from typing import Optional

class CarBase(BaseModel):
    brand: str
    model: str
    price: float
    year: int

class CarCreate(CarBase):
    pass

class CarResponse(CarBase):
    id: int
    owner_id: int
    image_url: Optional[str] = None

    # Правильный блок конфигурации внутри класса
    class Config:
        from_attributes = True 