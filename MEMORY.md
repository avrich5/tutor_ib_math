# tutor_ib_math — Project Memory

> Этот файл — append-only лог архитектурных решений. Не удалять старые записи.
> Читать в начале каждой новой сессии перед любыми действиями.

## Machine map

| Machine | Role | Path |
|---|---|---|
| skufs (Mac Mini) | Production, git master | `~/tutor_skufs/` |
| MacBook Pro | Development, mirror | `~/tutor_macbook/` |
| GitHub | Source of truth | `github.com/avrich5/tutor_ib_math` |
| Backblaze B2 | Backups | bucket `tutor-ib` |

**Path rule (важно):** на skufs работают только tilde-пути (`~/tutor_skufs/`),
абсолютные `/Users/andriy/...` не работают. В коде использовать
`os.path.expanduser("~/...")` или переменные окружения. Никакого хардкода.

## Связь с home_services

Tutor — отдельный продукт, который использует инфраструктуру `~/home_services/`
через `home_orchestrator :4700` (X-API-Key auth). Tutor НЕ содержит ключей LLM,
НЕ вызывает LLM/Wolfram/Ollama напрямую. Только через orchestrator.

Новые агенты для tutor добавляются В `~/home_services/`, не в tutor.


## ACTIVE ARCHITECTURE (effective 2026-05-21)

**This block overrides any earlier assumption about content sourcing. Read it first. Old decisions below remain as history; this block wins on conflict.**

### Content model — textbook is primary

Haese Mathematics — Analysis and Approaches HL is the **primary source of truth** for all teaching material: definitions, theorems, formulas, worked examples, exercises. Everything in `textbook_concept` and `textbook_question` is canonical content.

Generated content (`source_type='generated'` in unified tables) is **supplementary filler**, invisible to the student. It exists only to top up practice when the textbook does not have enough drill on a specific skill.

Original user intent (from project kickoff): _"натаскивание по типу Quizlet, но не прямое копирование... понятия, определения, аксиомы и теоремы [from textbook]... умные подсказки типа 'вспомни что говорилось в теореме такой-то'"_. The textbook is what the student returns to. The tutor is a Quizlet-style trainer **on top of** the textbook, not a replacement.

### Unified-pointer pattern (Phase R1)

Tables `question`, `concept`, `hint` carry two columns: `source_type` (`'textbook'` | `'generated'`) and `source_id` (UUID into `textbook_question` / `textbook_concept`, or NULL for generated rows).

- Routers and frontend read from `question` / `concept` / `hint` only. They do NOT know which source a row came from. This is intentional.
- Textbook rows are mirrored into the unified tables via INSERT trigger + UPDATE sync trigger on `textbook_*`. Single source of truth for textbook content stays in `textbook_*`; the mirror is a thin index.
- 34 existing generated questions, 102 hints, 5 attempts, 3 srs_cards are **preserved** and continue to work alongside textbook content. They are an asset, not legacy garbage.

### Hint provisioning

Hints for textbook questions are **derived on demand**, not stored. The pattern: look up the question's chapter and the nearest `textbook_concept` of `kind='theorem'` / `'definition'` / `'worked_example'`, and serve as a hint with format _"Recall from §10B: [theorem]"_. This matches the original "вспомни что говорилось в теореме такой-то" requirement.

Hints for generated questions stay in the `hint` table as before.

### What the topic tree is

The current 76 topics are an **IB syllabus skeleton**, not a content navigation structure. Until classification fills `textbook_question.topic_id`, textbook content appears under "Unassigned" in any topic-based UI. This is acceptable and does not block functionality.

Earlier framing of "Haese chapter 1 = Topic 1" is **rejected**. The IB syllabus topic tree and the Haese chapter structure are different hierarchies. Linking them is a future classification task, not a structural assumption.

### What is NOT changing

- `textbook_*` schema is read-only from the unified layer's perspective.
- Chat / RAG (`services/rag.py`, `services/chat_context.py`) continues to query `textbook_*` directly. Not affected by the pivot.
- Frontend code, routers, SRS engine, attempts, embeddings — unchanged by the pivot.
- The `pdf-schema-v2` branch — still off-limits unless explicitly merged.

### Why this exists

Phases 3, 4, 5, 5.5 built the system curriculum-first because the original SPEC said "content = LLM generation + open sources" without designating the textbook as primary. By the time Haese was loaded (Phase 5.5), the UI and routers were already committed to the curriculum schema. The Phase R1 pivot is the minimum-cost fix: swap the content underneath without rebuilding the layers above.

---

## Decisions (append-only)

### 2026-05-17 — Initial architecture decisions

**Stack:**
- Backend: FastAPI (Python 3.12) + SQLAlchemy 2.x + Alembic migrations
- Database: PostgreSQL with pgvector extension, separate DB `tutor_ib_math`
- Frontend: React + Vite + TypeScript + TailwindCSS + KaTeX + MathLive
- Deploy: launchd plists for backend; nginx for frontend (production stage)
- LLM access: via `home_orchestrator :4700` only

**Why pgvector (not pickle/qdrant/chroma):**
- Postgres already running on skufs at 127.0.0.1:5432
- Transactional consistency between content (questions table) and embeddings
- JOINs and filters in single query ("similar question, topic=Calculus, difficulty 3-4")
- No separate vector DB to maintain

**Why FastAPI for backend (not Django/Flask):**
- Consistent with existing home_services agents (all FastAPI)
- Same dev experience, same launchd pattern, same deploy.sh shape
- Async-first, fits LLM call patterns

**Why no Docker for tutor backend:**
- home_services pattern is launchd, not Docker
- Docker Desktop available on skufs but not used by existing agents
- Postgres is system-level brew install, not in container
- Consistency wins over isolation here

**Why React + Vite + MathLive:**
- MathLive is best-in-class math input (Desmos-tier UX)
- KaTeX for rendering (fast, no MathJax bloat)
- Vite for dev experience and build speed
- TypeScript for refactor safety in a multi-screen app


### 2026-05-17 — LLM provider strategy

**Primary chain:** OpenAI → Anthropic (fallback) → Ollama (local fallback)
**Math-specific:** Wolfram Alpha Full Results API (App ID in env)
**Reasoning-heavy (later):** DeepSeek (when API key provided)
**Embeddings:** Ollama nomic-embed-text (local, free, unlimited)

**Why OpenAI primary instead of Anthropic:**
- User preference (existing translation_agent uses anthropic primary,
  tutor will use openai primary, both are equally supported in the stack)
- Claude reserved as fallback for resilience
- Cost: gpt-4o and claude-sonnet-4 comparable, no strong cost preference

**LLM router lives in `hs_shared/llm_router/`** (NOT in a single tutor agent),
because all 5 new tutor agents need it. Replaces nothing — `translation_agent`
keeps its own translation-specific provider abstraction.

**Wolfram inside llm_router as 5th provider:**
- Lives at `hs_shared/llm_router/wolfram.py`
- NOT routed through standard fallback chain (chat-style)
- Separate method `router.compute(query: str) -> WolframResponse` for math
- Cache results by normalized query in Postgres (table `wolfram_cache`)
- Free tier 2000 req/month — soft limit 1800 (warn), hard 1950 (fallback to SymPy)

### 2026-05-17 — Math correctness contract

**Layered defense against hallucinations:**
1. SymPy validates locally (fast, free, no network)
2. Wolfram validates authoritatively (slow, billable, only at content generation)
3. Reference solutions stored in DB after Wolfram approval
4. Runtime answer checking: SymPy equivalence first, Wolfram only on ambiguity
5. LLM never gives unverified math facts — RAG over verified content only

This mirrors the anti-hallucination contract in `corpus_agent.synthesizer`.


### 2026-05-17 — Agent topology

**Existing in `~/home_services/` (NOT touched):**
- home_orchestrator :4700 — auth + proxy
- translation_agent :4701 — translation only
- format_agent :4702 — docx/pdf/md beautify
- transcribe_agent :4703 — audio to text
- corpus_agent :4704 — DIL positioning RAG (do not generalize, do not refactor)

**New tutor agents added to `~/home_services/`:**
- embedding_agent :4705 — generic embed(text) → vector via Ollama
- math_agent :4706 — SymPy + Wolfram, task validation, answer checking, hints
- progress_agent :4707 — LLM analysis of attempt history (not SRS)
- chat_agent :4708 — RAG-grounded conversational tutor (uses embedding_agent)
- tutor_content_agent :4709 — offline mass task generation (on-demand)

**Why split into 5 agents (not 1 math_agent):**
- User explicitly requested narrow agents for future expansion
- Each agent has different scaling needs (embedding is hot, content is cold)
- Future physics_agent reuses same patterns
- Existing home_services convention: one agent = one purpose

**Why embedding_agent is generic (not corpus_agent):**
- corpus_agent is hardcoded to DIL positioning archive
- User explicitly forbids modifying corpus_agent
- embedding_agent is a thin Ollama wrapper, no domain knowledge
- All storage and retrieval happens in tutor's pgvector

### 2026-05-17 — SRS module

- SRS algorithm (SM-2 / FSRS) lives in tutor backend, NOT in an agent
- Reason: deterministic logic, no LLM, no shared infra concern
- Implementation: separate Python package `tutor_backend/srs/` with clean API
- Goal: portable to other subjects (physics, chemistry) — copy package, plug in
- After MVP proves it works → consider moving to `hs_shared/srs/`


### 2026-05-17 — Scope, audience, content strategy

- **Target user:** son, DP1 (Year 12 IB), studying Math AA HL
- **Curriculum coverage:** all 5 AA HL topics (Number & Algebra, Functions,
  Geometry & Trigonometry, Statistics & Probability, Calculus)
- **Interface language:** English (matches IB exam language)
- **Devices:** desktop and laptop only (no mobile / no tablet first)
- **Access:** home LAN only initially; nginx + email whitelist + domain
  is a Phase 4 task (after MVP works)
- **Content source:** hybrid — offline LLM generation + open IB syllabus
- **Single user MVP, multi-user-ready DB schema** (one .env account hardcoded)

### 2026-05-17 — Chat UX

Built-in tutor chat:
- Right side of screen, full height
- Persistent across sessions, per-session log in DB
- Dynamic textarea height (grows with input up to a cap)
- RAG over knowledge base (concepts, theorems, son's prior solutions)
- Standard reusable UX pattern across user's projects

### 2026-05-17 — Deploy model

- Source of truth: GitHub `avrich5/tutor_ib_math`
- skufs pulls from GitHub on deploy.sh
- MacBook pulls from GitHub via `git pull` (mirror)
- launchd plists for tutor_backend and the 5 new agents in `~/Library/LaunchAgents/`
- `deploy.sh` modeled on `~/home_services/deploy.sh`:
  `git push (local) → ssh skufs "tutor_skufs/deploy.sh" → pull + pip + restart + mirror`
- Backup: nightly `pg_dump tutor_ib_math` + content JSON → B2 bucket `tutor-ib`


### 2026-05-17 — What we explicitly DO NOT touch

Hard "do not touch" list (project memory preserves this rule):
- `~/home_services/corpus_agent/` — DIL-specific RAG, frozen
- `~/home_services/translation_agent/` — works in production, has its own
  provider abstraction (do not migrate it to `hs_shared/llm_router/`)
- `~/home_services/format_agent/` — works in production
- `~/home_services/transcribe_agent/` — works in production
- Existing routers in `home_orchestrator/routers/` — add new ones, don't modify
- Existing entries in `home_orchestrator/config/agents.yaml` — add, don't change
- `~/home_services/.env` files (per user rule)
- Existing launchd plists (per user rule)

### 2026-05-17 — MVP phasing

1. **Phase 1 — Infrastructure agents** (1-2 days)
   embedding_agent, math_agent skeleton (SymPy only), Postgres + pgvector + schema,
   tutor backend skeleton, hs_shared/llm_router/ scaffolding

2. **Phase 2 — Content pipeline** (1-2 days)
   tutor_content_agent, Wolfram integration, generate ~30 questions for one
   topic (Calculus: derivatives), SymPy + Wolfram validation, store in DB

3. **Phase 3 — Frontend MVP** (3-5 days)
   React skeleton, topic screen, lesson screen (one question at a time),
   cards, multiple choice, MathLive input, SRS engine, three-tier hints
   from DB (not live LLM)

4. **Phase 4 — Chat + expansion** (post-MVP)
   chat_agent with RAG, chat UI panel, progress_agent for recommendations,
   remaining 4 AA HL topics, nginx + whitelist + domain

### 2026-05-17 — Phase 2 complete: content pipeline + syllabus anchor

**Phase 2 deliverables (all on skufs, all committed):**

- `home_services/math_agent`: LLM endpoints `/generate-solution` + `/generate-hints` live (v0.2.0)
- `home_services/tutor_content_agent`: full pipeline in `core/generator.py`:
  - fetches `syllabus_item` from DB, injects verbatim IB Subject Guide text into LLM system prompt
  - scope check via `gpt-4o-mini` per question (rejects off-syllabus content)
  - SymPy validation of `reference_answer` parseability
  - solution steps via `math_agent`, 3-tier hints via `math_agent`, embedding via `embedding_agent`
  - inserts with `status='pending_review'`
- `home_services/tutor_content_agent/core/cli.py`: CLI `generate` + `list-topics`
- `tutor_ib_math` DB: `syllabus_item` table (migration `a3f2c8e1d504`)
- 6 `syllabus_item` rows seeded for `calculus.derivatives.*`
- 34 questions in `pending_review` (30 full batch + 4 smoke test)
- `scripts/seed_syllabus.py`, `scripts/wolfram_verify_batch.py`, `scripts/approve_batch.py`

**Two bugs found+fixed during run:**
1. OpenAI `response_format=json` returns `{"questions":[...]}` — robust parser handles all variants
2. `sympy.symbols("x")` returns `Symbol` not tuple — fixed with `isinstance` guard

**Next steps:**
1. Human review pass: `backend/.venv/bin/python scripts/approve_batch.py --topic calculus.derivatives --dry-run`
2. Wolfram verify (if WOLFRAM_APP_ID set): `scripts/wolfram_verify_batch.py`
3. Approve: `scripts/approve_batch.py --topic calculus.derivatives`
4. Phase 3: Frontend MVP

### 2026-05-17 — pdf_ingest_agent :4710

**Location:** `~/home_services/pdf_ingest_agent/`

PDF probe findings:
- `Unnamed-T3` custom math font → Vision required for ~70% pages
- `doc.get_toc()` empty → TOC parsed from pages 5–6 via regex (primary), inline regex as fallback
- Blue/drill question detection: cross-link answers PDF, NOT color fill
- Answers PDF = full worked solutions (not just final answers)
- Back-of-book answers: check last 30 pages of main PDF

Architecture: FastAPI :4710, SQLite job registry, PyMuPDF + Vision pipeline, incremental JSONL output.
Vision: OpenAI gpt-4o primary, Claude claude-sonnet-4-6 fallback, SQLite cache keyed by (pdf_hash, page_num).
Verification: per-section Gates A1-A4 + LLM spot-check (2-3 Qs/section) + 7 final gates.
`protected=true` on all textbook records.

DB: migration `b4e1f9a2c305` adds `source_document`, `textbook_question`, `textbook_concept`.
Orchestrator: `/v1/ingest/*` → proxy to :4710 via `routers/ingest.py`.

**PDF files location (on skufs):** `~/tutor_skufs/source_docs/`
Need to copy or rsync to MacBook before local dry-run/testing.

**Step 1-3 complete (scaffold + probe + smoke test).** Steps 4-10 need actual Haese PDFs.


### 2026-05-21 — Frontend stack corrections (Phase 3)

- **Tailwind отменён.** Едем на vanilla CSS + CSS Modules. Причина: визуальный язык letterform (Plex/Literata/JetBrains Mono) построен на тонкой типографике и CSS custom properties — Tailwind utility-классы не дают нужного контроля.
- **`mathlive-react` убран** как несуществующий пакет. Используем только `mathlive` v0.105+. Интеграция через React `useRef` + императивный API (`mathfield.value`, `addEventListener`).
- **Тема: letterform. Density: compact.** Принимается как продакшн-дефолт. Токены в `src/styles/tokens.css`.
- **Wire format ответа: LaTeX string.** Согласовано с тем что backend хранит `reference_answer` как LaTeX и math_agent умеет парсить LaTeX через SymPy.
- **Статус Phase 3:** frontend scaffold создан, `tsc --noEmit` чист, `npm run dev` стартует на `0.0.0.0:5173`.

### 2026-05-21 — Phase 3 backend + Phase 4 frontend complete

**Backend routers added (all in `backend/app/routers/`):**
- `auth.py` — HTTPBasic single-user dependency; auto-creates `AppUser` row in DB on first call
- `sessions.py` — POST /sessions, GET /sessions/today (with SRS queue + topic list), POST /sessions/{id}/next, POST /sessions/{id}/end; in-memory `_queues` dict (MVP); `KIND_MAP = {"mc": "multiple_choice"}` for DB→frontend kind mapping
- `attempts.py` — POST /attempts with `_grade()` for all question kinds (mc/flashcard/free_numeric local, free_expression via orchestrator with SymPy fallback)
- `questions.py` — GET /questions/{id}/hint?tier=N, GET /questions/{id}/solution
- `users.py` — GET /me
- `topics.py` — GET /topics (tree), GET /topics/{slug:path} (path converter for dot-notation slugs); `_child_slugs()` determines leaf vs category; maps `statement_md→summary_md`
- `concepts.py` — GET /concepts/{id}
- `progress.py` — GET /progress/summary (streak/accuracy/due_today), GET /progress/weak-topics?n=N, GET /progress/activity?days=N

**Frontend new/updated files (src/):**
- `api/types.ts` — all typed interfaces (TodayData, SessionOut, QuestionEnvelope, AttemptOut, TodayTopic, Topic, TopicSummary, Concept, ProgressSummary, WeakTopic, ActivityDay, ActivityData)
- `api/client.ts` — added listTopics, getTopic, getConcept, progressSummary, weakTopics, activity
- `pages/Dashboard.tsx` + `.module.css` — streak card, stats row, due queue with topic links, "Start reviewing" button
- `pages/SessionNew.tsx` — creates session via API and redirects to `/session/:id` (replaces old idle start state)
- `pages/TopicList.tsx` + `.module.css` — tree view with mastery bars
- `pages/TopicDetail.tsx` + `.module.css` — concepts list, mastery bar, due count, Start session button
- `pages/ConceptDetail.tsx` — proof + examples sections, KaTeX rendering
- `pages/ProgressView.tsx` + `.module.css` — streak callout, 30-day activity bar chart (pure CSS, no Plotly), weak-topics accuracy bars
- `components/ui/StatsRow.tsx` + `.module.css`
- `components/layout/AppLayout.tsx` — nav sidebar added (Home / Topics / Progress)
- `App.tsx` — routing: `/`, `/topics`, `/topics/:slug/*`, `/concepts/:id`, `/session/new`, `/session/:sessionId`, `/progress`
- `hooks/useSession.ts` — `preloadedSessionId` param: skips idle, calls nextQuestion directly

**Critical bug fixed before commit:**
- `Session.tsx`: imported but unused `useNavigate` → TS6133. Removed.

**Port:**
- Vite dev server: port **5200** (5173 was occupied by another process)
- `VITE_API_BASE_URL=http://192.168.1.11:4800` in `.env.local` on skufs (browser resolves on MacBook)

**Status:** `tsc --noEmit` clean, all 15 backend routes verified, Vite on :5200.

### Reminder — Phase 4 chat (pending)

При подключении чата (chat_agent + ChatPanel):
1. Убедиться что `chat_session` и `chat_message` пишутся в Postgres (таблицы уже в схеме, см. SPEC раздел 5)
2. Сказать пользователю где просматривать сохранённые сессии.
   Подтверждено: `GET /chat/sessions` достаточно (прямой просмотр на диске тоже возможен, но API удобнее)

### 2026-05-21 — Phase 5 completed (Chat + RAG MVP)

**Что сделано:**
- Backend: `app/routers/chat.py` — sessions CRUD + sync message + SSE streaming (EventSourceResponse)
- Backend: `app/services/chat_context.py` — system prompt builder (current question + weak topics + RAG)
- Backend: `app/services/rag.py` — pgvector cosine search (`question.embedding`), LRU embed cache, hint lookup
- Frontend: `ChatPanel.tsx` — SSE streaming, citation pills, markdown+math, session context auto-attach
- Frontend: `CitationPill.tsx` — hover tooltip, Q=orange/C=green/hint=yellow

**Что НЕ сделано (специально):**
- Haese RAG — Phase 5.5
- UI истории чатов — только терминальная команда ниже
- Token usage UI

**Просмотр чатов из терминала:**
```bash
python3 scripts/dump_chat.py --list          # последние 20 сессий
python3 scripts/dump_chat.py <uuid>          # полный JSON дамп с токенами/ценой
```

**Tech debt:**
- `orchestrator_client.py` вызывает Anthropic API напрямую (не через chat_agent :4708)
  Исправить когда `chat_agent` в `~/home_services/` будет реализован
  ANTHROPIC_API_KEY находится в `tutor_backend/.env` (temp)

### 2026-05-21 — Phase 5.5 completed (Haese textbook RAG)

**Что сделано:**
- Migrations: `b4e1f9a2c305` (textbook tables) + `c7d2e4f1a803` (schema v2)
  — `source_document`, `textbook_concept`, `textbook_question`, `textbook_solution`
- Fix: `embed_text()` в orchestrator_client теперь вызывает embedding_agent :4705 напрямую
  (оркестратор не имел `/v1/embed` эндпоинта — RAG тихо не работал до этого фикса)
- `scripts/load_textbook.py` — идемпотентный загрузчик JSONL → Postgres с эмбеддингами
- В БД: **1258 textbook_question** + **193 textbook_concept** с 768-dim embeddings
- `services/rag.py` — добавлены `_fetch_textbook_concepts()` + `_fetch_textbook_questions()`
- `services/chat_context.py` — форматирует textbook chunks в system prompt

**Команда для перезагрузки данных (если нужно):**
```bash
cd ~/tutor_skufs/backend
# Очистить: psql -d tutor_ib_math -c 'TRUNCATE textbook_concept, textbook_question, textbook_solution, source_document CASCADE;'
.venv/bin/python ../scripts/load_textbook.py            # загрузить все JSONL
.venv/bin/python ../scripts/load_textbook.py --dry-run  # посмотреть что будет
.venv/bin/python ../scripts/load_textbook.py --skip-embed  # без эмбеддингов (быстро)
```

**Источник данных:** `~/home_services/pdf_ingest_agent/jobs/*/output.jsonl`
  (44/59 секций ✅ — ch01-ch10; остаток ch09_9A + mixed ch8-11 pending PDF ingest)

### 2026-05-21 — Phase R1 completed (textbook-first content pivot)

**Что сделано:**
- Migration `d8e4f2a1b395`: added `source_type TEXT NOT NULL DEFAULT 'generated'` + `source_id UUID` to `question`, `concept`, `hint`; made `question.topic_id`, `question.reference_answer`, `concept.topic_id` nullable; added CHECK + unique + composite index on all three tables.
- ORM models updated: `question.py`, `concept.py`, `hint.py` — source_type/source_id fields added; nullable relaxed to match migration.
- Migration `e5f3c1d2a846`: 4 PL/pgSQL triggers — UPDATE sync (textbook→unified) and INSERT mirror (auto-insert new textbook rows) for both question and concept.
- `scripts/seed_textbook_to_unified.py` — idempotent seed of 1258 textbook_question → question + 193 textbook_concept → concept as source_type='textbook'. Concept slugs: `tb-{tc.id}`.
- `services/hint_resolver.py` — resolve_hint(db, question_id, tier): generated → direct hint table; textbook → derive from nearest textbook_concept via embedding cosine similarity. Tier 1=theory/key_point, Tier 2=worked_example, Tier 3=full worked example text. Not stored in hint table.
- `routers/questions.py` hint handler: replaced direct Hint query with `resolve_hint()` call (5-line swap, only router change in entire phase).

**Acceptance commands (run on skufs after alembic upgrade + seed):**
```bash
alembic current   # → e5f3c1d2a846
psql -d tutor_ib_math -c "SELECT source_type, COUNT(*) FROM question GROUP BY source_type;"
# expected: generated | 34,  textbook | 1258
psql -d tutor_ib_math -c "SELECT source_type, COUNT(*) FROM concept GROUP BY source_type;"
# expected: textbook | 193
TBQ_ID=$(psql -d tutor_ib_math -tc "SELECT id FROM question WHERE source_type='textbook' LIMIT 1;" | tr -d ' ')
curl -u user:pass "http://localhost:4800/questions/${TBQ_ID}/hint?tier=1"
```

**Known limitation:** `rag.py` `_fetch_questions` uses INNER JOIN on topic — textbook questions (topic_id=NULL) won't appear in question RAG. They still appear via `textbook_questions` RAG key. Fix deferred (requires rag.py change which is out of scope for R1).
