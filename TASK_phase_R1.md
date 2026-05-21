# TASK — Phase R1 (Textbook-first content pivot)

**Created:** 2026-05-21
**Source of truth:** `~/tutor_skufs/TASK_phase_R1.md`
**Read first:** `PLAN.md`, `MEMORY.md` "ACTIVE ARCHITECTURE" block
**Mode:** Run all 5 stages straight through. No sign-off between stages. Final commit at the end.

---

## 0. Goal

Make textbook content (1258 questions + 193 concepts in `textbook_*` tables) reachable through the existing curriculum API surface (`question`, `concept`, `hint`) without changing routers or frontend.

Mechanism: turn `question` / `concept` / `hint` into thin unified tables with `source_type` + `source_id` pointers. Backfill existing 34 generated questions as `source_type='generated'`. Mirror textbook rows into them via INSERT + UPDATE trigger.

After this task:
- The frontend Session screen serves textbook questions through `/sessions/{id}/next` with zero code change.
- Existing 34 generated questions remain alive and reachable.
- Chat / RAG keeps working unchanged.

---

## 1. Locked constraints

| Constraint | Rule |
|---|---|
| Routers | DO NOT modify any router under `backend/app/routers/`. Zero changes. |
| Frontend | DO NOT modify any file under `frontend/src/`. Zero changes. |
| Generated data | DO NOT delete or migrate destructively. The 34 generated questions + 102 hints + 5 attempts + 3 srs_cards are the user's asset. |
| `textbook_*` schema | Read-only. DO NOT modify columns. DO NOT add FKs into it. |
| `pdf-schema-v2` branch | DO NOT touch. Out of scope. |
| Chat / RAG | DO NOT modify `services/rag.py`, `services/chat_context.py`, or `routers/chat.py`. |
| Auth, SRS, attempts | DO NOT modify. They work on unified `question.id`. |
| Topic tree | DO NOT restructure. textbook_question.topic_id stays NULL. UI will show them under "Unassigned" naturally. |

---

## 2. Stage 1 — Migration

Create new Alembic migration `add_source_pointers_to_unified_tables`.

Adds to **`question`**:
- `source_type` TEXT NOT NULL DEFAULT 'generated'
- `source_id` UUID NULL
- CHECK constraint: `source_type IN ('generated', 'textbook')`
- Composite index: `(source_type, source_id)` for sync lookups
- Unique constraint: `(source_type, source_id) WHERE source_id IS NOT NULL` — prevents duplicate mirroring

Same three columns added to **`concept`** and **`hint`** with same constraints.

Migration up:
1. Add columns nullable
2. Backfill: `UPDATE question SET source_type='generated' WHERE source_type IS NULL` (same for concept, hint)
3. ALTER COLUMN SET NOT NULL on source_type
4. Add CHECK, index, unique constraint

Migration down: drop the three columns and their constraints/indexes. No data loss for existing generated rows.

Run: `alembic upgrade head`. Verify: `psql -d tutor_ib_math -c "SELECT source_type, COUNT(*) FROM question GROUP BY source_type"` → returns `generated | 34`.

---

## 3. Stage 2 — ORM model update

Update `backend/app/models/question.py`, `concept.py`, `hint.py`:

Add to each:
```python
source_type: Mapped[str] = mapped_column(String, nullable=False, default="generated")
source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
```

Do NOT add relationships to `TextbookQuestion` / `TextbookConcept`. The pointer is intentionally loose — sync is via trigger, not ORM cascade. Reason: avoid SQLAlchemy session conflicts when both unified and textbook tables are queried in the same transaction.

Verify: `python -c "from app.models import Question; print([c.name for c in Question.__table__.columns])"` includes `source_type, source_id`.

---

## 4. Stage 3 — Seed textbook → unified

Create `scripts/seed_textbook_to_unified.py`. Idempotent (safe to re-run).

For each row in `textbook_question`:
1. Skip if `EXISTS (SELECT 1 FROM question WHERE source_type='textbook' AND source_id=tb.id)`.
2. INSERT into `question`:
   - `id` = new UUID
   - `source_type` = 'textbook'
   - `source_id` = `tb.id`
   - `topic_id` = `tb.topic_id` (NULL for now, that's fine)
   - `stem_md` = `tb.stem_md`
   - `kind` = `'free_expression'` (default — textbook questions don't have explicit kind; can refine later if needed)
   - `difficulty` = `tb.difficulty` if not NULL else 3
   - `status` = `'approved'`
   - `reference_answer` = NULL (textbook answers live in `textbook_solution`, currently empty — that's fine, math_agent will handle ungraded textbook questions as "self-graded" until solutions land)
   - `embedding` = `tb.embedding` (carry over so RAG-style queries on `question.embedding` see textbook content too)
   - other columns: sensible defaults / NULL

For each row in `textbook_concept`:
1. Skip if already mirrored.
2. INSERT into `concept`:
   - `id` = new UUID
   - `source_type` = 'textbook'
   - `source_id` = `tc.id`
   - `topic_id` = `tc.topic_id` (NULL)
   - `title` = `tc.label` or `tc.section_title`
   - `summary_md` = `tc.text_md`
   - `embedding` = `tc.embedding`

Do NOT seed hints from textbook — they will be generated on-demand in Stage 5.

Run: `python scripts/seed_textbook_to_unified.py`. Expected output: "Inserted 1258 questions and 193 concepts as source_type='textbook'." Re-run: "Inserted 0 questions and 0 concepts (already mirrored)."

Verify:
```
SELECT source_type, COUNT(*) FROM question GROUP BY source_type;
-- generated | 34
-- textbook  | 1258
```

---

## 5. Stage 4 — Sync trigger

Create migration `add_textbook_sync_triggers`.

Two PL/pgSQL functions:

```
CREATE FUNCTION sync_textbook_question_to_unified() RETURNS trigger AS $$
BEGIN
  UPDATE question
  SET stem_md = NEW.stem_md,
      difficulty = COALESCE(NEW.difficulty, 3),
      embedding = NEW.embedding,
      topic_id = NEW.topic_id
  WHERE source_type = 'textbook' AND source_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_textbook_question
  AFTER UPDATE ON textbook_question
  FOR EACH ROW EXECUTE FUNCTION sync_textbook_question_to_unified();
```

Same pattern for `textbook_concept` → `concept` (sync `summary_md` from `text_md`, `title` from `label`/`section_title`, `embedding`, `topic_id`).

Also: trigger on INSERT into textbook_question/textbook_concept → auto-mirror into unified (so future ch10 ingest flows automatically without re-running the seed script).

```
CREATE FUNCTION mirror_new_textbook_question() RETURNS trigger AS $$
BEGIN
  INSERT INTO question (id, source_type, source_id, topic_id, stem_md, kind, difficulty, status, embedding)
  VALUES (gen_random_uuid(), 'textbook', NEW.id, NEW.topic_id, NEW.stem_md, 'free_expression',
          COALESCE(NEW.difficulty, 3), 'approved', NEW.embedding)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mirror_new_textbook_question
  AFTER INSERT ON textbook_question
  FOR EACH ROW EXECUTE FUNCTION mirror_new_textbook_question();
```

Same for textbook_concept.

Verify: pick any textbook_question, do `UPDATE textbook_question SET stem_md='TEST EDIT' WHERE id=...`, then `SELECT stem_md FROM question WHERE source_id=...` should show `'TEST EDIT'`. Revert the edit after verifying.

---

## 6. Stage 5 — Smart hints for textbook questions

The trickier part. When `/questions/{id}/hint?tier=N` is called and the question's `source_type='textbook'`, the existing handler in `routers/questions.py` will find zero rows in `hint` (we did not seed hints). It will return 404 or empty.

Fix: change behavior **inside the hint lookup service**, NOT inside the router. Add a service `backend/app/services/hint_resolver.py`:

```python
def resolve_hint(db, question_id, tier):
    # 1. Try direct lookup in hint table (works for generated)
    h = db.query(Hint).filter_by(question_id=question_id, tier=tier).first()
    if h:
        return h

    # 2. If question is from textbook, derive hint from related textbook_concept
    q = db.query(Question).filter_by(id=question_id).first()
    if q and q.source_type == 'textbook':
        return _derive_textbook_hint(db, q, tier)

    return None
```

`_derive_textbook_hint` strategy:
- Look up `textbook_question` by `source_id=q.source_id`.
- Tier 1: nearest `textbook_concept` of `kind IN ('theorem', 'definition')` by embedding cosine similarity, formatted as: `"Recall from §{chapter}: {label} — {first 200 chars of text_md}"`.
- Tier 2: nearest `textbook_concept` of `kind='worked_example'` — formatted as: `"This is similar to the worked example in §{chapter}: {label}. {summary}"`.
- Tier 3: full text of the textbook_question's first related `textbook_concept` of `kind='worked_example'` (via `related_example_ids` if present, otherwise semantic similarity).

Important: this service returns hint **content**, not an INSERT into `hint` table. Textbook hints are derived on-demand, not stored. This keeps the `hint` table clean (only generated hints land there persistently).

Now wire it: open `backend/app/routers/questions.py`, find the `/questions/{id}/hint` handler, replace its direct `Hint` query with a call to `resolve_hint(db, ...)`. This is the **only router change** in the entire task, and it is minimal — replace ~5 lines.

If the response shape is different between Hint ORM object and the derived dict, normalize at the boundary (the service returns a dict shaped like `{tier: N, content_md: "...", source: "textbook|generated"}`).

Verify: pick a textbook_question id from unified `question`, curl `GET /questions/{id}/hint?tier=1` with auth → returns a hint string referencing a textbook concept.

---

## 7. Final acceptance

Run all the following in sequence. If any fails, fix before declaring done.

```bash
# Migrations applied
alembic current  # → latest revision

# Counts
psql -d tutor_ib_math -c "SELECT source_type, COUNT(*) FROM question GROUP BY source_type;"
# Expected: generated | 34, textbook | 1258
psql -d tutor_ib_math -c "SELECT source_type, COUNT(*) FROM concept GROUP BY source_type;"
# Expected: generated | 0, textbook | 193

# Sync trigger works
psql -d tutor_ib_math -c "UPDATE textbook_question SET stem_md=stem_md WHERE id=(SELECT id FROM textbook_question LIMIT 1);"
# Should not error.

# Existing routers still work
curl -u user:pass http://localhost:4800/topics | jq '. | length'      # > 0
curl -u user:pass http://localhost:4800/sessions/today | jq '.due_count, .topics'

# Textbook content reachable via existing routes
# (Find a textbook question id, hit hint endpoint)
TBQ_ID=$(psql -d tutor_ib_math -tc "SELECT id FROM question WHERE source_type='textbook' LIMIT 1;" | tr -d ' ')
curl -u user:pass "http://localhost:4800/questions/${TBQ_ID}/hint?tier=1"
# Expected: JSON with content_md referencing a textbook concept.

# Frontend smoke test (manual)
# Open http://192.168.1.11:5200 → Session → start session → see a textbook question render correctly.
```

---

## 8. Wrap-up steps

1. Update `MEMORY.md`: append a "Phase R1 completed" entry under the existing `## Decisions` log, noting concrete counts and the new acceptance commands.
2. Update `SPEC.md`:
   - Section 5 (Data model): document the `source_type` / `source_id` pattern on `question`, `concept`, `hint`.
   - Section 6 (API): no changes (that's the point).
   - Section 8 (Hints): describe the derive-from-textbook tier strategy.
3. Commit everything as one commit on `main`: `feat(phase-R1): textbook-first content pivot — unified pointers + sync triggers + smart hints`.
4. Push to origin. Pull on MacBook.

---

## 9. Out of scope (do NOT attempt)

- Frontend changes (TopicList showing source badge, etc.) — separate future task.
- Topic classification (filling `textbook_question.topic_id`) — separate future task.
- Textbook chapter/section browse UI — separate.
- Modifying or extending `chat.py`, `rag.py`, `chat_context.py`.
- Touching `pdf-schema-v2` branch.
- Generating any new content (LLM calls for hints or questions).
- Deleting or "cleaning up" any existing data.
