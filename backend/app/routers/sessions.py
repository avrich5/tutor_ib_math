from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from sqlalchemy import func

from app.db import get_db
from app.models.attempt import Attempt
from app.models.question import Question
from app.models.session import StudySession
from app.models.srs_card import SrsCard
from app.models.topic import Topic
from app.models.user import AppUser
from app.routers.auth import get_current_user

router = APIRouter()

# In-memory session queue: session_id → {question_ids, topic_slug}
_queues: dict[str, dict] = {}

KIND_MAP = {"mc": "multiple_choice"}


def _map_kind(kind: str) -> str:
    return KIND_MAP.get(kind, kind)


def _question_payload(q: Question, topic_slug: str) -> dict:
    choices = q.mc_options if q.kind == "mc" else None
    steps = q.ordered_steps if q.kind == "ordered_steps" else None
    return {
        "question_id": str(q.id),
        "kind": _map_kind(q.kind),
        "stem_md": q.stem_md,
        "choices": choices,
        "steps": steps,
        "topic_slug": topic_slug,
        "concept_id": "",
    }


class CreateSessionRequest(BaseModel):
    topic_slug: str


@router.get("/sessions/today")
def sessions_today(
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    due_count = (
        db.query(SrsCard)
        .filter(SrsCard.user_id == user.id, SrsCard.due_at <= now)
        .count()
    )

    # Build topics list: all topics with approved questions
    all_topics = db.query(Topic).all()
    topic_rows = []
    for t in all_topics:
        approved = (
            db.query(func.count(Question.id))
            .filter(Question.topic_id == t.id, Question.status == "approved")
            .scalar()
            or 0
        )
        if approved == 0:
            continue
        due = (
            db.query(func.count(SrsCard.id))
            .join(Question, Question.id == SrsCard.question_id)
            .filter(
                Question.topic_id == t.id,
                SrsCard.user_id == user.id,
                SrsCard.due_at <= now,
            )
            .scalar()
            or 0
        )
        topic_rows.append(
            {
                "topic_slug": t.slug,
                "title": t.name,
                "due_count": due,
                "approved_questions": approved,
            }
        )

    topic_rows.sort(key=lambda x: (-x["due_count"], x["topic_slug"]))
    topic_rows = topic_rows[:10]

    # suggested_topic_slug: max due_count, else first with approved questions
    suggested = None
    if topic_rows:
        by_due = sorted(topic_rows, key=lambda x: -x["due_count"])
        if by_due[0]["due_count"] > 0:
            suggested = by_due[0]["topic_slug"]
        else:
            suggested = topic_rows[0]["topic_slug"]

    return {"due_count": due_count, "topics": topic_rows, "suggested_topic_slug": suggested}


@router.post("/sessions")
def create_session(
    req: CreateSessionRequest,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    topic = db.query(Topic).filter_by(slug=req.topic_slug).first()
    if not topic:
        raise HTTPException(status_code=404, detail=f"Topic '{req.topic_slug}' not found")

    questions = (
        db.query(Question)
        .filter(Question.topic_id == topic.id, Question.status == "approved")
        .all()
    )
    if not questions:
        raise HTTPException(
            status_code=404, detail=f"No approved questions for topic '{req.topic_slug}'"
        )

    # SRS-order: due first, then new
    now = datetime.now(timezone.utc)
    cards = {
        str(c.question_id): c
        for c in db.query(SrsCard).filter(SrsCard.user_id == user.id).all()
    }

    def sort_key(q: Question):
        card = cards.get(str(q.id))
        if card and card.due_at <= now:
            return (0, card.due_at)
        return (1, q.created_at)

    questions.sort(key=sort_key)

    session = StudySession(user_id=user.id, goal_topic_id=topic.id)
    db.add(session)
    db.commit()
    db.refresh(session)

    sid = str(session.id)
    _queues[sid] = {
        "question_ids": [str(q.id) for q in questions],
        "topic_slug": req.topic_slug,
    }

    return {
        "session_id": sid,
        "topic_slug": req.topic_slug,
        "created_at": session.started_at.isoformat(),
        "total_questions": len(questions),
        "completed": 0,
    }


@router.post("/sessions/{session_id}/next")
def next_question(
    session_id: str,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        sid_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")

    session = db.query(StudySession).filter_by(id=sid_uuid, user_id=user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    queue = _queues.get(session_id)
    if not queue:
        # Rebuild queue after server restart
        topic = db.query(Topic).filter_by(id=session.goal_topic_id).first()
        topic_slug = topic.slug if topic else "unknown"
        questions = (
            db.query(Question)
            .filter(Question.topic_id == session.goal_topic_id, Question.status == "approved")
            .all()
        )
        questions.sort(key=lambda q: q.created_at)
        _queues[session_id] = {
            "question_ids": [str(q.id) for q in questions],
            "topic_slug": topic_slug,
        }
        queue = _queues[session_id]

    question_ids: list[str] = queue["question_ids"]
    topic_slug: str = queue["topic_slug"]

    answered = {
        str(a.question_id)
        for a in db.query(Attempt).filter_by(session_id=sid_uuid).all()
    }

    for qid in question_ids:
        if qid not in answered:
            q = db.query(Question).filter_by(id=uuid.UUID(qid)).first()
            if not q:
                continue
            return {
                "question": _question_payload(q, topic_slug),
                "session_id": session_id,
                "question_number": len(answered) + 1,
                "total_questions": len(question_ids),
            }

    return {
        "question": None,
        "session_id": session_id,
        "question_number": len(answered),
        "total_questions": len(question_ids),
    }


@router.post("/sessions/{session_id}/end")
def end_session(
    session_id: str,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        sid_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")

    session = db.query(StudySession).filter_by(id=sid_uuid, user_id=user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc)
    session.ended_at = now
    db.commit()

    attempts = db.query(Attempt).filter_by(session_id=sid_uuid).all()
    total = len(_queues.get(session_id, {}).get("question_ids", attempts))
    correct = sum(1 for a in attempts if a.correct)
    duration = int((now - session.started_at).total_seconds())

    return {
        "session_id": session_id,
        "total_questions": total,
        "correct": correct,
        "incorrect": len(attempts) - correct,
        "duration_seconds": duration,
        "mastery_delta": (correct / max(len(attempts), 1)) - 0.5,
    }
