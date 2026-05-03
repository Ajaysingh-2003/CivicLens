from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.api.v1.router import api_router

# Initialize the rate limiter (keyed by client IP address)
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title=settings.PROJECT_NAME)

# Attach limiter to app state so endpoints can access it
app.state.limiter = limiter

# Register a clean 429 error handler
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Set up CORS for Web Admin Panel and Mobile App access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Should be tied strictly to localhost and frontend domains in production!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "Welcome to the CivicLens API - Auth is perfectly secure!"}

@app.get("/ping")
def ping():
    return {"ping": "pong"}
