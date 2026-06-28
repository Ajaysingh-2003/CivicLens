from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, File, UploadFile
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
import re

from app.api import deps
from app.schemas.user import UserResponse, UserUpdate, UserSync
from app.services import user_service, storage_service, ai_service
from app.models.user import User
from app.utils.profanity import validate_clean_text

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/sync", response_model=UserResponse)
@limiter.limit("5/minute")
def sync_user(
    request: Request,
    data: UserSync,
    db: Session = Depends(deps.get_db),
    sub: str = Depends(deps.get_supabase_sub)
) -> Any:
    """
    Sync a new user from Supabase to our local PostgreSQL database.
    Expects a valid Supabase JWT in the Authorization header.
    """
    # 1. Check if user already exists
    user = db.query(User).filter(User.supabase_uid == sub).first()
    if user:
        return user

    # 2. Validate username
    if not re.match(r'^[a-zA-Z0-9_.]{3,30}$', data.username):
        raise HTTPException(
            status_code=400, 
            detail="Username must be 3-30 characters long and can only contain letters, numbers, underscores, and periods."
        )
    try:
        validate_clean_text(data.username, "Username", is_username=True)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 3. Check username uniqueness
    existing_username = db.query(User).filter(User.username == data.username).first()
    if existing_username:
        raise HTTPException(
            status_code=400,
            detail="Username is already taken"
        )

    # 4. Create user in local DB
    new_user = User(
        supabase_uid=sub,
        email=data.email,
        username=data.username,
        role=data.role,
        is_email_verified=True # Supabase handles email verification
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/me", response_model=UserResponse)
def read_user_me(current_user: User = Depends(deps.get_current_active_user)) -> Any:
    """
    Read the currently authenticated user based on their JWT.
    """
    return current_user


@router.post("/me/avatar", response_model=UserResponse)
@limiter.limit("5/minute")
def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Uploads a new avatar to Cloudflare R2 and updates the user record."""
    try:
        file_bytes = file.file.read()
        ai_service.moderate_avatar(file_bytes)
        file.file.seek(0)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if current_user.avatar_url:
        storage_service.delete_avatar(current_user.avatar_url)
        
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


@router.delete("/me")
def delete_user_me(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Deletes the currently authenticated user account and all associated R2 assets."""
    if current_user.avatar_url:
        storage_service.delete_avatar(current_user.avatar_url)

    from app.models.issue import Issue
    from app.models.issue_image import IssueImage
    user_issues = db.query(Issue).filter(Issue.reporter_id == current_user.id).all()
    for issue in user_issues:
        images = db.query(IssueImage).filter(IssueImage.issue_id == issue.id).all()
        for img in images:
            storage_service.delete_avatar(img.image_url)

    success = user_service.delete_user(db, current_user.id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete user account")

    return {"status": "success", "message": "User account deleted"}


@router.put("/me", response_model=UserResponse)
@limiter.limit("5/minute")
def update_user_me(
    request: Request,
    data: UserUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Update username or preferences."""
    if data.username is not None and data.username != current_user.username:
        if not re.match(r'^[a-zA-Z0-9_.]{3,30}$', data.username):
            raise HTTPException(
                status_code=400, 
                detail="Username must be 3-30 characters long and can only contain letters, numbers, underscores, and periods."
            )
        try:
            validate_clean_text(data.username, "Username", is_username=True)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
            
        existing = db.query(User).filter(User.username == data.username).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username is already taken")
        current_user.username = data.username
        
    if data.notifications_enabled is not None:
        current_user.notifications_enabled = data.notifications_enabled
        
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/recalculate-points")
@limiter.limit("1/minute")
def recalculate_my_points(
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Recalculates the current user's citizen points.
    """
    new_points = user_service.recalculate_points(db, current_user)
    return {
        "status": "success",
        "points": new_points,
        "message": f"Points recalculated. New total: {new_points}"
    }


@router.post("/admin/recalculate-points/{user_id}")
@limiter.limit("5/minute")
def admin_recalculate_user_points(
    request: Request,
    user_id: int,
    db: Session = Depends(deps.get_db),
    current_admin: User = Depends(deps.get_current_active_admin)
) -> Any:
    """
    (Admin only) Recalculates points for any user by their ID.
    """
    target_user = user_service.get_user(db, user_id=user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    new_points = user_service.recalculate_points(db, target_user)
    return {
        "status": "success",
        "user_id": user_id,
        "points": new_points,
        "message": f"Points recalculated for user {user_id}. New total: {new_points}"
    }
