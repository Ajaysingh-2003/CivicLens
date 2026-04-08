from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api import deps
from app.models.department import Department
from app.schemas.department import DepartmentResponse

router = APIRouter()

@router.get("/", response_model=List[DepartmentResponse])
def read_departments(db: Session = Depends(deps.get_db)) -> Any:
    """
    Retrieve all departments.
    """
    departments = db.query(Department).order_by(Department.name).all()
    return departments
