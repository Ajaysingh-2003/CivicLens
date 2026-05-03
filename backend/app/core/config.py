import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "CivicLens API"
    DATABASE_URL: str # No defaults! Pydantic will pull strictly from .env
    
    # Auth configuration
    SECRET_KEY: str # No defaults! Pydantic will pull strictly from .env
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days

    # External Services
    REDIS_URL: str
    REDIS_PASSWORD: str = ""
    RESEND_API_KEY: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
