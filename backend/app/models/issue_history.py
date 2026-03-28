from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base

class IssueHistory(Base):
    __tablename__ = "issue_history"

    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    old_status = Column(String, nullable=True)
    new_status = Column(String, nullable=False)
    remarks = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    issue = relationship("Issue", back_populates="history")
    actor = relationship("User", back_populates="histories_created")
