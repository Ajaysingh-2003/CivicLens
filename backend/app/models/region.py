from sqlalchemy import Column, Integer, String
from geoalchemy2 import Geometry
from sqlalchemy.orm import relationship
from app.db.base import Base

class Region(Base):
    __tablename__ = "regions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    geom = Column(Geometry('POLYGON', srid=4326), nullable=True)

    departments = relationship("Department", back_populates="region")
