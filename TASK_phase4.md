# TASK — Phase 4 (Lesson UX Completion)

**Дата создания:** 2026-05-21
**Source of truth:** `~/tutor_skufs/TASK_phase4.md`
**Зеркало:** `~/tutor_macbook/TASK_phase4.md` через git pull
**Принцип:** правки → skufs → git → MacBook.

---

## 0. Цель фазы

Достроить недостающие экраны вокруг работающего Session screen, чтобы tutor стал **используемым продуктом**, а не одной изолированной страницей вопросов.

После Phase 3 у сына есть только `/session` — открыл, прошёл вопросы. Нет навигации, нет выбора тем, нет прогресса, нет понимания «что учить дальше».

Phase 4 закрывает этот gap для всех 7 экранов из DESIGN_BRIEF, кроме одного — Function Explorer (не критичен для daily use, переносится в отдельную фазу).

**Что НЕ входит в Phase 4** (явно):
- Chat panel с реальной логикой (SSE, RAG, citations) — отдельная фаза 5
- Production deploy (nginx, TLS, домен, email whitelist) — отдельная фаза 6
- Function Explorer — отдельная фаза
- PDF ingest завершение и новые topics — параллельный content track, не code-фаза

---

## 1. Предварительная задача (ОБЯЗАТЕЛЬНА перед любой другой работой)

**Закоммитить untracked backend файлы и modified `main.py`.**

На skufs прямо сейчас в `~/tutor_skufs/`:

```
 M backend/main.py
 M frontend/vite.config.ts
?? backend/app/routers/attempts.py    (146 строк, грейдинг + SRS update)
?? backend/app/routers/auth.py        (35 строк, HTTP Basic single-user)
?? backend/app/routers/questions.py   (57 строк, /hint, /solution)
?? backend/app/routers/sessions.py    (209 строк, /sessions/today, POST /sessions, /next, /end)
?? backend/app/routers/users.py       (14 строк, /me)
```

Эти файлы реализуют **весь backend MVP из Phase 3**. Они работают (frontend `:5200` нормально с ними разговаривает), но не в git. Без них Phase 4 фронт работать не сможет.

**Действия:**
1. `cd ~/tutor_skufs`
2. `git status` — убедиться что состояние совпадает с описанным выше
3. Прочитать содержимое каждого untracked роутера, чтобы понимать что коммитим
4. `git add backend/app/routers/attempts.py backend/app/routers/auth.py backend/app/routers/questions.py backend/app/routers/sessions.py backend/app/routers/users.py backend/main.py frontend/vite.config.ts`
5. Один коммит с понятным сообщением: `feat(phase3): backend API endpoints — auth, sessions, attempts, questions, users`
6. `git push origin main`
7. На MacBook: `git pull` (если используется для разработки)

**Чего НЕ делать:**
- НЕ рефакторить эти роутеры
- НЕ исправлять "стиль" или "очевидные улучшения"
- НЕ добавлять тестов задним числом — будут отдельной задачей
- НЕ менять API контракт — frontend Phase 3 уже завязан на текущие request/response shapes

---

## 2. Зафиксированные решения Phase 3 (продолжают действовать)

Не пересматривать без явного разрешения:

| Параметр | Решение |
|---|---|
| Тема | letterform (Plex/Literata) |
| Density | compact |
| CSS | vanilla CSS + CSS Modules |
| MathLive | пакет `mathlive` v0.105+, custom element, LaTeX wire format |
| Wire format ответа | LaTeX string |
| Stack | React 18 + TypeScript + Vite + TanStack Query + React Router |
| Auth | HTTP Basic single-user, креды из `frontend/.env.local` |
| Backend port | 4800 |
| Frontend port | 5200 (был 5173 в TASK Phase 3, фактически выставлен 5200) |

---

## 3. Backend изменения (новые endpoints)

Все новые роутеры идут в `~/tutor_skufs/backend/app/routers/`. Подключать в `main.py` рядом с существующими.

### 3.1. `topics.py` (новый)

```
GET /topics
  → список всех топиков (плоский, не дерево):
    [{ "slug": "calculus.derivatives", "title": "...", "kind": "leaf",
       "approved_questions": 25, "due_count": 3 }, ...]
  Сортировка: по slug.
  Поля approved_questions, due_count считаются JOIN-ом
    к question / srs_card соответственно (для текущего user из auth).

GET /topics/{slug}
  → детали топика:
    { "slug": "calculus.derivatives",
      "title": "Derivatives",
      "kind": "leaf",
      "description_md": "<from topic.description_md if exists, иначе пусто>",
      "concepts": [{ "concept_id": "...", "title": "...", "summary_md": "..." }, ...],
      "approved_questions": 25,
      "due_count": 3,
      "mastery": 0.42 }
  mastery = среднее по response_quality последних 20 attempt'ов по questions топика, нормализовано в [0,1].
  Если attempt'ов нет — mastery = null (фронт показывает "—").
```

### 3.2. `concepts.py` (новый)

В БД таблица `concept` существует, но **сейчас пустая**. Endpoint должен:
- работать даже если concepts пустые (вернуть 404 с понятным detail)
- НЕ падать с 500

```
GET /concepts/{concept_id}
  → { "concept_id": "...", "title": "...", "summary_md": "...",
      "topic_slug": "...",
      "key_formulas": [...],     // если есть в БД
      "common_mistakes_md": "..." // если есть }
```

Если в БД нет соответствующих колонок — вернуть только то, что есть, остальные ключи опустить (не null, именно отсутствующий ключ).

### 3.3. `progress.py` (новый)

```
GET /progress/summary
  → { "total_attempts": N,
      "total_correct": M,
      "accuracy": 0.78,
      "streak_days": 3,
      "minutes_today": 17,
      "minutes_week": 142,
      "due_today": 5,
      "due_this_week": 18 }

  streak_days считается как количество последовательных дней (включая сегодня),
  в которых был хотя бы один attempt у этого user. UTC дни.

  minutes_today, minutes_week суммируются из attempt.time_seconds / 60.

  due_today, due_this_week — count srs_card WHERE due_at <= now / due_at <= now+7d.

GET /progress/weak-topics?limit=5
  → [{ "topic_slug": "...", "title": "...",
        "accuracy": 0.42, "attempts": 12 }, ...]

  Считается по последним 50 attempt'ам user'а, группировка по topic.
  Сортировка: по accuracy ASC (худшие первыми). limit default 5, max 20.

GET /progress/activity?days=30
  → { "days": [
        { "date": "2026-05-21", "attempts": 12, "correct": 9, "minutes": 18 },
        ...
      ] }
  Один объект на каждый день из последних N дней (UTC, считая сегодня).
  Дни без активности — attempts: 0, correct: 0, minutes: 0.
```

### 3.4. Доработка `sessions.py`

В существующем `GET /sessions/today` поле `topics: []` сейчас всегда пустое. Заполнить:

```
GET /sessions/today
  → { "due_count": N,                    # уже есть
      "topics": [                         # ★ дополнить
        { "topic_slug": "...",
          "title": "...",
          "due_count": 3,
          "approved_questions": 25 },
        ...
      ],
      "suggested_topic_slug": "calculus.derivatives"  # ★ новое
    }

  topics: все топики где у user есть due_count > 0 ИЛИ approved_questions > 0
          (то есть всё с чем можно работать), max 10, sort by due_count DESC.

  suggested_topic_slug: топик с максимальным due_count; если все нули — топик
                       с минимальной accuracy за последние 30 дней; если и таких
                       нет — первый approved.
```

### 3.5. Что НЕ делаем в backend

- НЕ трогаем `/health`, `/me`, `/sessions` (POST), `/sessions/{id}/next`, `/sessions/{id}/end`, `/attempts`, `/questions/{id}/hint`, `/questions/{id}/solution` — они работают, Phase 3 frontend на них завязан
- НЕ переписываем `_grade()` в `attempts.py` — есть TODO с math_agent fallback, оставить как есть
- НЕ добавляем Alembic миграцию — все нужные таблицы уже в БД (topic, concept, srs_card, attempt, question)
- НЕ трогаем `pdf-schema-v2` ветку и её изменения схемы (textbook_*, source_document) — это отдельная фаза

---

## 4. Frontend изменения (новые страницы и навигация)

### 4.1. Роутинг

В `App.tsx` сейчас, судя по структуре файлов, минимальная навигация. Расширить до:

```
/                      → Dashboard (★ полная реализация)
/topics                → TopicList (★ новая)
/topics/:slug          → TopicDetail (★ новая)
/concepts/:id          → ConceptDetail (★ новая)
/session/:sessionId    → Session (существует, не трогать функционально)
/session/new?topic=X   → создаёт сессию, редиректит на /session/:id
/progress              → ProgressView (★ новая)
```

Function Explorer (`/function-explorer`) — **НЕ В Phase 4**.

### 4.2. Dashboard (`pages/Dashboard.tsx`)

Полная замена существующей заглушки. Из DESIGN_BRIEF — главная страница, на которой сын приземляется при заходе.

Источники данных:
- `GET /sessions/today` → due_count, topics, suggested_topic_slug
- `GET /progress/summary` → streak_days, minutes_today, minutes_week, accuracy
- `GET /progress/weak-topics?limit=3` → 3 слабых топика

Структура (по DESIGN_BRIEF, letterform compact):
1. **Hero block**: "Welcome back, [name]" + большая кнопка `Start today's session` (использует `suggested_topic_slug`)
2. **Stats row**: 4 карточки (streak | minutes_today | accuracy | due_count)
3. **Today's queue**: список topics из `/sessions/today` с кнопкой "Start" у каждого
4. **Needs attention**: 3 weak topics — компактный список с accuracy badge

Не делать активность-график на dashboard в этой фазе — он на `/progress`.

### 4.3. TopicList (`pages/TopicList.tsx`)

```
GET /topics → плоский список
```

Структура:
- Поиск/фильтр (только клиентский, по title/slug)
- Список как карточки или строки (выбрать что лучше читается в compact density)
- На каждом топике: title, slug (мелким), approved_questions count, due badge если due_count > 0
- Клик по топику → `/topics/:slug`

Если `/topics` возвращает пустой список — empty state "No topics yet" (но в реальности есть `calculus.derivatives`).

### 4.4. TopicDetail (`pages/TopicDetail.tsx`)

```
GET /topics/:slug → детали + concepts
```

Структура:
- Заголовок: title топика
- Description (если есть)
- Кнопка `Start session` → POST `/sessions { topic_slug }` → redirect на `/session/:id`
- Mastery bar (визуально показать mastery 0..1)
- Stats: approved_questions, due_count
- Список concepts — каждый clickable, ведёт на `/concepts/:id`
- Если concepts пусты — секция "Concepts" не показывается вообще (не "No concepts")

### 4.5. ConceptDetail (`pages/ConceptDetail.tsx`)

```
GET /concepts/:id
```

Простой read-only экран:
- Заголовок: title concept'а
- summary_md (рендерить через существующий `Math` компонент + markdown)
- key_formulas (если есть) — каждая в KaTeX block
- common_mistakes_md (если есть) — отдельная секция

Сейчас в БД concepts пустые. Этот экран должен корректно отображать 404 "Concept not found" с навигационной подсказкой, как только real concepts появятся — заработает автоматически.

### 4.6. ProgressView (`pages/ProgressView.tsx`)

```
GET /progress/summary
GET /progress/weak-topics?limit=10
GET /progress/activity?days=30
```

Структура:
- Верх: те же 4 stats карточки что на Dashboard (можно вынести в общий компонент `StatsRow`)
- Activity heatmap или bar chart по дням за 30 дней — простая визуализация без сторонних либ, чистый SVG или CSS grid
- Weak topics — расширенный список (до 10)
- Streak detail: "N days in a row", дата последней сессии

### 4.7. Layout / навигация

В `AppLayout` добавить sidebar или top-nav links:
- Home (`/`)
- Topics (`/topics`)
- Progress (`/progress`)

Активная страница highlighted (CSS state). Что-то простое, без анимаций.

ChatPanel в layout остаётся как stub из Phase 3 — не трогать.

---

## 5. API контракт (полный, после Phase 4)

Сводная таблица того, что frontend ожидает от backend после Phase 4:

| Метод | Путь | Phase | Auth | Использует |
|---|---|---|---|---|
| GET | /health | 3 | no | App startup, polling 30s |
| GET | /me | 3 | yes | App startup |
| GET | /sessions/today | 3+4 | yes | Dashboard |
| POST | /sessions | 3 | yes | TopicDetail "Start session" |
| POST | /sessions/{id}/next | 3 | yes | Session |
| POST | /sessions/{id}/end | 3 | yes | Session |
| POST | /attempts | 3 | yes | Session |
| GET | /questions/{id}/hint?tier=N | 3 | yes | Session |
| GET | /questions/{id}/solution | 3 | yes | Session |
| GET | /topics | **4** | yes | TopicList |
| GET | /topics/{slug} | **4** | yes | TopicDetail |
| GET | /concepts/{id} | **4** | yes | ConceptDetail |
| GET | /progress/summary | **4** | yes | Dashboard, ProgressView |
| GET | /progress/weak-topics | **4** | yes | Dashboard, ProgressView |
| GET | /progress/activity | **4** | yes | ProgressView |

---

## 6. SPEC.md и MEMORY.md обновления

В конце Phase 4 (после того как всё работает):

### `SPEC.md` раздел 6 (API)

Дополнить таблицу новыми endpoints из раздела 5 этого TASK. Старые не трогать.

### `MEMORY.md`

Добавить запись:

```markdown
### 2026-XX-XX — Phase 4 completed (Lesson UX completion)

**Что сделано:**
- Backend: новые роутеры topics.py, concepts.py, progress.py; дополнен /sessions/today
- Frontend: 5 новых страниц — Dashboard, TopicList, TopicDetail, ConceptDetail, ProgressView
- Навигация в AppLayout, активный link state
- API контракт окончательно зафиксирован (см. SPEC раздел 6)

**Что НЕ сделано (специально):**
- Function Explorer — отдельная фаза
- Chat panel реальная логика — Phase 5
- Production deploy — Phase 6
- Backend tests — отложены
```

---

## 7. Definition of Done

Фаза считается законченной, когда:

1. Untracked backend файлы Phase 3 (раздел 1 этого TASK) закоммичены и запушены
2. С MacBook через браузер открывается `http://192.168.1.11:5200/` (или `http://skufs.local:5200/`)
3. На `/` — Dashboard со статистикой, today's queue, weak topics, кнопка Start session работает
4. `/topics` показывает список с `calculus.derivatives` и его метаданными
5. `/topics/calculus.derivatives` показывает детали + кнопка Start session создаёт сессию
6. `/concepts/<любой-id>` — корректный 404 с навигацией (concepts пока пустые)
7. `/progress` показывает statistics, weak topics, 30-day activity
8. Навигация работает, активная страница подсвечена
9. Существующий `/session/:id` функционал не сломан — сын может пройти сессию end-to-end
10. SPEC.md раздел 6 обновлён
11. MEMORY.md содержит запись о Phase 4
12. Всё закоммичено и запушено, MacBook подтянул через `git pull`

---

## 8. Допустимые автономные действия

**Можно без спроса:**
- Создавать/менять файлы в `~/tutor_skufs/frontend/` и `~/tutor_skufs/backend/app/routers/`
- Ставить новые npm пакеты ТОЛЬКО если без них реально не обойтись (предпочесть vanilla solution)
- Решать как разложить компоненты, какие имена давать, как формировать CSS Modules имена
- Чинить TypeScript ошибки и линтер
- Гонять `npm run dev` и `python -m uvicorn main:app --reload` для проверки
- Запускать миграции Alembic ТОЛЬКО если новые таблицы реально нужны (в этой фазе не должны — все существующие)

**Остановиться и спросить:**
- Если untracked backend файлы из раздела 1 окажутся не такими как описано — описать что не так, не коммитить
- Если что-то противоречит решениям Phase 3 (раздел 2)
- Если возникает соблазн поменять `_grade()` или существующие endpoints
- Если нужна новая БД таблица или миграция
- Если возникает соблазн добавить state management (Redux, Zustand) — оставить как есть, TanStack Query достаточно
- Если что-то требует трогать ветку `pdf-schema-v2`

---

## 9. После Phase 4

- **Phase 5**: Chat panel реальная логика (SSE stream от orchestrator, RAG retrieval, citation pills, llm-council интеграция)
- **Phase 6**: Production deploy (nginx, Let's Encrypt, домен, email whitelist через nginx auth, launchd plist для статики, production build)
- **Phase 7 / параллельно**: Function Explorer (Plotly.js, интерактивная функция в Session screen для visual концептов)
- **Параллельный track**: завершение PDF ingest (15 оставшихся секций) и расширение syllabus за пределы `calculus.derivatives`
