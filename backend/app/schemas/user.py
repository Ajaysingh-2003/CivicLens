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

# Properties to return to client (Notice no hashed_password here!)
class UserResponse(UserBase):
    id: int
    is_active: bool
    points: int
    title: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True
