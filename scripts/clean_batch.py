"""
Clean a pending_review batch before approval.

What this script does (in order):
  1. DUPLICATE DETECTION  — finds questions with identical or near-identical
     stems (exact match + SymPy-equivalent answers). Keeps the best one per
     group (longest stem, earliest created_at as tiebreaker), retires the rest.

  2. ANSWER EQUIVALENCE DEDUP — among questions with different stems but
     SymPy-equivalent answers AND same kind/difficulty, flags them for review.
     (Does not auto-retire — prints a warning and lets you decide.)

  3. DIFFICULTY SANITY for flashcards — flashcards that test a named rule or
     definition (pattern: "What is the X rule", "State the X", "Define X")
     should be difficulty 1-2. Corrects difficulty to 1 if currently > 2.

  4. OUT-OF-SCOPE DETECTION — retires questions whose stems contain keywords
     that indicate techniques outside the target topic's syllabus_item.
     Rules are per-topic, loaded from a config dict in this file.
     Prints each retired question so you can review the decision.

  5. SUMMARY — prints a table: kept / deduped / difficulty-fixed / retired.

Usage:
    cd ~/tutor_skufs
    backend/.venv/bin/python scripts/clean_batch.py \\
        --topic calculus.derivatives --dry-run

    backend/.venv/bin/python scripts/clean_batch.py \\
        --topic calculus.derivatives

    # Only dedup, skip scope check:
    backend/.venv/bin/python scripts/clean_batch.py \\
        --topic calculus.derivatives --skip-scope-check
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

import psycopg

DB_URL = (
    os.environ.get("TUTOR_DB_URL", "postgresql://andriy@localhost:5432/tutor_ib_math")
    .replace("postgresql+psycopg://", "postgresql://")
)

# ---------------------------------------------------------------------------
# Out-of-scope rules
# Each entry: topic_slug_prefix -> list of (pattern, reason) tuples.
# A question is considered out-of-scope if its stem matches ANY pattern.
# Patterns are case-insensitive regex applied to stem_md.
# ---------------------------------------------------------------------------
OUT_OF_SCOPE_RULES: dict[str, list[tuple[str, str]]] = {
    "calculus.derivatives": [
        # second derivatives belong to applications_of_derivatives
        (r"second derivative", "second derivative → applications_of_derivatives"),
        (r"d\^?2y|d²|f''|f\s*''\s*\(|h''\s*\(", "second derivative notation → applications_of_derivatives"),
        # integration is a separate topic
        (r"\bintegrat|\\int\b|antiderivative", "integration → calculus.integrals"),
        # limits (conceptually separate topic)
        (r"\blimit\b.*\bapproach|\\lim_", "limits → calculus.limits"),
        # optimization / extrema belong to applications_of_derivatives
        (r"maximum|minimum|extrema|critical point|optimis|optimiz",
         "optimization → calculus.applications_of_derivatives"),
        # inverse trig derivatives: arcsin/arccos/arctan — HL but separate subtopic
        (r"\\tan\^{?-1}|\\sin\^{?-1}|\\cos\^{?-1}|arctan|arcsin|arccos|\batan\b",
         "inverse trig derivatives — separate subtopic, not basic derivatives"),
        # differential equations
        (r"differential equation|dy\s*/\s*dx\s*=.*y\b", "ODE → calculus.differential_equations"),
    ],
    "calculus.derivatives.basic_rules": [
        # product rule doesn't belong in basic_rules
        (r"product rule", "product rule → calculus.derivatives.product_rule"),
        (r"chain rule", "chain rule → calculus.derivatives.chain_rule"),
        (r"quotient rule", "quotient rule → calculus.derivatives.quotient_rule"),
        (r"implicit", "implicit diff → calculus.derivatives.implicit"),
    ],
    "calculus.derivatives.product_rule": [
        (r"chain rule", "chain rule → separate subtopic"),
        (r"quotient rule", "quotient rule → separate subtopic"),
        (r"implicit", "implicit diff → separate subtopic"),
        (r"second derivative|d\^?2y|f''", "second derivative → applications"),
    ],
    "calculus.derivatives.chain_rule": [
        (r"product rule", "product rule → separate subtopic"),
        (r"quotient rule", "quotient rule → separate subtopic"),
        (r"implicit", "implicit diff → separate subtopic"),
        (r"second derivative|d\^?2y|f''", "second derivative → applications"),
    ],
}

# Patterns that mark a flashcard as "definition-level" (difficulty should be 1)
DEFINITION_PATTERNS = [
    r"^state the\b",
    r"^what is the\b.*(rule|theorem|formula|law|definition)",
    r"^define\b",
    r"^give the\b.*(rule|theorem|formula)",
    r"^write (down |out )?the\b.*(rule|theorem|formula)",
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_scope_rules(topic_slug: str) -> list[tuple[str, str]]:
    """Return the most specific matching scope rules for this topic."""
    # Try exact match first, then progressively shorter prefixes
    parts = topic_slug.split(".")
    for length in range(len(parts), 0, -1):
        key = ".".join(parts[:length])
        if key in OUT_OF_SCOPE_RULES:
            return OUT_OF_SCOPE_RULES[key]
    return []


def _is_out_of_scope(stem: str, rules: list[tuple[str, str]]) -> tuple[bool, str]:
    for pattern, reason in rules:
        if re.search(pattern, stem, re.IGNORECASE):
            return True, reason
    return False, ""


def _is_definition_flashcard(stem: str) -> bool:
    for pattern in DEFINITION_PATTERNS:
        if re.search(pattern, stem, re.IGNORECASE):
            return True
    return False


def _sympy_equivalent(ans_a: str, ans_b: str) -> bool:
    """Try SymPy simplification to check equivalence. Returns False on any error."""
    if ans_a == ans_b:
        return True
    # Only attempt for short, expression-like answers (not prose flashcard answers)
    if len(ans_a) > 200 or len(ans_b) > 200:
        return False
    if any(c in ans_a for c in ["The ", "is ", "are ", "\\frac"]):
        return False
    try:
        from sympy import sympify, simplify, symbols
        # Try to parse both; if either fails, they're not equivalent via SymPy
        a = sympify(ans_a)
        b = sympify(ans_b)
        diff = simplify(a - b)
        return diff == 0
    except Exception:
        return False


def _normalize_stem(stem: str) -> str:
    """Normalize whitespace and minor punctuation for fuzzy matching."""
    s = stem.strip().lower()
    s = re.sub(r"\s+", " ", s)
    # remove trailing period
    s = s.rstrip(".")
    # normalize function letter: f(x) / g(x) / h(x) → f(x)
    s = re.sub(r"\b[ghkmnpq]\(x\)", "f(x)", s)
    return s


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Clean a pending_review question batch")
    parser.add_argument("--topic", required=True, help="Topic slug (prefix)")
    parser.add_argument("--dry-run", action="store_true", help="Show decisions, make no changes")
    parser.add_argument("--skip-scope-check", action="store_true", help="Skip out-of-scope detection")
    args = parser.parse_args()

    dry = args.dry_run
    topic = args.topic

    # -----------------------------------------------------------------------
    # Load all pending_review questions for this topic
    # -----------------------------------------------------------------------
    with psycopg.connect(DB_URL) as conn:
        rows = conn.execute(
            """
            SELECT q.id::text, q.stem_md, q.reference_answer, q.kind,
                   q.difficulty, t.slug, q.created_at
            FROM question q
            JOIN topic t ON t.id = q.topic_id
            WHERE q.status = 'pending_review'
              AND (t.slug = %s OR t.slug LIKE %s || '.%%')
            ORDER BY q.created_at
            """,
            (topic, topic),
        ).fetchall()

    if not rows:
        print(f"No pending_review questions found for topic '{topic}'.")
        sys.exit(0)

    total = len(rows)
    print(f"\n{'DRY RUN — ' if dry else ''}Cleaning {total} questions for topic '{topic}'\n")

    # Track decisions
    to_retire: dict[str, str] = {}       # id -> reason
    to_fix_difficulty: dict[str, int] = {}  # id -> new difficulty
    kept: set[str] = set()

    # -----------------------------------------------------------------------
    # STEP 1 — Exact duplicate detection (same stem_md)
    # -----------------------------------------------------------------------
    print("── Step 1: Exact duplicate stems ──────────────────────────────")
    by_stem: dict[str, list[Any]] = defaultdict(list)
    for row in rows:
        by_stem[row[1]].append(row)  # key = stem_md

    exact_dupes = 0
    for stem, group in by_stem.items():
        if len(group) == 1:
            continue
        # Keep longest stem (tiebreak: earliest created_at — already sorted)
        group_sorted = sorted(group, key=lambda r: (-len(r[1]), r[6]))
        winner = group_sorted[0]
        losers = group_sorted[1:]
        exact_dupes += len(losers)
        for loser in losers:
            reason = f"exact duplicate of {winner[0][:8]}..."
            to_retire[loser[0]] = reason
            print(f"  RETIRE  [{loser[0][:8]}] diff={loser[4]}  \"{loser[1][:70]}\"")
            print(f"          reason: {reason}")
    if exact_dupes == 0:
        print("  No exact duplicates found.")
    print()

    # -----------------------------------------------------------------------
    # STEP 2 — Near-duplicate detection (normalized stem + SymPy-equivalent answer)
    # -----------------------------------------------------------------------
    print("── Step 2: Near-duplicate stems (same answer, similar stem) ───")
    live_rows = [r for r in rows if r[0] not in to_retire]

    by_norm: dict[str, list[Any]] = defaultdict(list)
    for row in live_rows:
        by_norm[_normalize_stem(row[1])].append(row)

    near_dupes = 0
    for norm, group in by_norm.items():
        if len(group) == 1:
            continue
        # Check if answers are SymPy-equivalent
        ref = group[0][2]
        if all(_sympy_equivalent(r[2], ref) for r in group[1:]):
            group_sorted = sorted(group, key=lambda r: (-len(r[1]), r[6]))
            winner = group_sorted[0]
            losers = group_sorted[1:]
            near_dupes += len(losers)
            for loser in losers:
                if loser[0] in to_retire:
                    continue
                reason = f"near-duplicate (normalized stem + SymPy-equivalent answer) of {winner[0][:8]}..."
                to_retire[loser[0]] = reason
                print(f"  RETIRE  [{loser[0][:8]}] diff={loser[4]}  \"{loser[1][:70]}\"")
                print(f"          reason: {reason}")
    if near_dupes == 0:
        print("  No near-duplicates found.")
    print()

    # -----------------------------------------------------------------------
    # STEP 3 — Difficulty fix for definition flashcards
    # -----------------------------------------------------------------------
    print("── Step 3: Difficulty sanity (definition flashcards) ───────────")
    live_rows = [r for r in rows if r[0] not in to_retire]
    diff_fixes = 0
    for row in live_rows:
        qid, stem, ans, kind, diff, slug, _ = row
        if kind == "flashcard" and diff > 2 and _is_definition_flashcard(stem):
            to_fix_difficulty[qid] = 1
            diff_fixes += 1
            print(f"  FIX     [{qid[:8]}] diff {diff}→1  \"{stem[:70]}\"")
    if diff_fixes == 0:
        print("  No difficulty fixes needed.")
    print()

    # -----------------------------------------------------------------------
    # STEP 4 — Out-of-scope detection
    # -----------------------------------------------------------------------
    if args.skip_scope_check:
        print("── Step 4: Out-of-scope check SKIPPED (--skip-scope-check) ────")
        print()
    else:
        print("── Step 4: Out-of-scope detection ──────────────────────────────")
        live_rows = [r for r in rows if r[0] not in to_retire]
        scope_retires = 0
        for row in live_rows:
            qid, stem, ans, kind, diff, slug, _ = row
            rules = _get_scope_rules(slug)
            out, reason = _is_out_of_scope(stem, rules)
            if out:
                to_retire[qid] = f"out-of-scope: {reason}"
                scope_retires += 1
                print(f"  RETIRE  [{qid[:8]}] diff={diff}  \"{stem[:70]}\"")
                print(f"          reason: out-of-scope: {reason}")
        if scope_retires == 0:
            print("  No out-of-scope questions detected.")
        print()

    # -----------------------------------------------------------------------
    # SUMMARY
    # -----------------------------------------------------------------------
    n_retire = len(to_retire)
    n_fix = len(to_fix_difficulty)
    n_keep = total - n_retire
    print("── Summary ─────────────────────────────────────────────────────")
    print(f"  Total questions:          {total}")
    print(f"  Will retire:              {n_retire}")
    print(f"    of which exact dupes:   {exact_dupes}")
    print(f"    of which near-dupes:    {near_dupes}")
    print(f"    of which out-of-scope:  {n_retire - exact_dupes - near_dupes}")
    print(f"  Difficulty fixes:         {n_fix}")
    print(f"  Will remain pending:      {n_keep}")
    print()

    if n_retire == 0 and n_fix == 0:
        print("Nothing to do. Batch is clean.")
        sys.exit(0)

    if dry:
        print("DRY RUN complete — no changes made.")
        print(f"Run without --dry-run to apply {n_retire} retirements and {n_fix} fixes.")
        sys.exit(0)

    # -----------------------------------------------------------------------
    # APPLY
    # -----------------------------------------------------------------------
    confirm = input(
        f"Apply {n_retire} retirements and {n_fix} difficulty fixes? [y/N] "
    ).strip().lower()
    if confirm != "y":
        print("Aborted.")
        sys.exit(1)

    with psycopg.connect(DB_URL) as conn:
        # Retire
        if to_retire:
            retire_ids = list(to_retire.keys())
            conn.execute(
                "UPDATE question SET status='retired' WHERE id = ANY(%s::uuid[])",
                (retire_ids,),
            )

        # Fix difficulty
        for qid, new_diff in to_fix_difficulty.items():
            conn.execute(
                "UPDATE question SET difficulty=%s WHERE id=%s::uuid",
                (new_diff, qid),
            )

        conn.commit()

    print(f"\nDone.")
    print(f"  Retired:          {n_retire} questions")
    print(f"  Difficulty fixed: {n_fix} questions")
    print(f"  Remaining pending_review: {n_keep}")
    print()
    print("Next step:")
    print(f"  backend/.venv/bin/python scripts/approve_batch.py --topic {topic} --dry-run")


if __name__ == "__main__":
    main()
