#!/usr/bin/env python3
"""
Mirror textbook_question + textbook_concept rows into the unified question/concept tables.

Idempotent: safe to re-run. Already-mirrored rows are skipped via the
(source_type, source_id) unique constraint check.

Usage:
    python3 scripts/seed_textbook_to_unified.py
    python3 scripts/seed_textbook_to_unified.py --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
os.chdir(Path(__file__).parent.parent / "backend")

from app.db import SessionLocal
from app.models.concept import Concept
from app.models.question import Question
from app.models.textbook import TextbookConcept, TextbookQuestion


def already_mirrored(db, model, source_id: uuid.UUID) -> bool:
    return (
        db.query(model)
        .filter_by(source_type="textbook", source_id=source_id)
        .first()
        is not None
    )


def seed_questions(db, dry_run: bool) -> tuple[int, int]:
    inserted = skipped = 0
    rows = db.query(TextbookQuestion).all()
    for tb in rows:
        if already_mirrored(db, Question, tb.id):
            skipped += 1
            continue
        if dry_run:
            inserted += 1
            continue
        q = Question(
            id=uuid.uuid4(),
            source_type="textbook",
            source_id=tb.id,
            topic_id=tb.topic_id,
            stem_md=tb.stem_md,
            kind="free_expression",
            difficulty=tb.difficulty if tb.difficulty is not None else 3,
            status="approved",
            reference_answer=None,
            embedding=tb.embedding,
            solution_steps=[],
            related_concept_ids=[],
        )
        db.add(q)
        inserted += 1
        if inserted % 100 == 0:
            db.flush()
            print(f"  ... {inserted} questions flushed")
    return inserted, skipped


def seed_concepts(db, dry_run: bool) -> tuple[int, int]:
    inserted = skipped = 0
    rows = db.query(TextbookConcept).all()
    for tc in rows:
        if already_mirrored(db, Concept, tc.id):
            skipped += 1
            continue
        if dry_run:
            inserted += 1
            continue
        title = tc.label or tc.section_title or f"Concept {str(tc.id)[:8]}"
        c = Concept(
            id=uuid.uuid4(),
            source_type="textbook",
            source_id=tc.id,
            slug=f"tb-{tc.id}",
            topic_id=tc.topic_id,
            kind=tc.kind,
            title=title,
            statement_md=tc.text_md,
            proof_md=None,
            examples_md=None,
            embedding=tc.embedding,
        )
        db.add(c)
        inserted += 1
        if inserted % 50 == 0:
            db.flush()
            print(f"  ... {inserted} concepts flushed")
    return inserted, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed textbook rows into unified tables")
    parser.add_argument("--dry-run", action="store_true",
                        help="Count what would be inserted without writing")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        q_ins, q_skip = seed_questions(db, args.dry_run)
        c_ins, c_skip = seed_concepts(db, args.dry_run)

        if not args.dry_run:
            db.commit()
            print(f"Inserted {q_ins} questions and {c_ins} concepts as source_type='textbook'.")
            if q_skip or c_skip:
                print(f"Skipped {q_skip} questions and {c_skip} concepts (already mirrored).")
        else:
            print(f"[dry-run] Would insert {q_ins} questions and {c_ins} concepts.")
            print(f"[dry-run] Would skip {q_skip} questions and {c_skip} concepts (already mirrored).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
