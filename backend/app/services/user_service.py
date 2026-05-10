from typing import Optional
import random
from datetime import date
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash, verify_password

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def generate_unique_username(db: Session) -> str:
    """Generates a unique username in the format Citizen-YYYYMMDD-N."""
    date_str = date.today().strftime("%Y%m%d")
    for _ in range(20):  # Try up to 20 random suffixes
        suffix = random.randint(1, 9999)
        candidate = f"Citizen-{date_str}-{suffix}"
        exists = db.query(User).filter(User.username == candidate).first()
        if not exists:
            return candidate
    # Fallback: use a larger random number if collisions are exhausted
    return f"Citizen-{date_str}-{random.randint(10000, 99999)}"

def create_user(db: Session, user_in: UserCreate) -> User:
    # Handle dynamic title based on role
    title = "Citizen"
    if user_in.role == "GOVT_OFFICIAL" or user_in.role == "NGO_ADMIN":
        prefix = "Govt Official" if user_in.role == "GOVT_OFFICIAL" else "NGO Admin"
        if user_in.department_id:
            from app.models.department import Department
            dept = db.query(Department).filter(Department.id == user_in.department_id).first()
            if dept:
                title = f"{prefix}: {dept.name}"
            else:
                title = prefix
        else:
            title = prefix

    username = user_in.username if user_in.username else generate_unique_username(db)

    db_obj = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        username=username,
        role=user_in.role,
        points=0,
        title=title,
        city_id=user_in.city_id,
        department_id=user_in.department_id
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email=email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

def delete_user(db: Session, user_id: int) -> bool:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True

