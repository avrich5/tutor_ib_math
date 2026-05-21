from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.attempt import Attempt
from app.models.concept import Concept
from app.models.question import Question
from app.models.session import StudySession
from app.models.srs_card import SrsCard
from app.models.topic import Topic
from app.models.user import AppUser
from app.routers.auth import get_current_user

router = APIRouter()


def _child_slugs(db: Session) -> set[str]:
    """Return set of topic slugs that have at least one child."""
    rows = db.query(Topic.slug).join(
        Topic, Topic.parent_id == Topic.id, isouter=False
    ).all()
    # parents of child topics
    parents = (
        db.query(Topic.slug)
        .filter(
            Topic.id.in_(
                db.query(Topic.parent_id).filter(Topic.parent_id.isnot(None))
            )
        )
        .all()
    )
    return {r[0] for r in parents}


def _approved_count(db: Session, topic_id: uuid.UUID) -> int:
    return (
        db.query(func.count(Question.id))
        .filter(Question.topic_id == topic_id, Question.status == "approved")
        .scalar()
        or 0
    )


def _due_count(db: Session, topic_id: uuid.UUID, user_id: uuid.UUID) -> int:
    now = datetime.now(timezone.utc)
    return (
        db.query(func.count(SrsCard.id))
        .join(Question, Question.id == SrsCard.question_id)
        .filter(
            Question.topic_id == topic_id,
            SrsCard.user_id == user_id,
            SrsCard.due_at <= now,
        )
        .scalar()
        or 0
    )


def _mastery(db: Session, topic_id: uuid.UUID, user_id: uuid.UUID) -> float | None:
    rows = (
        db.query(Attempt.response_quality)
        .join(Question, Question.id == Attempt.question_id)
        .filter(
            Question.topic_id == topic_id,
            Attempt.user_id == user_id,
            Attempt.response_quality.isnot(None),
        )
        .order_by(Attempt.started_at.desc())
        .limit(20)
        .all()
    )
    if not rows:
        return None
    return round(sum(r[0] for r in rows) / (5.0 * len(rows)), 3)


@router.get("/topics")
def list_topics(
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    parent_slugs = _child_slugs(db)
    topics = db.query(Topic).order_by(Topic.slug).all()

    result = []
    for t in topics:
        approved = _approved_count(db, t.id)
        due = _due_count(db, t.id, user.id)
        kind = "category" if t.slug in parent_slugs else "leaf"
        result.append(
            {
                "slug": t.slug,
                "title": t.name,
                "kind": kind,
                "approved_questions": approved,
                "due_count": due,
            }
        )
    return result


@router.get("/topics/{slug:path}")
def get_topic(
    slug: str,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    topic = db.query(Topic).filter_by(slug=slug).first()
    if not topic:
        raise HTTPException(status_code=404, detail=f"Topic '{slug}' not found")

    parent_slugs = _child_slugs(db)
    kind = "category" if slug in parent_slugs else "leaf"

    # Concepts for this topic
    concepts = db.query(Concept).filter_by(topic_id=topic.id).all()
    concept_list = [
        {
            "concept_id": str(c.id),
            "title": c.title,
            "summary_md": c.statement_md,
        }
        for c in concepts
    ]

    return {
        "slug": topic.slug,
        "title": topic.name,
        "kind": kind,
        "description_md": topic.description or "",
        "concepts": concept_list,
        "approved_questions": _approved_count(db, topic.id),
        "due_count": _due_count(db, topic.id, user.id),
        "mastery": _mastery(db, topic.id, user.id),
    }
