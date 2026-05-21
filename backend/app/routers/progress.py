from __future__ import annotations

from datetime import datetime, timezone, timedelta, date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.attempt import Attempt
from app.models.question import Question
from app.models.srs_card import SrsCard
from app.models.topic import Topic
from app.models.user import AppUser
from app.routers.auth import get_current_user

router = APIRouter()


def _streak(db: Session, user_id) -> int:
    """Consecutive days (UTC) with at least one attempt, counting today."""
    rows = (
        db.query(func.date(Attempt.started_at).label("d"))
        .filter(Attempt.user_id == user_id)
        .distinct()
        .order_by(func.date(Attempt.started_at).desc())
        .all()
    )
    if not rows:
        return 0

    days = sorted({r[0] for r in rows}, reverse=True)
    today = datetime.now(timezone.utc).date()

    if days[0] != today:
        return 0  # no activity today → streak broken

    streak = 1
    for i in range(1, len(days)):
        if days[i - 1] - days[i] == timedelta(days=1):
            streak += 1
        else:
            break
    return streak


@router.get("/progress/summary")
def progress_summary(
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=6)

    all_attempts = db.query(Attempt).filter_by(user_id=user.id).all()
    total = len(all_attempts)
    correct = sum(1 for a in all_attempts if a.correct)

    today_attempts = [a for a in all_attempts if a.started_at >= today_start]
    week_attempts = [a for a in all_attempts if a.started_at >= week_start]

    minutes_today = round(sum((a.time_seconds or 0) for a in today_attempts) / 60, 1)
    minutes_week = round(sum((a.time_seconds or 0) for a in week_attempts) / 60, 1)

    due_today = (
        db.query(func.count(SrsCard.id))
        .filter(SrsCard.user_id == user.id, SrsCard.due_at <= now)
        .scalar()
        or 0
    )
    due_week = (
        db.query(func.count(SrsCard.id))
        .filter(SrsCard.user_id == user.id, SrsCard.due_at <= now + timedelta(days=7))
        .scalar()
        or 0
    )

    return {
        "total_attempts": total,
        "total_correct": correct,
        "accuracy": round(correct / total, 3) if total else 0.0,
        "streak_days": _streak(db, user.id),
        "minutes_today": minutes_today,
        "minutes_week": minutes_week,
        "due_today": due_today,
        "due_this_week": due_week,
    }


@router.get("/progress/weak-topics")
def weak_topics(
    limit: int = Query(default=5, ge=1, le=20),
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Last 50 attempts with topic info
    rows = (
        db.query(Attempt, Topic.slug, Topic.name)
        .join(Question, Question.id == Attempt.question_id)
        .join(Topic, Topic.id == Question.topic_id)
        .filter(Attempt.user_id == user.id)
        .order_by(Attempt.started_at.desc())
        .limit(50)
        .all()
    )

    stats: dict[str, dict] = {}
    for attempt, slug, name in rows:
        if slug not in stats:
            stats[slug] = {"title": name, "correct": 0, "total": 0}
        stats[slug]["total"] += 1
        if attempt.correct:
            stats[slug]["correct"] += 1

    result = [
        {
            "topic_slug": slug,
            "title": v["title"],
            "accuracy": round(v["correct"] / v["total"], 3),
            "attempts": v["total"],
        }
        for slug, v in stats.items()
        if v["total"] > 0
    ]
    result.sort(key=lambda x: x["accuracy"])
    return result[:limit]


@router.get("/progress/activity")
def activity(
    days: int = Query(default=30, ge=1, le=365),
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    attempts = (
        db.query(Attempt)
        .filter(Attempt.user_id == user.id, Attempt.started_at >= start)
        .all()
    )

    # Bucket by date
    buckets: dict[date, dict] = {}
    for i in range(days):
        d = (start + timedelta(days=i)).date()
        buckets[d] = {"attempts": 0, "correct": 0, "minutes": 0.0}

    for a in attempts:
        d = a.started_at.date()
        if d in buckets:
            buckets[d]["attempts"] += 1
            if a.correct:
                buckets[d]["correct"] += 1
            buckets[d]["minutes"] += round((a.time_seconds or 0) / 60, 1)

    return {
        "days": [
            {
                "date": str(d),
                "attempts": v["attempts"],
                "correct": v["correct"],
                "minutes": v["minutes"],
            }
            for d, v in sorted(buckets.items())
        ]
    }
