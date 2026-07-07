from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

class NotificationBase(BaseModel):
    title: str
    body: str
    data: Optional[str] = None
    is_read: bool

class NotificationResponse(NotificationBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
