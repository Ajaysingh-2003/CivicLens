from sqlalchemy import Column, Integer, String, Enum as SAEnum, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
import enum
from app.db.base import Base

class IssueStatus(str, enum.Enum):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"

class IssuePriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    description = Column(String, nullable=False)
    
    status = Column(SAEnum(IssueStatus), default=IssueStatus.PENDING, nullable=False)
    priority = Column(SAEnum(IssuePriority), default=IssuePriority.MEDIUM, nullable=False)
    
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    
    geom = Column(Geometry('POINT', srid=4326), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Foreign Keys
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    category = relationship("Category", back_populates="issues")
    reporter = relationship("User", back_populates="issues_reported")
    
    images = relationship("IssueImage", back_populates="issue")
    votes = relationship("IssueVote", back_populates="issue")
    assignments = relationship("Assignment", back_populates="issue")
    history = relationship("IssueHistory", back_populates="issue")
    comments = relationship("Comment", back_populates="issue")
