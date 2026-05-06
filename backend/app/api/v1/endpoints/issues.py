from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import uuid

from app.api import deps
from app.schemas.issue import IssueCreate, IssueResponse, IssueUpdateStatus, IssueMapResponse, IssueClassifyResponse
from app.services import issue_service, storage_service, ai_service
from app.models.user import User
from app.models.category import Category

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
    
    # 3. Classify the image
    try:
        suggested_name = ai_service.classify_image(file_bytes, category_names)
    except Exception as e:
        # Fallback gracefully if AI fails, default to first category (e.g. Other)
        print(f"AI Classification Failed: {e}")
        suggested_name = category_names[-1] # Usually "Other" is at the end
        
    suggested_category = next(c for c in categories if c.name == suggested_name)

    return IssueClassifyResponse(
        image_url=image_url,
        suggested_category_id=suggested_category.id,
        suggested_category_name=suggested_category.name
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

