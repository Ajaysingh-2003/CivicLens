from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class CommentBase(BaseModel):
    content: str

class CommentCreate(CommentBase):
    pass

class CommentResponse(CommentBase):
    id: int
    issue_id: int
    author_id: Optional[int]
    author_name: Optional[str]
    author_avatar_url: Optional[str] = None
    created_at: datetime
    is_internal: bool

    class Config:
        from_attributes = True
