from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.api.v1.router import api_router
import redis

# Construct fully qualified Redis URI (handling password and missing scheme)
redis_host_port = settings.REDIS_URL.replace("redis://", "")
redis_uri = f"redis://:{settings.REDIS_PASSWORD}@{redis_host_port}" if settings.REDIS_PASSWORD else f"redis://{redis_host_port}"

# Initialize Redis connection for rate limiting (and check availability)
try:
    redis_client = redis.from_url(redis_uri, decode_responses=True)
    redis_client.ping()
    print("✅ Successfully connected to Redis for Rate Limiting")
except Exception as e:
    print(f"❌ Failed to connect to Redis: {e}")
    print("⚠️ Falling back to in-memory rate limiting")
    redis_uri = "memory://"

# Initialize the rate limiter using Redis storage (keyed by client IP address)
limiter = Limiter(key_func=get_remote_address, storage_uri=redis_uri)

app = FastAPI(
    title=settings.PROJECT_NAME,
    docs_url=None,       # Disable Swagger UI (/docs)
    redoc_url=None,      # Disable ReDoc (/redoc)
    openapi_url=None,    # Disable OpenAPI JSON schema (/openapi.json)
)

# Attach limiter to app state so endpoints can access it
app.state.limiter = limiter

# Register a clean 429 error handler
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Set up CORS for Web Admin Panel and Mobile App access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "Welcome to the Jantriva API - Auth is perfectly secure!"}

@app.get("/ping")
def ping():
    return {"ping": "pong"}
