from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional, Any
from app.models.user import UserRole

# Shared properties
class UserBase(BaseModel):
    email: EmailStr
    username: str
    role: UserRole = UserRole.CITIZEN

# Properties to receive via API on creation (Supabase Sync)
# NOTE: role is intentionally NOT accepted from the client to prevent privilege escalation.
class UserSync(BaseModel):
    email: EmailStr
    username: str
    city_id: Optional[int] = None

# Properties to return to client (no hashed_password)
class UserResponse(UserBase):
    id: int
    is_active: bool
    points: int
    title: Optional[str] = None      # derived from level.title
    level_number: Optional[int] = None  # derived from level.level
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None
    notifications_enabled: bool

    @model_validator(mode='before')
    @classmethod
    def populate_level_fields(cls, data: Any) -> Any:
        # Works for both ORM objects and dicts
        if hasattr(data, 'level') and data.level is not None:
            data.__dict__['title'] = data.level.title
            data.__dict__['level_number'] = data.level.level
        elif isinstance(data, dict):
            level = data.get('level')
            if level:
                data['title'] = level.title
                data['level_number'] = level.level
        return data

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    username: Optional[str] = None
    notifications_enabled: Optional[bool] = None

class PushTokenUpdate(BaseModel):
    token: str


