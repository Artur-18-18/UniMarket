from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class MessageCreate(BaseModel):
    content: str

class MessageOut(BaseModel):
    id: int
    user_id: int
    sender: str
    content: str
    created_at: datetime
    is_read: bool

    class Config:
        from_attributes = True
