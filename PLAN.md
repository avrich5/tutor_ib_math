# PLAN — Architecture pivot to textbook-first

**Created:** 2026-05-21
**Status:** Active. Replaces all prior implicit assumptions about content sourcing.

---

## Why this document exists

Phase 5.5 finished with Haese AA HL loaded into `textbook_*` tables (193 concepts, 1258 questions, 1099 with embeddings). But the entire frontend (Dashboard, TopicList, TopicDetail, Session, ConceptDetail) was built around the curriculum schema (`topic` → `concept` → `question`) and is blind to textbook content. RAG in chat is the only consumer of textbook data.

Root cause: the original SPEC said "content = LLM generation + open sources" without explicitly designating the textbook as primary. Every TASK since then reinforced curriculum-first. Result: 1258 textbook questions and 193 textbook concepts are unreachable from the UI.

The user's original intent (now made explicit): **textbook is primary, generation is invisible filler.**

---

## The pivot — one sentence

The `question`, `concept`, and `hint` tables become **thin unified pointers**: each row carries `source_type` (`textbook` | `generated`) and `source_id` (UUID into the real source row). Routers and frontend keep reading from `question` / `concept` / `hint`. Content swaps underneath without API or UI changes.

---

## Why this is minimum-cost

- **Routers: 0 changes.** `topics.py`, `sessions.py`, `attempts.py`, `questions.py`, `progress.py` keep `SELECT FROM question`.
- **Frontend: 0 changes.** Dashboard / TopicList / Session / ConceptDetail / ProgressView all keep working.
- **Existing data preserved.** All 34 generated questions, 102 hints, 5 attempts, 3 srs_cards remain — just tagged `source_type='generated'`. They are the "asset that will be useful" the user named.
- **SRS, attempts, embeddings work unchanged.** They live on the unified table.
- **Chat / RAG keeps working.** `services/rag.py` already reads `textbook_*` directly; not touched.
- **Reversible.** If the pivot is wrong, drop the two columns and the seed rows. Nothing else was modified.

---

## What changes (high level)

1. Migration: add `source_type` + `source_id` columns to `question`, `concept`, `hint`. Add CHECK constraint. Backfill existing rows with `source_type='generated'`.
2. Seed: `INSERT INTO question SELECT ... FROM textbook_question` mapping textbook rows into unified `question` rows. Same for `concept` from `textbook_concept`.
3. Sync: trigger on UPDATE of `textbook_question` / `textbook_concept` updates the mirrored `question` / `concept` row.
4. Hint provisioning for textbook questions: when sessions request a hint and the question's `source_type='textbook'`, look up the nearest textbook_concept (via `related_example_ids` or embedding similarity) and serve it as tier-1 hint: *"Recall from §10B: [theorem]"*. This is the "smart hint" pattern the user originally described ("вспомни что говорилось в теореме такой-то").
5. Ordering in `/sessions/{id}/next`: textbook rows come first; generated fills in when textbook for the topic is exhausted. Student sees no difference.

---

## What is NOT done in this pivot

- **No frontend changes.** TopicList, Session, ConceptDetail keep their current UI.
- **No router rewrites.**
- **No topic tree restructuring.** Existing 76 topics stay as-is. textbook_question.topic_id is NULL for now — they appear under an "Unassigned" pseudo-topic in the UI until classification (separate task).
- **No deletion of generated content.** Sacred.
- **No changes to `pdf-schema-v2` branch or `textbook_*` schema.** Those are upstream sources, treated as read-only by the pivot.
- **No changes to chat / RAG.** It already works directly against textbook_*.

---

## After this pivot — natural follow-ups

- **Topic classification** (optional, separate task): fill `textbook_question.topic_id` so the existing TopicList shows textbook content under proper IB topics. Until done, everything still works via "Unassigned".
- **Frontend Textbook browser** (optional): if user wants to navigate Haese by chapter/exercise (not by IB topic), add `/textbook/*` routes. Not required for the pivot to be useful — the unified `question` table already exposes everything via existing UI.
- **Haese chapter 10 ingest** (parallel track): finish remaining sections (ch10_10A–10E mentioned by Claude Code). Will auto-flow through the sync trigger.
