from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, File, UploadFile, BackgroundTasks
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
import re

from app.api import deps
from app.schemas.user import UserResponse, UserUpdate, UserSync, PushTokenUpdate
from app.services import user_service, storage_service, ai_service, notification_service
from app.models.user import User, UserRole
from app.core.config import settings
from app.utils.profanity import validate_clean_text

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)



@router.get("/me", response_model=UserResponse)
def read_user_me(current_user: User = Depends(deps.get_current_active_user)) -> Any:
    """
    Read the currently authenticated user based on their JWT.
    """
    return current_user

@router.post("/me/push-token")
def register_push_token(
    data: PushTokenUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Register an Expo push token for the authenticated user.
    """
    was_none = current_user.push_token is None
    
    current_user.push_token = data.token
    db.commit()
    
    if was_none:
        background_tasks.add_task(notification_service.notify_welcome, current_user.id)
        
    return {"status": "success", "message": "Push token registered"}

@router.post("/me/avatar", response_model=UserResponse)
@limiter.limit("5/minute")
def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Uploads a new avatar to Cloudflare R2 and updates the user record."""
    # Guard: Read file in chunks to enforce 5MB limit without loading everything into RAM
    MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5MB
    chunks = []
    total_size = 0
    while True:
        chunk = file.file.read(64 * 1024)  # 64KB chunks
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_AVATAR_SIZE:
            raise HTTPException(status_code=413, detail="File size exceeds the 5MB limit.")
        chunks.append(chunk)
    file_bytes = b"".join(chunks)

    try:
        ai_service.moderate_avatar(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if current_user.avatar_url:
        storage_service.delete_avatar(current_user.avatar_url)

    # Reset the file stream with the already-read bytes for the storage service
    import io
    file.file = io.BytesIO(file_bytes)
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

    # Store supabase_uid before deleting the user row (which detaches the object)
    supabase_uid = current_user.supabase_uid

    # Delete from local Postgres
    success = user_service.delete_user(db, current_user.id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete user account")
        
    # Delete from Supabase Auth schema using raw SQL
    from sqlalchemy import text
    try:
        # Need a fresh connection or execute on the db session
        db.execute(text(f"DELETE FROM {settings.AUTH_SCHEMA}.users WHERE id = :uid"), {"uid": supabase_uid})
        db.commit()
    except Exception as e:
        print(f"Failed to delete auth user from Supabase: {e}")

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
        if not re.match(r'^[a-zA-Z0-9_.-]{3,30}$', data.username):
            raise HTTPException(
                status_code=400, 
                detail="Username must be 3-30 characters long and can only contain letters, numbers, underscores, hyphens, and periods."
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

from app.models.notification import Notification
from app.schemas.notification import NotificationResponse
from typing import List

@router.get("/me/notifications", response_model=List[NotificationResponse])
def get_my_notifications(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Get the current user's notifications.
    """
    # Cap limit to prevent abuse
    limit = max(1, min(limit, 100))
    
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()
    return notifications

@router.get("/me/notifications/unread-count")
def get_unread_notification_count(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Get the count of unread notifications for the current user.
    """
    from sqlalchemy import func as sa_func
    count = db.query(sa_func.count(Notification.id)).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).scalar()
    return {"unread_count": count}

@router.patch("/me/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Mark a notification as read.
    """
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification
