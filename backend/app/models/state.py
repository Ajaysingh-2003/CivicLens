from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.db.base import Base

class State(Base):
    __tablename__ = "states"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False) 
    is_active = Column(Boolean, default=True)
    
    geom = Column(Geometry('GEOMETRY', srid=4326), nullable=True)

    cities = relationship("City", back_populates="state", cascade="all, delete-orphan")
