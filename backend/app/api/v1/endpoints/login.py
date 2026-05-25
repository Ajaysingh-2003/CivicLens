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


# ─── FORGOT PASSWORD ────────────────────────────────────────────────────────────

import secrets

class ForgotPasswordRequest(BaseModel):
    email: str

class ForgotPasswordVerify(BaseModel):
    email: str
    otp_code: str

class ForgotPasswordReset(BaseModel):
    email: str
    reset_token: str
    new_password: str

@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password_send_otp(request: Request, db: Session = Depends(deps.get_db), data: ForgotPasswordRequest = None) -> Any:
    """
    Step 1: Send OTP to the user's email for password reset.
    """
    if not data:
        raise HTTPException(status_code=400, detail="Invalid request body")

    user = user_service.get_user_by_email(db, email=data.email)
    if not user:
        # Don't reveal whether email exists — return generic success
        return {"status": "success", "message": "If this email is registered, an OTP has been sent."}

    if not user.is_email_verified:
        raise HTTPException(status_code=400, detail="Email is not verified. Please register again.")

    try:
        otp_code = otp_service.generate_and_store_otp(user.email, purpose="forgot_password")
        email_service.send_otp_email(user.email, otp_code, purpose="forgot_password")
        return {"status": "success", "message": "If this email is registered, an OTP has been sent."}
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))


@router.post("/forgot-password/verify-otp")
@limiter.limit("5/minute")
def forgot_password_verify_otp(request: Request, db: Session = Depends(deps.get_db), data: ForgotPasswordVerify = None) -> Any:
    """
    Step 2: Verify OTP and return a short-lived reset token.
    """
    if not data:
        raise HTTPException(status_code=400, detail="Invalid request body")

    user = user_service.get_user_by_email(db, email=data.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_valid = otp_service.verify_otp(data.email, "forgot_password", data.otp_code)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    # Generate a single-use reset token, store in Redis with 10min TTL
    reset_token = secrets.token_urlsafe(32)
    from app.services.otp_service import redis_client
    redis_client.setex(f"reset_token:{data.email}", 600, reset_token)

    return {"status": "success", "reset_token": reset_token}


@router.post("/forgot-password/reset")
@limiter.limit("5/minute")
def forgot_password_reset(request: Request, db: Session = Depends(deps.get_db), data: ForgotPasswordReset = None) -> Any:
    """
    Step 3: Validate reset token and set new password.
    """
    if not data:
        raise HTTPException(status_code=400, detail="Invalid request body")

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = user_service.get_user_by_email(db, email=data.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify reset token from Redis
    from app.services.otp_service import redis_client
    from app.core.security import get_password_hash
    redis_key = f"reset_token:{data.email}"
    stored_token = redis_client.get(redis_key)

    if not stored_token or stored_token != data.reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token. Please try again.")

    # Update password and delete the token
    user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    redis_client.delete(redis_key)

    return {"status": "success", "message": "Password has been reset successfully. Please login with your new password."}
