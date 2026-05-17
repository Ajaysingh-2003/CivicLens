from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api import deps
from app.models.level import Level

router = APIRouter()


class LevelResponse(BaseModel):
    level: int
    title: str
    min_points: int
    description: Optional[str] = None

    class Config:
        from_attributes = True


# In-memory cache — levels table almost never changes at runtime
_levels_cache: Optional[List[LevelResponse]] = None


@router.get("", response_model=List[LevelResponse])
def get_all_levels(db: Session = Depends(deps.get_db)):
    """
    Returns the full level configuration sorted by level number.
    Results are cached in-memory after the first call — no repeated DB hits.
    """
    global _levels_cache
    if _levels_cache is None:
        rows = db.query(Level).order_by(Level.level.asc()).all()
        _levels_cache = [LevelResponse.model_validate(r) for r in rows]
    return _levels_cache
