from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.models.department import Department
from app.models.user import User
from app.schemas.department import DepartmentResponse

router = APIRouter()

@router.get("/", response_model=List[DepartmentResponse])
def read_departments(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Retrieve all departments. Requires authentication.
    """
    departments = db.query(Department).order_by(Department.name).all()
    return departments
