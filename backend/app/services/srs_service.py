"""DB-touching SRS logic. Calls pure sm2.py for scheduling math."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session

from app.models.srs_card import SrsCard
from app.srs import CardState, schedule_next


def get_or_create_card(db: Session, user_id: uuid.UUID, question_id: uuid.UUID) -> SrsCard:
    card = db.query(SrsCard).filter_by(user_id=user_id, question_id=question_id).first()
    if not card:
        card = SrsCard(user_id=user_id, question_id=question_id)
        db.add(card)
        db.flush()
    return card


def record_review(db: Session, card: SrsCard, quality: int) -> SrsCard:
    state = CardState(
        easiness=card.easiness,
        interval_days=card.interval_days,
        repetitions=card.repetitions,
    )
    outcome = schedule_next(state, quality)
    card.easiness = outcome.next_state.easiness
    card.interval_days = outcome.next_state.interval_days
    card.repetitions = outcome.next_state.repetitions
    card.due_at = datetime.now(timezone.utc) + timedelta(seconds=outcome.due_offset_seconds)
    card.last_reviewed_at = datetime.now(timezone.utc)
    db.flush()
    return card


def get_due_cards(db: Session, user_id: uuid.UUID, limit: int = 20) -> list[SrsCard]:
    now = datetime.now(timezone.utc)
    return (
        db.query(SrsCard)
        .filter(SrsCard.user_id == user_id, SrsCard.due_at <= now)
        .order_by(SrsCard.due_at)
        .limit(limit)
        .all()
    )
