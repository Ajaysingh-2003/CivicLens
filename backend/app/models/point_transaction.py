import enum
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum as SAEnum, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class PointReason(str, enum.Enum):
    ISSUE_CREATED = "ISSUE_CREATED"
    ISSUE_DELETED = "ISSUE_DELETED"
    VOTE_RECEIVED = "VOTE_RECEIVED"
    VOTE_CHANGED = "VOTE_CHANGED"
    VOTES_REVOKED_ON_DELETE = "VOTES_REVOKED_ON_DELETE"
    ADMIN_ADJUSTMENT = "ADMIN_ADJUSTMENT"


class PointTransaction(Base):
    __tablename__ = "point_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    delta = Column(Integer, nullable=False)  # +1, -1, -5, etc.
    reason = Column(SAEnum(PointReason), nullable=False)
    reference_issue_id = Column(Integer, nullable=True)  # Which issue caused this
    caused_by_user_id = Column(Integer, nullable=True)   # Who triggered it (e.g. the voter)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Composite index: the hot path for delete-reversals and per-user history
    __table_args__ = (
        Index("ix_pt_user_issue", "user_id", "reference_issue_id"),
    )

    user = relationship("User", backref="point_transactions")
