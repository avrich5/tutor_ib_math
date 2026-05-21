"""RAG retrieval over question and concept embeddings via pgvector."""
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
) -> dict:
    """
    Returns:
    {
        "questions": [
            {"id": str, "stem_md": str, "topic_slug": str, "similarity": float,
             "hints": [{"id": str, "tier": int, "text_md": str}, ...]},
            ...
        ],
        "concepts": [
            {"id": str, "title": str, "statement_md": str, "similarity": float},
            ...
        ]
    }
    """
    try:
        embedding = await _embed_cached(query)
    except Exception as exc:
        logger.warning("embed_text failed, skipping RAG: %s", exc)
        return {"questions": [], "concepts": []}

    vec = _vec_str(embedding)
    questions = _fetch_questions(db, vec, k_questions)
    concepts = _fetch_concepts(db, vec, k_concepts)

    return {"questions": questions, "concepts": concepts}


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
