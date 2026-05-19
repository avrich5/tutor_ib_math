# ADDENDUM to TASK_pdf_ingest_agent.md
# TOC parsing + colour-coded question system

**Append this to TASK_pdf_ingest_agent.md before implementation.**

---

## New probe findings — read before Stage 1

### 1. TOC is parseable from text (pages 5–6)

`doc.get_toc()` returns empty, but pages 5–6 contain a clean text-based
table of contents that PyMuPDF extracts perfectly. Parse it in Stage 0.

**TOC format (confirmed from probe):**

```
Chapter 1 \nCounting principles . . . . . 2
 1A Basic techniques . . . . . 4
 1B Problem solving . . . . . 11
Chapter 2 \nAlgebra . . . . . 16
 2A Extension of the binomial theorem... 18
...
```

**TOC parsing regex:**

```python
import re

CHAPTER_TOC_RE = re.compile(
    r'^Chapter\s+(\d+)\s*\n([^\n.]+?)\.{2,}\s*(\d+)$', re.MULTILINE
)
SECTION_TOC_RE = re.compile(
    r'^\s+(\d+[A-Z])\s+([^\n.]+?)\.{2,}\s*(\d+)$', re.MULTILINE
)

def parse_toc(doc) -> list[dict]:
    """
    Parse table of contents from text pages (pages 5-6 in Haese AA HL).
    Returns list of:
      {"kind": "chapter", "number": "1", "title": "Counting principles", "page": 2}
      {"kind": "section", "ref": "1A", "title": "Basic techniques",
       "chapter": "1", "page": 4}
    """
    toc_entries = []
    current_chapter = None

    # Scan first 10 pages for TOC (safe upper bound)
    for i in range(min(10, doc.page_count)):
        text = doc[i].get_text()
        if 'Chapter 1' not in text and 'Contents' not in text:
            continue

        for m in CHAPTER_TOC_RE.finditer(text):
            num, title, page = m.group(1), m.group(2).strip(), int(m.group(3))
            current_chapter = num
            toc_entries.append({
                "kind": "chapter", "number": num,
                "title": title, "page": page
            })

        for m in SECTION_TOC_RE.finditer(text):
            ref, title, page = m.group(1), m.group(2).strip(), int(m.group(3))
            toc_entries.append({
                "kind": "section", "ref": ref,
                "chapter": ref[:-1],  # "1A" → chapter "1"
                "title": title, "page": page
            })

    return toc_entries
```

**How TOC is used in Stage 1:**

Instead of detecting sections purely from text patterns on each page,
use the TOC as the **primary section map**. For each TOC entry we know:
- Exact `page_start`
- `page_end` = next entry's `page_start - 1`
- `chapter`, `section_ref`, `title` — no regex needed on content pages

Stage 1 becomes:
```
1. parse_toc() → authoritative section list
2. For each section: page_start and page_end already known
3. Regex scan is now only a FALLBACK for pages that fall between
   TOC entries (e.g. Mixed Practice, chapter summaries)
4. Save toc_entries to meta.json alongside section_map
```

This eliminates the main source of section boundary errors.

**TOC known content (from probe, for reference):**

```
Ch 1  Counting principles           p2
  1A  Basic techniques              p4
  1B  Problem solving               p11
Ch 2  Algebra                       p16
  2A  Extension of binomial theorem p18
  2B  Partial fractions             p22
  2C  Systems of linear equations   p25
Ch 3  Trigonometry                  p34
  3A  Further trig functions        p36
  3B  Compound angle identities     p44
Ch 4  Complex numbers               p56
  4A  Cartesian form                p58
  4B  Modulus-argument & Euler form p65
  4C  Complex conjugate roots       p74
  4D  Powers and roots              p79
  4E  Trig identities               p87
Ch 5  Mathematical proof            p94
  5A  Proof by induction            p96
  5B  Proof by contradiction        p102
  5C  Disproof by counterexample    p104
Ch 6  Polynomials                   p108
  6A  Graphs and equations          p110
  6B  Factor and remainder theorems p118
  6C  Sum and product of roots      p122
Ch 7  Functions                     p132
  7A  Rational functions            p134
  7B  Solutions g(x) ≥ f(x)        p139
  7C  |f(x)| and f(|x|) graphs     p143
  7D  1/f(x), f(ax+b), [f(x)]² graphs p151
  7E  Properties of functions       p163
Ch 8  Vectors                       p176
  8A  Introduction to vectors       p178
  8B  Vectors and geometry          p190
  8C  Scalar product and angles     p199
  8D  Equation of line in 3D        p207
  8E  Intersection of lines         p221
  8F  Vector product and areas      p226
  8G  Equation of a plane           p234
  8H  Angles and intersections      p242
Ch 9  Probability                   p262
  9A  Bayes' theorem                p264
  9B  Variance of discrete RV       p270
  9C  Continuous random variables   p274
Ch 10 Further calculus              p294
  10A Fundamentals of calculus      p297
  10B L'Hôpital's rule              p306
  10C Implicit differentiation      p310
  10D Related rates of change       (p310+)
  ... (pages 6 cut off — parse at runtime)
```

---

### 2. Colour-coded question system — fully documented (p7–8)

The introduction explicitly describes the colour system. This is authoritative.
No inference needed — it's in the text.

**Four difficulty levels (confirmed):**

| Colour | Level | Description | IB target |
|--------|-------|-------------|-----------|
| **Green** (1) | Standard | Standard techniques, few processes | All candidates |
| **Blue** (2) | Medium | Tactical decisions, multiple procedures | Medium HL grades |
| **Red** (3) | Hard | Creative problem-solving, extended procedures | Top HL grades |
| **Black** (4) | Enrichment | Beyond IB expectations | Very best students |

**Drill questions** (numbered 1–N, two parts a/b):
- No colour code
- Paired: if you get `a` right, skip `b`; if wrong, `b` is a retry
- No answers in solutions manual ("excludes drill questions")
- `is_drill: true`, `has_answer: false`

**Problem-solving questions** (colour-coded, higher numbers in each exercise):
- Appear after drill questions in each exercise section
- Have worked solutions in the companion PDF
- `is_drill: false`, `difficulty` mapped from colour (1=green, 2=blue, 3=red, 4=black)

**Also present:**
- **Mixed Practice** at end of each chapter: colour-coded + IB past paper questions
- **Practice exam papers** at end of book (3 papers)

**Detection in output records:**

```python
# Map colour label → difficulty integer
COLOUR_DIFFICULTY = {
    "green": 1,
    "blue": 2,
    "red": 3,
    "black": 4,
    "drill": None,   # difficulty not applicable for drill
}

# In exercise_question record:
{
  "record_type": "exercise_question",
  ...
  "is_drill": True,          # True for numbered drill pairs (1a/1b, 2a/2b...)
  "colour": "blue",          # "green"|"blue"|"red"|"black"|null (null = drill)
  "difficulty": 2,           # 1-4 from colour, null for drill
  "has_answer": False,       # True only for colour-coded questions
  ...
}
```

**Detection heuristic (Vision prompt addition):**

Add to `VISION_PROMPT`:
```
Colour-coded question detection:
- Drill questions: numbered 1a/1b, 2a/2b pairs, no colour marker, appear first
- Green questions: marked with a green circle/dot or [1] marker — difficulty 1
- Blue questions: marked with a blue circle/dot or [2] marker — difficulty 2
- Red questions: marked with a red circle/dot or [3] marker — difficulty 3
- Black questions: marked with a black diamond or [4] marker — difficulty 4

For each exercise_question, set:
  "is_drill": true if it's a numbered a/b pair without colour
  "colour": "green"|"blue"|"red"|"black"|null
  "difficulty": 1|2|3|4|null
```

**Cross-check with answers PDF:**
After cross-linking, validate: every question with `has_answer: true` should
have `is_drill: false`. Any mismatch → log `COLOUR_MISMATCH` to errors.jsonl.

---

### 3. Additional content types (from introduction, p7–8)

Beyond theory/worked_example/exercise_question, also present:

| Kind | Description | record_type |
|------|-------------|-------------|
| ESSENTIAL UNDERSTANDINGS | Chapter opener, key ideas summary | `chapter_intro` |
| KEY POINTS | Blue-bordered boxes with rules/formulae | `key_point` |
| WORKED EXAMPLES | Two-column format (thinking / writing) | `worked_example` |
| Be the Examiner | Three solutions, find the correct one | `be_the_examiner` |
| Making connections | Cross-topic link note | `connection_note` |
| Mixed Practice | End-of-chapter colour-coded + IB past paper | `mixed_practice` |
| Practice exams | 3 full IB-style exam papers at end | `practice_exam` |

Add these to the `kind` enum in the Vision prompt and output schema.

**`be_the_examiner`** is particularly valuable — three solutions to the same
problem, one correct. Store all three as:
```json
{
  "record_type": "be_the_examiner",
  "stem_md": "...",
  "solutions": [
    {"label": "Alex", "steps": [...], "is_correct": null},
    {"label": "Ben",  "steps": [...], "is_correct": null},
    {"label": "Cara", "steps": [...], "is_correct": null}
  ]
}
```
`is_correct` left null — LLM spot-check in Gate B determines which is correct.

---

### 4. "Answers at the back of the book" (p8)

> *"Answers to all exercises can be found at the back of the book."*

This means the **main PDF itself** may contain short answers at the back
(in addition to the companion worked solutions PDF). Check last 30 pages
of main PDF for an answers section.

```python
# In Stage 0 probe, add:
def find_back_answers(doc) -> tuple[int, int] | None:
    """Check if last 30 pages of main PDF contain an answers section."""
    for i in range(doc.page_count - 30, doc.page_count):
        text = doc[i].get_text()
        if re.search(r'^Answers', text, re.MULTILINE | re.IGNORECASE):
            return (i + 1, doc.page_count)  # (start_page, end_page), 1-indexed
    return None
```

If found: parse as a third source (in addition to companion PDF).
Short answers from back of book are often more complete for drill questions
than the companion worked solutions PDF.

---

### 5. IB past paper questions in Mixed Practice

Page 8 states: *"questions taken directly from past IB Diploma Mathematics
exam papers"* appear in Mixed Practice sections.

These should be flagged:
```json
{
  "record_type": "exercise_question",
  ...
  "section_kind": "mixed_practice",
  "source_hint": "ib_past_paper",   // flag, not a guarantee
  "protected": true
}
```

Do NOT attempt to identify which specific past paper they came from —
that requires copyright research. Just flag `source_hint: "ib_past_paper"`.

---

### 6. Updated Stage 1 implementation

Replace the original Stage 1 description with:

```
Stage 1 — Structure detection (revised)

Step 1a: Parse TOC from pages 5–6 (parse_toc())
  → authoritative section map: chapter + section_ref + title + page_start
  → compute page_end = next_section.page_start - 1
  → save toc_entries to meta.json

Step 1b: Detect non-TOC page ranges
  Scan for page ranges not covered by TOC entries:
  - Back-of-book answers section (find_back_answers())
  - Practice exam papers (3 papers near end)
  - Front matter (introduction, p7-8 — skip, text-only)
  Add these to section_map with appropriate kind

Step 1c: Validate section map
  Assert: every page 9..end_of_exercises is covered by exactly one section
  Assert: section page ranges are non-overlapping and contiguous
  Assert: TOC page numbers match actual text on those pages
    (sample check: does page TOC[i].page contain exercise_ref TOC[i].ref?)

Step 1d: Report
  "TOC parsed: 47 sections across 13 chapters + 3 practice exams + answers"
  "Section map coverage: 483 / 491 pages (8 pages front matter skipped)"
  Save to meta.json.
```

---

### 7. section_id naming convention (updated)

Use TOC data for stable, human-readable section IDs:

```python
# Format: ch{NN}_{ref}_{slug}
# Examples:
"ch01_1A_basic_techniques"
"ch04_4C_complex_conjugate_roots"
"ch10_10C_implicit_differentiation"
"back_answers"
"practice_exam_1"
```

This makes section files in `jobs/{id}/sections/` self-documenting.

---

### 8. Updated acceptance criteria (addendum)

Add to the acceptance test:

```bash
# TOC parsing
cat jobs/haese_p30/meta.json | python3 -c "
import sys, json
m = json.load(sys.stdin)
toc = m.get('toc_entries', [])
chapters = [e for e in toc if e['kind']=='chapter']
sections = [e for e in toc if e['kind']=='section']
print(f'Chapters: {len(chapters)}')   # expected: >= 3 (for first 30 pages)
print(f'Sections: {len(sections)}')   # expected: >= 4
print('First chapter:', chapters[0] if chapters else 'NONE')
# → Chapters: 3, first = {'kind':'chapter','number':'1','title':'Counting principles','page':2}
"

# Colour-coded questions present
cat jobs/haese_p30/output.jsonl | python3 -c "
import sys, json
recs = [json.loads(l) for l in sys.stdin if l.strip()]
qs = [r for r in recs if r['record_type']=='exercise_question']
drill  = sum(1 for q in qs if q.get('is_drill'))
colour = sum(1 for q in qs if not q.get('is_drill'))
green  = sum(1 for q in qs if q.get('colour')=='green')
blue   = sum(1 for q in qs if q.get('colour')=='blue')
print(f'Drill: {drill}, Colour-coded: {colour}')
print(f'Green: {green}, Blue: {blue}')
# → Drill questions present, at least some colour-coded questions
"
```

---

### Summary of changes to original task

| Area | Original | Updated |
|------|----------|---------|
| Stage 1 source | Regex on all pages | **TOC parse first**, regex as fallback |
| Section map | Inferred from text | **Authoritative from TOC** |
| Blue question detection | Color fill detection | **Cross-link + colour label in Vision** |
| Difficulty levels | binary drill/non-drill | **4 levels: green/blue/red/black** |
| Content types | 4 types | **8 types** incl. be_the_examiner, mixed_practice |
| Back answers | Not mentioned | **Check last 30 pages of main PDF** |
| IB past papers | Not mentioned | **Flag source_hint in Mixed Practice** |

