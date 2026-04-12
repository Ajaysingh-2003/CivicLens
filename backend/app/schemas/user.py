from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from app.models.user import UserRole

# Shared properties
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = Field(None, alias="full_name")
    role: UserRole = UserRole.CITIZEN # Default role

# Properties to receive via API on creation
class UserCreate(UserBase):
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
    name: Optional[str] = None

    class Config:
        from_attributes = True
