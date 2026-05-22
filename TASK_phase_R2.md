# TASK — Phase R2 (Real grading end-to-end)

**Created:** 2026-05-21
**Source of truth:** `~/tutor_skufs/TASK_phase_R2.md`
**Mode:** Run all stages straight through. No sign-off between stages. Final commit at the end.

---

## 0. The problem in one screen

The student opens Session, sees a question, enters an answer in MathLive (LaTeX string), submits — and the answer is **always graded wrong**, even when mathematically correct. Database evidence: 9 attempts so far, 0 marked correct.

Sample attempts (real data):

| Student answer | Reference answer | Should be |
|---|---|---|
| `6x+5` | `6*x + 5` | correct |
| `3\cdot\exponentialE^{3x}-\frac{1}{x}` | `3*exp(3*x) - 1/x` | correct |
| `55` | `Total choices: 5 ൈ11 ൌ55` (garbled PDF Unicode) | correct |
| `\left(3\cdot x^2\right)\cdot\left(\cos x` | `3*x**2*cos(x) - x**3*sin(x)` | correct |

Root cause: `_grade()` in `backend/app/routers/attempts.py` falls back to `student_answer.strip() == reference_answer.strip()` for `free_expression` because the orchestrator call inside it has an async bug (`asyncio.get_event_loop().run_until_complete()` in already-running event loop).

---

## 1. The goal

After this task: the full **submit → grade → feedback** flow works for both textbook and generated questions, recognizing mathematically equivalent answers including LaTeX from MathLive and garbled Unicode reference answers.

Definition of done lives in section 6.

---

## 2. Locked constraints

| Constraint | Rule |
|---|---|
| Architecture | All math grading goes through `orchestrator:4700/v1/math/check-answer` with `X-API-Key`. DO NOT call `math_agent:4706` directly. The orchestrator route exists, works, returns `{"equivalent": true/false, "feedback_md": "...", "method": "..."}`. Verified via curl. |
| `orchestrator_client.py` | Stays as it is on `main` (commit `58501c8`). The original signature works. Optional additions allowed (see Stage 2). |
| math_agent on skufs | Already has LaTeX-to-SymPy + LLM fallback. DO NOT modify `~/home_services/math_agent/`. Treat as ready external dependency. |
| Frontend | DO NOT modify any file under `frontend/src/`. The API contract (`POST /attempts` body and response) does NOT change. |
| Existing data | DO NOT delete the 9 attempts, the 34 generated questions, the 1258 textbook questions, the 102 hints. Preserve everything. |
| `pdf-schema-v2` branch | DO NOT touch. |
| Auth, SRS, chat, RAG | DO NOT modify. |
| Topic tree | textbook_question.topic_id is NULL for all 1258. This is a separate task; the grading flow does not require topic_id. |

---

## 3. Current data state (verified 2026-05-21)

```
question total:                      1292
  source_type=generated:               34 (all have reference_answer)
  source_type=textbook:              1258
    with reference_answer:            777
    without reference_answer:         481

attempts total:                         9
  marked correct:                      0  ← the bug

triggers on textbook_question, textbook_concept: 4 (sync + mirror UP/IN)
alembic head: e5f3c1d2a846 (R1 applied)

prod backend: PID 11865, port 4800, launchd com.skufs.tutor-backend
orchestrator: PID running, port 4700, route /v1/math/check-answer works
              with header X-API-Key: hs-f0dc686ec84c494fc38d5804359d695d
math_agent: PID running, port 4706, /check-answer works
```

---

## 4. Stages

Five stages. Run them in order. Do not skip. Do not split. After all five pass, do one final commit.

### Stage 1 — Inventory the gap

Before changing code, measure precisely:

1. Count textbook questions per chapter that lack `reference_answer`:
   ```sql
   SELECT tq.chapter, COUNT(*) AS missing
   FROM textbook_question tq
   JOIN question q ON q.source_type='textbook' AND q.source_id=tq.id
   WHERE q.reference_answer IS NULL
   GROUP BY tq.chapter ORDER BY tq.chapter;
   ```
   Save output as `scripts/_inventory_missing_answers.txt`.

2. Identify the most recent `output.jsonl` (largest, on skufs):
   ```bash
   find ~/home_services/pdf_ingest_agent/jobs -name output.jsonl -exec wc -l {} \; | sort -rn | head -3
   ```

3. Identify how many records in that jsonl have `has_answer: true`:
   ```bash
   python3 -c "import json; print(sum(1 for line in open('PATH') if json.loads(line).get('has_answer')))"
   ```

4. Cross-check: of those with `has_answer=true`, how many would match unfilled `question.reference_answer` rows by `(exercise_ref, question_number)`? Write a small one-off script `scripts/_check_answer_coverage.py` to compute this. Output: "X answered records in JSONL, Y match unfilled questions in DB."

This stage produces information only. No DB changes.

### Stage 2 — Fill missing reference_answer rows

The existing script `scripts/load_textbook_answers.py` is already in working tree (untracked). It writes directly to unified `question` table (which is correct: `textbook_question` has no `reference_answer` column; answers live in `textbook_solution` which is empty, but we are not blocked on that — the unified mirror is the canonical place).

1. Run `scripts/load_textbook_answers.py --dry-run`. Capture the output.
2. If the dry-run number aligns with Stage 1 inventory (or is reasonably close), run it for real: `python3 scripts/load_textbook_answers.py`.
3. Verify with SQL:
   ```sql
   SELECT source_type, COUNT(*) FROM question WHERE reference_answer IS NOT NULL GROUP BY source_type;
   ```
   Expected: generated=34, textbook≥777 (ideally close to 1258).

4. Acceptable if some textbook questions still lack `reference_answer` after this — those are exercises that genuinely have no answer in the textbook (proofs, "show that", "discuss") or weren't extracted by PDF ingest. They will be graded leniently (see Stage 3).

### Stage 3 — Fix `_grade()` in attempts.py

This is the central code change. Read `backend/app/routers/attempts.py` fully first. Understand the current `_grade()` function for `free_expression` branch.

Required changes:

1. Change `_grade()` from `def` to `async def`. Propagate `async` through whatever calls it.

2. The handler `POST /attempts` likely already is async. The call site changes from `correct, feedback = _grade(q, body.student_answer)` to `correct, feedback = await _grade(q, body.student_answer)`.

3. Inside `_grade()` for `free_expression`:
   - If `q.reference_answer is None`: do NOT try to grade. Return `(False, "This question has no auto-graded reference answer. Recorded for review.")`. Mark the attempt with a flag (use existing `correct=False` for now — adding a third state is out of scope).
   - Otherwise call:
     ```python
     from app.services.orchestrator_client import orchestrator
     result = await orchestrator.check_answer(
         student_answer=body.student_answer,
         reference_answer=q.reference_answer,
         answer_format="expression",
         variables=q.variables or [],
     )
     ```
   - Parse the response. The orchestrator returns `{"equivalent": bool, "feedback_md": str, "method": str}`. (Not `correct`. The field name is `equivalent`.)
   - `correct = bool(result.get("equivalent", False))`
   - `feedback = result.get("feedback_md") or ("Correct!" if correct else "Not quite — check your work.")`
   - On any HTTPError or unexpected response shape: catch, log, return `(False, "Could not verify automatically — answer recorded.")`. Do NOT crash the request.

4. Optional but recommended: extend `OrchestratorClient.check_answer()` to accept a `question_stem: str | None = None` parameter and pass `q.stem_md` in the call. This gives the math agent's LLM fallback context for ambiguous answers. The orchestrator route already accepts this parameter. If you do this, the addition is one parameter and one JSON field — no other changes.

DO NOT change anything else in `orchestrator_client.py`. No URL change. No timeout change. No header change. Those would all be regressions.

### Stage 4 — Restart backend and verify end-to-end

1. Restart the launchd service:
   ```bash
   launchctl kickstart -k gui/$(id -u)/com.skufs.tutor-backend
   ```
   Wait 3 seconds. Confirm `/health` returns 200.

2. Manual end-to-end test: pick a textbook question with `reference_answer` set, post an answer via curl:
   ```bash
   # Get a question
   QID=$(psql -d tutor_ib_math -tc "SELECT id FROM question WHERE source_type='textbook' AND reference_answer IS NOT NULL LIMIT 1" | tr -d ' ')

   # Create a session and get the question
   # ... (use existing /sessions, /sessions/{id}/next flow)

   # Submit a correct-equivalent answer
   curl -u son@example.com:$PASSWORD -X POST http://localhost:4800/attempts \
     -H 'Content-Type: application/json' \
     -d "{\"session_id\":\"...\", \"question_id\":\"$QID\", \"student_answer\":\"...known correct value...\", \"hints_used\":0, \"time_seconds\":10}"
   ```
   Expected: `{"correct": true, "feedback_md": "..."}`.

3. Submit a deliberately wrong answer. Expected: `{"correct": false, ...}`.

4. Submit an equivalent-but-differently-formatted answer (e.g. `2x` vs `2*x`). Expected: `{"correct": true, ...}`.

5. Verify the new attempt row in DB:
   ```sql
   SELECT correct, student_answer, LEFT(feedback_md, 60) FROM attempt ORDER BY id DESC LIMIT 3;
   ```

### Stage 5 — Classify textbook topic_id (optional within R2, but cheap)

Run `scripts/classify_textbook_topics.py --dry-run` to see what it would do. If the WARN count is low and the numbers look reasonable, run it for real. Sync triggers will propagate topic_id into unified `question.topic_id` automatically.

Verify:
```sql
SELECT COUNT(*) FROM question WHERE source_type='textbook' AND topic_id IS NOT NULL;
```
Expected: a large fraction of 1258 (exact number depends on slug coverage).

If many slugs were warned as missing — STOP this stage and skip. Topic classification quality is not blocking the grading flow. Note it in the commit message as "partial classification" or "skipped".

---

## 5. Commit + docs

After all five stages pass:

1. `git add` the modified `backend/app/routers/attempts.py`, possibly `backend/app/services/orchestrator_client.py` (if you added `question_stem`), and the two scripts in `scripts/` if they aren't already tracked.

2. **CRITICAL: confirm you are on branch `main` before commit.** Run `git branch --show-current`. If not main: `git checkout main`. Then `git add` and commit.

3. Commit message:
   ```
   feat(phase-R2): real grading end-to-end via orchestrator → math_agent

   - Fix async/await bug in _grade() for free_expression
   - Route grading through orchestrator with X-API-Key (architecture compliant)
   - Handle equivalent → correct field rename from math_agent response
   - Populate reference_answer for N textbook questions (from load_textbook_answers.py)
   - [Stage 5 outcome: classified N textbook questions to IB topics / skipped]

   Before: 9 attempts, 0 correct (primitive string compare).
   After:  end-to-end grading works for LaTeX and Unicode reference answers.
   ```

4. `git push origin main`. On MacBook: `git pull origin main --ff-only`.

5. Append a "Phase R2 completed" entry to `MEMORY.md` under the existing `## Decisions` log with concrete counts.

---

## 6. Definition of done

Pass all of these. If any fails — fix it, don't ship.

```
# Backend healthy
curl -s http://localhost:4800/health | jq .status   # → "ok"

# A textbook question with reference answer exists
psql -d tutor_ib_math -c \
  "SELECT COUNT(*) FROM question WHERE source_type='textbook' AND reference_answer IS NOT NULL;"
# → ≥ 777 (ideally close to 1258)

# Submit '2x' against reference '2*x' returns correct=true
# (use the curl pattern from Stage 4)

# Submit garbage returns correct=false without crashing
# (use the curl pattern from Stage 4)

# A new attempt row in DB has correct=true for at least one test submission
psql -d tutor_ib_math -c "SELECT COUNT(*) FROM attempt WHERE correct=true;"
# → ≥ 1

# Manual UI test: open http://192.168.1.11:5200, start a session,
# submit an answer matching the reference, see "Correct!" feedback.

# Git clean
cd ~/tutor_skufs && git status   # → working tree clean (or only intentional untracked)
git branch --show-current        # → main
git log --oneline -1             # → the R2 commit on main
```

---

## 7. Out of scope (do NOT attempt)

- LLM fallback configuration changes in math_agent (already done by previous session)
- Adding `headers` field rewrites or URL rewrites in `orchestrator_client.py`
- Frontend changes
- New tables, new migrations
- Loading `textbook_solution` separately (skip; we write to unified `question` directly)
- Improving `_grade()` for non-`free_expression` kinds (multiple_choice, ordered_steps, flashcard, free_numeric all stay as they are)
- Adding a "needs manual review" third state to attempts.correct (boolean stays boolean)
- Touching chat, RAG, embeddings, SRS, sessions, hints
- Touching `pdf-schema-v2` branch

---

## 8. If something goes wrong

- If `_grade()` async refactor cascades (calling code is sync) — fix only what's strictly necessary. The handler in attempts.py is already async (verified). The `_grade` is the only sync function that needs to become async.
- If orchestrator returns a different field shape than `{equivalent, feedback_md, method}` — log the full response, stop, ask. Do not guess.
- If `load_textbook_answers.py` writes to a column that doesn't exist — fix the script (it's untracked, free to edit) but flag what was changed in the commit message.
- If `launchctl kickstart` doesn't restart the service — find the correct invocation in the existing plist (`/Users/andriy/Library/LaunchAgents/com.skufs.tutor-backend.plist`). Do not start a competing process on port 4800.
- After context compact: re-read this file from the top before continuing. The constraints in section 2 are the most important part.
