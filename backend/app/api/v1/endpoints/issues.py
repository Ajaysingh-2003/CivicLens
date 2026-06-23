from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import uuid

from app.api import deps
from app.schemas.issue import IssueCreate, IssueResponse, IssueUpdateStatus, IssueMapResponse, IssueClassifyResponse, DuplicateCheckRequest, DuplicateCheckResponse
from app.schemas.comment import CommentCreate, CommentResponse
from app.services import issue_service, storage_service, ai_service
from app.models.user import User
from app.models.category import Category
from app.models.comment import Comment
from app.utils.profanity import validate_clean_text

router = APIRouter()

@router.post("/classify", response_model=IssueClassifyResponse)
async def classify_issue_image(
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    (Mobile App) AI-Assisted Incident Classification.
    Uploads the image to temporary storage, analyzes it against the DB categories using CLIP,
    and returns a suggested category ID.
    """
    # 1. Upload to Cloudflare R2 temporarily
    file_bytes = await file.read()
    temp_filename = f"temp/{uuid.uuid4()}_{file.filename}"
    
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
    
    # 3. Classify the image with moderation
    moderation_labels = [
        "A photo of a person's face or selfie",
        "A photo of a pet or animal",
        "A photo of food or a meal",
        "A screenshot, meme, or text document",
        "Explicit, sexual, or nude content",
        "Violent or hateful imagery"
    ]
    
    try:
        suggested_name = ai_service.classify_image(file_bytes, category_names, moderation_labels)
    except ValueError as e:
        # Caught a moderation rejection
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Fallback gracefully if AI fails for other reasons, default to first category (e.g. Other)
        print(f"AI Classification Failed: {e}")
        suggested_name = category_names[-1] # Usually "Other" is at the end
        
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
def create_issue(
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

    return issue_service.create_issue(db, issue_in=issue_in, reporter_id=current_user.id)

@router.get("/", response_model=List[IssueResponse])
def read_issues(
    skip: int = 0,
    limit: int = 100,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 5.0,
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
def read_issue_by_id(
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
    issue = issue_service.update_issue_status(
        db, issue_id=issue_id, status_update=status_update, actor_id=current_admin.id
    )
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue

@router.post("/{issue_id}/vote", response_model=IssueResponse)
def vote_on_issue(
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
        
    issue = issue_service.vote_issue(db, issue_id=issue_id, user_id=current_user.id, vote_type=vote_type)
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
def get_comments(
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
def add_comment(
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
