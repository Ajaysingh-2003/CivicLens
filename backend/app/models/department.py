from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    description = Column(String, nullable=True)
    
    region_id = Column(Integer, ForeignKey("regions.id"), nullable=True)
    region = relationship("Region", back_populates="departments")

    users = relationship("User", back_populates="department")
    assignments = relationship("Assignment", back_populates="department")
