#!/usr/bin/env python3
"""
Classify textbook_question and textbook_concept rows by setting topic_id
based on chapter and exercise_ref.

The sync triggers propagate topic_id changes to the unified question/concept
tables automatically after each UPDATE.

Idempotent: safe to re-run.

Usage:
    python3 scripts/classify_textbook_topics.py
    python3 scripts/classify_textbook_topics.py --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
os.chdir(Path(__file__).parent.parent / "backend")

from sqlalchemy import text
from app.db import SessionLocal


# ---------------------------------------------------------------------------
# Chapter + exercise_ref → topic slug mapping
#
# Haese & Harris IB Math AA HL (Mathematics: Analysis and Approaches HL)
#
# Chapter 1  – Counting Principles (permutations, combinations)
# Chapter 2  – Binomial Theorem + Systems of Linear Equations
# Chapter 3  – Trigonometry (compound angles, further trig)
# Chapter 4  – Complex Numbers
# Chapter 5  – Mathematical Proof
# Chapter 6  – Polynomial Functions
# Chapter 7  – Functions (properties, rational, transformations)
# Chapter 8  – Vectors + Lines & Planes
# Chapter 9  – Statistics & Probability
# Chapter 10 – Calculus
# ---------------------------------------------------------------------------

# Default chapter → slug (fallback when exercise_ref not listed below)
CHAPTER_SLUG: dict[str, str] = {
    "1":  "number_and_algebra.binomial_theorem",
    "2":  "number_and_algebra.binomial_theorem",
    "3":  "geometry_and_trigonometry",
    "4":  "number_and_algebra.complex_numbers",
    "5":  "number_and_algebra.proof",
    "6":  "functions.polynomial_functions",
    "7":  "functions",
    "8":  "geometry_and_trigonometry.vectors_2d_3d",
    "9":  "statistics_and_probability",
    "10": "calculus",
}

# Fine-grained overrides keyed by (chapter, exercise_ref)
EXERCISE_SLUG: dict[tuple[str, str], str] = {
    # Ch 2 – systems of equations
    ("2", "2C"):              "number_and_algebra.systems_of_equations",
    # Ch 3 – trig subtopics
    ("3", "3A"):              "geometry_and_trigonometry.compound_angle_double_angle",
    ("3", "3B"):              "geometry_and_trigonometry.trig_identities",
    # Ch 4 – complex number subtopics
    ("4", "4A"):              "number_and_algebra.complex_numbers.cartesian_form",
    ("4", "4B"):              "number_and_algebra.complex_numbers.cartesian_form",
    ("4", "4C"):              "number_and_algebra.complex_numbers.cartesian_form",
    ("4", "4D"):              "number_and_algebra.complex_numbers.polar_form",
    ("4", "4E"):              "number_and_algebra.complex_numbers.de_moivre",
    # Ch 5 – proof subtopics
    ("5", "5A"):              "number_and_algebra.proof.contradiction",
    ("5", "5B"):              "number_and_algebra.proof.induction",
    ("5", "5C"):              "number_and_algebra.proof",
    # Ch 7 – function subtopics
    ("7", "7A"):              "functions.function_basics",
    ("7", "7B"):              "functions.modulus_reciprocal_piecewise",
    ("7", "7C"):              "functions.rational_functions",
    ("7", "7D"):              "functions.transformations",
    ("7", "7E"):              "functions.function_basics",
    # Ch 8 – vectors vs lines & planes
    ("8", "8E"):              "geometry_and_trigonometry.lines_and_planes",
    ("8", "8F"):              "geometry_and_trigonometry.lines_and_planes",
    ("8", "8G"):              "geometry_and_trigonometry.lines_and_planes",
    ("8", "8H"):              "geometry_and_trigonometry.lines_and_planes",
    # Ch 9 – stats subtopics
    ("9", "9A"):              "statistics_and_probability.discrete_distributions",
    ("9", "9B"):              "statistics_and_probability.continuous_distributions",
    ("9", "9C"):              "statistics_and_probability.conditional_probability_bayes",
    # Ch 10 – calculus subtopics
    ("10", "10A"):            "calculus.derivatives.basic_rules",
    ("10", "10B"):            "calculus.derivatives",
    ("10", "10C"):            "calculus.derivatives.implicit",
    ("10", "10D"):            "calculus.derivatives.related_rates",
    ("10", "10E"):            "calculus.applications_of_derivatives.optimization",
}


def build_slug_to_id(db) -> dict[str, str]:
    rows = db.execute(text("SELECT slug, id FROM topic")).fetchall()
    return {r.slug: str(r.id) for r in rows}


def classify(db, slug_to_id: dict[str, str], dry_run: bool) -> dict[str, int]:
    counts: dict[str, int] = {"q_updated": 0, "c_updated": 0, "q_skipped": 0}

    # Fetch all textbook_question rows needing classification
    rows_q = db.execute(
        text("SELECT id, chapter, exercise_ref FROM textbook_question ORDER BY chapter, exercise_ref")
    ).fetchall()

    for row in rows_q:
        ch = row.chapter
        ex = row.exercise_ref
        slug = EXERCISE_SLUG.get((ch, ex)) or CHAPTER_SLUG.get(ch)
        if not slug:
            counts["q_skipped"] += 1
            continue
        topic_id = slug_to_id.get(slug)
        if not topic_id:
            print(f"  WARN: slug '{slug}' not found in topic table")
            counts["q_skipped"] += 1
            continue
        if not dry_run:
            db.execute(
                text("UPDATE textbook_question SET topic_id = :tid WHERE id = :qid"),
                {"tid": topic_id, "qid": str(row.id)},
            )
        counts["q_updated"] += 1

    # Fetch all textbook_concept rows needing classification
    rows_c = db.execute(
        text("SELECT id, chapter FROM textbook_concept ORDER BY chapter")
    ).fetchall()

    for row in rows_c:
        ch = row.chapter
        if not ch:
            counts["q_skipped"] += 1
            continue
        slug = CHAPTER_SLUG.get(ch)
        if not slug:
            counts["q_skipped"] += 1
            continue
        topic_id = slug_to_id.get(slug)
        if not topic_id:
            counts["q_skipped"] += 1
            continue
        if not dry_run:
            db.execute(
                text("UPDATE textbook_concept SET topic_id = :tid WHERE id = :cid"),
                {"tid": topic_id, "cid": str(row.id)},
            )
        counts["c_updated"] += 1

    if not dry_run:
        db.commit()

    return counts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        slug_to_id = build_slug_to_id(db)
        print(f"Loaded {len(slug_to_id)} topics")

        counts = classify(db, slug_to_id, args.dry_run)

        mode = "DRY RUN" if args.dry_run else "DONE"
        print(f"{mode}: updated {counts['q_updated']} questions, "
              f"{counts['c_updated']} concepts, "
              f"skipped {counts['q_skipped']}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
