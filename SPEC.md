# SPEC: tutor_ib_math

**Status:** Draft v1
**Date:** 2026-05-17
**Repo:** github.com/avrich5/tutor_ib_math
**Production:** skufs `~/tutor_skufs/`
**Mirror:** MacBook `~/tutor_macbook/`
**Database:** Postgres `tutor_ib_math` on skufs 127.0.0.1:5432 (pgvector)
**Companion spec:** `~/home_services/SPEC_tutor_agents.md`

---

## 1. Purpose and non-goals

### Purpose

A self-hosted web-based math tutor for one student (son, DP1 Year 12,
IB Math Analysis & Approaches HL). Covers all 5 AA HL topics.
Pedagogical approach: Quizlet-style drilling (cards, multiple choice,
free input, mixed order, simple → complex) plus interactive function
exploration, smart layered hints, and a built-in RAG-grounded chat tutor.

### Non-goals

- NOT a commercial product (one user, home LAN, no marketing)
- NOT a replacement for school or human tutor — supplement only
- NOT a content authoring tool for the student — student consumes,
  doesn't create
- NOT mobile-first — desktop/laptop only at MVP
- NOT a general LMS — purpose-built for IB AA HL only
- NOT internet-public initially — LAN only until nginx + whitelist phase


---

## 2. Pedagogical model

### Core principles (from user)

1. **Drilling like Quizlet, but principle-based, not copy:**
   - Mixed card formats: flashcards, multiple choice, written answer,
     computed result, ordered steps
2. **Mix difficulty and topics; simple → complex; lots of problems;
   look for cross-topic relationships**
3. **Knowledge types in scope:**
   - Concepts and definitions
   - Axioms and theorems
   - Problem-solving techniques as step sequences
   - Function investigation on interactive graphs
4. **Smart hints — not "do this", but:**
   - "Recall what theorem X says..."
   - "What do you know about Y?"
   - "Think about the structure of the expression..."

### Implementation mapping

| Principle | Implementation |
|-----------|----------------|
| Mixed formats | `question_kind` enum: flashcard, mc, free_expression, free_numeric, ordered_steps |
| Mixed order | SRS scheduler in backend prioritizes by weakness + recency |
| Simple → complex | `difficulty` 1–5 per question; SRS ramps up by mastery |
| Concepts/theorems | `concepts` table; each Q can require_concepts[] |
| Step-by-step techniques | `methods` table; reference solutions cite method_id |
| Function exploration | `/v1/math/explore-function` + frontend graph component |
| Three-tier hints | `hints` table: tier 1 recall, tier 2 apply, tier 3 full |


---

## 3. User scenarios

### Scenario A — Daily practice session (primary)

1. Son opens tutor in browser (LAN).
2. Lands on dashboard: today's queue (SRS-derived), recent activity,
   weak topics, streak.
3. Clicks "Start session" → goes to lesson screen.
4. Sees one question with the chat panel on the right.
5. Tries to solve → enters answer via MathLive (or selects MC option).
6. On submit:
   - **Correct:** brief positive feedback, "Next" button.
   - **Wrong:** "Not quite. Want a hint?" button (no shaming).
7. Hints reveal one tier at a time. After tier 3 the full solution shows.
8. Optional: ask chat tutor a follow-up question about the concept.
9. SRS schedules the question for next review based on response.
10. After ~15 questions session ends with summary
    (correct/total, time, weak spots).

### Scenario B — Targeted topic drill

1. Son picks a topic from the topic list (e.g. "Calculus → Integration").
2. Sees a list of subtopics with mastery percentages.
3. Picks one subtopic → enters lesson mode constrained to that subtopic.

### Scenario C — Free chat with tutor

1. Son opens any screen with the chat panel visible.
2. Types a question ("Why does integration by parts work?").
3. Chat tutor responds, grounded in concepts/theorems already in the DB,
   citing them.
4. Conversation log persists per session, viewable later.

### Scenario D — Concept review

1. Son picks "Concepts" view for a topic.
2. Sees a list of concepts, definitions, theorems with examples.
3. Can drill into any concept → see all questions that test it.


---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (LAN; future: nginx + whitelist + domain)              │
│  React + Vite + TS + Tailwind + KaTeX + MathLive                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP (JSON, SSE)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  tutor_backend  (FastAPI, port :4800)                           │
│  - REST API for frontend                                        │
│  - Postgres tutor_ib_math (pgvector)                            │
│  - SRS engine (deterministic, in-process Python package)        │
│  - Session + chat log persistence                               │
│  - Orchestrator client (X-API-Key auth)                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP, X-API-Key
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  home_orchestrator  :4700                                       │
│  /v1/embed/* /v1/math/* /v1/progress/*                          │
│  /v1/chat/*  /v1/content/* /v1/wolfram/*                        │
└────┬────┬────┬────┬────┬────┬───────────────────────────────────┘
     │    │    │    │    │    │
     ▼    ▼    ▼    ▼    ▼    ▼
   :4705 :4706 :4707 :4708 :4709 Wolfram REST API
   embed math progr chat content
     │    │    │    │    │
     │    │    │    │    └─ direct Postgres write (only for content)
     │    └────┴────┴────── hs_shared.llm_router
     │                       │
     │                       ▼
     │              OpenAI | Anthropic | Ollama | DeepSeek
     │
     ▼
   Ollama nomic-embed-text (local)
```

Frontend NEVER talks to orchestrator directly. Backend NEVER talks to LLM
directly. One direction, one layer at a time.

### Port assignments

- Frontend (Vite dev): 5200
- tutor_backend: 4800
- home_orchestrator: 4700
- agents: 4705–4709
- Postgres: 5432

Production frontend served via nginx (Phase 4); during dev, Vite dev server.


---

## 5. Database schema (Postgres `tutor_ib_math` + pgvector)

### Extensions

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()
```

### Naming conventions

- Singular table names: `user`, `topic`, `question` — not `users`/`topics`
- snake_case
- Primary key always `id UUID DEFAULT gen_random_uuid()`
- Foreign keys named `<table>_id`
- Timestamps: `created_at`, `updated_at` (timestamptz)
- All vectors: `embedding vector(768)` (nomic-embed-text dimension)

### Tables

```sql
-- Users (MVP: just son; schema future-proof for multi-user)
CREATE TABLE app_user (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'student',  -- student | parent | admin
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AA HL topic taxonomy (5 main topics, each with subtopics, depth flexible)
CREATE TABLE topic (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,    -- "calculus.derivatives.product_rule"
  parent_id    UUID REFERENCES topic(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_topic_parent ON topic(parent_id);
CREATE INDEX ix_topic_slug ON topic(slug);
```


```sql
-- Concepts (definitions, axioms, theorems, named methods)
CREATE TABLE concept (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,    -- "chain_rule", "fundamental_thm_calculus"
  topic_id     UUID NOT NULL REFERENCES topic(id),
  kind         TEXT NOT NULL,           -- definition | theorem | method | axiom
  title        TEXT NOT NULL,
  statement_md TEXT NOT NULL,           -- markdown w/ KaTeX delimiters
  proof_md     TEXT,                    -- optional, for theorems
  examples_md  TEXT,                    -- worked examples
  embedding    vector(768),             -- for RAG
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_concept_topic ON concept(topic_id);
CREATE INDEX ix_concept_embedding ON concept USING ivfflat (embedding vector_cosine_ops);

-- Questions (the bank)
CREATE TABLE question (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id              UUID NOT NULL REFERENCES topic(id),
  kind                  TEXT NOT NULL,    -- flashcard | mc | free_expression
                                          -- | free_numeric | ordered_steps
  difficulty            SMALLINT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  stem_md               TEXT NOT NULL,
  stem_latex            TEXT,              -- optional rendered form
  -- Answer format depends on kind:
  reference_answer      TEXT NOT NULL,     -- canonical answer (SymPy-parseable)
  reference_answer_tex  TEXT,
  mc_options            JSONB,             -- {"A": "...", "B": "...", ...} when kind=mc
  mc_correct_key        TEXT,              -- "A" when kind=mc
  ordered_steps         JSONB,             -- [{"text":"...","correct_pos":1},...]
  variables             TEXT[],            -- ["x","y"] for SymPy parsing
  solution_steps        JSONB NOT NULL,    -- [{"text":"...","latex":"..."}]
  related_concept_ids   UUID[] NOT NULL DEFAULT '{}',
  source                TEXT,              -- "generated:openai" | "manual" | "ib_past_paper"
  wolfram_verified      BOOLEAN NOT NULL DEFAULT false,
  status                TEXT NOT NULL DEFAULT 'pending_review',
                                          -- pending_review | approved | retired
  embedding             vector(768),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_question_topic ON question(topic_id);
CREATE INDEX ix_question_status ON question(status);
CREATE INDEX ix_question_difficulty ON question(difficulty);
CREATE INDEX ix_question_embedding ON question USING ivfflat (embedding vector_cosine_ops);
```


```sql
-- Three-tier hints, pre-generated, served from DB
CREATE TABLE hint (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID NOT NULL REFERENCES question(id) ON DELETE CASCADE,
  tier         SMALLINT NOT NULL CHECK (tier IN (1,2,3)),
  kind         TEXT NOT NULL,           -- recall | apply | full
  text_md      TEXT NOT NULL,
  UNIQUE (question_id, tier)
);

-- Study sessions
CREATE TABLE study_session (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES app_user(id),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ,
  goal_topic_id UUID REFERENCES topic(id),
  summary_md   TEXT
);
CREATE INDEX ix_session_user ON study_session(user_id);

-- Individual question attempts
CREATE TABLE attempt (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES study_session(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES app_user(id),
  question_id     UUID NOT NULL REFERENCES question(id),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  student_answer  TEXT,
  correct         BOOLEAN,
  hints_used      SMALLINT NOT NULL DEFAULT 0,
  response_quality SMALLINT,  -- SM-2 scale 0–5
  time_seconds    INTEGER
);
CREATE INDEX ix_attempt_user_question ON attempt(user_id, question_id);
CREATE INDEX ix_attempt_session ON attempt(session_id);
CREATE INDEX ix_attempt_started ON attempt(started_at DESC);
```


```sql
-- SRS cards (one per (user, question) pair; SM-2 state)
CREATE TABLE srs_card (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES app_user(id),
  question_id   UUID NOT NULL REFERENCES question(id),
  easiness      REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions   INTEGER NOT NULL DEFAULT 0,
  due_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reviewed_at TIMESTAMPTZ,
  UNIQUE (user_id, question_id)
);
CREATE INDEX ix_srs_due ON srs_card(user_id, due_at);

-- Chat sessions and messages
CREATE TABLE chat_session (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES app_user(id),
  study_session_id UUID REFERENCES study_session(id),
  title        TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_chat_user_last ON chat_session(user_id, last_message_at DESC);

CREATE TABLE chat_message (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES chat_session(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,           -- user | assistant
  content_md   TEXT NOT NULL,
  cited_sources JSONB,                  -- [{"kind":"concept","id":"..."}]
  provider     TEXT,                    -- "openai" | "anthropic" | "ollama"
  tokens_in    INTEGER,
  tokens_out   INTEGER,
  cost_usd     REAL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_chat_message_session ON chat_message(session_id, created_at);

-- Wolfram cache (shared across all callers)
CREATE TABLE wolfram_cache (
  query_hash   TEXT PRIMARY KEY,        -- sha256 of normalized query
  query        TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Monthly Wolfram usage counter
CREATE TABLE wolfram_usage (
  ym           TEXT PRIMARY KEY,        -- "2026-05"
  call_count   INTEGER NOT NULL DEFAULT 0,
  cached_count INTEGER NOT NULL DEFAULT 0
);
```


### Migration management

- **Alembic** for schema migrations.
- All schema changes via migration scripts; no manual SQL on production.
- Migrations live in `tutor_skufs/backend/alembic/versions/`.
- Initial migration creates all tables above + pgvector extension.

### Backups

- Nightly cron on skufs: `pg_dump tutor_ib_math | gzip > /tmp/dump-$(date).sql.gz`
- Upload to B2 bucket `tutor-ib` under `db/` prefix
- Retain 30 daily, 12 monthly snapshots
- B2 lifecycle is "Keep all versions" → manual prune monthly

---

## 6. Backend (FastAPI)

### Project layout

```
~/tutor_skufs/
├── backend/
│   ├── .venv/                       # Python 3.12 venv
│   ├── .env                         # secrets (gitignored)
│   ├── .env.example
│   ├── requirements.txt
│   ├── main.py                      # FastAPI app entry
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py                # settings via pydantic-settings
│   │   ├── db.py                    # SQLAlchemy engine + session
│   │   ├── models/                  # ORM models
│   │   ├── schemas/                 # pydantic request/response
│   │   ├── routers/                 # FastAPI routers
│   │   ├── services/                # business logic
│   │   │   ├── orchestrator_client.py
│   │   │   ├── question_picker.py
│   │   │   ├── attempt_grader.py
│   │   │   └── chat_service.py
│   │   └── srs/                     # SRS engine (self-contained package)
│   │       ├── __init__.py
│   │       ├── sm2.py
│   │       ├── schedule.py
│   │       └── README.md
│   └── tests/
├── frontend/                        # see section 7
├── scripts/
│   ├── backup_to_b2.sh
│   ├── seed_topics.py
│   └── reindex_embeddings.py
├── docker-compose.yml               # optional, for dev DB only
├── deploy.sh                        # mirrors home_services/deploy.sh
├── README.md
├── SPEC.md                          # this file
├── MEMORY.md
└── ERRORS.md
```


### Configuration (`.env.example`)

```bash
# Database
TUTOR_DB_URL=postgresql+psycopg://andriy@localhost:5432/tutor_ib_math

# Orchestrator
ORCHESTRATOR_URL=http://localhost:4700
ORCHESTRATOR_API_KEY=<key from home_orchestrator/.env>

# Auth (MVP: one-user mode)
SINGLE_USER_EMAIL=son@example.com
SINGLE_USER_BASIC_PASSWORD=<random>

# Backend
BACKEND_HOST=0.0.0.0
BACKEND_PORT=4800
LOG_LEVEL=INFO

# B2 backup (used by scripts/backup_to_b2.sh)
B2_KEY_ID=<from B2>
B2_APPLICATION_KEY=<from B2>
B2_BUCKET=tutor-ib
```

### REST API contract (backend → frontend)

Auth: HTTP Basic in dev (single user); JWT in Phase 4.

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Backend status, DB ping, orchestrator ping |
| GET | /me | Current user |
| GET | /topics | Topic tree |
| GET | /topics/{slug} | One topic + subtopics + concepts |
| GET | /concepts/{id} | One concept |
| GET | /sessions/today | Today's queue (SRS-derived) |
| POST | /sessions | Start a new study session |
| POST | /sessions/{id}/next | Get next question to show |
| POST | /sessions/{id}/end | End session, return summary |
| POST | /attempts | Submit attempt (answer + meta) |
| GET | /attempts/recent?n=N | Recent attempts |
| GET | /questions/{id} | Full question detail (admin/review) |
| GET | /questions/{id}/hint?tier=N | One hint tier |
| GET | /questions/{id}/solution | Full reference solution |
| POST | /chat/sessions | Start chat session |
| POST | /chat/sessions/{id}/messages | Send a message, get reply |
| GET | /chat/sessions/{id}/messages | History |
| POST | /chat/sessions/{id}/messages/stream | SSE-streamed reply |
| GET | /progress/summary | Overall mastery, streak, accuracy, due count |
| GET | /progress/weak-topics?n=N | Top N topics needing work (accuracy + attempts) |
| GET | /progress/activity?days=N | Per-day attempt/correct/minutes buckets for last N days |


### Sample request/response

```jsonc
// POST /sessions/{id}/next
// Response:
{
  "question": {
    "id": "q-uuid",
    "topic": {"slug": "calculus.derivatives.product_rule", "name": "Product Rule"},
    "kind": "free_expression",
    "difficulty": 2,
    "stem_md": "Find the derivative of $f(x) = x^2 \\sin(x)$.",
    "variables": ["x"],
    "related_concepts": [
      {"id": "c-uuid", "title": "Product Rule", "slug": "product_rule"}
    ]
  },
  "queue_position": 3,
  "queue_total": 15
}

// POST /attempts
// Request:
{
  "session_id": "sess-uuid",
  "question_id": "q-uuid",
  "student_answer": "2x sin(x) + x^2 cos(x)",
  "time_seconds": 47,
  "hints_used": 0
}

// Response:
{
  "attempt_id": "att-uuid",
  "correct": true,
  "feedback_md": "Correct. Note the symmetric form of the product rule output.",
  "show_solution_next": false,
  "response_quality": 5,
  "srs_next_review_at": "2026-05-22T08:00:00Z"
}
```


### Services layer

**`orchestrator_client.py`** — thin wrapper around httpx, adds X-API-Key,
exposes typed methods for every orchestrator endpoint tutor uses
(`embed_text`, `check_answer`, `generate_solution`, `compute_wolfram`,
`chat_message`, `analyze_progress`). Centralizes auth and error handling.

**`question_picker.py`** — given current session, user, topic, picks the
next question:
1. Ask SRS for due cards
2. Fallback to new questions if SRS queue empty
3. Avoid recently shown questions in same session
4. Bias toward weak topics

**`attempt_grader.py`** — when student submits an answer:
1. For MC: direct key match
2. For free_expression / free_numeric: call math_agent /check-answer
3. For ordered_steps: positional match
4. For flashcard: self-rating (student says "got it" / "missed")
5. Map result + time + hints to SM-2 response_quality (0–5)

**`chat_service.py`** — orchestrates a chat turn:
1. Persist user message
2. Load last ~20 turns as context
3. POST to chat_agent via orchestrator
4. Persist assistant message + cited sources + tokens + cost
5. Return to frontend

### SRS engine (`app/srs/`)

Self-contained Python package. Pure functions, no DB access, no Flask/FastAPI
deps. Future-portable to physics tutor.

```python
# app/srs/sm2.py
@dataclass(frozen=True)
class CardState:
    easiness: float = 2.5
    interval_days: int = 0
    repetitions: int = 0

@dataclass(frozen=True)
class ReviewOutcome:
    next_state: CardState
    interval_days: int
    due_offset_seconds: int

def schedule_next(state: CardState, quality: int) -> ReviewOutcome: ...
```

DB-touching code lives in `services/srs_service.py` and calls into
`app/srs/` for the pure logic. Clean separation = easy unit testing
and easy port to another subject.


---

## 7. Frontend (React + Vite + TS)

### Stack and key libraries

- **React 18** + **TypeScript** + **Vite** (no Next.js — single SPA)
- **Vanilla CSS + CSS Modules** for styling. Global design tokens (CSS custom properties) live in `src/styles/tokens.css` — ported from `tutor_design/prototype.html` (theme: letterform, dark/light via `data-mode`, density: compact fixed). No Tailwind.
- **TanStack Query** (react-query) for server state
- **React Router** for routing
- **KaTeX** (`katex`, `react-katex`) for rendering math
- **MathLive** (`mathlive` v0.105+) for math input — integrated as custom element `<math-field>` via React `useRef` and imperative API (`mathfield.value`, `addEventListener('input', ...)`). No `mathlive-react` wrapper (package does not exist).
- **Plotly.js** for interactive function exploration (Function Explorer screen, Phase 3.6+)
- **EventSource polyfill** if needed for SSE chat (Phase 4)

### Project layout

```
~/tutor_skufs/frontend/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/                     # generated/typed client
│   │   ├── client.ts
│   │   └── types.ts
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Session.tsx
│   │   ├── TopicList.tsx
│   │   ├── TopicDetail.tsx
│   │   ├── ConceptDetail.tsx
│   │   ├── ProgressView.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── chat/                # right-side chat panel
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   └── ChatInput.tsx    # dynamic-height textarea
│   │   ├── question/
│   │   │   ├── QuestionView.tsx
│   │   │   ├── MultipleChoice.tsx
│   │   │   ├── FreeExpression.tsx  # MathLive
│   │   │   ├── FreeNumeric.tsx
│   │   │   ├── OrderedSteps.tsx
│   │   │   ├── Flashcard.tsx
│   │   │   └── HintsPanel.tsx
│   │   ├── graph/
│   │   │   ├── FunctionGraph.tsx   # Plotly
│   │   │   └── ParamSlider.tsx
│   │   └── ui/                  # shadcn-style primitives or own
│   ├── hooks/
│   ├── styles/
│   └── utils/
└── public/
```


### Layout

Two-column app layout on every authenticated page:

```
┌───────────────────────────────────────────────────────────────┐
│  Top bar: logo, current topic, streak, settings               │
├──────────────────────────────────────┬────────────────────────┤
│                                      │                        │
│  Main content area                   │  Chat panel            │
│  (Dashboard / Session / Topic /      │  (right-side,          │
│   ConceptDetail / Progress)          │   full height,         │
│                                      │   resizable width,     │
│                                      │   collapsible)         │
│                                      │                        │
│                                      │  - Message list        │
│                                      │  - Scroll auto-bottom  │
│                                      │  - Cited source pills  │
│                                      │                        │
│                                      │  Dynamic-height        │
│                                      │  textarea + send btn   │
└──────────────────────────────────────┴────────────────────────┘
```

Chat panel:
- Default width: 380–420 px, resizable via drag handle
- Collapsible to a narrow icon column
- Persists open/collapsed state in localStorage
- Dynamic textarea: starts 1 row, grows up to 8 rows then scrolls
- Per-session log loaded on mount; new messages appended in real time
- SSE streaming for assistant replies (token-by-token visible)
- "Cite" pills under messages → clicking opens concept/question in main area

### Lesson screen flow

1. Header: topic name, queue progress (e.g., "3/15"), elapsed time
2. Question stem rendered with KaTeX
3. Answer input area (depends on `kind`)
4. Submit button + "I need a hint" button
5. After submit: feedback inline, "Next" button
6. If hint requested: tier 1 reveals; second click → tier 2; third → tier 3
   (=full solution)
7. Solution view: step-by-step from `solution_steps` array
8. "Continue" → next question

### Function exploration screen (used inside lessons and standalone)

- Plotly graph
- Sliders for parameters (e.g., a, b, c in f(x) = ax² + bx + c)
- Tabs: "Graph", "Derivative", "Integral", "Properties"
- "Properties" lists roots, extrema, asymptotes from /v1/math/explore-function


---

## 8. LLM strategy table (for tutor's use cases)

| Use case | Primary | Fallback | Notes |
|----------|---------|----------|-------|
| Embedding text for RAG | Ollama nomic-embed-text | — | Local, free, unlimited |
| Mass question generation | OpenAI gpt-4o | Anthropic claude-sonnet-4 | Offline, batch |
| Generating hints (3 tiers) | OpenAI gpt-4o | Anthropic | Offline, stored in DB |
| Generating reference solution | OpenAI gpt-4o | Anthropic | Verified by Wolfram before save |
| Chat: simple follow-ups | Ollama llama3.2 | OpenAI | If cheap path can answer |
| Chat: deep conceptual question | OpenAI gpt-4o | Anthropic | RAG-grounded |
| Concept explanation | OpenAI gpt-4o | Anthropic | RAG-grounded |
| Progress narrative | OpenAI gpt-4o-mini | — | Cheap |
| Reasoning-heavy task gen (later) | DeepSeek reasoner | OpenAI | Opt-in, when key arrives |
| Authoritative math check | Wolfram Full Results | SymPy local | Used only during gen + ambiguity |
| Symbolic equivalence at runtime | SymPy local | Wolfram | Free, fast |
| Function exploration | SymPy local | — | No LLM ever |
| Answer parsing | SymPy local | — | No LLM ever |

**Hard rules:**
- Never call Wolfram or paid LLM from inside the lesson loop without cache check
- Never use LLM to "do math" without a deterministic verifier (SymPy/Wolfram)
- Never put live LLM in the critical path of grading if SymPy can decide


### Chat flow (Phase 5 implementation)

```
Browser (ChatPanel.tsx)
  → POST /chat/sessions/{id}/messages/stream   [SSE, text/event-stream]
  → tutor_backend (chat.py)
      → services/chat_context.py  ← builds system prompt:
          • current question (from study session, if any)
          • weak topics (last 50 attempts, top 3)
          • RAG results (pgvector cosine search on question.embedding + hint lookup)
      → orchestrator_client.chat_stream()
          → Anthropic Messages API (TEMP: direct call, not via chat_agent :4708)
              model: claude-haiku-4-5-20251001
  ← SSE: event: chunk / data: {"delta": "..."}
  ← SSE: event: done  / data: {"message_id": "...", "tokens_in": N, "tokens_out": N, "cost_usd": X}
  → DB write: chat_message row (user + assistant)
```

**Phase 5 RAG retrieval** (`services/rag.py`):
- Query is embedded via `orchestrator.embed_text()` → Ollama nomic-embed-text
- `question.embedding` searched with pgvector `<=>` (cosine distance), k=3
- Each retrieved question includes its stored hints (all tiers)
- `concept.embedding` searched, k=2 — currently always returns [] (no concept embeddings)
- Haese textbook source chunks → Phase 5.5

Citation markers in LLM output: `[Q:uuid]` (question), `[C:uuid]` (concept), `[hint:uuid:tier]`
Frontend parses and renders these as `CitationPill` components (orange/green/yellow).

**Tech debt:** `orchestrator_client.py` calls Anthropic API directly (chat_agent :4708 is a 501 stub).
When `chat_agent` is implemented in `~/home_services/`, remove direct key from `tutor_backend/.env`
and route through `orchestrator → chat_agent` as per the original architecture.


---

## 9. Deploy and operations

### Production deploy flow

```bash
# Local (MacBook):
cd ~/tutor_macbook
git add -A
git commit -m "..."
git push

# Trigger production deploy:
ssh skufs-mac-mini "~/tutor_skufs/deploy.sh"
```

### `~/tutor_skufs/deploy.sh` (modeled on home_services/deploy.sh)

```bash
#!/usr/bin/env bash
set -euo pipefail
cd ~/tutor_skufs

echo "[1/5] Pull latest from origin"
git pull --ff-only

echo "[2/5] Backend deps"
cd backend
./.venv/bin/pip install -r requirements.txt

echo "[3/5] DB migrations"
./.venv/bin/alembic upgrade head

echo "[4/5] Frontend build"
cd ../frontend
npm ci
npm run build

echo "[5/5] Restart tutor_backend"
launchctl unload ~/Library/LaunchAgents/com.skufs.tutor-backend.plist || true
launchctl load ~/Library/LaunchAgents/com.skufs.tutor-backend.plist

echo "[mirror] Sync to MacBook"
ssh macbook 'cd ~/tutor_macbook && git pull --ff-only'

echo "Deploy complete."
```


### launchd plist for backend

`~/tutor_skufs/launchd/com.skufs.tutor-backend.plist`, deployed to
`~/Library/LaunchAgents/`. Pattern from home_services agents:

- WorkingDirectory: `~/tutor_skufs/backend`
- ProgramArguments: `.venv/bin/uvicorn main:app --host 0.0.0.0 --port 4800`
- StandardOutPath / StandardErrorPath in `backend/logs/`
- KeepAlive: true
- RunAtLoad: true

### Nginx (Phase 4, when we go beyond LAN)

```nginx
server {
    listen 443 ssl http2;
    server_name tutor.<your-domain>;

    # frontend (static build)
    location / {
        root /Users/andriy/tutor_skufs/frontend/dist;
        try_files $uri /index.html;
    }

    # backend API
    location /api/ {
        proxy_pass http://127.0.0.1:4800/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }

    # SSE chat streaming
    location /api/chat/sessions/.*/messages/stream {
        proxy_pass http://127.0.0.1:4800;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
    }

    # Whitelist (basic, MVP)
    auth_basic "tutor";
    auth_basic_user_file /etc/nginx/tutor.htpasswd;
}
```

Phase 4 will replace basic auth with email whitelist + Cloudflare Access
or similar.


### Backup script (`scripts/backup_to_b2.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
DUMP=/tmp/tutor_ib_math-$TS.sql.gz
pg_dump -Fc tutor_ib_math | gzip > "$DUMP"

# Upload via rclone (preferred — already configured for other projects)
# or via b2 CLI
rclone copy "$DUMP" b2:tutor-ib/db/

rm -f "$DUMP"

# Retain only last 30 daily dumps; B2 lifecycle handles versioning
```

Cron entry on skufs (`crontab -e`):
```
0 3 * * * /Users/andriy/tutor_skufs/scripts/backup_to_b2.sh >> /Users/andriy/tutor_skufs/backend/logs/backup.log 2>&1
```

### MacBook mirror

After every deploy, skufs runs `ssh macbook 'cd ~/tutor_macbook && git pull'`.
This keeps MacBook copy in sync for dev sessions starting from a clean state.

Rules (mirroring home_services convention):
- All commits originate from MacBook → push to GitHub → pull on skufs
- skufs NEVER commits directly; only pulls
- MacBook can pull from GitHub too (after deploy.sh syncs it back)


---

## 10. Phased implementation plan

### Phase 1 — Infrastructure (target: 1–2 days)

**Goal:** all plumbing in place; nothing user-facing yet.

- [ ] Create `~/tutor_skufs/` on skufs (empty git repo, push to GitHub)
- [ ] Clone to `~/tutor_macbook/` on MacBook
- [ ] Backend skeleton: FastAPI, .venv, requirements.txt, .env.example
- [ ] Postgres: create `tutor_ib_math` DB, install pgvector extension,
      run initial Alembic migration (all tables from section 5)
- [ ] Seed `topic` table with AA HL taxonomy (5 main + initial subtopics)
- [ ] Backend /health endpoint working
- [ ] `hs_shared/llm_router/` scaffold with OpenAI provider only
- [ ] `embedding_agent` running on :4705, registered in orchestrator
- [ ] `math_agent` skeleton on :4706 — `/check-answer` and `/explore-function`
      working via SymPy (rest return 501 NotImplemented)
- [ ] New routers in `home_orchestrator` for /v1/embed and /v1/math
- [ ] Smoke test: curl through orchestrator → embedding_agent and math_agent

**Acceptance:** can embed a string and check a math answer via orchestrator,
with auth, returning expected JSON.


### Phase 2 — Content pipeline (target: 1–2 days)

**Goal:** generate 30 validated questions for one topic and have them
queryable in the DB with embeddings.

- [ ] Wolfram router in orchestrator (/v1/wolfram/compute) + cache table
      in tutor_ib_math + monthly usage counter
- [ ] math_agent: /validate-task, /generate-solution, /generate-hints
      with LLM via hs_shared.llm_router (OpenAI primary)
- [ ] tutor_content_agent CLI: `generate --topic calculus.derivatives --count 30`
- [ ] First batch: 30 questions for `calculus.derivatives` end-to-end:
      LLM-generated → SymPy-parsed → Wolfram-verified → hints generated →
      embeddings computed → inserted with status=pending_review
- [ ] Manual review pass (Andriy reads 10 random questions, marks bad ones)
- [ ] Approval script to flip status=approved for the good batch

**Acceptance:** `SELECT count(*) FROM question WHERE topic_id = <calculus> AND status='approved';` returns ≥ 25. Sample questions are correct, hints are pedagogically sound, solutions render via KaTeX.

### Phase 3 — Frontend MVP (target: 3–5 days)

**Goal:** son can actually study with the tool, on one topic.

- [ ] Vite + React + TS + Tailwind scaffolded
- [ ] API client with typed methods
- [ ] Basic auth (single-user mode), login page
- [ ] Dashboard page (today's queue from /sessions/today)
- [ ] Topic list and detail pages
- [ ] Session page with question rendering:
      - flashcard / mc / free_expression (MathLive) / free_numeric components
- [ ] Hints panel (three-tier reveal)
- [ ] Solution view
- [ ] FunctionGraph component (Plotly) — minimal version
- [ ] SRS engine in backend (`app/srs/sm2.py`) + service wiring
- [ ] Attempt submission + grading via math_agent
- [ ] Dashboard shows streak, recent activity
- [ ] Chat panel skeleton (UI only; no backend call yet — placeholder)
- [ ] launchd plist for tutor_backend
- [ ] deploy.sh working

**Acceptance:** son opens http://192.168.1.11:5173 (or :4800 with served
frontend), logs in, completes a 15-question session on calculus.derivatives,
SRS schedules next reviews correctly, all questions render math correctly.


### Phase 4 — Chat + recommendations + content expansion (target: 1–2 weeks)

**Goal:** full tutor experience across all 5 AA HL topics.

- [ ] chat_agent on :4708, registered in orchestrator
- [ ] /v1/chat/* router in orchestrator
- [ ] Chat backend service in tutor_backend (persist messages, fetch context,
      forward to chat_agent)
- [ ] Chat panel frontend: SSE streaming, cited sources, dynamic textarea
- [ ] progress_agent on :4707, /progress/weak-topics endpoint live
- [ ] Progress page in frontend (mastery over time, weak topics, narrative)
- [ ] Content generation for the remaining 4 AA HL topics:
      - number_and_algebra (sequences, exponents, logarithms, complex, proofs)
      - functions (transformations, inverse, composite, polynomial, rational)
      - geometry_and_trigonometry (vectors 3D, trig identities, equations)
      - statistics_and_probability (PDFs, hypothesis tests, binomial, normal)
- [ ] Target ~150 questions per topic, 750 total
- [ ] Concept content for each topic (definitions, theorems, methods)
      seeded and embedded
- [ ] /v1/math/explain endpoint live, used by chat

**Acceptance:** son can study any AA HL topic, ask questions in the chat
panel, see weak-topic recommendations on the dashboard.

### Phase 5 — Public access (target: when ready, last)

**Goal:** tutor reachable from outside home LAN with proper auth.

- [ ] Domain pointed at skufs WAN IP (DNS A record)
- [ ] Cloudflare Tunnel OR direct port-forward on router
- [ ] Nginx config with TLS (Let's Encrypt or Cloudflare cert)
- [ ] Email whitelist auth (basic htpasswd → later JWT + magic link)
- [ ] Rate limiting on /api/chat/* (per-user, per-minute)
- [ ] Production logging review (no secrets in logs)
- [ ] Frontend served from nginx static, not Vite dev server

**Acceptance:** son can use tutor from any device with internet via
the domain, behind email whitelist.


---

## 11. Testing strategy

### Backend

- **Unit tests** with pytest:
  - `app/srs/sm2.py` — pure functions, easy to test, full coverage
  - `services/attempt_grader.py` — mock math_agent calls
  - `services/orchestrator_client.py` — mock httpx responses
- **Integration tests** with pytest + a test Postgres instance:
  - Create/teardown test DB on each run (template DB approach)
  - Seed minimal topic + question fixtures
  - Full request → response flow for /sessions, /attempts, /chat
- **Smoke tests** for orchestrator integration (skipped in CI, run locally):
  - Require live orchestrator and agents
  - Tag with `@pytest.mark.integration`

### Frontend

- **Component tests** with Vitest + Testing Library:
  - QuestionView rendering each `kind`
  - HintsPanel reveal sequence
  - MathLive input parsing
- **E2E** with Playwright (Phase 4):
  - Login → complete one question → assert SRS updates
  - Chat send/receive happy path

### Math correctness sanity tests

A dedicated test suite that picks ~20 questions at random from approved
batch, calls /check-answer with their reference_answer (and with a known
incorrect answer), asserts equivalence. Run nightly via cron on skufs;
on failure, alert via existing notify channel (FamilyTranslator notification
infrastructure if reusable, or simple email).

### Pre-commit hooks

Mirrored from FamilyTranslator pattern:
- `pre-commit` runs `pytest -x --ff` on backend, `npm test` on frontend
- Blocks commit on failure
- `scripts/install-hooks.sh` for fresh clones


---

## 12. Content quality controls

LLM-generated content has known failure modes. Defenses:

### At generation time

- **Schema validation:** LLM forced to JSON output with response_format=json
  and a strict pydantic schema; malformed responses retried
- **SymPy parseability:** every reference_answer must parse via `sympy.parse`
  with the declared variables. Failures discarded.
- **Self-consistency:** LLM is asked to solve its own generated question
  independently; if its solution disagrees with its stated answer, discard.
- **Wolfram cross-check:** Wolfram Full Results compared against
  reference_answer for symbolic equivalence. Mismatch → discard and re-roll.
- **Hint coverage:** tier-1 must mention a concept_id; tier-3 must lead to
  the same answer SymPy computes. Otherwise regenerate hints.
- **Difficulty calibration:** difficulty is LLM-assigned then human-reviewed;
  drift is tracked over time by comparing attempt success rates per difficulty.

### At runtime

- All math operations through SymPy or Wolfram, never LLM
- LLM is allowed only to: explain, generate prose, summarize prose, route
  conversation. Never to "do math."

### Manual review queue

`status='pending_review'` questions are listed in an admin view in tutor_backend
(simple JSON endpoint, no UI initially). Andriy reviews in batches:
- Approve: status='approved'
- Reject with note: status='retired' + reject_reason
- Edit and re-submit: edit stem/answer/hints, set status='approved'

### Retire mechanism

If during use Andriy notices a bad question (son flags it, or it has
suspiciously high failure rate), it can be retired (`status='retired'`).
Retired questions are excluded from new attempts but their attempt history
is preserved.


---

## 13. Security and privacy

### MVP (LAN-only)

- HTTP Basic auth, single user
- Postgres bound to 127.0.0.1 (already is)
- Orchestrator already enforces X-API-Key on all /v1/* routes
- Tutor backend's connection to orchestrator uses the same API key,
  read from `.env`
- All secrets in `.env` files, all `.env` files in `.gitignore`
- B2 keys live in skufs `~/tutor_skufs/.env` only

### Phase 5 (public)

- TLS via Let's Encrypt or Cloudflare
- Email whitelist (initial: htpasswd; later: magic-link JWT)
- Per-user rate limiting on /api/chat/* and any LLM-touching endpoint
- Cost cap: a daily/monthly USD cap that disables paid LLM calls when hit
  (Ollama fallback always available)
- Audit log: every authenticated request logged with user, IP, endpoint
- HSTS, secure cookies, CSP headers, frame-deny

### Privacy

- Single user (son), data isolated to his account
- Chat logs are private to the user
- No analytics, no third-party trackers, no external CDN for fonts/etc
- LLM provider data policies: OpenAI/Anthropic/DeepSeek API calls are
  opt-out of training by default per their data agreements; this is the
  user's responsibility to verify per-account


---

## 14. Open questions and TODOs

These do NOT block Phase 1. Logged so future sessions surface them.

### Pedagogy

- Should we add timed exam mode (IB exam simulation, past paper format)?
  Decision deferred to Phase 4 once base tutor proves out.
- Mistake review mode: queue of recent mistakes, drill until mastered.
  Likely in Phase 4 as "weak topic" focus.
- Sister/parent dashboard for visibility into son's progress.
  Multi-user already in schema; UI deferred.

### Architecture

- Should `srs/` move from `tutor_backend/app/srs/` to `hs_shared/srs/`
  after MVP proves portability? Yes if physics tutor starts within 6 months.
- Should chat sessions move from Postgres to Redis for performance once
  conversation history grows? Re-evaluate at 1000+ sessions.
- Embedding model upgrade: when Ollama gets a newer/better embedding model
  (e.g. nomic-embed-text-v2), re-index pipeline must support migration
  (already supported by re-running embeddings on all questions).
- Worth adding qwen2.5-math or other math-tuned local model to the
  Ollama fallback chain? Re-evaluate after observing actual fallback usage.

### Operations

- Cost ceiling per month: define a hard $ cap (currently no cap, only
  Wolfram free-tier limit). Probably $30/month for OpenAI is plenty for
  one student studying daily.
- Monitoring: do we need Prometheus + Grafana for tutor metrics, or is
  reading logs sufficient? Probably logs suffice until Phase 5.
- Disaster recovery test: monthly test of restoring from B2 backup to
  a fresh Postgres DB. Schedule once production data exists.

### Content

- Past paper integration: IB past papers are copyrighted; can't republish.
  Options: link out to IBO store, OR generate "in the style of past paper Q5"
  without copying. Likely option B with explicit attribution.
- Russian-language explanations: chat tutor in English by default; chat
  agent could detect language and reply in Russian if son asks in Russian.
  Cheap; add to chat_agent prompt in Phase 4.


---

## 15. AA HL syllabus mapping (initial topic seed)

Used by `scripts/seed_topics.py` in Phase 1. Source: IB AA HL guide (current
syllabus as of 2026). Slugs are stable; names can be edited.

```
number_and_algebra
  ├── sequences_and_series
  │     ├── arithmetic
  │     ├── geometric
  │     ├── infinite_series_convergence
  │     └── compound_interest
  ├── exponents_and_logs
  │     ├── laws_of_exponents
  │     ├── laws_of_logarithms
  │     └── exponential_equations
  ├── binomial_theorem
  ├── proof
  │     ├── direct_proof
  │     ├── contradiction
  │     ├── induction
  │     └── counterexample
  ├── complex_numbers
  │     ├── cartesian_form
  │     ├── polar_form
  │     ├── de_moivre
  │     └── roots_of_unity
  └── systems_of_equations

functions
  ├── function_basics
  │     ├── domain_range
  │     ├── composition
  │     └── inverse
  ├── transformations
  ├── polynomial_functions
  ├── rational_functions
  ├── exponential_logarithmic
  ├── trigonometric_functions
  └── modulus_reciprocal_piecewise

geometry_and_trigonometry
  ├── trig_identities
  ├── trig_equations
  ├── circular_functions
  ├── compound_angle_double_angle
  ├── vectors_2d_3d
  ├── lines_and_planes
  └── geometric_proofs

statistics_and_probability
  ├── descriptive_statistics
  ├── probability_basics
  ├── conditional_probability_bayes
  ├── discrete_distributions
  │     └── binomial
  ├── continuous_distributions
  │     └── normal
  └── hypothesis_testing_chi_squared

calculus
  ├── limits
  ├── derivatives
  │     ├── basic_rules
  │     ├── chain_rule
  │     ├── product_rule
  │     ├── quotient_rule
  │     ├── implicit
  │     └── related_rates
  ├── applications_of_derivatives
  │     ├── extrema
  │     ├── inflection
  │     ├── curve_sketching
  │     └── optimization
  ├── integrals
  │     ├── indefinite
  │     ├── definite
  │     ├── by_substitution
  │     └── by_parts
  ├── applications_of_integrals
  │     ├── area
  │     ├── volume_of_revolution
  │     └── kinematics
  └── differential_equations
        ├── separable
        └── first_order_linear
```

Total: 5 top-level, ~20 mid-level, ~50 leaf-level subtopics.
Phase 2 starts with `calculus.derivatives.*` (one branch, ~30 questions × 6 leaves).


---

## 16. Reference — companion documents

- `~/home_services/SPEC_tutor_agents.md` — agents extension to home_services
  (5 new agents, llm_router, Wolfram integration). MUST be read together with
  this document.
- `~/home_services/CLAUDE.md` — home_services project memory (existing).
- `~/tutor_macbook/MEMORY.md` — tutor_ib_math append-only decision log.
- `~/tutor_macbook/ERRORS.md` — tutor_ib_math failure log.

---

## 17. Glossary

- **AA HL** — IB Math Analysis and Approaches, Higher Level
- **DP1 / DP2** — Diploma Programme Year 1 / Year 2 (the 2-year IB)
- **SRS** — Spaced Repetition System
- **SM-2** — original SuperMemo 2 scheduling algorithm
- **FSRS** — Free Spaced Repetition Scheduler (modern alternative; not used initially)
- **pgvector** — Postgres extension for vector similarity search
- **RAG** — Retrieval-Augmented Generation
- **MathLive** — JS library for visual math input
- **KaTeX** — JS library for fast math rendering
- **SSE** — Server-Sent Events (one-way streaming over HTTP)
- **Orchestrator** — `home_orchestrator :4700`, single entry point to all
  home_services agents

---

**End of spec.**
