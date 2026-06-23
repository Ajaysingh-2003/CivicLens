from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.issue import IssuePriority, IssueStatus

class IssueBase(BaseModel):
    title: str = Field(..., max_length=150)
    description: str
    category_id: int

class IssueCreate(IssueBase):
    lat: float = Field(..., description="Latitude from mobile phone GPS (-90 to 90)")
    lng: float = Field(..., description="Longitude from mobile phone GPS (-180 to 180)")
    image_url: Optional[str] = None

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
    priority: IssuePriority
    upvotes: int
    downvotes: int
    created_at: datetime
    updated_at: Optional[datetime]
    reporter_id: int
    city_id: Optional[int] = None
    lat: float
    lng: float
    category_name: str
    category_color: str
    reporter_name: Optional[str] = None
    reporter_avatar_url: Optional[str] = None
    image_url: Optional[str] = None
    comments_count: int = 0

    class Config:
        from_attributes = True

class IssueClassifyResponse(BaseModel):
    image_url: str
    suggested_category_id: int
    suggested_category_name: str

class DuplicateCheckRequest(BaseModel):
    lat: float
    lng: float
    category_id: int
    radius_m: int = Field(default=50, description="Search radius in meters")

class DuplicateMatchItem(BaseModel):
    id: int
    title: str
    status: IssueStatus
    upvotes: int
    image_url: Optional[str] = None
    created_at: datetime
    reporter_name: Optional[str] = None
    category_name: Optional[str] = None

    class Config:
        from_attributes = True

class DuplicateCheckResponse(BaseModel):
    duplicates_found: bool
    potential_duplicates: List[DuplicateMatchItem] = []

