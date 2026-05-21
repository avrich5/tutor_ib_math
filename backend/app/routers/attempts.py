from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.attempt import Attempt
from app.models.question import Question
from app.models.session import StudySession
from app.models.user import AppUser
from app.routers.auth import get_current_user
from app.services.srs_service import get_or_create_card, record_review

router = APIRouter()


class AttemptRequest(BaseModel):
    session_id: str
    question_id: str
    student_answer: str
    time_seconds: int = 0
    hints_used: int = 0


def _grade(q: Question, student_answer: str) -> tuple[bool, str]:
    """Returns (correct, feedback_md). Pure local grading — no orchestrator."""
    kind = q.kind

    if kind == "flashcard":
        correct = student_answer.strip() == "got_it"
        return correct, "Marked as known." if correct else "Marked for review."

    if kind == "mc":
        correct = student_answer.strip().upper() == (q.mc_correct_key or "").strip().upper()
        if correct:
            return True, "Correct!"
        correct_text = (q.mc_options or {}).get(q.mc_correct_key or "", "")
        return False, f"Not quite. The correct answer is **{q.mc_correct_key}**: {correct_text}"

    if kind == "free_numeric":
        try:
            from fractions import Fraction
            ref = float(Fraction(q.reference_answer.strip()))
            ans = float(Fraction(student_answer.strip()))
            correct = abs(ref - ans) < 1e-6
        except Exception:
            correct = student_answer.strip() == q.reference_answer.strip()
        if correct:
            return True, "Correct!"
        return False, f"Not quite. Expected: $${q.reference_answer}$$"

    if kind == "ordered_steps":
        try:
            import json
            submitted = json.loads(student_answer) if isinstance(student_answer, str) else student_answer
            reference = [s["step_id"] for s in (q.ordered_steps or [])]
            correct = list(submitted) == reference
        except Exception:
            correct = False
        return correct, "Correct order!" if correct else "Not quite — check the order of steps."

    # free_expression — try orchestrator, fall back to string comparison
    if kind == "free_expression":
        try:
            import asyncio
            from app.services.orchestrator_client import orchestrator
            result = asyncio.get_event_loop().run_until_complete(
                orchestrator.check_answer(
                    student_answer=student_answer,
                    reference_answer=q.reference_answer,
                    answer_format="expression",
                    variables=q.variables or [],
                )
            )
            correct = bool(result.get("correct", False))
            feedback = result.get("feedback_md") or ("Correct!" if correct else "Not quite.")
            return correct, feedback
        except Exception:
            pass
        # Fallback: normalize whitespace and compare
        correct = student_answer.strip() == q.reference_answer.strip()
        msg = "Correct!" if correct else (
            "Could not verify automatically — answer recorded. "
            f"Reference: $${q.reference_answer}$$"
        )
        return correct, msg

    return False, "Unknown question kind."


@router.post("/attempts")
def submit_attempt(
    req: AttemptRequest,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        session_id = uuid.UUID(req.session_id)
        question_id = uuid.UUID(req.question_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID")

    session = db.query(StudySession).filter_by(id=session_id, user_id=user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    q = db.query(Question).filter_by(id=question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    correct, feedback_md = _grade(q, req.student_answer)

    # Map quality 0-5 for SRS
    quality = 5 if correct and req.hints_used == 0 else (4 if correct else (2 if req.hints_used > 0 else 1))

    # Update SRS card
    card = get_or_create_card(db, user.id, question_id)
    card = record_review(db, card, quality)

    attempt = Attempt(
        session_id=session_id,
        user_id=user.id,
        question_id=question_id,
        student_answer=req.student_answer,
        correct=correct,
        hints_used=req.hints_used,
        response_quality=quality,
        time_seconds=req.time_seconds,
        ended_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return {
        "attempt_id": str(attempt.id),
        "correct": correct,
        "feedback_md": feedback_md,
        "show_solution_next": not correct,
        "response_quality": quality,
        "srs_next_review_at": card.due_at.isoformat(),
    }
