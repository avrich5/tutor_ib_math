# TASK: pdf_ingest_agent — PDF Book Parser Agent

**For:** Claude Code  
**Date:** 2026-05-17  
**Port:** 4710  
**Location:** `~/home_services/pdf_ingest_agent/`  
**Orchestrator route:** `/v1/ingest/*`  
**Does NOT touch:** corpus_agent, translation_agent, format_agent,
transcribe_agent, existing .env files, existing plists, existing agents.yaml entries

---

## PDF probe results (already done — read carefully)

Both PDFs are confirmed text-based (not scanned). PyMuPDF extracts text.

**Main PDF:** `haese_aa_hl_main.pdf` — 491 pages, 58MB  
Publisher: Hodder Education (Cambridge). Creator: Chrome/85 → printed to PDF.

**Answers PDF:** `haese_aa_hl_answers.pdf` — 460 pages, 10MB  
Title: "Worked Solutions" — full step-by-step solutions, NOT just final answers.

### Critical findings from probe:

**1. Math encoding — `Unnamed-T3` font**  
Mathematical symbols use a custom Type3 font (`Unnamed-T3`). PyMuPDF extracts
math as **fragmented token strings**, not coherent expressions:
```
# What the PDF contains:   f'(x) = 2x sin(x) + x² cos(x)
# What PyMuPDF returns:     '2x', '\n', 'sin', '(', 'x', ')', '+', 'x', '2', ...
```
This is the primary challenge. Math cannot be assembled reliably from raw text tokens.
**Claude Vision is required for all pages containing math expressions.**

**2. No table of contents in PDF metadata**  
`doc.get_toc()` returns empty list. Structure must be detected from text patterns:
- Chapter start: line matching `^\d+\s+[A-Z][a-z]+` e.g. `"1  Counting principles"`
- Exercise section: line matching `^\d+[A-Z]\s` e.g. `"1A Basic techniques"`
- Chapter number alone on a line followed by chapter title on next line.

**3. Blue/colour question detection — NOT via fill color on exercise pages**  
The teal fill `(0.0, 0.674, 0.773)` appears in page decoration (headers, icons),
NOT as background fills behind question numbers on exercise pages.
The probe found **0 teal rects** on exercise page p15.

**Real mechanism (confirmed from answers PDF p2):**  
The answers PDF explicitly states:
> *"These are worked solutions to the colour-coded problem-solving questions
> from the exercises in the Student's Book. **This excludes the drill questions.**"*

Structure:
- **Drill questions** = easy, numbered 1,2,3... — NO answers anywhere
- **Colour-coded questions** = harder, numbered separately (starting from a
  higher number within each exercise, e.g. answers start at Q13 for Exercise 1A)
- The answers PDF starts each exercise's answers at the first colour-coded
  question number

**Detection rule:** A question has an answer if and only if its number
appears in the answers PDF for that exercise. Questions below the minimum
answered number in each exercise = drill questions = `has_answer: false`.

**4. Answers PDF math encoding — same `Unnamed-T3` + Unicode math**  
Answers also use custom font PLUS Unicode math characters (ൌ = equals,
ൈ = times, ଵ = superscript digits in Indic encoding for fractions like ½).
Full worked solutions with step-by-step algebra — same Vision requirement.

**5. Structure of answers PDF**  
Each chapter starts with: `"N Chapter_title\nThese are worked solutions..."`
Each exercise block: `"Exercise NA\n Q_number\n solution steps"`
Question numbers appear as standalone lines before their solution.

---

## Purpose

A general-purpose document ingestion agent for PDFs (textbooks, past papers,
reference books). Domain-agnostic — reused for physics, chemistry, any subject.

Primary use case: Haese AA HL textbook (main + worked solutions).

**Core philosophy:**
- Slow and correct beats fast and broken
- Incremental by section — flush to disk after each section completes
- Every error is logged, never silently dropped
- A job can be paused, resumed, and inspected at any point
- Source material is immutable (`protected: true`)

---

## Architecture

### Directory layout

```
~/home_services/pdf_ingest_agent/
├── .env
├── .env.example
├── .venv/
├── requirements.txt
├── main.py                     # FastAPI :4710
├── core/
│   ├── __init__.py
│   ├── job_store.py            # SQLite job registry
│   ├── pdf_reader.py           # PyMuPDF: text blocks, page images, drawings
│   ├── structure_parser.py     # Chapter/exercise/question detection
│   ├── vision.py               # OpenAI Vision primary, Claude fallback
│   ├── cross_linker.py         # Link answers to questions by exercise ref
│   ├── verifier.py             # Per-section + final verification gates
│   └── output_writer.py        # Incremental JSONL writer
├── cli.py
├── jobs/                       # gitignored
│   └── {job_id}/
│       ├── meta.json
│       ├── progress.json
│       ├── sections/
│       │   ├── 001_ch1_counting.json
│       │   └── ...
│       ├── vision_cache.db     # SQLite: (pdf_hash, page_num) → vision JSON
│       ├── errors.jsonl
│       ├── qa_samples.jsonl    # LLM spot-check results per section
│       └── output.jsonl
└── logs/
```

---

## Vision layer — OpenAI primary, Claude fallback

**Provider order:** GPT-4o Vision → Claude claude-sonnet-4 → error

```python
# core/vision.py

VISION_PROMPT = """
You are parsing a page from an IB Math textbook (Haese Mathematics AA HL).
The PDF uses a custom math font — raw text extraction is corrupted.
Your job: reconstruct the mathematical content accurately from the image.

Return ONLY valid JSON, no other text. Schema:

{
  "page_elements": [
    {
      "kind": "chapter_heading" | "section_heading" | "theory" |
               "key_point" | "worked_example" | "exercise_question" |
               "exercise_header" | "footnote" | "figure_caption",
      "label": "string or null",
      "text_md": "prose with inline math as $...$",
      "latex_blocks": ["display math as LaTeX string, no delimiters"],
      "question_number": "string or null",   // "13", "14a", "2b" etc
      "is_drill": null,                      // leave null — determined by cross-link
      "solution_steps": null                 // only for worked_example kind
    }
  ],
  "exercise_ref": "string or null",   // e.g. "1A", "4C" if this page has exercises
  "chapter_ref": "string or null",    // e.g. "1", "4"
  "has_math": true | false,
  "page_notes": "string or null"
}

Rules:
- ALL math MUST use $...$ for inline, and be returned in latex_blocks for display
- Use \\frac{a}{b} not a/b; x^{2} not x2; \\sqrt{x} not √x
- nCr notation: \\binom{n}{r}
- For exercise questions: capture the FULL stem including all sub-parts (a), (b), (c)
- If a question continues from previous page: note in page_notes
- Theory paragraphs: capture key definitions and theorems verbatim
- Key Point boxes (blue-bordered boxes): kind="key_point", full content in text_md
- Worked Examples: kind="worked_example", solution_steps as array of step strings
- Do NOT invent. If math is unclear write [UNCLEAR_MATH] in text_md
- Page numbers, headers, footers: omit entirely
"""

ANSWERS_PROMPT = """
You are parsing a page from an IB Math worked solutions book (Haese AA HL).
Return ONLY valid JSON.

{
  "solutions": [
    {
      "exercise_ref": "1A",           // exercise letter reference
      "question_number": "13",        // question number as string
      "steps": [                      // array of solution steps
        "prose with $inline math$"
      ],
      "final_answer": "LaTeX string or null"
    }
  ],
  "chapter_ref": "string or null",
  "page_notes": "string or null"
}

Rules:
- Each solution starts with a standalone question number on a page
- Math: $...$ inline, \\frac{a}{b}, x^{2}, \\binom{n}{r}
- Unicode math chars in source (ൌ ൈ ½ ଵ) → convert to proper LaTeX
- final_answer: the last expression in the solution, in LaTeX
"""
```

**Rate limiting:**
- OpenAI: 60 RPM (gpt-4o) — use `asyncio.Semaphore(10)` + 0.5s gap
- Claude fallback: same semaphore, triggered only when OpenAI fails
- Vision cache: SQLite keyed by `(sha256(pdf_bytes[:1024]), page_num)`
  Never call Vision twice for the same page within or across job runs

**Math page detection (before Vision call):**
```python
def needs_vision(page) -> bool:
    """Heuristic: does this page need Vision for math?"""
    text = page.get_text()
    # Skip clearly text-only pages
    if len(page.get_images()) == 0 and 'Unnamed' not in str(page.get_fonts()):
        # Check for math-like patterns even in garbled text
        math_signals = ['\\n', 'frac', '\\', 'sqrt', 'sin', 'cos', 'log',
                        'lim', '∫', '→', '≡', '≤', '≥']
        font_names = [f[3] for f in page.get_fonts()]
        has_t3 = any('Unnamed' in f or 'T3' in f for f in font_names)
        return has_t3
    return True  # has images or unknown fonts → use Vision
```
Expected: ~70% of pages need Vision (theory + exercises). 
~30% are text-only (intros, ToC, acknowledgements) → skip Vision.

---

## Processing pipeline

### Stage 0 — Probe

Open PDF, extract:
- Page count
- Font inventory (detect `Unnamed-T3` presence)
- Estimate math pages via `needs_vision()` heuristic on all pages
- Estimate Vision API cost: `math_pages × $0.003`
- Sample 3 random pages with Vision, show results to user

Output:
```
PDF: haese_aa_hl_main.pdf
Pages: 491
Math pages (estimated): 341 / 491
Vision API cost estimate: $1.02 (OpenAI gpt-4o)
Estimated duration: 35–50 min

Sample page 47 Vision result:
  Exercise 3B | 4 questions | has math: yes
  Q1: Find all values of θ...
  Q2: Solve sin(2θ) = ...

Proceed? [y/N]
```

### Stage 1 — Structure detection (text pass, all pages, fast)

PyMuPDF text-only scan on all pages. Build section map:

```python
# Patterns to detect (in order of priority):
CHAPTER_RE    = re.compile(r'^(\d+)\s{2,}([A-Z][^\n]{3,40})$', re.M)
EXERCISE_RE   = re.compile(r'^(\d+[A-Z])\s+([A-Z][^\n]{3,50})$', re.M)
EXAMPLE_RE    = re.compile(r'^WORKED EXAMPLE\s+(\d+\.\d+)', re.M)
QUESTION_RE   = re.compile(r'^\s*(\d+)\s+[A-Za-z\$\\(]', re.M)  # Q number at line start
```

Section map entry:
```json
{
  "section_id": "ch04_ex4C",
  "kind": "exercise",
  "chapter": "4",
  "exercise_ref": "4C",
  "title": "The chain rule",
  "page_start": 141,
  "page_end": 145,
  "estimated_questions": 12
}
```

Report: `"87 sections detected across 491 pages."`
Save to `meta.json`. Do NOT proceed to Stage 2 without saving this.

### Stage 2 — Content extraction (section by section, Vision)

For each section in order:

```
a. For each page in section:
   i.  If needs_vision(page): call Vision API → structured JSON
   ii. Else: extract text blocks with PyMuPDF, parse manually
   iii. Save raw Vision response to vision_cache.db

b. Parse section content from accumulated page JSONs:
   - Identify all exercise_question records
   - Identify all worked_example records
   - Identify all theory / key_point records

c. Write section JSON to sections/{NNN}_{section_id}.json
d. Append records to output.jsonl
e. Update progress.json with last completed section + page

f. *** PER-SECTION VERIFICATION *** (see below)
g. *** PER-SECTION LLM SPOT-CHECK *** (see below)
```

**Never move to next section until current section is saved to disk.**
If process is killed between sections, the next run resumes from the
last completed section using `progress.json`.

### Stage 3 — Answers cross-linking

After Stage 2 completes on main PDF, process answers PDF:

```
For each page in answers PDF:
  Vision → solutions JSON
  For each solution:
    Find matching exercise_question by (exercise_ref, question_number)
    If found: set reference_answer, solution_steps, has_answer=true
    If not found: log UNMATCHED_ANSWER to errors.jsonl

Drill question detection:
  For each exercise_ref:
    min_answered = min question_number that has an answer
    All questions with number < min_answered → has_answer=false, is_drill=true
```

### Stage 4 — Verification (all gates)

See Gates section below.

### Stage 5 — Export to DB

Write to `textbook_question` and `textbook_concept` tables.
Idempotent (UNIQUE constraint on source_doc_id + exercise_ref + question_number).

---

## Per-section verification (after EACH section — Gate A)

Run immediately after each section completes in Stage 2.
If any check fails: log warning, mark section `needs_review`, continue.
Do NOT stop the job — flag and continue.

```python
def verify_section(section_json: dict) -> SectionVerificationResult:
    questions = [r for r in section_json['records']
                 if r['record_type'] == 'exercise_question']

    checks = []

    # A1 — Question number continuity
    nums = sorted_question_numbers(questions)  # parse "1","2","3a","3b"...
    gaps = find_gaps(nums)
    checks.append(Check("question_continuity", passed=len(gaps)==0,
                         detail=f"gaps: {gaps}" if gaps else "ok"))

    # A2 — Every question has a non-empty stem
    empty_stems = [q['question_number'] for q in questions
                   if not q.get('stem_md','').strip()]
    checks.append(Check("stems_non_empty", passed=len(empty_stems)==0,
                         detail=f"empty: {empty_stems}" if empty_stems else "ok"))

    # A3 — LaTeX balance
    bad_latex = []
    for q in questions:
        stem = q.get('stem_md', '')
        if stem.count('$') % 2 != 0:
            bad_latex.append(q['question_number'])
    checks.append(Check("latex_balanced", passed=len(bad_latex)==0,
                         detail=f"unbalanced $: {bad_latex}" if bad_latex else "ok"))

    # A4 — No duplicate question numbers within section
    dupes = find_duplicates([q['question_number'] for q in questions])
    checks.append(Check("no_duplicates", passed=len(dupes)==0,
                         detail=f"dupes: {dupes}" if dupes else "ok"))

    return SectionVerificationResult(section_id=section_json['section_id'],
                                     checks=checks,
                                     passed=all(c.passed for c in checks))
```

---

## Per-section LLM spot-check (after EACH section — Gate B)

After section verification passes (or is logged as warning), run an LLM
spot-check on a random sample of 2–3 questions from the section.

**Purpose:** catch Vision hallucinations, corrupted math, wrong question
attribution. A human cannot review 491 pages — the LLM does sampling.

**Provider:** OpenAI gpt-4o primary, Claude claude-sonnet-4 fallback.

```python
SPOT_CHECK_PROMPT = """
You are verifying that exercise questions were correctly extracted from an
IB Math AA HL textbook (Haese & Harris).

For each question below, check:
1. Does the stem look like a valid IB Math exercise question?
2. Is the LaTeX syntactically correct? (balanced $, proper \\frac, \\sqrt etc)
3. Does the question number match what you'd expect in a sequence?
4. Is there any obvious hallucinated content (nonsense, non-math text in stem)?

Questions to verify:
{questions_json}

For each question respond with:
{
  "question_number": "...",
  "looks_valid": true | false,
  "latex_ok": true | false,
  "issues": "description of any problem, or null"
}

Return a JSON array of these objects. No other text.
"""
```

After getting LLM response:
- Append to `qa_samples.jsonl` with section_id and timestamp
- If any question `looks_valid: false`: log `QA_FAIL` to errors.jsonl
- If > 1 question fails in a section: mark section `needs_review`
- Print summary: `"Section 4C: 3 sampled, 3 ok"` or `"Section 4C: NEEDS REVIEW (1 QA fail)"`

---

## Final verification gates (Stage 4)

Run after all sections and cross-linking are complete.
Status → `needs_review` if ANY gate fails (not `completed`).

### Gate 1 — Page coverage
```
pages_with_content / total_pages >= 0.85
```

### Gate 2 — Section continuity
```
For consecutive sections: section[i].page_end + 1 ≈ section[i+1].page_start
No page gaps > 2 pages between sections
```

### Gate 3 — Exercise completeness
```
For each exercise_ref:
  question_numbers form a contiguous sequence (no gaps > 1)
  no duplicates within exercise
```

### Gate 4 — LaTeX sanity (global)
```
For ALL stems and solution steps:
  count($) is even
  \frac always followed by {arg1}{arg2}
  \sqrt always followed by {arg}
  No raw Unicode math: ², ×, ÷, ≡ outside prose context
  No [UNCLEAR_MATH] tags in > 5% of questions
```

### Gate 5 — Answer cross-link rate
```
(only if companion PDF provided)
linked / total_non_drill >= 0.80
Unlinked question refs logged individually
```

### Gate 6 — QA sample pass rate
```
qa_passes / qa_total >= 0.90
(aggregated across all per-section spot-checks)
```

### Gate 7 — Vision consistency
```
For pages where Vision was called:
  response is non-empty JSON
  page_elements list is non-empty
  Zero empty responses on pages detected as math pages
```

---

## Output format (output.jsonl)

One JSON object per line:

```jsonc
// Theory / Key Point block
{
  "record_type": "theory",
  "job_id": "ingest_abc123",
  "source_pdf": "haese_aa_hl_main.pdf",
  "page": 15,
  "section_id": "ch01_ex1A",
  "chapter": "1",
  "section_title": "Basic techniques",
  "text_md": "The number of ways of choosing $r$ items from $n$ when order matters is...",
  "latex_blocks": ["_nP_r = \\frac{n!}{(n-r)!}"],
  "kind": "key_point",
  "origin": "haese_aa_hl",
  "origin_page": 15,
  "protected": true
}

// Worked example
{
  "record_type": "worked_example",
  "job_id": "ingest_abc123",
  "source_pdf": "haese_aa_hl_main.pdf",
  "page": 16,
  "section_id": "ch01_ex1A",
  "label": "Worked Example 1.3",
  "stem_md": "A maths teacher needs to select a team of four from 19 students...",
  "solution_steps": [
    "Order does not matter → use $\\binom{n}{r}$",
    "Number of ways $= \\binom{19}{4} = 3876$"
  ],
  "final_answer": "3876",
  "origin": "haese_aa_hl",
  "origin_page": 16,
  "protected": true
}

// Exercise question
{
  "record_type": "exercise_question",
  "job_id": "ingest_abc123",
  "source_pdf": "haese_aa_hl_main.pdf",
  "page": 17,
  "section_id": "ch01_ex1A",
  "chapter": "1",
  "exercise_ref": "1A",
  "question_number": "13",
  "stem_md": "A pet shop has 5 cats and 11 dogs. Find the number of ways of choosing one cat and one dog.",
  "parts": null,
  "is_drill": false,
  "has_answer": true,
  "reference_answer": null,         // filled in Stage 3
  "solution_steps": null,           // filled in Stage 3
  "origin": "haese_aa_hl",
  "origin_page": 17,
  "protected": true
}
```

---

## DB schema additions

New Alembic migration: `add_textbook_tables`

```sql
CREATE TABLE source_document (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  kind         TEXT NOT NULL,   -- "textbook" | "answers" | "past_paper"
  filename     TEXT NOT NULL,
  page_count   INTEGER,
  job_id       TEXT,
  ingested_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE textbook_question (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_doc_id   UUID NOT NULL REFERENCES source_document(id),
  topic_id        UUID REFERENCES topic(id),  -- filled later by classifier
  chapter         TEXT NOT NULL,
  exercise_ref    TEXT NOT NULL,
  question_number TEXT NOT NULL,
  stem_md         TEXT NOT NULL,
  parts           JSONB,
  is_drill        BOOLEAN NOT NULL DEFAULT false,
  has_answer      BOOLEAN NOT NULL DEFAULT false,
  reference_answer TEXT,
  solution_steps  JSONB,
  origin_page     INTEGER NOT NULL,
  protected       BOOLEAN NOT NULL DEFAULT true,
  embedding       vector(768),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_doc_id, exercise_ref, question_number)
);
CREATE INDEX ix_tbq_source ON textbook_question(source_doc_id);
CREATE INDEX ix_tbq_topic ON textbook_question(topic_id);
CREATE INDEX ix_tbq_embedding ON textbook_question
  USING ivfflat (embedding vector_cosine_ops) WHERE embedding IS NOT NULL;

CREATE TABLE textbook_concept (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_doc_id   UUID NOT NULL REFERENCES source_document(id),
  topic_id        UUID REFERENCES topic(id),
  chapter         TEXT,
  section_title   TEXT NOT NULL,
  kind            TEXT NOT NULL,  -- "theory" | "key_point" | "worked_example"
  text_md         TEXT NOT NULL,
  latex_blocks    TEXT[],
  origin_page     INTEGER NOT NULL,
  protected       BOOLEAN NOT NULL DEFAULT true,
  embedding       vector(768),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_tbc_source ON textbook_concept(source_doc_id);
CREATE INDEX ix_tbc_embedding ON textbook_concept
  USING ivfflat (embedding vector_cosine_ops) WHERE embedding IS NOT NULL;
```

**Rule:** `protected = true` on all textbook records. Never auto-deletable.

---

## Endpoints

```
POST   /jobs                       Create job (probe + optional start)
GET    /jobs                       List all jobs
GET    /jobs/{id}                  Status + progress
POST   /jobs/{id}/start            Start after probe confirmation
POST   /jobs/{id}/pause            Pause between sections
POST   /jobs/{id}/resume           Resume from last section
POST   /jobs/{id}/cancel           Cancel (keeps data)
POST   /jobs/{id}/retry-errors     Retry errored sections/pages
GET    /jobs/{id}/sections         Section map
GET    /jobs/{id}/errors           Error log
GET    /jobs/{id}/qa-samples       LLM spot-check results
POST   /jobs/{id}/export-to-db     Write to Postgres
GET    /health
```

---

## CLI

```bash
# Probe only
.venv/bin/python -m pdf_ingest_agent.cli ingest \
    --slug haese_aa_hl \
    --pdf ~/tutor_skufs/source_docs/haese_aa_hl_main.pdf \
    --companion ~/tutor_skufs/source_docs/haese_aa_hl_answers.pdf \
    --dry-run

# Full run
.venv/bin/python -m pdf_ingest_agent.cli ingest \
    --slug haese_aa_hl \
    --pdf ~/tutor_skufs/source_docs/haese_aa_hl_main.pdf \
    --companion ~/tutor_skufs/source_docs/haese_aa_hl_answers.pdf \
    --title "Haese Mathematics AA HL" \
    --kind textbook

# Watch live progress (run in separate terminal)
.venv/bin/python -m pdf_ingest_agent.cli watch --job ingest_abc123

# Show errors
.venv/bin/python -m pdf_ingest_agent.cli errors --job ingest_abc123

# Show QA spot-check results
.venv/bin/python -m pdf_ingest_agent.cli qa --job ingest_abc123

# Retry errors
.venv/bin/python -m pdf_ingest_agent.cli retry --job ingest_abc123

# Export to DB
.venv/bin/python -m pdf_ingest_agent.cli export --job ingest_abc123
```

`watch` output (refreshes every 5s):
```
══════════════════════════════════════════════════
 pdf_ingest_agent  job: ingest_abc123  [RUNNING]
══════════════════════════════════════════════════
 Stage 2/5 — Content extraction
 Progress:  ████████████░░░░░░░░  23/87 sections  (26%)
 Pages:     142 / 491
 Current:   ch04_ex4C  "Chain Rule exercises"
──────────────────────────────────────────────────
 Counts:    theory=89  examples=44  questions=312
 QA:        23 sections checked, 22 ok, 1 needs_review
 Errors:    1 (p88: VISION_PARSE_FAILED — skipped)
 Elapsed:   14m 22s  |  Est. remaining: ~42m
 Vision $:  $0.31 used of ~$1.02 est.
══════════════════════════════════════════════════
```

---

## `requirements.txt`

```
fastapi
uvicorn[standard]
pydantic
pydantic-settings
python-dotenv
pymupdf
openai          # Vision primary
anthropic       # Vision fallback
sympy
psycopg[binary]
httpx
rich            # CLI progress bars
```

## `.env.example`

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
TUTOR_DB_URL=postgresql://andriy@localhost:5432/tutor_ib_math
VISION_PROVIDER=openai          # openai | anthropic
VISION_RATE_LIMIT_RPM=10
JOB_STORE_DIR=/Users/andriy/home_services/pdf_ingest_agent/jobs
```

---

## agents.yaml addition

```yaml
  ingest:
    url: http://localhost:4710
    description: "PDF ingestion — parse textbooks and past papers into structured JSON"
```

## orchestrator router

New file `home_orchestrator/routers/ingest.py` — proxy pattern identical
to `embed.py`. Add to `main.py` with prefix `/v1/ingest`.

---

## Implementation order

**Step 1 — Scaffold + probe**
- Scaffold: venv, requirements, main.py (health), job_store.py (SQLite)
- pdf_reader.py: open PDF, count pages, font inventory, needs_vision()
- `POST /jobs dry_run=true`: probe + cost estimate
- CLI `--dry-run`
- **Test:** dry-run on haese_aa_hl_main.pdf → correct page count (491), cost estimate

**Step 2 — Structure detection**
- structure_parser.py: chapter/exercise/question patterns
- Stage 1 on full main PDF
- `GET /jobs/{id}/sections`
- **Test:** ≥80 sections detected, chapter titles match known content

**Step 3 — Vision (10-page smoke test)**
- vision.py: OpenAI gpt-4o Vision call, cache, rate limiter, Claude fallback
- Run Stage 2 on pages 1–10 only (`--end-page 10`)
- **Test:** vision_cache.db populated, output.jsonl has valid records,
  math LaTeX visible in stems

**Step 4 — Full Stage 2 with per-section verification + LLM spot-check**
- verifier.py: Gates A1–A4 per section
- LLM spot-check: 2–3 random questions per section via OpenAI
- qa_samples.jsonl written after each section
- **Test:** run on one full chapter (30 pages), all gates pass,
  qa_samples shows ≥90% pass rate

**Step 5 — Resume logic**
- Kill process mid-run, restart, verify continues from last section
- **Test:** interrupt at section 5, restart, sections 1–5 not re-processed

**Step 6 — Answers cross-linking**
- cross_linker.py: parse answers PDF, match by exercise_ref + question_number
- Drill detection: min answered Q per exercise
- **Test:** Exercise 1A — Q13+ have answers, Q1–12 are drill (has_answer=false)

**Step 7 — Final verification gates (1–7)**
- verifier.py: all final gates
- verification_report.json
- status → needs_review if any gate fails

**Step 8 — Export + DB migration**
- Alembic migration
- POST /jobs/{id}/export-to-db
- **Test:** export, re-export, no duplicates

**Step 9 — CLI watch command**
- rich live display, 5s refresh
- **Test:** run full job, watch in separate terminal

**Step 10 — Full run**
```bash
# First: 30-page test
.venv/bin/python -m pdf_ingest_agent.cli ingest \
    --slug haese_test \
    --pdf ~/tutor_skufs/source_docs/haese_aa_hl_main.pdf \
    --end-page 30
# Verify output, then full run:
.venv/bin/python -m pdf_ingest_agent.cli ingest \
    --slug haese_aa_hl \
    --pdf ~/tutor_skufs/source_docs/haese_aa_hl_main.pdf \
    --companion ~/tutor_skufs/source_docs/haese_aa_hl_answers.pdf \
    --title "Haese Mathematics AA HL" --kind textbook
```

---

## Acceptance criteria

```bash
# 1. Health
curl http://localhost:4710/health
# → {"status":"ok","service":"pdf_ingest_agent"}

# 2. Probe
.venv/bin/python -m pdf_ingest_agent.cli ingest \
    --slug test --pdf ~/tutor_skufs/source_docs/haese_aa_hl_main.pdf --dry-run
# → Pages: 491, cost estimate shown, no files written

# 3. 30-page run
.venv/bin/python -m pdf_ingest_agent.cli ingest \
    --slug haese_p30 \
    --pdf ~/tutor_skufs/source_docs/haese_aa_hl_main.pdf --end-page 30
# In another terminal: watch --job haese_p30
# → Completes in < 10 min

# 4. Output quality
cat jobs/haese_p30/output.jsonl | python3 -c "
import sys,json
recs=[json.loads(l) for l in sys.stdin]
print('theory:', sum(1 for r in recs if r['record_type']=='theory'))
print('examples:', sum(1 for r in recs if r['record_type']=='worked_example'))
print('questions:', sum(1 for r in recs if r['record_type']=='exercise_question'))
# Spot-check a question stem
qs=[r for r in recs if r['record_type']=='exercise_question']
if qs: print('Sample Q:', qs[0]['stem_md'][:150])
"
# → Non-zero counts, sample question has real LaTeX

# 5. Verification
cat jobs/haese_p30/verification_report.json | python3 -c "
import sys,json; r=json.load(sys.stdin)
print('Gates passed:', sum(1 for g in r['gates'] if g['passed']), '/', len(r['gates']))
"
# → 7/7 (or specific failures explained)

# 6. QA samples
cat jobs/haese_p30/qa_samples.jsonl | python3 -c "
import sys,json
recs=[json.loads(l) for l in sys.stdin]
total=sum(len(r['results']) for r in recs)
passed=sum(1 for r in recs for q in r['results'] if q['looks_valid'])
print(f'QA: {passed}/{total} passed ({100*passed//total}%)')
"
# → ≥ 90%

# 7. Resume test
# Start job on pages 1-50, kill after ~5 sections, restart, verify resumes

# 8. Export
.venv/bin/python -m pdf_ingest_agent.cli export --job haese_p30
/opt/homebrew/bin/psql tutor_ib_math -c \
    "SELECT count(*) FROM textbook_question; SELECT count(*) FROM textbook_concept;"
# → non-zero, no errors

# 9. Full run (after 30-page test passes all acceptance criteria)
.venv/bin/python -m pdf_ingest_agent.cli ingest \
    --slug haese_aa_hl \
    --pdf ~/tutor_skufs/source_docs/haese_aa_hl_main.pdf \
    --companion ~/tutor_skufs/source_docs/haese_aa_hl_answers.pdf \
    --title "Haese Mathematics AA HL" --kind textbook
# Expected: 60–90 min. Watch in separate terminal.
# Final DB check:
/opt/homebrew/bin/psql tutor_ib_math -c "
  SELECT count(*) as questions FROM textbook_question;
  SELECT count(*) as concepts FROM textbook_concept;
  SELECT count(*) filter (where has_answer) as with_answers,
         count(*) filter (where is_drill) as drill
  FROM textbook_question;"
# Expected: 1000–2000 questions, 500–800 concepts
```

---

## What NOT to do

- Do NOT call Vision on every page — probe first, skip text-only pages
- Do NOT write to `question` table — only to `textbook_question`
- Do NOT set `protected = false` on any textbook record
- Do NOT process full PDF without passing 30-page test
- Do NOT modify corpus_agent or any existing agent
- Do NOT hardcode paths — use .env and argparse

---

## Files to create

| File | Notes |
|---|---|
| `home_services/pdf_ingest_agent/main.py` | FastAPI :4710 |
| `home_services/pdf_ingest_agent/core/job_store.py` | SQLite job registry |
| `home_services/pdf_ingest_agent/core/pdf_reader.py` | PyMuPDF + needs_vision() |
| `home_services/pdf_ingest_agent/core/vision.py` | OpenAI primary, Claude fallback, cache |
| `home_services/pdf_ingest_agent/core/structure_parser.py` | Haese section/Q patterns |
| `home_services/pdf_ingest_agent/core/cross_linker.py` | Answer matching + drill detection |
| `home_services/pdf_ingest_agent/core/verifier.py` | Per-section gates A1-A4 + final gates 1-7 |
| `home_services/pdf_ingest_agent/core/output_writer.py` | JSONL writer |
| `home_services/pdf_ingest_agent/cli.py` | CLI incl. watch command |
| `home_services/pdf_ingest_agent/requirements.txt` | |
| `home_services/pdf_ingest_agent/.env.example` | |
| `home_services/home_orchestrator/routers/ingest.py` | Proxy router |
| `tutor_skufs/backend/alembic/versions/XXXX_add_textbook_tables.py` | |
| `tutor_skufs/backend/app/models/textbook.py` | ORM: SourceDocument, TextbookQuestion, TextbookConcept |
| `tutor_skufs/source_docs/README.md` | Update with file entries |

After completion, append to `tutor_macbook/MEMORY.md`:
```markdown
### 2026-05-17 — pdf_ingest_agent :4710

PDF probe revealed: Unnamed-T3 custom math font — Vision required for ~70%
of pages. TOC empty — structure detected via regex patterns. Blue/drill
question detection via answer cross-link (not color). Answers PDF = full
worked solutions, not just final answers.
Vision: OpenAI gpt-4o primary, Claude fallback.
Verification: per-section (Gates A1-A4) + LLM spot-check (2-3 Qs/section,
gpt-4o) + 7 final gates. Protected=true on all textbook records.
```
