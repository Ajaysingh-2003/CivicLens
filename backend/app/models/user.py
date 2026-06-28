from sqlalchemy import Column, Integer, String, Boolean, Enum as SAEnum, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.base import Base


class UserRole(str, enum.Enum):
    CITIZEN = "CITIZEN"
    NGO_ADMIN = "NGO_ADMIN"
    GOVT_OFFICIAL = "GOVT_OFFICIAL"
    SUPER_ADMIN = "SUPER_ADMIN"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    supabase_uid = Column(String, unique=True, index=True, nullable=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    role = Column(SAEnum(UserRole), default=UserRole.CITIZEN, nullable=False)
    is_active = Column(Boolean, default=True)
    is_email_verified = Column(Boolean, default=False)
    notifications_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Gamification
    points = Column(Integer, default=0)
    level_id = Column(Integer, ForeignKey("levels.id"), nullable=True)
    level = relationship("Level", back_populates="users")

    avatar_url = Column(String, nullable=True)

    # Relations
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    department = relationship("Department", back_populates="users")
    
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=True)
    city = relationship("City", back_populates="users")
    
    issues_reported = relationship("Issue", back_populates="reporter")
    votes_cast = relationship("IssueVote", back_populates="user", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="author")
    assignments_received = relationship("Assignment", foreign_keys="Assignment.assigned_to_id", back_populates="assigned_to")
    assignments_given = relationship("Assignment", foreign_keys="Assignment.assigned_by_id", back_populates="assigned_by")
    histories_created = relationship("IssueHistory", back_populates="actor")
