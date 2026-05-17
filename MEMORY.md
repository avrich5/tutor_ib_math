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
