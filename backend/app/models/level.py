from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.db.base import Base


class Level(Base):
    __tablename__ = "levels"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(Integer, unique=True, nullable=False, index=True)
    title = Column(String, nullable=False)
    min_points = Column(Integer, nullable=False)
    description = Column(String, nullable=True)

    users = relationship("User", back_populates="level")
