from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router

app = FastAPI(title=settings.PROJECT_NAME)

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
