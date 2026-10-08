"""
Project management endpoints — requires admin JWT.
"""

from fastapi import APIRouter, Depends, status
from pymongo.database import Database

from app.core.security import get_current_admin
from app.db.session import get_db
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services import project_service

router = APIRouter(dependencies=[Depends(get_current_admin)])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProjectResponse)
def create_project(payload: ProjectCreate, db: Database = Depends(get_db)) -> ProjectResponse:
    project = project_service.create_project(db, payload)
    return ProjectResponse.model_validate(project)


@router.get("", response_model=list[ProjectResponse])
def list_projects(db: Database = Depends(get_db)) -> list[ProjectResponse]:
    projects = project_service.list_projects(db)
    return [ProjectResponse.model_validate(p) for p in projects]


@router.get("/{app_id}", response_model=ProjectResponse)
def get_project(app_id: str, db: Database = Depends(get_db)) -> ProjectResponse:
    project = project_service.get_project_by_app_id(db, app_id)
    return ProjectResponse.model_validate(project)


@router.patch("/{app_id}", response_model=ProjectResponse)
def update_project(
    app_id: str, payload: ProjectUpdate, db: Database = Depends(get_db)
) -> ProjectResponse:
    project = project_service.update_project(db, app_id, payload)
    return ProjectResponse.model_validate(project)
