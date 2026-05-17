from sqlalchemy.orm import Session
from app.models.level import Level


def get_level_for_points(db: Session, points: int) -> Level:
    """Return the highest Level row whose min_points <= points."""
    level = (
        db.query(Level)
        .filter(Level.min_points <= points)
        .order_by(Level.min_points.desc())
        .first()
    )
    if level is None:
        # Fallback: return level 1 (should always exist after seeding)
        level = db.query(Level).order_by(Level.level.asc()).first()
    return level


def assign_level(db: Session, user) -> bool:
    """
    Recalculate and assign the correct Level to a user based on their current points.
    Returns True if the level changed (i.e. user levelled up/down).
    """
    correct_level = get_level_for_points(db, user.points)
    if correct_level and user.level_id != correct_level.id:
        user.level_id = correct_level.id
        return True
    return False
