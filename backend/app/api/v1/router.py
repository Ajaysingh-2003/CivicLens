from fastapi import APIRouter
from app.api.v1.endpoints import users, login, issues, locations, departments, levels

api_router = APIRouter()
api_router.include_router(login.router, prefix="/login", tags=["login"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(issues.router, prefix="/issues", tags=["issues"])
api_router.include_router(locations.router, prefix="/locations", tags=["locations"])
api_router.include_router(departments.router, prefix="/departments", tags=["departments"])
api_router.include_router(levels.router, prefix="/levels", tags=["levels"])
