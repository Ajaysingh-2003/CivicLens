from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api import deps
from app.schemas.user import UserCreate, UserResponse
from app.services import user_service
from app.models.user import User

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

@router.post("/register", response_model=UserResponse)
@limiter.limit("3/minute")
def register_user(request: Request, *, db: Session = Depends(deps.get_db), user_in: UserCreate) -> Any:
    """
    Register a new user. Rate limited to 3 registrations/minute per IP.
    """
    user = user_service.get_user_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    user = user_service.create_user(db, user_in=user_in)
    return user

@router.get("/me", response_model=UserResponse)
def read_user_me(current_user: User = Depends(deps.get_current_active_user)) -> Any:
    """
    Read the currently authenticated user based on their JWT.
    """
    return current_user

@router.post("/me/avatar", response_model=UserResponse)
def mock_upload_avatar(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Mock upload: Assign a realistic avatar URL until S3 is integrated"""
    import random
    current_user.avatar_url = f"https://i.pravatar.cc/150?u={current_user.id}{random.randint(1,100)}"
    db.commit()
    db.refresh(current_user)
    return current_user

@router.delete("/me/avatar", response_model=UserResponse)
def remove_avatar(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return current_user
