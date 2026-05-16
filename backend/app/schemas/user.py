from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from app.models.user import UserRole

# Shared properties
class UserBase(BaseModel):
    email: EmailStr
    username: str
    role: UserRole = UserRole.CITIZEN # Default role

# Properties to receive via API on creation
class UserCreate(BaseModel):
    email: EmailStr
    username: Optional[str] = None  # If None, backend auto-generates
    role: UserRole = UserRole.CITIZEN
    password: str
    state_id: Optional[int] = None
    city_id: Optional[int] = None
    department_id: Optional[int] = None

from datetime import datetime

# Properties to return to client (Notice no hashed_password here!)
class UserResponse(UserBase):
    id: int
    is_active: bool
    points: int
    title: str
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None
    notifications_enabled: bool

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
