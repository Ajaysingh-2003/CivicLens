from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, Query, BackgroundTasks
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
import uuid

from app.api import deps
from app.schemas.issue import IssueCreate, IssueResponse, IssueUpdateStatus, IssueMapResponse, IssueClassifyResponse, DuplicateCheckRequest, DuplicateCheckResponse, ReportCreate
from app.schemas.comment import CommentCreate, CommentResponse
from app.services import issue_service, storage_service, ai_service
from app.models.user import User
from app.models.category import Category
from app.models.comment import Comment
from app.models.issue import Issue, IssueStatus
from app.db.session import SessionLocal
from app.utils.profanity import validate_clean_text
import httpx

def moderate_issue_background(issue_id: int, image_url: str):
    if not image_url:
        return
        
    db = SessionLocal()
    try:
        response = httpx.get(image_url)
        if response.status_code != 200:
            return
            
        file_bytes = response.content
        categories = db.query(Category).all()
        category_names = [c.name for c in categories]
        moderation_labels = [
            "A photo of a person's face or selfie",
            "A photo of a pet or animal",
            "A photo of food or a meal",
            "A screenshot, meme, or text document",
            "Explicit, sexual, or nude content",
            "Violent or hateful imagery"
        ]
        
        try:
            ai_service.classify_image(file_bytes, category_names, moderation_labels)
            issue = db.query(Issue).get(issue_id)
            if issue and issue.status == IssueStatus.PENDING_MODERATION:
                issue.status = IssueStatus.PENDING
                db.commit()
        except ValueError as e:
            issue = db.query(Issue).get(issue_id)
            if issue:
                issue.status = IssueStatus.REJECTED
                db.commit()
    except Exception as e:
        print(f"Background moderation failed: {e}")
        issue = db.query(Issue).get(issue_id)
        if issue and issue.status == IssueStatus.PENDING_MODERATION:
            issue.status = IssueStatus.PENDING
            db.commit()
    finally:
        db.close()

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

@router.post("/classify", response_model=IssueClassifyResponse)
@limiter.limit("5/minute")
async def classify_issue_image(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    (Mobile App) AI-Assisted Incident Classification.
    Uploads the image to temporary storage, analyzes it against the DB categories using CLIP,
    and returns a suggested category ID.
    """
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG and PNG are allowed.")
    
    file_bytes = await file.read()
    if len(file_bytes) > 5 * 1024 * 1024: # 5MB limit
        raise HTTPException(status_code=400, detail="File size exceeds the 5MB limit.")
        
    file_extension = "jpg" if file.content_type in ["image/jpeg", "image/jpg"] else "png"
    temp_filename = f"temp/{uuid.uuid4()}_{current_user.id}.{file_extension}"
    
    image_url = storage_service.upload_file(
        file_bytes=file_bytes,
        filename=temp_filename,
        content_type=file.content_type
    )
    if not image_url:
        raise HTTPException(status_code=500, detail="Failed to upload image temporarily")

    # 2. Get active categories from DB
    categories = db.query(Category).all()
    if not categories:
        raise HTTPException(status_code=500, detail="No categories configured in DB")
        
    category_names = [c.name for c in categories]
    
    # We removed synchronous AI classification to make the UI instant.
    # We will just suggest the first category or 'Other'
    suggested_name = "Other" if "Other" in category_names else category_names[0]
        
    suggested_category = next(c for c in categories if c.name == suggested_name)

    return IssueClassifyResponse(
        image_url=image_url,
        suggested_category_id=suggested_category.id,
        suggested_category_name=suggested_category.name
    )

@router.post("/check-duplicates", response_model=DuplicateCheckResponse)
def check_duplicates(
    *,
    db: Session = Depends(deps.get_db),
    request: DuplicateCheckRequest,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Check for existing issues near the given coordinates with the same category.
    Used by the mobile app to warn users about potential duplicate reports.
    """
    duplicates = issue_service.find_nearby_duplicates(
        db, lat=request.lat, lng=request.lng,
        category_id=request.category_id, radius_m=request.radius_m
    )
    return DuplicateCheckResponse(
        duplicates_found=len(duplicates) > 0,
        potential_duplicates=duplicates
    )

@router.get("/categories")
def read_categories(db: Session = Depends(deps.get_db)) -> Any:
    """
    Get all active categories for the dropdown.
    """
    categories = db.query(Category).all()
    return [{"id": c.id, "name": c.name, "description": c.description, "marker_color": c.marker_color} for c in categories]

@router.get("/map", response_model=List[IssueMapResponse])
def read_issues_map(
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    (Web App Dashboard) Fast endpoint for plotting markers with category-specific colors.
    """
    return issue_service.get_issues(db, skip=skip, limit=limit)

@router.post("/", response_model=IssueResponse)
@limiter.limit("5/minute")
def create_issue(
    request: Request,
    background_tasks: BackgroundTasks,
    *,
    db: Session = Depends(deps.get_db),
    issue_in: IssueCreate,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    (Mobile App) Report a new civil issue with strict GPS coordinates.
    """
    try:
        validate_clean_text(issue_in.title, "Title")
        validate_clean_text(issue_in.description, "Description")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Strict server-side duplicate check (within 50 meters, same category)
    duplicates = issue_service.find_nearby_duplicates(
        db, lat=issue_in.lat, lng=issue_in.lng, category_id=issue_in.category_id, radius_m=50
    )
    if duplicates:
        raise HTTPException(status_code=409, detail="A similar issue already exists at this location.")

    issue = issue_service.create_issue(db, issue_in=issue_in, reporter_id=current_user.id)
    
    if issue_in.image_url:
        background_tasks.add_task(moderate_issue_background, issue["id"], str(issue_in.image_url))
        
    return issue

@router.get("/", response_model=List[IssueResponse])
def read_issues(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = Query(5.0, ge=0.1, le=50.0),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Retrieve full issue details in list format (Feed), sorted by location if provided.
    """
    return issue_service.get_issues(db, skip=skip, limit=limit, lat=lat, lng=lng, radius_km=radius_km)

@router.get("/me", response_model=List[IssueResponse])
def read_issues_me(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Retrieve the issues strictly reported by the currently logged-in user.
    """
    return issue_service.get_user_issues(db, user_id=current_user.id, skip=skip, limit=limit)

@router.get("/{issue_id}", response_model=IssueResponse)
@limiter.limit("60/minute")
def read_issue_by_id(
    request: Request,
    issue_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    (Dashboard Pop-up) Get technical details for a specific issue.
    """
    issue = issue_service.get_issue(db, issue_id=issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue

@router.patch("/{issue_id}/status", response_model=IssueResponse)
def update_issue_status(
    *,
    db: Session = Depends(deps.get_db),
    issue_id: int,
    status_update: IssueUpdateStatus,
    current_admin: User = Depends(deps.get_current_active_admin)
) -> Any:
    """
    (Web App Admin Only) Change the state and record audit log.
    """
    # Broken Access Control Fix: Ensure admin belongs to the correct city/department
    issue = issue_service.get_issue(db, issue_id=issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
        
    if current_admin.role.name != "SUPER_ADMIN":
        if issue.get("city_id") != current_admin.city_id:
            raise HTTPException(status_code=403, detail="Not authorized to manage issues outside your city.")
            
    issue = issue_service.update_issue_status(
        db, issue_id=issue_id, status_update=status_update, actor_id=current_admin.id
    )
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue

@router.post("/{issue_id}/vote", response_model=IssueResponse)
@limiter.limit("10/minute")
def vote_on_issue(
    request: Request,
    *,
    db: Session = Depends(deps.get_db),
    issue_id: int,
    vote_type: int, # 1 for upvote, -1 for downvote
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    (Mobile App / Web App) Upvote or downvote an issue.
    """
    if vote_type not in [1, -1]:
        raise HTTPException(status_code=400, detail="Invalid vote_type. Must be 1 or -1.")
        
    try:
        issue = issue_service.vote_issue(db, issue_id=issue_id, user_id=current_user.id, vote_type=vote_type)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
        
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue

@router.delete("/{issue_id}")
def delete_issue(
    issue_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Delete a specific issue. Only the reporter can delete their issue.
    """
    issue = issue_service.get_issue(db, issue_id=issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
        
    if issue.get("reporter_id") != current_user.id and current_user.role.name not in ["SUPER_ADMIN", "GOVT_OFFICIAL"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    success = issue_service.delete_issue(db, issue_id=issue_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete issue")
        
    return {"status": "success", "message": "Issue deleted"}


@router.get("/{issue_id}/comments", response_model=List[CommentResponse])
@limiter.limit("60/minute")
def get_comments(
    request: Request,
    issue_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Get all comments for a specific issue.
    """
    comments = db.query(Comment).filter(Comment.issue_id == issue_id).order_by(Comment.created_at.desc()).all()
    
    response = []
    for c in comments:
        response.append({
            "id": c.id,
            "issue_id": c.issue_id,
            "author_id": c.author_id,
            "author_name": c.author.username if c.author else "Deleted User",
            "author_avatar_url": c.author.avatar_url if c.author else None,
            "content": c.content,
            "is_internal": c.is_internal,
            "created_at": c.created_at
        })
    return response


@router.post("/{issue_id}/comments", response_model=CommentResponse)
@limiter.limit("5/minute")
def add_comment(
    request: Request,
    issue_id: int,
    comment_in: CommentCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Add a comment to an issue.
    """
    try:
        validate_clean_text(comment_in.content, "Comment")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Verify issue exists
    issue = issue_service.get_issue(db, issue_id=issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
        
    db_obj = Comment(
        issue_id=issue_id,
        author_id=current_user.id,
        content=comment_in.content,
        is_internal=False
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    
    return {
        "id": db_obj.id,
        "issue_id": db_obj.issue_id,
        "author_id": db_obj.author_id,
        "author_name": current_user.username,
        "author_avatar_url": current_user.avatar_url,
        "content": db_obj.content,
        "is_internal": db_obj.is_internal,
        "created_at": db_obj.created_at
    }


@router.delete("/{issue_id}/comments/{comment_id}")
def delete_comment(
    issue_id: int,
    comment_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Delete a comment.
    """
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.issue_id == issue_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
        
    if comment.author_id != current_user.id and current_user.role.name not in ["SUPER_ADMIN", "GOVT_OFFICIAL"]:
        raise HTTPException(status_code=403, detail="Not enough permissions to delete this comment")
        
    db.delete(comment)
    db.commit()
    
    return {"status": "success", "message": "Comment deleted"}

@router.post("/{issue_id}/report")
@limiter.limit("5/minute")
def report_issue(
    request: Request,
    issue_id: int,
    report_data: ReportCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Report an issue for community moderation.
    """
    issue_service.report_issue(
        db=db,
        issue_id=issue_id,
        reporter_id=current_user.id,
        reason=report_data.reason,
        description=report_data.description
    )
    return {"status": "success", "message": "Report submitted successfully"}
