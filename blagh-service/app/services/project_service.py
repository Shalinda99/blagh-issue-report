"""
Project service — CRUD operations for projects stored in MongoDB.
"""

from datetime import datetime, timezone

from pymongo import DESCENDING
from pymongo.database import Database

from app.core.exceptions import ConflictError, NotFoundError
from app.schemas.project import ProjectCreate, ProjectUpdate


def _doc_to_dict(doc: dict) -> dict:
    result = dict(doc)
    result["id"] = str(result.pop("_id"))
    return result


def create_project(db: Database, payload: ProjectCreate) -> dict:
    if db.projects.find_one({"app_id": payload.app_id}, {"_id": 1}):
        raise ConflictError(f"A project with app_id '{payload.app_id}' already exists.")

    now = datetime.now(timezone.utc)
    doc = {
        "app_id": payload.app_id,
        "name": payload.name,
        "origin_url": payload.origin_url,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    result = db.projects.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _doc_to_dict(doc)


def get_project_by_app_id(db: Database, app_id: str) -> dict:
    doc = db.projects.find_one({"app_id": app_id})
    if not doc:
        raise NotFoundError("Project", app_id)
    return _doc_to_dict(doc)


def list_projects(db: Database) -> list[dict]:
    cursor = db.projects.find().sort("created_at", DESCENDING)
    return [_doc_to_dict(doc) for doc in cursor]


def update_project(db: Database, app_id: str, payload: ProjectUpdate) -> dict:
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        return get_project_by_app_id(db, app_id)
    update_data["updated_at"] = datetime.now(timezone.utc)
    doc = db.projects.find_one_and_update(
        {"app_id": app_id},
        {"$set": update_data},
        return_document=True,
    )
    if not doc:
        raise NotFoundError("Project", app_id)
    return _doc_to_dict(doc)
