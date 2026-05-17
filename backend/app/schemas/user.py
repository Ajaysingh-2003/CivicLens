from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional, Any
from app.models.user import UserRole

# Shared properties
class UserBase(BaseModel):
    email: EmailStr
    username: str
    role: UserRole = UserRole.CITIZEN

# Properties to receive via API on creation
class UserCreate(BaseModel):
    email: EmailStr
    username: Optional[str] = None
    role: UserRole = UserRole.CITIZEN
    password: str
    state_id: Optional[int] = None
    city_id: Optional[int] = None
    department_id: Optional[int] = None

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

class PasswordChangeRequest(BaseModel):
    current_password: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    otp_code: str
