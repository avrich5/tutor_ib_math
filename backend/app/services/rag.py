"""RAG retrieval over question, concept, and Haese textbook embeddings via pgvector."""
from __future__ import annotations

import logging
import uuid
from collections import OrderedDict

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.hint import Hint
from app.services.orchestrator_client import orchestrator

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Embedding cache — LRU, max 128 entries
# ---------------------------------------------------------------------------

_embed_cache: OrderedDict[str, list[float]] = OrderedDict()
_CACHE_MAX = 128


async def _embed_cached(query: str) -> list[float]:
    if query in _embed_cache:
        _embed_cache.move_to_end(query)
        return _embed_cache[query]

    vec = await orchestrator.embed_text(query)

    _embed_cache[query] = vec
    _embed_cache.move_to_end(query)
    if len(_embed_cache) > _CACHE_MAX:
        _embed_cache.popitem(last=False)

    return vec


def _vec_str(vec: list[float]) -> str:
    return "[" + ",".join(map(str, vec)) + "]"


# ---------------------------------------------------------------------------
# Core retrieval
# ---------------------------------------------------------------------------


async def retrieve(
    db: Session,
    query: str,
    k_questions: int = 3,
    k_concepts: int = 2,
    k_textbook: int = 3,
) -> dict:
    """
    Returns:
    {
        "questions":          [{id, stem_md, topic_slug, similarity, hints:[...]}],
        "concepts":           [{id, title, statement_md, similarity}],
        "textbook_concepts":  [{id, kind, label, section_title, chapter, text_md, similarity}],
        "textbook_questions": [{id, exercise_ref, question_number, stem_md, chapter, similarity}],
    }
    """
    try:
        embedding = await _embed_cached(query)
    except Exception as exc:
        logger.warning("embed_text failed, skipping RAG: %s", exc)
        return {"questions": [], "concepts": [], "textbook_concepts": [], "textbook_questions": []}

    vec = _vec_str(embedding)
    questions = _fetch_questions(db, vec, k_questions)
    concepts = _fetch_concepts(db, vec, k_concepts)
    tb_concepts = _fetch_textbook_concepts(db, vec, k_textbook)
    tb_questions = _fetch_textbook_questions(db, vec, k_textbook)

    return {
        "questions": questions,
        "concepts": concepts,
        "textbook_concepts": tb_concepts,
        "textbook_questions": tb_questions,
    }


def _fetch_questions(db: Session, vec_str: str, k: int) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT q.id::text, q.stem_md, t.slug AS topic_slug,
                   1 - (q.embedding <=> CAST(:vec AS vector)) AS similarity
            FROM question q
            JOIN topic t ON t.id = q.topic_id
            WHERE q.status = 'approved' AND q.embedding IS NOT NULL
            ORDER BY q.embedding <=> CAST(:vec AS vector)
            LIMIT :k
            """
        ),
        {"vec": vec_str, "k": k},
    ).fetchall()

    result = []
    for row in rows:
        q_id = uuid.UUID(row.id)
        hints = (
            db.query(Hint)
            .filter_by(question_id=q_id)
            .order_by(Hint.tier)
            .all()
        )
        result.append(
            {
                "id": row.id,
                "stem_md": row.stem_md,
                "topic_slug": row.topic_slug,
                "similarity": round(float(row.similarity), 4),
                "hints": [
                    {"id": str(h.id), "tier": h.tier, "text_md": h.text_md}
                    for h in hints
                ],
            }
        )

    return result


def _fetch_concepts(db: Session, vec_str: str, k: int) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT c.id::text, c.title, c.statement_md,
                   1 - (c.embedding <=> CAST(:vec AS vector)) AS similarity
            FROM concept c
            WHERE c.embedding IS NOT NULL
            ORDER BY c.embedding <=> CAST(:vec AS vector)
            LIMIT :k
            """
        ),
        {"vec": vec_str, "k": k},
    ).fetchall()

    return [
        {
            "id": row.id,
            "title": row.title,
            "statement_md": row.statement_md,
            "similarity": round(float(row.similarity), 4),
        }
        for row in rows
    ]


def _fetch_textbook_concepts(db: Session, vec_str: str, k: int) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT tc.id::text, tc.kind, tc.label, tc.section_title, tc.chapter,
                   tc.text_md,
                   1 - (tc.embedding <=> CAST(:vec AS vector)) AS similarity
            FROM textbook_concept tc
            WHERE tc.embedding IS NOT NULL
            ORDER BY tc.embedding <=> CAST(:vec AS vector)
            LIMIT :k
            """
        ),
        {"vec": vec_str, "k": k},
    ).fetchall()

    return [
        {
            "id": row.id,
            "kind": row.kind,
            "label": row.label,
            "section_title": row.section_title,
            "chapter": row.chapter,
            "text_md": row.text_md,
            "similarity": round(float(row.similarity), 4),
        }
        for row in rows
    ]


def _fetch_textbook_questions(db: Session, vec_str: str, k: int) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT tq.id::text, tq.exercise_ref, tq.question_number,
                   tq.stem_md, tq.chapter,
                   1 - (tq.embedding <=> CAST(:vec AS vector)) AS similarity
            FROM textbook_question tq
            WHERE tq.embedding IS NOT NULL
            ORDER BY tq.embedding <=> CAST(:vec AS vector)
            LIMIT :k
            """
        ),
        {"vec": vec_str, "k": k},
    ).fetchall()

    return [
        {
            "id": row.id,
            "exercise_ref": row.exercise_ref,
            "question_number": row.question_number,
            "stem_md": row.stem_md,
            "chapter": row.chapter,
            "similarity": round(float(row.similarity), 4),
        }
        for row in rows
    ]
