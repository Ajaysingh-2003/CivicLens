from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.issue import IssuePriority, IssueStatus

class IssueBase(BaseModel):
    title: str = Field(..., max_length=150)
    description: str
    priority: IssuePriority = IssuePriority.MEDIUM
    category_id: int

class IssueCreate(IssueBase):
    lat: float = Field(..., description="Latitude from mobile phone GPS (-90 to 90)")
    lng: float = Field(..., description="Longitude from mobile phone GPS (-180 to 180)")

class IssueUpdateStatus(BaseModel):
    status: IssueStatus
    remarks: Optional[str] = Field(None, description="Admin remarks for the audit history log")

class IssueMapResponse(BaseModel):
    id: int
    title: str
    status: IssueStatus
    priority: IssuePriority
    category_name: str
    category_color: str
    lat: float
    lng: float

    class Config:
        from_attributes = True

class IssueResponse(IssueBase):
    id: int
    status: IssueStatus
    upvotes: int
    downvotes: int
    created_at: datetime
    updated_at: Optional[datetime]
    reporter_id: int
    lat: float
    lng: float
    category_name: str
    category_color: str
    reporter_name: Optional[str] = None

    class Config:
        from_attributes = True

