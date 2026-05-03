from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api import deps
from app.core.config import settings
from app.core.security import create_access_token
from app.schemas.token import Token
from app.services import user_service

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

from pydantic import BaseModel
from app.services import otp_service, email_service

class OTPVerifyRequest(BaseModel):
    email: str
    otp_code: str

@router.post("/access-token")
@limiter.limit("5/minute")
def login_access_token(request: Request, db: Session = Depends(deps.get_db), form_data: OAuth2PasswordRequestForm = Depends()) -> Any:
    """
    OAuth2 compatible token login. Rate limited to 5 attempts/minute per IP.
    Returns MFA required status and sends OTP.
    """
    user = user_service.authenticate_user(db, email=form_data.username, password=form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    # Generate and send OTP
    otp_code = otp_service.generate_and_store_otp(user.email, purpose="login")
    email_service.send_otp_email(user.email, otp_code, purpose="login")
    
    return {"status": "mfa_required", "email": user.email, "message": "OTP sent to email"}

@router.post("/verify-login-otp", response_model=Token)
@limiter.limit("5/minute")
def verify_login_otp(request: Request, db: Session = Depends(deps.get_db), data: OTPVerifyRequest = None) -> Any:
    """
    Verify OTP for login and return JWT access token.
    """
    if not data:
        raise HTTPException(status_code=400, detail="Invalid request body")
        
    user = user_service.get_user_by_email(db, email=data.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    is_valid = otp_service.verify_otp(data.email, "login", data.otp_code)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(user.id, expires_delta=access_token_expires),
        "token_type": "bearer",
    }

class OTPResendRequest(BaseModel):
    email: str

@router.post("/resend-login-otp")
@limiter.limit("3/minute")
def resend_login_otp(request: Request, db: Session = Depends(deps.get_db), data: OTPResendRequest = None) -> Any:
    """
    Resends the login OTP if the 60s cooldown has passed.
    """
    if not data:
        raise HTTPException(status_code=400, detail="Invalid request body")
        
    user = user_service.get_user_by_email(db, email=data.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    try:
        otp_code = otp_service.generate_and_store_otp(user.email, purpose="login")
        email_service.send_otp_email(user.email, otp_code, purpose="login")
        return {"status": "success", "message": "OTP resent successfully"}
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))
