"""
Approval script for pending_review questions.

Usage:
    cd ~/tutor_skufs
    .venv/bin/python scripts/approve_batch.py --topic calculus.derivatives --dry-run
    .venv/bin/python scripts/approve_batch.py --topic calculus.derivatives --wolfram-verified-only
    .venv/bin/python scripts/approve_batch.py --topic calculus.derivatives  # approve all pending
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

import psycopg

DB_URL = os.environ.get("TUTOR_DB_URL", "postgresql://andriy@localhost:5432/tutor_ib_math").replace("postgresql+psycopg://", "postgresql://")


def main():
    parser = argparse.ArgumentParser(description="Approve pending_review questions")
    parser.add_argument("--topic", required=True, help="Topic slug prefix")
    parser.add_argument("--wolfram-verified-only", action="store_true", help="Only approve wolfram_verified=true")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be approved, no changes")
    parser.add_argument("--min-difficulty", type=int, default=1, help="Minimum difficulty to include")
    args = parser.parse_args()

    wv_clause = "AND q.wolfram_verified = true" if args.wolfram_verified_only else ""
    with psycopg.connect(DB_URL) as conn:
        rows = conn.execute(
            f"""
            SELECT q.id, q.stem_md, q.reference_answer, q.difficulty,
                   q.wolfram_verified, t.slug
            FROM question q
            JOIN topic t ON t.id = q.topic_id
            WHERE q.status = 'pending_review'
              AND (t.slug = %s OR t.slug LIKE %s || '.%%')
              AND q.difficulty >= %s
              {wv_clause}
            ORDER BY t.slug, q.difficulty
            """,
            (args.topic, args.topic, args.min_difficulty),
        ).fetchall()

    print(f"\nFound {len(rows)} questions to approve")
    if args.dry_run:
        print("(DRY RUN — no changes)")
    print()

    for qid, stem_md, ref_answer, difficulty, wv, slug in rows:
        wv_flag = "✓WF" if wv else "   "
        print(f"  [{wv_flag} diff={difficulty}] {slug}")
        print(f"    {stem_md[:90]}")
        print(f"    ans: {ref_answer[:60]}")
        print()

    if args.dry_run:
        print(f"Would approve: {len(rows)} questions")
        sys.exit(0)

    if len(rows) == 0:
        print("Nothing to approve.")
        sys.exit(0)

    confirm = input(f"Approve {len(rows)} questions for '{args.topic}'? [y/N] ").strip().lower()
    if confirm != "y":
        print("Aborted.")
        sys.exit(1)

    with psycopg.connect(DB_URL) as conn:
        ids = [str(r[0]) for r in rows]
        conn.execute(
            "UPDATE question SET status='approved' WHERE id = ANY(%s::uuid[])",
            (ids,),
        )
        conn.commit()

    print(f"\nApproved {len(rows)} questions for topic '{args.topic}'")
    sys.exit(0)


if __name__ == "__main__":
    main()
