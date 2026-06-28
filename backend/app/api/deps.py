from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.core.config import settings
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"/api/v1/users/sync")

def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

import urllib.request
import json

jwks_cache = None

def get_jwks():
    global jwks_cache
    if not jwks_cache:
        url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        with urllib.request.urlopen(url) as response:
            jwks_cache = json.loads(response.read())
    return jwks_cache

def get_supabase_sub(token: str = Depends(oauth2_scheme)) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Get public keys (JWKS) to verify ES256/RS256 asymmetric signatures
        jwks = get_jwks()
        payload = jwt.decode(
            token, 
            jwks, 
            algorithms=["HS256", "ES256", "RS256"],
            options={"verify_aud": False} # Supabase uses 'authenticated' audience
        )
        sub: str = payload.get("sub")
        if sub is None:
            raise credentials_exception
        return sub
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(db: Session = Depends(get_db), sub: str = Depends(get_supabase_sub)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="User not found or credentials invalid",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user = db.query(User).filter(User.supabase_uid == sub).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def get_current_active_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.NGO_ADMIN, UserRole.GOVT_OFFICIAL]:
        raise HTTPException(status_code=403, detail="The user doesn't have privilege to view this.")
    return current_user
