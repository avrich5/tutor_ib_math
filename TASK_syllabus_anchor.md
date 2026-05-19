# TASK: Syllabus Anchor System for Content Generation

**For:** Claude Code  
**Date:** 2026-05-17  
**Priority:** Must complete before generating any question batches  
**Depends on:** Phase 2 infrastructure (math_agent LLM endpoints, tutor_content_agent generator.py)  
**Does NOT touch:** corpus_agent, translation_agent, format_agent, transcribe_agent, existing .env files, existing plists

---

## Problem

`tutor_content_agent/core/generator.py` currently generates questions with this prompt:

> "Generate {count} IB AA HL practice questions for the topic: {topic_name}"

The LLM has no IB-specific grounding. It generates mathematically correct
questions, but with no guarantee that:
- the technique is in scope for AA HL (not SL-only or beyond-syllabus)
- the difficulty matches IB exam norms for that subtopic
- the question format matches IB command terms
- the answer format is what IB mark schemes expect

**Result:** hallucinated difficulty levels, off-syllabus techniques,
non-IB notation, questions that are mathematically valid but pedagogically wrong
for this specific exam.

## Solution

Add a `syllabus_item` table to the DB that stores the official IB Subject Guide
text for each leaf topic, plus 2–3 example questions from past papers (or
hand-crafted examples matching past paper style). Before every LLM generation
call, the generator fetches the relevant `syllabus_item` and injects it into
the system prompt as a hard constraint.

This turns a free-form generation call into a constrained interpolation task:
the LLM generates questions that are *between* the given examples, not *beyond*
the given syllabus text.

---

## Step 1 — Add `syllabus_item` table

File: `~/tutor_skufs/backend/alembic/versions/` — new migration.

```sql
CREATE TABLE syllabus_item (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id        UUID NOT NULL REFERENCES topic(id) ON DELETE CASCADE,
    ib_ref          TEXT NOT NULL,
    -- e.g. "5.6" or "5.7.3" — section number in the IB AA HL Subject Guide
    guide_text      TEXT NOT NULL,
    -- VERBATIM excerpt from the Subject Guide for this subtopic.
    -- Describes what students must be able to do.
    command_terms   TEXT[] NOT NULL DEFAULT '{}',
    -- IB command terms relevant to this subtopic:
    -- e.g. ["find", "show that", "hence", "deduce", "prove", "sketch"]
    example_questions JSONB NOT NULL DEFAULT '[]',
    -- Array of 2–3 reference questions. Schema per element:
    -- {
    --   "stem": "...",            -- question text as it appears in source
    --   "answer": "...",          -- canonical answer
    --   "source": "may2023_p1q3", -- identifier (NOT full copyright text)
    --   "difficulty": 3           -- estimated 1–5
    -- }
    formula_booklet_refs TEXT[] NOT NULL DEFAULT '{}',
    -- Names of relevant formula booklet entries,
    -- e.g. ["Product rule: (uv)' = u'v + uv'"]
    notes           TEXT,
    -- Any additional guidance for the generator:
    -- e.g. "IB always tests product rule combined with trig, rarely in isolation"
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (topic_id, ib_ref)
);

CREATE INDEX ix_syllabus_item_topic ON syllabus_item(topic_id);
```

**Migration file name convention:** `XXXX_add_syllabus_item_table.py`
Run: `cd ~/tutor_skufs/backend && .venv/bin/alembic upgrade head`

Also add the ORM model:
File: `~/tutor_skufs/backend/app/models/syllabus_item.py`

Pattern: follow the existing models (e.g. `topic.py`). Use `ARRAY(Text)` for
array columns and `JSONB` for `example_questions`.

---

## Step 2 — Seed `syllabus_item` for `calculus.derivatives.*`

File: `~/tutor_skufs/scripts/seed_syllabus.py`

This is a one-time seed script. It must cover all 6 leaf subtopics under
`calculus.derivatives`:

```
calculus.derivatives.basic_rules
calculus.derivatives.chain_rule
calculus.derivatives.product_rule
calculus.derivatives.quotient_rule
calculus.derivatives.implicit
calculus.derivatives.related_rates
```

For each subtopic, populate:

### `calculus.derivatives.basic_rules`
```python
ib_ref = "5.1"
guide_text = """
Students should be able to:
- Find derivatives of x^n (n ∈ Q), sin x, cos x, tan x, e^x, ln x.
- Use linearity: derivative of af(x) + bg(x) is af'(x) + bg'(x).
- Understand and apply the notation dy/dx, f'(x), d/dx[f(x)].
"""
command_terms = ["find", "differentiate", "calculate"]
example_questions = [
    {
        "stem": "Find f'(x) given f(x) = 3x^4 - 2x^2 + 5.",
        "answer": "12*x**3 - 4*x",
        "source": "style:ib_aa_hl_p1",
        "difficulty": 1
    },
    {
        "stem": "Differentiate g(x) = 4e^x - 3sin(x) + 7.",
        "answer": "4*exp(x) - 3*cos(x)",
        "source": "style:ib_aa_hl_p1",
        "difficulty": 1
    },
    {
        "stem": "Find dy/dx given y = x^(2/3) + ln(x).",
        "answer": "Rational(2,3)*x**(-Rational(1,3)) + 1/x",
        "source": "style:ib_aa_hl_p1",
        "difficulty": 2
    }
]
formula_booklet_refs = [
    "d/dx(x^n) = nx^(n-1)",
    "d/dx(sin x) = cos x",
    "d/dx(cos x) = -sin x",
    "d/dx(e^x) = e^x",
    "d/dx(ln x) = 1/x"
]
notes = "IB often tests rational exponents (n ∈ Q not just integers). Always use exact form."
```

### `calculus.derivatives.chain_rule`
```python
ib_ref = "5.6"
guide_text = """
Students should be able to:
- Apply the chain rule: if y = f(g(x)), then dy/dx = f'(g(x)) · g'(x).
- Recognise composite function structure before differentiating.
- Combine chain rule with standard derivatives (trig, exp, log).
"""
command_terms = ["find", "differentiate", "hence", "show that"]
example_questions = [
    {
        "stem": "Find the derivative of y = sin(3x^2 + 1).",
        "answer": "6*x*cos(3*x**2 + 1)",
        "source": "style:ib_aa_hl_p1",
        "difficulty": 2
    },
    {
        "stem": "Differentiate f(x) = e^(x^3 - 2x).",
        "answer": "(3*x**2 - 2)*exp(x**3 - 2*x)",
        "source": "style:ib_aa_hl_p1",
        "difficulty": 2
    },
    {
        "stem": "Find dy/dx for y = ln(cos x).",
        "answer": "-tan(x)",
        "source": "style:ib_aa_hl_p1",
        "difficulty": 3
    }
]
formula_booklet_refs = [
    "Chain rule: dy/dx = (dy/du)(du/dx)"
]
notes = "IB frequently nests trig inside polynomial or polynomial inside exp/ln. The 'hence' command term signals using the chain rule result in the next part of the question."
```

### `calculus.derivatives.product_rule`
```python
ib_ref = "5.6"
guide_text = """
Students should be able to:
- Apply the product rule: (uv)' = u'v + uv'.
- Choose which factor to call u and which v (usually does not matter, but
  IB mark schemes have a canonical choice — follow it for full marks on
  'show that' questions).
- Combine with chain rule for composite factors.
"""
command_terms = ["find", "differentiate", "show that", "hence"]
example_questions = [
    {
        "stem": "Find the derivative of f(x) = x^2 sin(x).",
        "answer": "2*x*sin(x) + x**2*cos(x)",
        "source": "style:ib_aa_hl_p1",
        "difficulty": 2
    },
    {
        "stem": "Differentiate y = x e^x.",
        "answer": "exp(x) + x*exp(x)",
        "source": "style:ib_aa_hl_p1",
        "difficulty": 2
    },
    {
        "stem": "Find f'(x) for f(x) = (3x^2 - 1) ln(x).",
        "answer": "6*x*log(x) + (3*x**2 - 1)/x",
        "source": "style:ib_aa_hl_p1",
        "difficulty": 3
    }
]
formula_booklet_refs = [
    "Product rule: (uv)' = u'v + uv'"
]
notes = "IB commonly combines product rule with trig (x^n * sin/cos) or with ln. Avoid generating questions requiring integration by parts — that is a separate topic."
```

### `calculus.derivatives.quotient_rule`
```python
ib_ref = "5.6"
guide_text = """
Students should be able to:
- Apply the quotient rule: (u/v)' = (u'v - uv') / v^2.
- Recognise when quotient rule is needed vs rewriting as product (both are
  acceptable in IB mark schemes).
- Simplify the result to standard form.
"""
command_terms = ["find", "differentiate", "show that", "simplify"]
example_questions = [
    {
        "stem": "Find dy/dx for y = sin(x) / x.",
        "answer": "(x*cos(x) - sin(x)) / x**2",
        "source": "style:ib_aa_hl_p1",
        "difficulty": 2
    },
    {
        "stem": "Differentiate f(x) = (x^2 + 1) / (x - 3).",
        "answer": "(x**2 - 6*x - 1) / (x - 3)**2",
        "source": "style:ib_aa_hl_p1",
        "difficulty": 3
    }
]
formula_booklet_refs = [
    "Quotient rule: (u/v)' = (u'v - uv') / v^2"
]
notes = "IB sometimes tests both product and quotient rule in the same multi-part question. Difficulty 4–5 questions usually require simplification of the result."
```

### `calculus.derivatives.implicit`
```python
ib_ref = "5.9"
guide_text = """
Students should be able to:
- Differentiate implicitly both sides of an equation with respect to x.
- Apply d/dx[f(y)] = f'(y) · dy/dx (chain rule with y as intermediate variable).
- Express dy/dx in terms of x and y.
"""
command_terms = ["find", "show that", "hence find"]
example_questions = [
    {
        "stem": "Given x^2 + y^2 = 25, find dy/dx.",
        "answer": "-x/y",
        "source": "style:ib_aa_hl_p1",
        "difficulty": 2
    },
    {
        "stem": "Given x^2 + 3xy + y^2 = 7, find dy/dx.",
        "answer": "-(2*x + 3*y)/(3*x + 2*y)",
        "source": "style:ib_aa_hl_p1",
        "difficulty": 3
    }
]
formula_booklet_refs = [
    "Chain rule applied to y: d/dx[f(y)] = f'(y) · dy/dx"
]
notes = "IB implicit differentiation questions almost always involve x^2 + y^2 form (circles, ellipses) or mixed xy terms. The answer must be expressed as dy/dx = ... in terms of x and y."
```

### `calculus.derivatives.related_rates`
```python
ib_ref = "5.9"
guide_text = """
Students should be able to:
- Set up related rates problems: identify which quantities vary with time.
- Apply chain rule: dA/dt = (dA/dx)(dx/dt).
- Solve for the unknown rate given the other rate and the current value.
"""
command_terms = ["find", "calculate", "determine"]
example_questions = [
    {
        "stem": "A spherical balloon is being inflated so that its radius increases at 2 cm/s. Find the rate of increase of volume when the radius is 5 cm.",
        "answer": "200*pi",
        "source": "style:ib_aa_hl_p2",
        "difficulty": 3
    },
    {
        "stem": "The area of a square is increasing at 8 cm²/s. Find the rate of increase of the side length when the side is 4 cm.",
        "answer": "1",
        "source": "style:ib_aa_hl_p2",
        "difficulty": 3
    }
]
formula_booklet_refs = [
    "Chain rule: dy/dt = (dy/dx)(dx/dt)",
    "Volume of sphere: V = (4/3)πr^3"
]
notes = "IB related rates appear on Paper 2 (calculator allowed). Answers are often numeric at a specific instant. Include units in the stem. Reference_answer should be the numeric value (for SymPy), units are in stem."
```

**Script usage:**
```bash
cd ~/tutor_skufs
.venv/bin/python scripts/seed_syllabus.py
# Expected output: 6 syllabus_item rows inserted.
```

The script should:
1. Connect to `tutor_ib_math` DB using `TUTOR_DB_URL` from `backend/.env`
2. For each subtopic, look up `topic_id` by `slug`
3. Insert the `syllabus_item` row (upsert on conflict `(topic_id, ib_ref)`)
4. Print a confirmation line per row
5. Exit with code 0

---

## Step 3 — Update `tutor_content_agent/core/generator.py`

### 3a. Fetch syllabus anchor before generation

Add a new DB query function:

```python
def _get_syllabus_item(conn, topic_id: str) -> dict | None:
    """Return the syllabus_item for this topic, or None if not seeded yet."""
    cur = conn.execute(
        """
        SELECT ib_ref, guide_text, command_terms,
               example_questions, formula_booklet_refs, notes
        FROM syllabus_item
        WHERE topic_id = %s
        LIMIT 1
        """,
        (topic_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        "ib_ref": row[0],
        "guide_text": row[1],
        "command_terms": row[2],
        "example_questions": row[3],   # already parsed JSONB → list[dict]
        "formula_booklet_refs": row[4],
        "notes": row[5],
    }
```

### 3b. Replace the system prompt

Replace `_QUESTION_BATCH_SYSTEM` with an anchored version:

```python
def _build_system_prompt(syllabus: dict | None) -> str:
    """
    Build the LLM system prompt.
    If syllabus anchor is available, inject it as a hard constraint.
    If not, fall back to the original generic prompt (log a warning).
    """
    base = """You are an expert IB Math Analysis & Approaches Higher Level question author.
Generate practice questions that match the IB AA HL curriculum exactly.

For each question, output a JSON object with this exact schema:
{
  "kind": "free_expression" | "free_numeric" | "mc" | "flashcard",
  "difficulty": 1 | 2 | 3 | 4 | 5,
  "stem_md": "Question text with inline math using $...$ delimiters.",
  "reference_answer": "Canonical answer in SymPy-parseable form.",
  "reference_answer_tex": "LaTeX form of the answer.",
  "variables": ["x"],
  "mc_options": null,
  "mc_correct_key": null
}

Rules:
- difficulty 1=very easy, 2=easy, 3=medium, 4=hard, 5=exam-level
- reference_answer MUST be parseable by SymPy (** for powers, * for multiplication)
- For mc: set mc_options to {"A":"...","B":"...","C":"...","D":"..."} and mc_correct_key
- For flashcard: reference_answer is prose; variables = []
- Output ONLY a JSON array, no extra text"""

    if syllabus is None:
        # No anchor — warn, fall back to generic
        logger.warning(
            "No syllabus_item found for this topic. "
            "Generating without IB grounding — questions may be off-syllabus. "
            "Run scripts/seed_syllabus.py first."
        )
        return base

    # Build the anchored constraint block
    examples_block = ""
    for i, ex in enumerate(syllabus.get("example_questions") or [], 1):
        examples_block += (
            f"  Example {i}: {ex['stem']}\n"
            f"    Answer: {ex['answer']} | Difficulty: {ex['difficulty']}\n"
        )

    formula_block = "\n".join(
        f"  - {f}" for f in (syllabus.get("formula_booklet_refs") or [])
    )

    command_terms_str = ", ".join(syllabus.get("command_terms") or [])

    notes_block = (
        f"\nAdditional guidance: {syllabus['notes']}"
        if syllabus.get("notes") else ""
    )

    anchor = f"""
=== IB AA HL SYLLABUS CONSTRAINT (MANDATORY) ===

IB Subject Guide reference: {syllabus['ib_ref']}

What students must be able to do (verbatim from IB AA HL Subject Guide):
{syllabus['guide_text'].strip()}

Relevant formula booklet entries:
{formula_block}

Acceptable IB command terms for this topic: {command_terms_str}
(Use only these command terms in question stems.)

Reference questions at IB AA HL level (style and difficulty guide):
{examples_block}
{notes_block}

=== HARD CONSTRAINTS ===
- Generate questions that require ONLY the techniques listed in the Subject Guide excerpt above.
- Do NOT use techniques from other topics (e.g. do not use integration in a derivatives question).
- Do NOT test knowledge beyond AA HL (e.g. no university-level analysis, no tensors).
- Match the style, notation and difficulty of the reference examples.
- Use the same mathematical notation as IB: × for multiplication in prose,
  standard trig notation (sin, cos, tan), natural log as ln (not log).
- Reference_answer must remain SymPy-parseable.
"""
    return base + anchor
```

### 3c. Wire the anchor into `generate_questions()`

In the `generate_questions()` function, after resolving `topic_id`:

```python
    # Fetch syllabus anchor
    with psycopg.connect(DB_URL) as conn:
        topic_info = _get_topic(conn, topic_slug)
        if not topic_info:
            raise ValueError(f"Topic not found in DB: {topic_slug}")
        topic_id, topic_name = topic_info
        syllabus = _get_syllabus_item(conn, topic_id)  # NEW

    system_prompt = _build_system_prompt(syllabus)     # NEW
```

And pass `system_prompt` into `_llm_generate_questions()`:

```python
async def _llm_generate_questions(
    topic_slug: str,
    topic_name: str,
    count: int,
    difficulty_range: list[int],
    system_prompt: str,             # NEW parameter
) -> list[dict]:
    ...
    resp = await router.chat(
        [ChatMessage(role="system", content=system_prompt),   # was hardcoded
         ChatMessage(role="user", content=user_msg)],
        ...
    )
```

### 3d. Add syllabus-scope check after generation

After LLM returns a batch, add a lightweight post-generation scope check.
This is a second LLM call — cheap (few tokens) and uses a small model:

```python
async def _check_in_scope(
    client: httpx.AsyncClient,
    stem: str,
    guide_text: str,
    router,
) -> tuple[bool, str]:
    """
    Ask LLM: does this question require ONLY the techniques in guide_text?
    Returns (in_scope: bool, reason: str).
    Uses a cheap model (gpt-4o-mini / ollama) — not the main generation model.
    """
    from hs_shared.llm_router import ChatMessage, LLMRouter

    cheap_router = LLMRouter(
        chain=["openai", "ollama"],
        agent_name="tutor_content_agent_scope_check",
    )
    prompt = f"""IB AA HL Subject Guide says students should be able to:
{guide_text.strip()}

Question: {stem}

Answer YES or NO: does this question require ONLY the techniques listed above?
Then on the same line, after a space, give a one-sentence reason.
Example: "YES Uses only chain rule as listed."
Example: "NO Requires integration by parts which is not listed."
Output exactly one line."""

    try:
        resp = await cheap_router.chat(
            [ChatMessage(role="user", content=prompt)],
            model_per_provider={"openai": "gpt-4o-mini", "ollama": "llama3.2"},
            temperature=0.0,
            max_tokens=60,
        )
        line = resp.content.strip().upper()
        in_scope = line.startswith("YES")
        return in_scope, resp.content.strip()
    except Exception as e:
        logger.warning("Scope check failed: %s — defaulting to in_scope=True", e)
        return True, "check_failed"
```

Add this call in the per-question loop, after SymPy validation and before
generating solution/hints:

```python
                # Scope check (skip for flashcard — prose answers don't need it)
                if kind != "flashcard" and syllabus:
                    in_scope, reason = await _check_in_scope(
                        http, stem, syllabus["guide_text"], _get_router()
                    )
                    if not in_scope:
                        logger.warning("Scope reject: %s | Reason: %s", stem[:80], reason)
                        result.skipped_scope = result.skipped_scope + 1
                        continue
```

Add `skipped_scope: int = 0` to the `GenerationResult` dataclass.

---

## Step 4 — CLI update

File: `~/home_services/tutor_content_agent/` — add `cli.py` if not present,
or update if present.

```bash
.venv/bin/python -m tutor_content_agent.cli generate \
    --topic calculus.derivatives.product_rule \
    --count 10 \
    --difficulty-range 2-4
```

The CLI should:
1. Call `generate_questions()` from `core/generator.py`
2. Print a progress line per inserted question (already logged)
3. Print the `GenerationResult` summary at the end:

```
=== Generation complete ===
Topic:           calculus.derivatives.product_rule
Attempted:       10
Inserted:        9
Skipped (SymPy): 0
Skipped (scope): 1
Skipped (error): 0
```

4. Exit with code 0 if `inserted > 0`, else exit 1.

---

## Step 5 — Wolfram verification pass (after first batch)

This is a separate script, run manually after the first batch is inserted
and before marking questions `approved`.

File: `~/tutor_skufs/scripts/wolfram_verify_batch.py`

```bash
cd ~/tutor_skufs
.venv/bin/python scripts/wolfram_verify_batch.py \
    --topic calculus.derivatives \
    --limit 30
```

What it does:
1. SELECT questions WHERE status='pending_review' AND topic matches AND wolfram_verified=false
2. For each question, POST to `/v1/wolfram/compute` via the orchestrator:
   query = `"Differentiate {reference_answer} is the derivative of {stem_hint}"` or
   a direct check `"Is {reference_answer} equal to d/dx[{function}]"`
3. Parse Wolfram's `primary_result` and compare symbolically (SymPy) to `reference_answer`
4. If they match: set `wolfram_verified=true`
5. If they differ: set `status='retired'`, write to ERRORS.md
6. Print summary: verified/total, retired/total, Wolfram API calls used

**Important:** Wolfram is called ONCE per question, at this verification stage.
Never during live lesson/grading (per SPEC hard rules).

---

## Step 6 — Approval script (already implied in SPEC, make explicit)

File: `~/tutor_skufs/scripts/approve_batch.py`

```bash
.venv/bin/python scripts/approve_batch.py \
    --topic calculus.derivatives \
    --min-difficulty 1 \
    --dry-run        # show what would be approved
```

```bash
.venv/bin/python scripts/approve_batch.py \
    --topic calculus.derivatives \
    --wolfram-verified-only  # only approve questions Wolfram already confirmed
```

What it does:
1. SELECT questions WHERE status='pending_review' AND wolfram_verified=true (when flag set)
2. Print each question stem + answer (for human review)
3. In dry-run mode: count only, no changes
4. In live mode: UPDATE status='approved' for matching questions
5. Print: `Approved {n} questions for topic {topic}`

---

## Acceptance criteria

Run this sequence and confirm all steps pass:

```bash
# 1. Migration
cd ~/tutor_skufs/backend
.venv/bin/alembic upgrade head
# Expected: "Running upgrade ... -> XXXX, add syllabus_item_table"

# 2. Seed
cd ~/tutor_skufs
.venv/bin/python scripts/seed_syllabus.py
# Expected: 6 rows inserted for calculus.derivatives.*

# 3. Verify seed
psql tutor_ib_math -c "SELECT t.slug, s.ib_ref, array_length(s.command_terms,1) as terms, jsonb_array_length(s.example_questions) as examples FROM syllabus_item s JOIN topic t ON t.id = s.topic_id ORDER BY t.slug;"
# Expected: 6 rows, each with 2-4 command_terms, 2-3 examples

# 4. Generate with anchor
cd ~/home_services/tutor_content_agent
.venv/bin/python -m tutor_content_agent.cli generate \
    --topic calculus.derivatives.product_rule --count 5
# Expected: "Inserted: 4-5" (some may be rejected by scope check — that's correct)
# Must NOT see: "No syllabus_item found" warning

# 5. Spot-check a generated question
psql tutor_ib_math -c "SELECT stem_md, reference_answer, difficulty FROM question WHERE status='pending_review' ORDER BY created_at DESC LIMIT 3;"
# Verify: stems look like IB questions, answers are SymPy-parseable

# 6. Wolfram pass (optional at acceptance, required before approve)
cd ~/tutor_skufs
.venv/bin/python scripts/wolfram_verify_batch.py \
    --topic calculus.derivatives.product_rule --limit 5

# 7. Full batch
cd ~/home_services/tutor_content_agent
.venv/bin/python -m tutor_content_agent.cli generate \
    --topic calculus.derivatives --count 30 --difficulty-range 1-4
# Expected final DB check:
psql tutor_ib_math -c "SELECT count(*) FROM question WHERE status='pending_review';"
# Expected: >= 25
```

---

## What NOT to do

- Do NOT modify `corpus_agent`, `translation_agent`, `format_agent`, `transcribe_agent`.
- Do NOT modify existing `.env` files or existing launchd plists.
- Do NOT add `syllabus_item` rows for topics outside `calculus.derivatives.*` in this task.
  Other topics are Phase 4.
- Do NOT change the `question` table schema — `syllabus_item` is a separate table.
- Do NOT call Wolfram from inside the per-question generation loop.
  Wolfram runs only in the separate `wolfram_verify_batch.py` pass.
- Do NOT skip the scope check just because it adds latency.
  It is the primary guard against off-syllabus content.

---

## Files to create / modify

| File | Action |
|---|---|
| `tutor_skufs/backend/alembic/versions/XXXX_add_syllabus_item_table.py` | CREATE |
| `tutor_skufs/backend/app/models/syllabus_item.py` | CREATE |
| `tutor_skufs/backend/app/models/__init__.py` | MODIFY — add SyllabusItem import |
| `tutor_skufs/scripts/seed_syllabus.py` | CREATE |
| `tutor_skufs/scripts/wolfram_verify_batch.py` | CREATE |
| `tutor_skufs/scripts/approve_batch.py` | CREATE |
| `home_services/tutor_content_agent/core/generator.py` | MODIFY — Steps 3a–3d |
| `home_services/tutor_content_agent/cli.py` | CREATE or MODIFY — Step 4 |
| `tutor_macbook/MEMORY.md` | APPEND — decision log entry |

After all files are created and tests pass, append to `MEMORY.md`:

```markdown
### 2026-05-17 — Syllabus anchor system

Added `syllabus_item` table (migration + ORM model). Seeded 6 rows for
calculus.derivatives.*. Updated tutor_content_agent generator to:
(a) inject verbatim Subject Guide text + example questions into LLM system prompt,
(b) run a post-generation scope check via cheap LLM call,
(c) skip questions that fail scope check (skipped_scope counter).
Wolfram verification runs separately via wolfram_verify_batch.py (not in generation loop).
Approval via approve_batch.py --wolfram-verified-only.
```
