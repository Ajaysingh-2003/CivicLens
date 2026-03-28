from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models.user import UserRole

# Shared properties
class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    role: UserRole = UserRole.NGO_ADMIN # Default role for web panel registration

# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str

# Properties to return to client (Notice no hashed_password here!)
class UserResponse(UserBase):
    id: int
    is_active: bool
    points: int
    title: str

    class Config:
        from_attributes = True
