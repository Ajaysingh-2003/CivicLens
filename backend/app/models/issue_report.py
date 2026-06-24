import enum
from sqlalchemy import Column, Integer, String, Enum as SAEnum, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base

class ReportReason(str, enum.Enum):
    FAKE_ISSUE = "FAKE_ISSUE"
    AI_GENERATED = "AI_GENERATED"
    NOT_CIVIC = "NOT_CIVIC"
    SPAM = "SPAM"
    INAPPROPRIATE = "INAPPROPRIATE"
    EDITED_IMAGE = "EDITED_IMAGE"
    OTHER = "OTHER"

class IssueReport(Base):
    __tablename__ = "issue_reports"

    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id", ondelete="CASCADE"), nullable=False)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reason = Column(SAEnum(ReportReason), nullable=False)
    description = Column(String, nullable=True)
    
    # Track the calculated weight applied for this report at the time of reporting
    weight_applied = Column(Integer, default=1, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Ensure a user can only report a specific issue once
    __table_args__ = (
        UniqueConstraint('issue_id', 'reporter_id', name='uq_issue_reporter'),
    )

    issue = relationship("Issue", backref="reports")
    reporter = relationship("User")
