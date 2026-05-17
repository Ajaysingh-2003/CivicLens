from typing import Optional
import random
from datetime import date
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash, verify_password
from app.core.levels import assign_level, get_level_for_points


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def generate_unique_username(db: Session) -> str:
    """Generates a unique username in the format Citizen-YYYYMMDD-N."""
    date_str = date.today().strftime("%Y%m%d")
    for _ in range(20):
        suffix = random.randint(1, 9999)
        candidate = f"Citizen-{date_str}-{suffix}"
        exists = db.query(User).filter(User.username == candidate).first()
        if not exists:
            return candidate
    return f"Citizen-{date_str}-{random.randint(10000, 99999)}"


def create_user(db: Session, user_in: UserCreate) -> User:
    username = user_in.username if user_in.username else generate_unique_username(db)

    # New citizen users start at Level 1 (0 points)
    starting_level = get_level_for_points(db, 0)

    db_obj = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        username=username,
        role=user_in.role,
        points=0,
        level_id=starting_level.id if starting_level else None,
        city_id=user_in.city_id,
        department_id=user_in.department_id,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def award_points(db: Session, user: User, points: int) -> bool:
    """
    Add points to a user and auto-update their level.
    Returns True if the user levelled up.
    """
    user.points = (user.points or 0) + points
    levelled_up = assign_level(db, user)
    db.commit()
    db.refresh(user)
    return levelled_up


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
