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

from pydantic import BaseModel
from app.services import otp_service, email_service
from app.core.security import create_access_token
from app.schemas.token import Token
from datetime import timedelta
from app.core.config import settings

class OTPVerifyRequest(BaseModel):
    email: str
    otp_code: str

@router.post("/register")
@limiter.limit("3/minute")
def register_user(request: Request, *, db: Session = Depends(deps.get_db), user_in: UserCreate) -> Any:
    """
    Register a new user and send an OTP. Rate limited.
    """
    user = user_service.get_user_by_email(db, email=user_in.email)
    if user:
        if user.is_email_verified:
            raise HTTPException(
                status_code=400,
                detail="The user with this username already exists in the system.",
            )
        else:
            # Overwrite unverified user
            db.delete(user)
            db.commit()

    user = user_service.create_user(db, user_in=user_in)
    
    # Generate and send OTP
    otp_code = otp_service.generate_and_store_otp(user.email, purpose="register")
    email_service.send_otp_email(user.email, otp_code, purpose="register")
    
    return {"status": "mfa_required", "email": user.email, "message": "OTP sent to email"}

@router.post("/register/verify", response_model=Token)
@limiter.limit("5/minute")
def verify_registration_otp(request: Request, db: Session = Depends(deps.get_db), data: OTPVerifyRequest = None) -> Any:
    """
    Verify OTP for registration and return JWT access token.
    """
    if not data:
        raise HTTPException(status_code=400, detail="Invalid request body")
        
    user = user_service.get_user_by_email(db, email=data.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.is_email_verified:
        raise HTTPException(status_code=400, detail="User already verified")
        
    is_valid = otp_service.verify_otp(data.email, "register", data.otp_code)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    user.is_email_verified = True
    db.commit()
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(user.id, expires_delta=access_token_expires),
        "token_type": "bearer",
    }
class OTPResendRequest(BaseModel):
    email: str

@router.post("/register/resend-otp")
@limiter.limit("3/minute")
def resend_registration_otp(request: Request, db: Session = Depends(deps.get_db), data: OTPResendRequest = None) -> Any:
    """
    Resends the registration OTP if the 60s cooldown has passed.
    """
    if not data:
        raise HTTPException(status_code=400, detail="Invalid request body")
        
    user = user_service.get_user_by_email(db, email=data.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.is_email_verified:
        raise HTTPException(status_code=400, detail="User already verified")
        
    try:
        otp_code = otp_service.generate_and_store_otp(user.email, purpose="register")
        email_service.send_otp_email(user.email, otp_code, purpose="register")
        return {"status": "success", "message": "OTP resent successfully"}
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))
@router.get("/me", response_model=UserResponse)
def read_user_me(current_user: User = Depends(deps.get_current_active_user)) -> Any:
    """
    Read the currently authenticated user based on their JWT.
    """
    return current_user

from fastapi import File, UploadFile
from app.services import storage_service

@router.post("/me/avatar", response_model=UserResponse)
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Uploads a new avatar to Cloudflare R2 and updates the user record."""
    # Delete old avatar if exists
    if current_user.avatar_url:
        storage_service.delete_avatar(current_user.avatar_url)
        
    # Upload new avatar
    new_avatar_url = storage_service.upload_avatar(file, current_user.id)
    
    current_user.avatar_url = new_avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user

@router.delete("/me/avatar", response_model=UserResponse)
def remove_avatar(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Deletes the user's avatar from Cloudflare R2 and the database."""
    if current_user.avatar_url:
        storage_service.delete_avatar(current_user.avatar_url)
        
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return current_user
