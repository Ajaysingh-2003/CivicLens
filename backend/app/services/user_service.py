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
    DEPRECATED — legacy shim. Delegates to record_points with ADMIN_ADJUSTMENT.
    Kept temporarily so any missed call sites don't break.
    """
    from app.models.point_transaction import PointReason
    return record_points(db, user, points, PointReason.ADMIN_ADJUSTMENT)


def record_points(
    db: Session,
    user: User,
    delta: int,
    reason,
    reference_issue_id: int = None,
    caused_by_user_id: int = None,
) -> bool:
    """
    Single entry point for ALL point changes.
    1. Inserts an immutable ledger row into point_transactions.
    2. Updates the users.points cache atomically.
    3. Re-derives the user's level.
    Returns True if the user levelled up.
    NOTE: Does NOT commit — the caller owns the transaction boundary.
    """
    from app.models.point_transaction import PointTransaction

    txn = PointTransaction(
        user_id=user.id,
        delta=delta,
        reason=reason,
        reference_issue_id=reference_issue_id,
        caused_by_user_id=caused_by_user_id,
    )
    db.add(txn)
    user.points = max((user.points or 0) + delta, 0)  # Floor at 0
    levelled_up = assign_level(db, user)
    return levelled_up


def revoke_issue_points(db: Session, user: User, issue_id: int) -> None:
    """
    Reverses ALL points a user earned from a specific issue.
    Queries the ledger for the net delta tied to this issue,
    then inserts a single reversal row to zero it out.
    """
    from sqlalchemy import func as sqlfunc
    from app.models.point_transaction import PointTransaction, PointReason

    total = (
        db.query(sqlfunc.coalesce(sqlfunc.sum(PointTransaction.delta), 0))
        .filter(
            PointTransaction.user_id == user.id,
            PointTransaction.reference_issue_id == issue_id,
        )
        .scalar()
    )

    if total != 0:
        record_points(
            db, user, -total,
            PointReason.VOTES_REVOKED_ON_DELETE,
            reference_issue_id=issue_id,
        )


def recalculate_points(db: Session, user: User) -> int:
    """
    Rebuilds the users.points cache from the ledger (source of truth).
    Safe to run any number of times — always produces the correct value.
    """
    from sqlalchemy import func as sqlfunc
    from app.models.point_transaction import PointTransaction

    computed = (
        db.query(sqlfunc.coalesce(sqlfunc.sum(PointTransaction.delta), 0))
        .filter(PointTransaction.user_id == user.id)
        .scalar()
    )
    user.points = max(computed, 0)
    assign_level(db, user)
    db.commit()
    db.refresh(user)
    return user.points


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
