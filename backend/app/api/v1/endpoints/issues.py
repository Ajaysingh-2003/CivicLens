from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api import deps
from app.schemas.issue import IssueCreate, IssueResponse, IssueUpdateStatus, IssueMapResponse
from app.services import issue_service
from app.models.user import User

router = APIRouter()

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
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Retrieve full issue details in list format.
    """
    return issue_service.get_issues(db, skip=skip, limit=limit)

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

