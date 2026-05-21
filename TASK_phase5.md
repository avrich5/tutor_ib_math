# TASK — Phase 5 (Chat + RAG)

**Дата создания:** 2026-05-21
**Source of truth:** `~/tutor_skufs/TASK_phase5.md`
**Зеркало:** `~/tutor_macbook/TASK_phase5.md` через git pull
**Принцип:** правки → skufs → git → MacBook.

---

## 0. Цель фазы

Подключить рабочий чат-ассистент к tutor, чтобы сын мог в любой момент задать вопрос по текущей задаче или по теме в целом и получить ответ с цитированием источников из его собственной базы (вопросы, концепты, hints).

После Phase 5 в правой sidebar-панели сын видит:
- Поле ввода вопроса
- Историю текущей сессии чата (streaming, символ за символом)
- Citation pills в ответах AI, кликабельные → подсвечивают источник

Чат **знает** что сейчас открыто (текущий вопрос, последний attempt, weak topics) и **умеет искать** по похожим вопросам и концептам через pgvector.

---

## 1. Зафиксированные решения (не пересматривать без явного разрешения)

| Параметр | Решение |
|---|---|
| Транспорт | **SSE** (Server-Sent Events) от tutor_backend |
| Архитектура | Frontend → tutor_backend → orchestrator → chat_agent. Frontend НЕ ходит к chat_agent напрямую. |
| Persistence | Postgres: `chat_session` + `chat_message` (таблицы и модели уже готовы) |
| Контекст | Session context (текущий вопрос + последний attempt + weak topics) + RAG по существующим эмбеддингам |
| RAG источники | `question.embedding` (25 approved сейчас) + `concept.embedding` (пустая, retrieval работает но возвращает []) |
| Haese RAG | **НЕ в этой фазе.** Отдельная Phase 5.5 после merge `pdf-schema-v2` и загрузки jsonl в Postgres. |
| Citation pills | UI готов, генерация — regex postprocess маркеров `[Q:uuid]`, `[C:uuid]`, `[hint:uuid:tier]` |
| История чатов | **Без UI.** Только `GET /chat/sessions` для просмотра из терминала + путь к файлу-дампу. |
| Sidebar | Чат живёт в существующем `ChatPanel` справа (Phase 3 stub превращается в реальный) |

---

## 2. Что уже есть в системе

### 2.1. БД (готово)

Таблицы `chat_session` и `chat_message` существуют в `tutor_ib_math` БД с правильными колонками:

- `chat_session`: id, user_id, study_session_id (nullable FK на текущую study_session), title, started_at, last_message_at
- `chat_message`: id, session_id, role (user|assistant), content_md, cited_sources (JSONB), provider, tokens_in, tokens_out, cost_usd, created_at

Модели в `~/tutor_skufs/backend/app/models/chat.py` уже соответствуют схеме. **Миграция не нужна.**

### 2.2. Агенты (живые)

- `chat_agent :4708` — endpoints `POST /message`, `POST /message/stream`, `GET /sessions/{id}/log`. Стрим уже работает.
- `embedding_agent :4705` — `POST /embed`, `POST /embed/batch`, `GET /model`. Используется для query векторов при RAG.
- `home_orchestrator :4700` — проксирует к chat_agent. В Phase 5 tutor_backend будет звать orchestrator, не chat_agent напрямую (соблюдаем существующую архитектуру).

### 2.3. Данные

- `question.embedding` — pgvector(768), индекс ivfflat. **25 approved + 9 retired** = 34 записи с эмбеддингами.
- `concept` таблица существует, **пустая**. retrieval должен корректно возвращать [] на этом источнике.
- `hint` таблица — 102 записи, **без эмбеддингов**. В RAG **не включаем** напрямую — hint'ы найдутся через parent question, и подмешиваются в контекст вторичным lookup'ом.

### 2.4. Frontend stub

`~/tutor_skufs/frontend/src/components/layout/ChatPanel.tsx` — заглушка с текстом «Tutor chat — coming in Phase 4» (отстаёт от номера фазы, надо обновить). Размер и расположение в layout уже зафиксированы.

---

## 3. Подэтапы с sign-off

Phase 5 разбивается на **5 последовательных подэтапов**. После каждого Claude Code **останавливается и ждёт твоего OK** в чате прежде чем идти к следующему.

Между подэтапами тебе нужно успеть проверить либо визуально, либо через curl что описанное работает. Если не работает — фидбек, фиксы, и только потом следующий sign-off.

### Stage 1: Backend — POST /chat и /chat/{id}/messages (без стрима, без RAG)

**Цель:** научить tutor_backend создавать chat session и сохранять non-streaming сообщения в Postgres.

**Что делать:**

1. Новый файл `~/tutor_skufs/backend/app/routers/chat.py`. Подключить в `main.py`.

2. Endpoint `POST /chat/sessions`:
   - body: `{ "study_session_id": "uuid|null", "title": "string|null" }`
   - создаёт ChatSession для текущего user, возвращает `{ "chat_session_id": "...", "started_at": "..." }`
   - если `study_session_id` указан — проверить что он принадлежит user

3. Endpoint `GET /chat/sessions`:
   - возвращает последние 50 чатов user'а, sort by `last_message_at DESC`
   - формат: `[{ "id": "...", "title": "...", "study_session_id": "...", "started_at": "...", "last_message_at": "...", "message_count": N }, ...]`
   - **Это endpoint для тебя**, не для UI. Просто работает.

4. Endpoint `GET /chat/sessions/{id}/messages`:
   - возвращает все сообщения чата, sort by `created_at ASC`
   - формат: `[{ "id": "...", "role": "...", "content_md": "...", "cited_sources": [...], "created_at": "..." }, ...]`

5. Endpoint `POST /chat/sessions/{id}/messages` (НЕ стрим, синхронный — для теста):
   - body: `{ "content_md": "string" }`
   - сохраняет user message в БД
   - вызывает orchestrator (или chat_agent через orchestrator) с минимальным system prompt: "You are a math tutor for IB Mathematics AA HL."
   - сохраняет assistant ответ в БД
   - возвращает `{ "user_message_id": "...", "assistant_message_id": "...", "content_md": "..." }`
   - обновляет `chat_session.last_message_at`

**НЕ делать в Stage 1:**
- SSE / streaming
- RAG retrieval
- Session context
- Citation pills

**Sign-off критерии:**
- `curl POST /chat/sessions` создаёт запись в БД (проверить `psql -d tutor_ib_math -c "SELECT * FROM chat_session ORDER BY started_at DESC LIMIT 1"`)
- `curl POST /chat/sessions/{id}/messages` с простым вопросом возвращает ответ
- `curl GET /chat/sessions` возвращает список
- **Путь для просмотра чатов на диске тебе скажет Claude Code в конце Stage 1**:
  - либо команда `psql -d tutor_ib_math -c "SELECT ... FROM chat_message WHERE session_id = '...'"`
  - либо скрипт `scripts/dump_chat.py {chat_session_id}` который выплёвывает JSON в stdout
  - вариант на усмотрение Claude Code, главное чтобы тебе было удобно из терминала

---

### Stage 2: Backend — SSE стриминг

**Цель:** добавить стриминг ответа от chat_agent через tutor_backend на фронт.

**Что делать:**

1. Endpoint `POST /chat/sessions/{id}/messages/stream`:
   - body: то же `{ "content_md": "string" }`
   - сразу сохраняет user message в БД
   - открывает SSE stream к orchestrator (chat_agent `POST /message/stream` через оркестратор)
   - **проксирует** SSE chunks на фронт, **попутно накапливая** полный assistant ответ
   - в конце стрима — сохраняет полный assistant message в БД (одной транзакцией с обновлением `chat_session.last_message_at`)

2. Формат SSE events для фронта:
   ```
   event: chunk
   data: {"delta": "Lorem "}

   event: chunk
   data: {"delta": "ipsum"}

   event: done
   data: {"message_id": "uuid", "tokens_in": 234, "tokens_out": 89, "cost_usd": 0.0012}
   ```

3. Обработка ошибок: если стрим оборвётся в середине — сохранить partial ответ с пометкой `[INCOMPLETE]` в content_md, чтобы не было silent loss.

4. Использовать `EventSourceResponse` из `sse-starlette` (pip install). Это стандартный путь для FastAPI + SSE.

**Sign-off критерии:**
- `curl -N POST /chat/sessions/{id}/messages/stream -d '{"content_md":"test"}'` показывает чанки в реальном времени
- После стрима в БД появляется полный assistant message
- `chat_session.last_message_at` обновлено

---

### Stage 3: Backend — Session context

**Цель:** подмешать контекст текущей учебной активности в system prompt перед отправкой в chat_agent.

**Что собирать в контекст:**

1. Если `chat_session.study_session_id` указан — найти **последний** Attempt этого user в этой study_session:
   - сам вопрос (stem_md, kind, topic_slug)
   - reference_answer
   - что ответил ученик (student_answer)
   - correct/incorrect
   - сколько hints использовал

2. Если study_session_id не указан — **только weak topics**:
   - последние 3 weak topics из `/progress/weak-topics?limit=3` логики

3. Сформировать system prompt:
   ```
   You are a math tutor for IB Mathematics AA HL.
   Student's name: {name}

   {if current_question:}
   Current task the student is working on:
   - Topic: {topic_slug}
   - Question: {stem_md}
   - Reference answer: {reference_answer}
   - Student's last attempt: {student_answer} ({correct ? "correct" : "incorrect"})
   - Hints used: {n}

   {if weak_topics:}
   Topics where the student is currently weaker than average:
   - {weak_topic_1} ({accuracy}%)
   - ...

   Guidelines:
   - Be concise. The student is doing a focused study session.
   - When you reference a question, hint, or concept from the system, use citation markers: [Q:uuid], [C:uuid], [hint:uuid:tier].
   - Explain reasoning step-by-step using LaTeX inline ($...$) and block ($$...$$) math.
   - If asked for the answer directly without effort, redirect: ask the student where they got stuck first.
   ```

4. Логика сборки контекста — в новый модуль `~/tutor_skufs/backend/app/services/chat_context.py`. Функция `build_context_prompt(db, user, chat_session) -> str`.

**Sign-off критерии:**
- При новом сообщении в чате attached к study_session — chat_agent получает system prompt с актуальным вопросом
- При запросе вне study_session — получает только weak topics
- Проверить через временный debug log: сохранять system_prompt в `chat_message.cited_sources` как `{"_debug_system_prompt": "..."}` ИЛИ через `logger.info` — на усмотрение Claude Code

---

### Stage 4: Backend — RAG retrieval

**Цель:** добавить семантический поиск по question и concept эмбеддингам, передавать топ-K в system prompt с маркерами для citations.

**Что делать:**

1. Новый модуль `~/tutor_skufs/backend/app/services/rag.py`:
   ```python
   def retrieve(
       db: Session,
       query: str,
       k_questions: int = 3,
       k_concepts: int = 2,
   ) -> dict:
       """
       Returns: {
           "questions": [{"id": "...", "stem_md": "...", "topic_slug": "...", "similarity": 0.87}, ...],
           "concepts": [...]
       }
       """
   ```

2. Внутри:
   - Вызвать `embedding_agent POST /embed` с query текстом → получить вектор 768
   - SQL запрос с pgvector оператором `<=>` (cosine distance):
     ```sql
     SELECT id, stem_md, topic_slug, 1 - (embedding <=> :query_vec) AS similarity
     FROM question
     WHERE status = 'approved' AND embedding IS NOT NULL
     ORDER BY embedding <=> :query_vec
     LIMIT :k
     ```
   - То же для concept (пустая сейчас — вернёт [], это норма)

3. Интеграция в `chat_context.build_context_prompt`:
   - Перед формированием prompt — вызвать `retrieve(query=user_message)`
   - Добавить секцию в system prompt:
     ```
     Relevant questions from the student's curriculum (use citation markers if you reference them):
     - [Q:{id}] {topic_slug}: {stem_md_first_100_chars}...
     - ...

     Relevant concepts:
     - [C:{id}] {title}: {summary_md_first_100_chars}...
     ```

4. Параллельный lookup hints: для каждого retrieved question — подтянуть его hints в context (через тот же SQL, не через эмбеддинги):
   ```
   Hints available for [Q:{id}]:
   - Tier 1: [hint:{id}:1] {hint_text_first_80_chars}
   - Tier 2: ...
   ```

5. Кэш query embedding в LRU (functools.lru_cache по тексту query, size 128) — снижает дубль embedding calls в одной сессии.

**Sign-off критерии:**
- Тестовый запрос: «explain product rule» → retrieve возвращает 3 derivative questions с высоким similarity
- Concept retrieval возвращает [] (concepts пустые) и НЕ падает
- В debug system prompt видно секцию Relevant questions с реальными UUID-маркерами
- Chat ответ упоминает что-то типа `As we saw in [Q:5a3f...], the product rule states...`

---

### Stage 5: Frontend — ChatPanel реальный

**Цель:** превратить заглушку ChatPanel в рабочий UI с SSE подключением, citation pills, привязкой к текущей study_session.

**Что делать:**

1. Заменить содержимое `~/tutor_skufs/frontend/src/components/layout/ChatPanel.tsx`. Старая заглушка идёт под нож.

2. Структура:
   - **Header**: title чата (если есть, иначе «New chat»). Кнопка «🔄 New» — старт новой ChatSession.
   - **Messages list**: прокручиваемый, user/assistant сообщения. AI сообщения — markdown с inline KaTeX (использовать существующий `Math` компонент из `components/ui/`).
   - **Input**: textarea + Send button. Enter — send, Shift+Enter — newline.
   - **Streaming indicator**: пока идёт SSE — последнее assistant сообщение строится буква за буквой, в конце — финализируется.

3. Привязка к текущей сессии:
   - Если URL = `/session/:sessionId` — при первом открытии ChatPanel создавать chat_session с `study_session_id = sessionId`
   - Если URL = `/dashboard` или другая — chat_session без `study_session_id`
   - В `App.tsx` или layout-компоненте — отслеживать смену route, при заходе в новую study_session — кнопка «New chat with this session context» или auto-create на усмотрение Claude Code

4. SSE consumer:
   - Использовать встроенный браузерный `EventSource` НЕ подходит для POST с body. Использовать `fetch` + `ReadableStream` reader, парсить SSE формат вручную.
   - Шаблон: `~/tutor_skufs/frontend/src/api/chatStream.ts` — функция `streamChatMessage(sessionId, content, onChunk, onDone, onError)`.

5. Citation pills:
   - В content_md ответа AI — regex по маркерам `[Q:uuid]`, `[C:uuid]`, `[hint:uuid:tier]`
   - Заменять на React-компоненты `<CitationPill type="Q" id="uuid">Q-derivative-15</CitationPill>` (label берётся из cited_sources, который backend кладёт в chat_message).
   - Клик по pill — пока **только** показать tooltip с full text источника. Без навигации. Навигация на конкретный вопрос — позже.

6. Стили — vanilla CSS Modules в существующем `ChatPanel.module.css`. Letterform compact. Длина чата — fit-content до 70% высоты, дальше скролл. Input pinned к низу панели.

**Sign-off критерии:**
- Открыть `http://192.168.1.11:5200/session/{id}` — справа есть рабочий чат
- Ввести «explain the product rule» → streaming ответ, citation pills рендерятся
- Открыть `/dashboard` — чат тоже работает, но без session_id
- В психоле БД через `psql` или скрипт из Stage 1 — все сообщения сохранены
- Проверить `GET /chat/sessions` — список чатов виден

---

## 4. Полный список новых API endpoints (после Phase 5)

| Метод | Путь | Stage | Auth |
|---|---|---|---|
| POST | /chat/sessions | 1 | yes |
| GET | /chat/sessions | 1 | yes |
| GET | /chat/sessions/{id}/messages | 1 | yes |
| POST | /chat/sessions/{id}/messages | 1 | yes |
| POST | /chat/sessions/{id}/messages/stream | 2 | yes (SSE) |

---

## 5. Что НЕ делаем в Phase 5

- **Haese учебник RAG.** Требует merge `pdf-schema-v2`, миграции, jsonl loader, эмбеддинги для 2039 записей. Отдельная Phase 5.5.
- **UI истории чатов.** Только `GET /chat/sessions` для тебя из терминала.
- **Hint embeddings.** Hints находятся через parent question, отдельно эмбедить не нужно.
- **Search в чате.** UI с поиском по истории — позже, если понадобится.
- **Multi-LLM provider switcher.** Используем то что chat_agent уже использует (Anthropic Claude по умолчанию).
- **Удаление / редактирование сообщений.** Read-only история.
- **Token usage UI.** Сохраняем в БД, в UI не показываем.
- **Кнопка «regenerate response»**. Если ответ плохой — пишем новый вопрос.

---

## 6. Допустимые автономные действия

**Можно без спроса:**
- Создавать/менять файлы в `~/tutor_skufs/backend/app/routers/`, `services/`, `frontend/src/components/`, `api/`
- Ставить новые pip пакеты: `sse-starlette`, `httpx[http2]` если нужны
- Ставить новые npm пакеты ТОЛЬКО если без них реально не обойтись
- Решать как разложить компоненты, имена, файловую структуру внутри одного подэтапа
- Запускать `python -m uvicorn main:app --reload`, `npm run dev`, `psql -d tutor_ib_math -c "..."`
- Писать ad-hoc скрипты в `~/tutor_skufs/scripts/` для тестирования

**Остановиться и спросить:**
- В конце **каждого Stage** — ждать sign-off
- Если chat_agent или orchestrator ведут себя не так как ожидается (запросы зависают, неверный формат SSE, etc.)
- Если embedding_agent возвращает векторы другой размерности чем 768
- Если в `chat_session` или `chat_message` найдены данные тест-сессий от Claude Code до того как Stage 1 завершён (тогда — спросить чистить или нет)
- Если возникает соблазн редактировать `chat_agent` или `embedding_agent` (это **home_services**, не tutor — изменения там НЕ в скоупе)
- Если возникает соблазн добавить state management библиотеку (Redux, Zustand)
- Если что-то требует трогать ветку `pdf-schema-v2`

---

## 7. SPEC.md и MEMORY.md обновления

В конце Phase 5 (после Stage 5 sign-off):

### `SPEC.md`

- Раздел 6 (API): добавить новые `/chat/*` endpoints из раздела 4
- Раздел 8 (LLM/Orchestration): дополнить описание chat flow: frontend → tutor_backend → orchestrator → chat_agent, через SSE proxy, с сохранением в Postgres и RAG обогащением system prompt
- Раздел 9 (RAG): описать что в Phase 5 retrieval работает по `question.embedding` и `concept.embedding` (пустая); Haese учебник — Phase 5.5

### `MEMORY.md`

Добавить запись:

```markdown
### 2026-XX-XX — Phase 5 completed (Chat + RAG MVP)

**Что сделано:**
- Backend: новый router chat.py (sessions CRUD + sync messages + SSE streaming)
- Backend: services/chat_context.py (session context builder) + services/rag.py (pgvector retrieval)
- Frontend: реальный ChatPanel с SSE, citation pills, session context auto-attachment
- Architecture: frontend → tutor_backend → orchestrator → chat_agent, всё через одну точку входа
- RAG: question + concept эмбеддинги, hint lookup через parent question

**Что НЕ сделано (специально):**
- Haese RAG — Phase 5.5
- UI истории чатов — только GET /chat/sessions для терминала
- Token usage UI

**Путь к просмотру чатов:**
- {команда или скрипт, который Claude Code согласует в Stage 1}
```

---

## 8. Definition of Done

Фаза считается законченной, когда:

1. Все 5 Stages подписаны
2. SPEC.md разделы 6, 8, 9 обновлены
3. MEMORY.md содержит запись с конкретной командой для просмотра чатов
4. С браузера `http://192.168.1.11:5200/session/{id}` работает чат с RAG, citation pills видны
5. `GET /chat/sessions` из терминала возвращает список чатов
6. В БД для тестового чата есть user message + assistant message + cited_sources
7. Всё закоммичено в `main` на skufs, push в origin, MacBook подтянул через `git pull`

---

## 9. После Phase 5

- **Phase 5.5** — Haese RAG: merge `pdf-schema-v2`, миграция, loader jsonl → Postgres, эмбеддинги для 2039 записей, расширение `services/rag.py`
- **Phase 6** — Production deploy: nginx + Let's Encrypt + домен + email whitelist + production build + launchd plist
- **Phase 7 / параллельно** — Function Explorer (Plotly, интерактив в Session)
- **Параллельный track** — завершение PDF ingest и расширение syllabus за пределы `calculus.derivatives`
