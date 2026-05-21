import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.concept import Concept
from app.models.topic import Topic
from app.models.user import AppUser
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/concepts/{concept_id}")
def get_concept(
    concept_id: str,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        cid = uuid.UUID(concept_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID")

    concept = db.query(Concept).filter_by(id=cid).first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    topic = db.query(Topic).filter_by(id=concept.topic_id).first()
    topic_slug = topic.slug if topic else ""

    payload: dict = {
        "concept_id": str(concept.id),
        "title": concept.title,
        "summary_md": concept.statement_md,
        "topic_slug": topic_slug,
    }
    if concept.proof_md:
        payload["proof_md"] = concept.proof_md
    if concept.examples_md:
        payload["examples_md"] = concept.examples_md

    return payload
