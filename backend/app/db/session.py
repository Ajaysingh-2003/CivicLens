import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/CivicLens")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Pings the DB to check if connection is alive before using it
    pool_recycle=3600    # Automatically recycle connections older than 1 hour
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
