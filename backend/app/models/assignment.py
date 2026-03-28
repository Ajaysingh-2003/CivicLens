from sqlalchemy import Column, Integer, String, Enum as SAEnum, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.db.base import Base

class AssignmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    status = Column(SAEnum(AssignmentStatus), default=AssignmentStatus.PENDING, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    issue = relationship("Issue", back_populates="assignments")
    department = relationship("Department", back_populates="assignments")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], back_populates="assignments_received")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id], back_populates="assignments_given")
