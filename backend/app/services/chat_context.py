"""Build a context-enriched system prompt for the tutor chat."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models.attempt import Attempt
from app.models.chat import ChatSession
from app.models.question import Question
from app.models.topic import Topic
from app.models.user import AppUser
from app.services.rag import retrieve

logger = logging.getLogger(__name__)

_GUIDELINES = """\
Guidelines:
- Be concise. The student is doing a focused study session.
- When you reference a question, hint, or concept from the system, use citation markers: [Q:uuid], [C:uuid], [hint:uuid:tier].
- Explain reasoning step-by-step using LaTeX inline ($...$) and block ($$...$$) math.
- If asked for the answer directly without effort, redirect: ask the student where they got stuck first."""


async def build_context_prompt(
    db: Session,
    user: AppUser,
    chat_session: ChatSession,
    query: str,
) -> str:
    parts: list[str] = [
        "You are a math tutor for IB Mathematics AA HL.",
        f"Student's name: {user.display_name}",
        "",
    ]

    if chat_session.study_session_id:
        _add_current_question(parts, db, user, chat_session.study_session_id)

    weak = _weak_topics(db, user.id, limit=3)
    if weak:
        parts.append("Topics where the student is currently weaker than average:")
        for t in weak:
            parts.append(f"- {t['title']} ({round(t['accuracy'] * 100)}%)")
        parts.append("")

    if query:
        rag = await retrieve(db, query)
        _add_rag_section(parts, rag)

    parts.append(_GUIDELINES)

    prompt = "\n".join(parts)
    logger.info("chat context prompt:\n%s", prompt)
    return prompt


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _add_current_question(parts: list[str], db: Session, user: AppUser, study_session_id) -> None:
    row = (
        db.query(Attempt, Question, Topic)
        .join(Question, Question.id == Attempt.question_id)
        .join(Topic, Topic.id == Question.topic_id)
        .filter(
            Attempt.session_id == study_session_id,
            Attempt.user_id == user.id,
        )
        .order_by(Attempt.started_at.desc())
        .first()
    )

    if not row:
        return

    attempt, question, topic = row
    parts.append("Current task the student is working on:")
    parts.append(f"- Topic: {topic.slug}")
    parts.append(f"- Question: {question.stem_md}")
    parts.append(f"- Reference answer: {question.reference_answer}")
    if attempt.student_answer is not None:
        status = "correct" if attempt.correct else "incorrect"
        parts.append(f"- Student's last attempt: {attempt.student_answer} ({status})")
    parts.append(f"- Hints used: {attempt.hints_used}")
    parts.append("")


def _weak_topics(db: Session, user_id, limit: int = 3) -> list[dict]:
    rows = (
        db.query(Attempt, Topic.slug, Topic.name)
        .join(Question, Question.id == Attempt.question_id)
        .join(Topic, Topic.id == Question.topic_id)
        .filter(Attempt.user_id == user_id)
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
        {"topic_slug": slug, "title": v["title"], "accuracy": v["correct"] / v["total"]}
        for slug, v in stats.items()
    ]
    result.sort(key=lambda x: x["accuracy"])
    return result[:limit]


def _add_rag_section(parts: list[str], rag: dict) -> None:
    questions = rag.get("questions", [])
    concepts = rag.get("concepts", [])

    if questions:
        parts.append(
            "Relevant questions from the student's curriculum "
            "(use citation markers if you reference them):"
        )
        for q in questions:
            stem_preview = q["stem_md"][:100] + ("..." if len(q["stem_md"]) > 100 else "")
            parts.append(f"- [Q:{q['id']}] {q['topic_slug']}: {stem_preview}")

            if q.get("hints"):
                parts.append(f"  Hints available for [Q:{q['id']}]:")
                for h in q["hints"]:
                    hint_preview = h["text_md"][:80] + ("..." if len(h["text_md"]) > 80 else "")
                    parts.append(f"  - Tier {h['tier']}: [hint:{h['id']}:{h['tier']}] {hint_preview}")
        parts.append("")

    if concepts:
        parts.append("Relevant concepts:")
        for c in concepts:
            stmt_preview = c["statement_md"][:100] + ("..." if len(c["statement_md"]) > 100 else "")
            parts.append(f"- [C:{c['id']}] {c['title']}: {stmt_preview}")
        parts.append("")
