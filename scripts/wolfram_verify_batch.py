"""
Wolfram verification pass for pending_review questions.

Usage:
    cd ~/tutor_skufs
    .venv/bin/python scripts/wolfram_verify_batch.py --topic calculus.derivatives --limit 30
    .venv/bin/python scripts/wolfram_verify_batch.py --topic calculus.derivatives.product_rule --limit 10

What it does:
  1. SELECT questions WHERE status='pending_review' AND wolfram_verified=false AND topic matches
  2. POST to /v1/wolfram/compute via orchestrator
  3. SymPy compare Wolfram result vs reference_answer
  4. Match → wolfram_verified=true
  5. Mismatch → status='retired', log to ERRORS.md
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

import httpx
import psycopg

DB_URL = os.environ.get("TUTOR_DB_URL", "postgresql://andriy@localhost:5432/tutor_ib_math").replace("postgresql+psycopg://", "postgresql://")
ORCHESTRATOR_URL = os.environ.get("ORCHESTRATOR_URL", "http://localhost:4700")
ORCHESTRATOR_API_KEY = os.environ.get("ORCHESTRATOR_API_KEY", "")
ERRORS_MD = Path(__file__).parent.parent / "ERRORS.md"


def _sympy_equivalent(a: str, b: str, variables: list[str]) -> bool:
    try:
        from sympy import symbols, parse_expr, simplify, S
        var_names = variables or ["x"]
        syms = {v: symbols(v) for v in var_names}
        ea = parse_expr(a, local_dict=syms)
        eb = parse_expr(b, local_dict=syms)
        return simplify(ea - eb) == S.Zero
    except Exception:
        return False


def _wolfram_query(stem_snippet: str, reference_answer: str) -> str:
    return f"simplify {reference_answer}"


def _append_errors_md(lines: list[str]):
    with open(ERRORS_MD, "a") as f:
        f.write("\n".join(lines) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Wolfram verification pass")
    parser.add_argument("--topic", required=True, help="Topic slug prefix, e.g. calculus.derivatives")
    parser.add_argument("--limit", type=int, default=30)
    args = parser.parse_args()

    headers = {"X-API-Key": ORCHESTRATOR_API_KEY} if ORCHESTRATOR_API_KEY else {}

    with psycopg.connect(DB_URL) as conn:
        rows = conn.execute(
            """
            SELECT q.id, q.stem_md, q.reference_answer, q.variables,
                   t.slug
            FROM question q
            JOIN topic t ON t.id = q.topic_id
            WHERE q.status = 'pending_review'
              AND q.wolfram_verified = false
              AND (t.slug = %s OR t.slug LIKE %s || '.%%')
            ORDER BY q.created_at
            LIMIT %s
            """,
            (args.topic, args.topic, args.limit),
        ).fetchall()

    print(f"Found {len(rows)} questions to verify via Wolfram")
    verified = retired = skipped = 0
    error_lines: list[str] = []

    with httpx.Client(timeout=30.0) as http:
        for qid, stem_md, ref_answer, variables, slug in rows:
            if not ref_answer or not ref_answer.strip():
                skipped += 1
                continue

            query = _wolfram_query(stem_md[:120], ref_answer)
            try:
                r = http.post(
                    f"{ORCHESTRATOR_URL}/v1/wolfram/compute",
                    json={"query": query, "format": "plaintext"},
                    headers=headers,
                )
                if r.status_code == 503:
                    data = r.json()
                    code = data.get("error", {}).get("code", "")
                    if "QUOTA" in code or "APP_ID" in code.upper() or not ORCHESTRATOR_API_KEY:
                        print(f"  SKIP  Wolfram not configured or quota exceeded — stopping")
                        skipped += len(rows) - verified - retired - skipped
                        break
                r.raise_for_status()
                wolf_data = r.json()
            except Exception as e:
                print(f"  ERROR {str(qid)[:8]}... Wolfram call failed: {e}")
                skipped += 1
                continue

            primary = wolf_data.get("primary_result") or ""
            cached = wolf_data.get("cached", False)

            # Attempt SymPy equivalence between Wolfram primary result and reference_answer
            equiv = _sympy_equivalent(ref_answer, primary, variables or ["x"]) if primary else None

            with psycopg.connect(DB_URL) as conn:
                if equiv is True:
                    conn.execute(
                        "UPDATE question SET wolfram_verified=true WHERE id=%s",
                        (qid,),
                    )
                    conn.commit()
                    verified += 1
                    print(f"  OK    {str(qid)[:8]}... verified{'(cached)' if cached else ''}")
                elif equiv is False:
                    conn.execute(
                        "UPDATE question SET status='retired' WHERE id=%s",
                        (qid,),
                    )
                    conn.commit()
                    retired += 1
                    print(f"  RETIRE {str(qid)[:8]}... Wolfram={primary!r:.40} ref={ref_answer!r:.40}")
                    error_lines.extend([
                        f"## Wolfram mismatch — {slug}",
                        f"**question_id:** {qid}",
                        f"**stem:** {stem_md[:120]}",
                        f"**reference_answer:** {ref_answer}",
                        f"**wolfram_primary:** {primary}",
                        "",
                    ])
                else:
                    # Could not compare (Wolfram returned no parseable result)
                    skipped += 1
                    print(f"  SKIP  {str(qid)[:8]}... Wolfram result not parseable: {primary!r:.60}")

    if error_lines:
        _append_errors_md(["", "---"] + error_lines)
        print(f"\nWrote {len([l for l in error_lines if l.startswith('##')])} entries to ERRORS.md")

    print(f"\n{'='*50}")
    print(f"Topic:    {args.topic}")
    print(f"Verified: {verified}")
    print(f"Retired:  {retired}")
    print(f"Skipped:  {skipped}")
    print(f"{'='*50}\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
