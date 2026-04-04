from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.db.base import Base

class City(Base):
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True, index=True)
    state_id = Column(Integer, ForeignKey("states.id"), nullable=False)
    name = Column(String, index=True, nullable=False)
    
    geom = Column(Geometry('GEOMETRY', srid=4326), nullable=True)

    state = relationship("State", back_populates="cities")
    users = relationship("User", back_populates="city")
    issues = relationship("Issue", back_populates="city")
