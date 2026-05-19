# TASK — Frontend Phase 3 (Lesson MVP)

**Дата создания:** 2026-05-19
**Source of truth:** этот файл на skufs (`~/tutor_skufs/TASK_frontend_phase3.md`)
**Зеркало:** MacBook (`~/tutor_macbook/TASK_frontend_phase3.md`)
**Принцип:** правки → skufs → git → MacBook.

---

## 0. Цель фазы

Поднять рабочий фронтенд в `~/tutor_skufs/frontend/`. Сын открывает браузер на ноутбуке в домашней сети и проходит полноценную учебную сессию на 34 одобренных вопросах по `calculus.derivatives` из backend.

**MVP cut:** экран Session работает end-to-end с реальным backend (GET /sessions/today → POST /sessions → /next → /attempts → /hint → /end). Остальные 6 экранов из DESIGN_BRIEF — следующей фазой.

---

## 1. Зафиксированные решения (не пересматривать без явного разрешения)

| Параметр | Решение |
|----------|---------|
| Тема | letterform (cool Plex/Literata, из `tutor_design/`) |
| Density | compact |
| CSS-стратегия | vanilla CSS + CSS Modules (НЕ Tailwind) |
| MathLive | пакет `mathlive` v0.105+, монтируется как custom element `<math-field>` через React `useRef`. НЕ использовать `mathlive-react` или wrapper'ы. |
| Wire format ученик → backend | LaTeX string (`mathfield.value`) |
| Stack | React 18 + TypeScript + Vite |
| Server state | TanStack Query (react-query) |
| Routing | React Router |
| Math rendering | KaTeX (`react-katex` или прямой импорт `katex`) |
| Graphs | Plotly.js (для Function Explorer, не для MVP сессии) |
| HTTP client | `fetch` через типизированный wrapper `src/api/client.ts` |

---

## 2. Расхождения со SPEC.md (исправить в рамках этой задачи)

SPEC.md раздел 7 написан до решений сегодняшней сессии. Два расхождения:

**2.1.** В разделе 7 указан **TailwindCSS**. Удалить из списка библиотек. Заменить на:
> Vanilla CSS + CSS Modules. Глобальные дизайн-токены (CSS custom properties) живут в `src/styles/tokens.css` — портированы из `tutor_design/prototype.html` (тема letterform, режим dark/light как два data-mode, density compact зафиксирована).

**2.2.** В разделе 7 указан пакет **`mathlive-react`**. Такого пакета не существует. Заменить:
> MathLive: пакет `mathlive` (custom element `<math-field>`), интеграция через React `useRef` + императивный API (`mathfield.value`, `mathfield.addEventListener('input', ...)`).

**Действие:** после согласования этого TASK — сделать edit'ы в `SPEC.md` (раздел 7) и добавить запись в `MEMORY.md`:

```markdown
### 2026-05-19 — Frontend stack корректировки

- Tailwind отменён. Едем на vanilla CSS + CSS Modules. Причина: визуальный язык letterform (Plex/Literata/JetBrains Mono) построен на тонкой типографике и CSS custom properties — Tailwind utility-классы не дают нужного контроля.
- `mathlive-react` убран как несуществующий. Используем только `mathlive`.
- Тема: letterform. Density: compact. Принимается как продакшн-дефолт.
- Wire format ответа: LaTeX string. Согласовано с тем что backend уже хранит `reference_answer` как LaTeX и math_agent умеет парсить LaTeX через SymPy.
```

---

## 3. Структура `~/tutor_skufs/frontend/`

Создать с нуля. На skufs сейчас директории `frontend/` нет.

```
~/tutor_skufs/frontend/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── .env.example
├── .gitignore
├── public/
│   └── favicon.svg
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── api/
    │   ├── client.ts            # typed fetch wrapper
    │   └── types.ts             # request/response типы
    ├── pages/
    │   ├── Dashboard.tsx        # заглушка-роут, реальное наполнение — следующая фаза
    │   └── Session.tsx          # ★ главный экран MVP
    ├── components/
    │   ├── layout/
    │   │   ├── TopBar.tsx
    │   │   ├── AppLayout.tsx    # 2-column: main + chat
    │   │   └── ChatPanel.tsx    # ★ stub: показывается, но без логики (Phase 4)
    │   ├── question/
    │   │   ├── QuestionView.tsx
    │   │   ├── MultipleChoice.tsx
    │   │   ├── FreeExpression.tsx   # ★ MathLive
    │   │   ├── FreeNumeric.tsx
    │   │   ├── Flashcard.tsx
    │   │   ├── OrderedSteps.tsx
    │   │   ├── HintsPanel.tsx
    │   │   └── Feedback.tsx
    │   └── ui/
    │       ├── Button.tsx
    │       ├── Card.tsx
    │       └── Math.tsx         # обёртка над KaTeX
    ├── hooks/
    │   ├── useSession.ts
    │   └── useMathfield.ts      # обёртка над MathLive
    ├── styles/
    │   ├── tokens.css           # ★ портировано из prototype.html (letterform)
    │   ├── reset.css
    │   └── global.css
    └── utils/
        └── katex.ts             # safe render helpers
```

★ — компоненты, которые ОБЯЗАТЕЛЬНО реализовать в этой фазе.


---

## 4. API контракт (что фронт реально вызывает в этой фазе)

Из SPEC.md раздел 6, реальная проверка на skufs `:4800` показала что endpoints соответствуют. Auth: HTTP Basic, один пользователь из `.env`.

### Endpoints для MVP сессии

| Метод | Путь | Назначение | Когда вызывается |
|-------|------|-----------|------------------|
| GET | `/health` | Health check (бэк, БД, оркестратор) | На загрузке приложения, каждые 30 сек в фоне |
| GET | `/me` | Текущий пользователь | На загрузке приложения |
| GET | `/sessions/today` | Очередь на сегодня (SRS) | Dashboard mount |
| POST | `/sessions` | Создать сессию | Клик «Start session» |
| POST | `/sessions/{id}/next` | Получить следующий вопрос | После каждого ответа |
| POST | `/attempts` | Отправить ответ | Submit answer |
| GET | `/questions/{id}/hint?tier=N` | Подсказка уровня N (1, 2, 3) | Клик «Show hint» |
| GET | `/questions/{id}/solution` | Полное решение | После tier 3 или ошибки |
| POST | `/sessions/{id}/end` | Завершить сессию, получить summary | Последний вопрос или ручной выход |

### Endpoints вне MVP (заглушки в типах, но не вызывать)

- `/topics`, `/topics/{slug}`, `/concepts/{id}` — следующая фаза (Topic List, Concept Detail)
- `/progress/summary`, `/progress/weak-topics` — Progress View, следующая фаза
- `/chat/*` — Chat Panel, следующая фаза (UI отрисовать как `<aside>` со статичной заглушкой)

### Wire format ответа ученика

POST `/attempts` тело:

```json
{
  "session_id": "uuid",
  "question_id": "uuid",
  "student_answer": "\\frac{d}{dx}[x^{2}\\sin x] = 2x\\sin x + x^{2}\\cos x",
  "time_seconds": 47,
  "hints_used": 0
}
```

`student_answer` — это LaTeX string ровно в том виде, в каком вернул `mathfield.value`. Не нормализуем на фронте. Не пытаемся «упростить». Backend через SymPy сравнивает с `reference_answer`. Если SymPy неоднозначен — math_agent делает fallback на Wolfram (см. SPEC раздел 8).

Для `multiple_choice` ответ — это ключ опции (`"A"`, `"B"`, `"C"`, `"D"`), не текст.
Для `free_numeric` — строка с числом (`"3.14"` или `"22/7"`).
Для `flashcard` — `"got_it"` или `"missed_it"`.
Для `ordered_steps` — массив `step_id`'ов в порядке, который выбрал ученик.

### Ответ backend на /attempts

```json
{
  "attempt_id": "uuid",
  "correct": true,
  "feedback_md": "Correct. Note the symmetric form…",
  "show_solution_next": false,
  "response_quality": 5,
  "srs_next_review_at": "2026-05-22T08:00:00Z"
}
```

Фронт показывает `feedback_md` (рендерится как markdown с inline KaTeX) и SRS-микронотификацию «Scheduled for review in N days» (вычисляется на фронте из `srs_next_review_at` относительно `now()`).

---

## 5. MathLive setup recipe

### Установка

```bash
npm install mathlive
```

Версия должна быть **0.105.0 или новее**. Старые версии имеют другой API.

### Шаблон компонента FreeExpression

`src/components/question/FreeExpression.tsx`:

```typescript
import { useEffect, useRef } from 'react';
import 'mathlive';
import type { MathfieldElement } from 'mathlive';

interface Props {
  value: string;                       // LaTeX string
  onChange: (latex: string) => void;
  onSubmit: () => void;                // Enter key
  disabled?: boolean;
}

export function FreeExpression({ value, onChange, onSubmit, disabled }: Props) {
  const ref = useRef<MathfieldElement>(null);

  // Sync external value → mathfield (controlled-style)
  useEffect(() => {
    if (ref.current && ref.current.value !== value) {
      ref.current.value = value;
    }
  }, [value]);

  // Listen for input events
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onChange(el.value);
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, [onChange]);

  // Enter to submit (Shift+Enter for newline in mathfield)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [onSubmit]);

  return (
    <math-field
      ref={ref as never}
      class="freeexpr-mathfield"
      disabled={disabled || undefined}
    />
  );
}
```

### TypeScript декларация для custom element

`src/types/mathlive.d.ts`:

```typescript
import type { MathfieldElement } from 'mathlive';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement>,
        MathfieldElement
      > & {
        class?: string;
        disabled?: boolean;
      };
    }
  }
}
```

### Стилизация

MathLive можно стилизовать через CSS custom properties. В `src/components/question/FreeExpression.module.css`:

```css
.freeexpr-mathfield {
  display: block;
  width: 100%;
  min-height: 56px;
  padding: 12px 16px;
  font-size: 18px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink);
  --selection-color: var(--accent);
  --selection-background-color: var(--accent-soft);
  --keyboard-toolbar-background: var(--elevated);
  --keyboard-toolbar-text: var(--ink);
}
.freeexpr-mathfield:focus { border-color: var(--accent); }
```

### Чего НЕ делать

- НЕ оборачивать MathLive в дополнительные React-компоненты-обёртки. Custom element работает в JSX напрямую.
- НЕ хранить значение в React state и форсить ререндер на каждый ввод символа — это ломает курсор. Текущий value — это `mathfield.value`, React state синхронизируется через `useEffect` (см. шаблон выше).
- НЕ парсить и не валидировать LaTeX на фронте. Просто шлём строку на backend.
- НЕ использовать `mathfield.getValue('math-json')` в MVP. Только `.value` (LaTeX).


---

## 6. Дизайн-токены: что портировать из `tutor_design/prototype.html`

Сейчас в `tutor_design/prototype.html` определены **обе** темы (octave, letterform) в **обоих** режимах (dark, light) с **обеими** плотностями (cozy, compact). Для продакшна берём только:

- Тема **letterform**, оба режима dark + light (сын учится поздно, нужен ночной режим)
- Плотность **compact** (фиксируется, без переключателя)

### Что переносим в `src/styles/tokens.css`

Скопировать из `prototype.html` строки:

1. `:root` направление-уровень letterform — но без `data-theme` селектора, прямо в `:root`:
   ```css
   :root {
     --accent-hue: 250;
     --accent-chroma-dark: 0.13;
     --accent-chroma-light: 0.15;
     --font-display: 'Literata', Georgia, serif;
     --font-prose:   'Literata', Georgia, serif;
     --font-ui:      'IBM Plex Sans', system-ui, sans-serif;
     --font-mono:    'JetBrains Mono', ui-monospace, monospace;
     --radius: 8px;
     --radius-sm: 4px;
     --chip-radius: 6px;
     --chrome-case: uppercase;
     --chrome-letterspacing: 0.08em;
     --chrome-weight: 500;
     /* compact density — fixed */
     --fs-body: 14px;
     --fs-small: 11.5px;
     --fs-h1: 26px;
     --fs-h2: 18px;
     --pad-card: 16px;
     --pad-screen: 24px;
     --gap: 14px;
   }
   ```

2. `:root[data-mode="dark"]` — все oklch значения dark-варианта letterform из prototype.html.
3. `:root[data-mode="light"]` — все oklch значения light-варианта letterform.

(Реальные значения oklch скопировать **точно** из prototype.html — там они уже подобраны.)

### Где переключается `data-mode`

В `App.tsx`:
```typescript
useEffect(() => {
  const saved = localStorage.getItem('tutor-mode') ?? 'dark';
  document.documentElement.dataset.mode = saved;
}, []);
```

Переключатель в TopBar (иконка солнце/луна) — пишет в localStorage и в `document.documentElement.dataset.mode`. По умолчанию dark.

### Шрифты

Загружать через Google Fonts в `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;0,7..72,600;1,7..72,400&family=IBM+Plex+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap" />
```

(Никаких Newsreader — это octave, не используем.)

---

## 7. Чек-лист реализации

### 7.1. Bootstrap (можно делать без согласования)

- [ ] `cd ~/tutor_skufs && npm create vite@latest frontend -- --template react-ts`
- [ ] Установить зависимости: `mathlive`, `katex`, `react-katex`, `@tanstack/react-query`, `react-router-dom`
- [ ] Конфиг Vite: `server.host = '0.0.0.0'`, `server.port = 5173` (для доступа из LAN)
- [ ] `.gitignore`: `node_modules/`, `dist/`, `.env.local`
- [ ] `.env.example` с `VITE_API_BASE_URL=http://localhost:4800`
- [ ] Скопировать структуру каталогов из раздела 3 этого TASK
- [ ] Создать `src/styles/tokens.css` (раздел 6)
- [ ] Создать `src/styles/reset.css` и `src/styles/global.css` (типографика, body styles)
- [ ] Импортировать стили в `src/main.tsx`
- [ ] Проверить: `npm run dev` → открыть `http://skufs.local:5173` с MacBook, страница пустая но без ошибок в консоли

### 7.2. API layer

- [ ] `src/api/types.ts` — TypeScript типы для всех request/response (раздел 4)
- [ ] `src/api/client.ts` — `apiFetch<T>(path, opts)` с HTTP Basic из `.env.local`, обработка 401/5xx
- [ ] Smoke test: вызвать `GET /health` из `App.tsx` на mount, вывести `JSON.stringify` на страницу

### 7.3. Layout

- [ ] `AppLayout.tsx` — две колонки (main + chat-panel), top bar
- [ ] `TopBar.tsx` — лого, breadcrumb (заглушка), переключатель темы dark/light
- [ ] `ChatPanel.tsx` — **только визуально**, без бизнес-логики. Заглушка с текстом «Tutor chat — coming in Phase 4». Resizable пока не делаем.

### 7.4. Session screen (★ главный)

- [ ] `pages/Session.tsx` — оркестрирует жизненный цикл сессии:
   1. Mount → POST `/sessions` → получить `session_id`
   2. POST `/sessions/{id}/next` → показать вопрос
   3. После submit → POST `/attempts` → показать feedback → кнопка Next
   4. После «End session» или последнего вопроса → POST `/sessions/{id}/end` → SessionSummary
- [ ] `components/question/QuestionView.tsx` — switch по `kind`:
   - `free_expression` → `<FreeExpression>` (MathLive)
   - `multiple_choice` → `<MultipleChoice>`
   - `free_numeric` → `<FreeNumeric>` (обычный input)
   - `flashcard` → `<Flashcard>`
   - `ordered_steps` → `<OrderedSteps>` (drag-to-reorder, можно `@dnd-kit`)
- [ ] `components/question/HintsPanel.tsx`:
   - 3 кнопки tier 1/2/3, появляются последовательно после клика
   - Каждый клик → GET `/questions/{id}/hint?tier=N` → append результат под вопросом
   - Все раскрытые tier'ы остаются видны до конца вопроса
- [ ] `components/question/Feedback.tsx` — correct/incorrect state, рендер `feedback_md` с inline KaTeX
- [ ] Keyboard shortcuts: Enter (submit/next), H (hint), 1-4 (multiple choice)

### 7.5. Math rendering

- [ ] `components/ui/Math.tsx` — обёртка над KaTeX. Поддержать inline (`$...$`) и block (`$$...$$`). Безопасно (`throwOnError: false`).
- [ ] Все `stem_md` и `feedback_md` от backend могут содержать `$...$` — рендер через `Math` или библиотеку типа `react-markdown` + `rehype-katex`.

### 7.6. Health monitoring

- [ ] Top bar показывает статус backend: зелёная точка / жёлтая (degraded) / красная (offline)
- [ ] Источник: GET `/health` каждые 30 сек через `useQuery` с `refetchInterval`

---


## 8. Что НЕ делаем в этой фазе (явный non-goals)

- **Dashboard, Topic List, Topic Detail, Concept Detail, Progress, Function Explorer** — отдельная фаза. В этой фазе их роуты существуют как `<div>Coming soon</div>`.
- **Chat panel логика** — только UI-заглушка. SSE стрим, RAG, citation pills — следующая фаза.
- **Auth UI** — нет страницы логина. HTTP Basic в Vite dev — через `.env.local` с одной парой credentials. В production через nginx (Phase 4).
- **Деплой** — не пишем. Запускаем через `npm run dev` на skufs. Production build (`npm run build`), nginx, launchd plist для фронта — отдельная задача после того как Session screen работает.
- **Тесты** — оставляем на следующую фазу. В MVP важнее увидеть рабочий экран.
- **Резизабельная chat panel, collapse-to-strip, переключатель density** — позже.

---

## 9. Допустимые автономные действия для Claude Code

Чтобы не было лишних остановок на тривиальных решениях:

**Можно без спроса:**
- Создавать файлы внутри `~/tutor_skufs/frontend/` по структуре из раздела 3
- Ставить npm-пакеты из списка раздела 1 («Stack»)
- Подбирать имена CSS-классов, props, локальных переменных
- Решать как разложить компоненты внутри Session screen на под-компоненты
- Писать TypeScript типы для API на основе раздела 4
- Чинить TS-ошибки и линтер
- Гонять `npm run dev` для проверки

**Остановиться и спросить:**
- Если API endpoint из раздела 4 ведёт себя не так как описано (несоответствие SPEC ↔ реальность)
- Если KaTeX не рендерит выражение из реального вопроса (это может быть проблема с экранированием обратных слешей)
- Если MathLive ведёт себя не так как в шаблоне раздела 5
- Если возникает соблазн добавить библиотеку, которой нет в списке раздела 1
- Если что-то противоречит зафиксированным решениям раздела 1

---

## 10. Definition of Done

Фаза считается законченной, когда:

1. С MacBook через браузер открывается `http://skufs.local:5173`
2. Видна шапка с переключателем темы (dark/light работает, остальное — заглушки)
3. Кнопка «Start session» создаёт сессию через backend
4. Появляется реальный вопрос из БД (`calculus.derivatives`)
5. Для `free_expression` работает MathLive — сын может ввести `\frac{d}{dx}[x^2 \sin x]`
6. Submit отправляет LaTeX на `/attempts`, видно correct/incorrect feedback
7. Кнопка «Show hint» открывает tier 1, повторно — tier 2, и так до tier 3
8. После последнего вопроса показывается summary
9. SPEC.md раздел 7 обновлён (TailwindCSS → CSS Modules; убран `mathlive-react`)
10. В MEMORY.md появилась запись о смене стека (см. раздел 2 этого TASK)
11. Всё закоммичено на skufs и запушено в GitHub, MacBook подтянул через git pull

---

## 11. После завершения фазы — что дальше

Phase 3.5 (если Session работает чисто):
- Dashboard с реальной очередью SRS
- Topic List + Topic Detail (использовать GET /topics)
- Concept Detail (использовать GET /concepts/{id})

Phase 3.6:
- Progress View
- Function Explorer

Phase 4:
- Chat Panel с реальной логикой (SSE, RAG, citations)
- nginx + email whitelist + домен
- Production build + launchd plist для статики
