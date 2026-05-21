import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.hint import Hint
from app.models.question import Question
from app.models.user import AppUser
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/questions/{question_id}/hint")
def get_hint(
    question_id: str,
    tier: int = Query(..., ge=1, le=3),
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        qid = uuid.UUID(question_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID")

    hint = db.query(Hint).filter_by(question_id=qid, tier=tier).first()
    if not hint:
        raise HTTPException(status_code=404, detail=f"Hint tier {tier} not found")

    return {"tier": hint.tier, "hint_md": hint.text_md}


@router.get("/questions/{question_id}/solution")
def get_solution(
    question_id: str,
    user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        qid = uuid.UUID(question_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID")

    q = db.query(Question).filter_by(id=qid).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    steps = q.solution_steps or []
    if steps:
        solution_md = "\n\n".join(
            f"**Step {i+1}.** {s}" if isinstance(s, str) else f"**Step {i+1}.** {s.get('text_md', str(s))}"
            for i, s in enumerate(steps)
        )
    else:
        solution_md = f"$$\n{q.reference_answer}\n$$"

    return {"solution_md": solution_md}
