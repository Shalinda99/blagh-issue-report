from fastapi import APIRouter

from app.api.v1.endpoints import admin, consents, projects, reports

api_router = APIRouter()

api_router.include_router(reports.router,  prefix="/reports",  tags=["Reports"])
api_router.include_router(consents.router, prefix="/consents", tags=["Consents"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(admin.router,    prefix="/admin",    tags=["Admin"])
