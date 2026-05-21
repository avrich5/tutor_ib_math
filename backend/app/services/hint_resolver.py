"""
Resolve a hint for a given question + tier.

Generated questions  → direct lookup in the hint table (existing behaviour).
Textbook questions   → derive on-demand from the nearest textbook_concept.

Derived hints are NOT persisted; the hint table stays clean (only generated
hints land there permanently).

Tier strategy for textbook questions:
  1  — nearest theory/key_point concept:
         "Recall from §{chapter}: {label} — {first 200 chars of text_md}"
  2  — nearest worked_example concept:
         "This is similar to the worked example in §{chapter}: {label}. {summary}"
  3  — full text of the most relevant worked_example (via related_example_ids
         if present, otherwise cosine similarity fallback)
"""
from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.hint import Hint
from app.models.question import Question
from app.models.textbook import TextbookConcept, TextbookQuestion


def resolve_hint(db: Session, question_id: uuid.UUID, tier: int) -> dict | None:
    hint = db.query(Hint).filter_by(question_id=question_id, tier=tier).first()
    if hint:
        return {"tier": hint.tier, "hint_md": hint.text_md, "source": "generated"}

    q = db.query(Question).filter_by(id=question_id).first()
    if q and q.source_type == "textbook" and q.source_id is not None:
        return _derive_textbook_hint(db, q, tier)

    return None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _vec_str(vec: list[float]) -> str:
    return "[" + ",".join(map(str, vec)) + "]"


def _derive_textbook_hint(db: Session, q: Question, tier: int) -> dict | None:
    tb = db.query(TextbookQuestion).filter_by(id=q.source_id).first()
    if tb is None:
        return None

    chapter = tb.chapter or "?"

    if tier == 3:
        return _hint_tier3(db, tb, chapter)
    if tier == 2:
        return _hint_tier2(db, tb, q, chapter)
    return _hint_tier1(db, tb, q, chapter)


def _nearest_concept(
    db: Session, q: Question, kinds: tuple[str, ...], limit: int = 1
) -> list:
    """Return textbook_concept rows nearest to q.embedding filtered by kind."""
    if q.embedding is None:
        return []
    kind_list = ", ".join(f"'{k}'" for k in kinds)
    rows = db.execute(
        text(
            f"""
            SELECT id, kind, label, section_title, chapter, text_md
            FROM textbook_concept
            WHERE kind IN ({kind_list}) AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:vec AS vector)
            LIMIT :lim
            """
        ),
        {"vec": _vec_str(q.embedding), "lim": limit},
    ).fetchall()
    return rows


def _hint_tier1(db: Session, tb: TextbookQuestion, q: Question, chapter: str) -> dict | None:
    rows = _nearest_concept(db, q, ("theory", "key_point"))
    if not rows:
        # Graceful fallback: surface whatever we find
        rows = _nearest_concept(db, q, ("theory", "key_point", "chapter_intro", "worked_example"))
    if not rows:
        return {"tier": 1, "hint_md": f"Review the theory for §{chapter}.", "source": "textbook"}

    row = rows[0]
    label = row.label or row.section_title or "related concept"
    ch = row.chapter or chapter
    summary = (row.text_md or "")[:200]
    hint_md = f"Recall from §{ch}: **{label}** — {summary}"
    return {"tier": 1, "hint_md": hint_md, "source": "textbook"}


def _hint_tier2(db: Session, tb: TextbookQuestion, q: Question, chapter: str) -> dict | None:
    rows = _nearest_concept(db, q, ("worked_example",))
    if not rows:
        return _hint_tier1(db, tb, q, chapter)

    row = rows[0]
    label = row.label or row.section_title or "worked example"
    ch = row.chapter or chapter
    summary = (row.text_md or "")[:400]
    hint_md = f"This is similar to the worked example in §{ch}: **{label}**.\n\n{summary}"
    return {"tier": 2, "hint_md": hint_md, "source": "textbook"}


def _hint_tier3(db: Session, tb: TextbookQuestion, chapter: str) -> dict | None:
    # Prefer explicitly linked examples
    if tb.related_example_ids:
        for ex_id in tb.related_example_ids:
            concept = db.query(TextbookConcept).filter_by(id=ex_id).first()
            if concept:
                label = concept.label or concept.section_title or "worked example"
                ch = concept.chapter or chapter
                hint_md = (
                    f"**Worked Example from §{ch}: {label}**\n\n{concept.text_md}"
                )
                return {"tier": 3, "hint_md": hint_md, "source": "textbook"}

    # Fallback: highest-similarity worked_example in the same chapter
    rows = db.execute(
        text(
            """
            SELECT id, label, section_title, chapter, text_md
            FROM textbook_concept
            WHERE kind = 'worked_example' AND chapter = :ch
            LIMIT 1
            """
        ),
        {"ch": chapter},
    ).fetchall()
    if rows:
        row = rows[0]
        label = row.label or row.section_title or "worked example"
        ch = row.chapter or chapter
        return {
            "tier": 3,
            "hint_md": f"**Worked Example from §{ch}: {label}**\n\n{row.text_md}",
            "source": "textbook",
        }

    return {"tier": 3, "hint_md": f"Review all worked examples in §{chapter}.", "source": "textbook"}
