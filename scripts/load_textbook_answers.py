#!/usr/bin/env python3
"""
Populate question.reference_answer and question.solution_steps from
output.jsonl for textbook questions that have answers.

Matches by (exercise_ref, question_number) → textbook_question.id → question.source_id.

Idempotent: skips questions that already have reference_answer set.

Usage:
    python3 scripts/load_textbook_answers.py [JSONL_PATH] [--dry-run] [--overwrite]
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
os.chdir(Path(__file__).parent.parent / "backend")

from sqlalchemy import text
from app.db import SessionLocal

DEFAULT_JSONL = str(
    Path.home() / "home_services/pdf_ingest_agent/jobs/ingest_ff66a7e8/output.jsonl"
)


def load_answered_records(jsonl_path: str) -> list[dict]:
    records = []
    with open(jsonl_path) as f:
        for line in f:
            if not line.strip():
                continue
            r = json.loads(line)
            if r.get("record_type") == "exercise_question" and r.get("has_answer"):
                ref_ans = (r.get("reference_answer") or "").strip()
                steps = r.get("solution_steps") or []
                if ref_ans or steps:
                    records.append(r)
    return records


def run(jsonl_path: str, dry_run: bool, overwrite: bool) -> None:
    records = load_answered_records(jsonl_path)
    print(f"Answered records in JSONL: {len(records)}")

    db = SessionLocal()
    try:
        # Build lookup: (exercise_ref, question_number) → textbook_question.id
        tb_rows = db.execute(
            text("SELECT id, exercise_ref, question_number FROM textbook_question")
        ).fetchall()
        tb_lookup: dict[tuple, str] = {
            (r.exercise_ref, r.question_number): str(r.id) for r in tb_rows
        }
        print(f"textbook_question rows in DB: {len(tb_lookup)}")

        updated = skipped_no_match = skipped_already_set = 0

        for rec in records:
            key = (rec["exercise_ref"], str(rec["question_number"]))
            tb_id = tb_lookup.get(key)
            if tb_id is None:
                skipped_no_match += 1
                continue

            if not overwrite:
                existing = db.execute(
                    text(
                        "SELECT reference_answer FROM question "
                        "WHERE source_type='textbook' AND source_id=:sid"
                    ),
                    {"sid": tb_id},
                ).scalar()
                if existing is not None:
                    skipped_already_set += 1
                    continue

            ref_ans = (rec.get("reference_answer") or "").strip() or None
            steps = rec.get("solution_steps") or []

            if not dry_run:
                db.execute(
                    text(
                        "UPDATE question SET reference_answer=:ref, solution_steps=:steps "
                        "WHERE source_type='textbook' AND source_id=:sid"
                    ),
                    {
                        "ref": ref_ans,
                        "steps": json.dumps(steps),
                        "sid": tb_id,
                    },
                )
            updated += 1

        if not dry_run:
            db.commit()

        mode = "DRY RUN" if dry_run else "DONE"
        print(f"{mode}: updated={updated}, no_match={skipped_no_match}, already_set={skipped_already_set}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("jsonl_path", nargs="?", default=DEFAULT_JSONL)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--overwrite", action="store_true",
                        help="Overwrite already-set reference_answer values")
    args = parser.parse_args()
    run(args.jsonl_path, args.dry_run, args.overwrite)


if __name__ == "__main__":
    main()
