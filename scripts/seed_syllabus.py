"""
Seed syllabus_item table for calculus.derivatives.* subtopics.

Usage:
    cd ~/tutor_skufs
    .venv/bin/python scripts/seed_syllabus.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Allow running from tutor_skufs root without installing the backend package
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

import psycopg

DB_URL = os.environ.get("TUTOR_DB_URL", "postgresql://andriy@localhost:5432/tutor_ib_math")
# psycopg3 uses postgresql:// not postgresql+psycopg://
DB_URL = DB_URL.replace("postgresql+psycopg://", "postgresql://")

SYLLABUS_ITEMS = [
    {
        "slug": "calculus.derivatives.basic_rules",
        "ib_ref": "5.1",
        "guide_text": """Students should be able to:
- Find derivatives of x^n (n ∈ Q), sin x, cos x, tan x, e^x, ln x.
- Use linearity: derivative of af(x) + bg(x) is af'(x) + bg'(x).
- Understand and apply the notation dy/dx, f'(x), d/dx[f(x)].""",
        "command_terms": ["find", "differentiate", "calculate"],
        "example_questions": [
            {
                "stem": "Find $f'(x)$ given $f(x) = 3x^4 - 2x^2 + 5$.",
                "answer": "12*x**3 - 4*x",
                "source": "style:ib_aa_hl_p1",
                "difficulty": 1,
            },
            {
                "stem": "Differentiate $g(x) = 4e^x - 3\\sin(x) + 7$.",
                "answer": "4*exp(x) - 3*cos(x)",
                "source": "style:ib_aa_hl_p1",
                "difficulty": 1,
            },
            {
                "stem": "Find $\\frac{dy}{dx}$ given $y = x^{2/3} + \\ln x$.",
                "answer": "Rational(2,3)*x**(-Rational(1,3)) + 1/x",
                "source": "style:ib_aa_hl_p1",
                "difficulty": 2,
            },
        ],
        "formula_booklet_refs": [
            "d/dx(x^n) = nx^(n-1)",
            "d/dx(sin x) = cos x",
            "d/dx(cos x) = -sin x",
            "d/dx(e^x) = e^x",
            "d/dx(ln x) = 1/x",
        ],
        "notes": "IB often tests rational exponents (n ∈ Q not just integers). Always use exact form.",
    },
    {
        "slug": "calculus.derivatives.chain_rule",
        "ib_ref": "5.6",
        "guide_text": """Students should be able to:
- Apply the chain rule: if y = f(g(x)), then dy/dx = f'(g(x)) · g'(x).
- Recognise composite function structure before differentiating.
- Combine chain rule with standard derivatives (trig, exp, log).""",
        "command_terms": ["find", "differentiate", "hence", "show that"],
        "example_questions": [
            {
                "stem": "Find the derivative of $y = \\sin(3x^2 + 1)$.",
                "answer": "6*x*cos(3*x**2 + 1)",
                "source": "style:ib_aa_hl_p1",
                "difficulty": 2,
            },
            {
                "stem": "Differentiate $f(x) = e^{x^3 - 2x}$.",
                "answer": "(3*x**2 - 2)*exp(x**3 - 2*x)",
                "source": "style:ib_aa_hl_p1",
                "difficulty": 2,
            },
            {
                "stem": "Find $\\frac{dy}{dx}$ for $y = \\ln(\\cos x)$.",
                "answer": "-tan(x)",
                "source": "style:ib_aa_hl_p1",
                "difficulty": 3,
            },
        ],
        "formula_booklet_refs": [
            "Chain rule: dy/dx = (dy/du)(du/dx)",
        ],
        "notes": "IB frequently nests trig inside polynomial or polynomial inside exp/ln. The 'hence' command term signals using the chain rule result in the next part.",
    },
    {
        "slug": "calculus.derivatives.product_rule",
        "ib_ref": "5.6",
        "guide_text": """Students should be able to:
- Apply the product rule: (uv)' = u'v + uv'.
- Choose which factor to call u and which v.
- Combine with chain rule for composite factors.""",
        "command_terms": ["find", "differentiate", "show that", "hence"],
        "example_questions": [
            {
                "stem": "Find the derivative of $f(x) = x^2 \\sin x$.",
                "answer": "2*x*sin(x) + x**2*cos(x)",
                "source": "style:ib_aa_hl_p1",
                "difficulty": 2,
            },
            {
                "stem": "Differentiate $y = x e^x$.",
                "answer": "exp(x) + x*exp(x)",
                "source": "style:ib_aa_hl_p1",
                "difficulty": 2,
            },
            {
                "stem": "Find $f'(x)$ for $f(x) = (3x^2 - 1)\\ln x$.",
                "answer": "6*x*log(x) + (3*x**2 - 1)/x",
                "source": "style:ib_aa_hl_p1",
                "difficulty": 3,
            },
        ],
        "formula_booklet_refs": [
            "Product rule: (uv)' = u'v + uv'",
        ],
        "notes": "IB commonly combines product rule with trig (x^n * sin/cos) or with ln. Avoid generating questions requiring integration by parts — that is a separate topic.",
    },
    {
        "slug": "calculus.derivatives.quotient_rule",
        "ib_ref": "5.6",
        "guide_text": """Students should be able to:
- Apply the quotient rule: (u/v)' = (u'v - uv') / v^2.
- Recognise when quotient rule is needed vs rewriting as product.
- Simplify the result to standard form.""",
        "command_terms": ["find", "differentiate", "show that", "simplify"],
        "example_questions": [
            {
                "stem": "Find $\\frac{dy}{dx}$ for $y = \\frac{\\sin x}{x}$.",
                "answer": "(x*cos(x) - sin(x)) / x**2",
                "source": "style:ib_aa_hl_p1",
                "difficulty": 2,
            },
            {
                "stem": "Differentiate $f(x) = \\frac{x^2 + 1}{x - 3}$.",
                "answer": "(x**2 - 6*x - 1) / (x - 3)**2",
                "source": "style:ib_aa_hl_p1",
                "difficulty": 3,
            },
        ],
        "formula_booklet_refs": [
            "Quotient rule: (u/v)' = (u'v - uv') / v^2",
        ],
        "notes": "IB sometimes tests both product and quotient rule in the same multi-part question. Difficulty 4-5 questions usually require simplification of the result.",
    },
    {
        "slug": "calculus.derivatives.implicit",
        "ib_ref": "5.9",
        "guide_text": """Students should be able to:
- Differentiate implicitly both sides of an equation with respect to x.
- Apply d/dx[f(y)] = f'(y) · dy/dx (chain rule with y as intermediate variable).
- Express dy/dx in terms of x and y.""",
        "command_terms": ["find", "show that", "hence find"],
        "example_questions": [
            {
                "stem": "Given $x^2 + y^2 = 25$, find $\\frac{dy}{dx}$.",
                "answer": "-x/y",
                "source": "style:ib_aa_hl_p1",
                "difficulty": 2,
            },
            {
                "stem": "Given $x^2 + 3xy + y^2 = 7$, find $\\frac{dy}{dx}$.",
                "answer": "-(2*x + 3*y)/(3*x + 2*y)",
                "source": "style:ib_aa_hl_p1",
                "difficulty": 3,
            },
        ],
        "formula_booklet_refs": [
            "Chain rule applied to y: d/dx[f(y)] = f'(y) · dy/dx",
        ],
        "notes": "IB implicit differentiation questions almost always involve x^2 + y^2 form (circles, ellipses) or mixed xy terms. Answer must be expressed as dy/dx = ... in terms of x and y.",
    },
    {
        "slug": "calculus.derivatives.related_rates",
        "ib_ref": "5.9",
        "guide_text": """Students should be able to:
- Set up related rates problems: identify which quantities vary with time.
- Apply chain rule: dA/dt = (dA/dx)(dx/dt).
- Solve for the unknown rate given the other rate and the current value.""",
        "command_terms": ["find", "calculate", "determine"],
        "example_questions": [
            {
                "stem": "A spherical balloon is being inflated so that its radius increases at $2$ cm/s. Find the rate of increase of volume when the radius is $5$ cm.",
                "answer": "200*pi",
                "source": "style:ib_aa_hl_p2",
                "difficulty": 3,
            },
            {
                "stem": "The area of a square is increasing at $8$ cm²/s. Find the rate of increase of the side length when the side is $4$ cm.",
                "answer": "1",
                "source": "style:ib_aa_hl_p2",
                "difficulty": 3,
            },
        ],
        "formula_booklet_refs": [
            "Chain rule: dy/dt = (dy/dx)(dx/dt)",
            "Volume of sphere: V = (4/3)πr^3",
        ],
        "notes": "IB related rates appear on Paper 2 (calculator allowed). Answers are often numeric at a specific instant. Reference_answer should be the numeric value (SymPy-parseable), units are in the stem.",
    },
]


def main():
    print(f"Connecting to: {DB_URL.split('@')[1] if '@' in DB_URL else DB_URL}")
    inserted = 0
    with psycopg.connect(DB_URL) as conn:
        for item in SYLLABUS_ITEMS:
            slug = item["slug"]
            cur = conn.execute("SELECT id FROM topic WHERE slug = %s", (slug,))
            row = cur.fetchone()
            if not row:
                print(f"  SKIP  {slug} — topic not found in DB")
                continue
            topic_id = row[0]

            conn.execute(
                """
                INSERT INTO syllabus_item
                    (id, topic_id, ib_ref, guide_text, command_terms,
                     example_questions, formula_booklet_refs, notes)
                VALUES
                    (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (topic_id, ib_ref) DO UPDATE SET
                    guide_text = EXCLUDED.guide_text,
                    command_terms = EXCLUDED.command_terms,
                    example_questions = EXCLUDED.example_questions,
                    formula_booklet_refs = EXCLUDED.formula_booklet_refs,
                    notes = EXCLUDED.notes
                """,
                (
                    topic_id,
                    item["ib_ref"],
                    item["guide_text"],
                    item["command_terms"],
                    json.dumps(item["example_questions"]),
                    item["formula_booklet_refs"],
                    item.get("notes"),
                ),
            )
            inserted += 1
            print(f"  OK    {slug} (ib_ref={item['ib_ref']})")

        conn.commit()

    print(f"\nDone: {inserted}/{len(SYLLABUS_ITEMS)} rows upserted.")
    sys.exit(0 if inserted == len(SYLLABUS_ITEMS) else 1)


if __name__ == "__main__":
    main()
