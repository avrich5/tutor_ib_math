# Design Brief — IB Math Tutor Web App

**Project:** tutor_ib_math  
**For:** UI/UX Designer  
**Date:** 2026-05-17  
**Access:** Home LAN only for now (later: own domain, TBD)  
**Devices:** Desktop and laptop only — no mobile, no tablet  
**Stack (FYI, not your constraint):** React + Vite + TailwindCSS + KaTeX + MathLive  

---

## What this is

A personal web-based math tutor for one student — a 16-year-old (DP1, IB Year 12)
studying for IB Math Analysis & Approaches Higher Level.
He opens it at home before exams, after school, on weekends.
There is no public audience, no sign-up flow, no marketing.

This is not a SaaS product. Design for depth, focus, and daily use —
not for acquisition or first-time impressions.

The closest reference points in terms of purpose:
**Anki** (spaced repetition drilling) + **Wolfram Alpha** (math authority)
+ a good private tutor who sits beside you and gives hints without giving away the answer.

---

## The student and how he studies

- 17 years old, IB DP1, fluent in English (language of the exam)
- Studies on a MacBook (school) and a Lenovo (home) — both laptop form factor,
  wide enough for the two-column layout
- Outside math: music and sport — he is not a "computer person" by identity,
  he is a person who uses computers. The tool should feel natural, not geeky.
- Sessions are typically 20–40 minutes, 10–20 questions per session
- He is not a passive reader — he solves problems, enters answers, makes mistakes,
  asks follow-up questions
- He will use this daily for two years — design for habituation, not novelty
- Streaks and scores matter, but should not feel like a game. He is serious
  about the subject — treat him accordingly.
- The tutor chat panel is always available — he should feel like there is someone
  to ask when he is stuck, without having to admit he is stuck to anyone

---

## Layout: the one rule that governs everything

Every authenticated page has this structure:

```
┌─────────────────────────────────────────────────────────────────┐
│  Top bar                                                        │
├──────────────────────────────────────┬──────────────────────────┤
│                                      │                          │
│  Main content area                   │  Chat panel              │
│                                      │  (right side,            │
│                                      │   full height,           │
│                                      │   collapsible)           │
│                                      │                          │
└──────────────────────────────────────┴──────────────────────────┘
```

- Chat panel is **always present** on every screen — not a modal, not a drawer,
  a permanent column. Default width: ~380px. Resizable by drag. Collapsible
  to a narrow icon strip.
- Main content area gets the rest of the width.
- Top bar is minimal — logo, current topic breadcrumb, streak indicator, settings icon.

This layout is a hard constraint from the engineering spec. Everything else —
visual language, color, typography, spacing, component style — is your creative call.

---

## The 7 screens to design

### 1. Dashboard

The first thing the student sees after login.

**Functional elements (all required):**

- **Today's queue** — a count + visual indicator of questions due today
  (SRS-scheduled). The primary CTA is "Start session" — it should be the most
  obvious action on the page.
- **Streak** — days studied in a row. Simple, not loud.
- **Recent activity** — last 3–5 sessions with topic name, score, date.
- **Weak topics** — a short list of subtopics where accuracy is lowest,
  with a "Drill this" shortcut.
- **Topic overview** — the 5 AA HL topics as an entry point to browse
  (not the primary action, secondary navigation).

**UX note:** The student should be able to go from opening the app to answering
the first question in under 3 clicks. Dashboard → Start session → first question.

---

### 2. Topic List + Topic Detail

**Topic List:**
5 main IB AA HL topics, each expandable to subtopics:

```
Number & Algebra
  └ Sequences & Series
  └ Exponents & Logs
  └ Complex Numbers
  └ ...
Functions
Geometry & Trigonometry
Statistics & Probability
Calculus
  └ Limits
  └ Derivatives  ← this is where content starts
  └ Integrals
  └ ...
```

Each topic card shows: mastery percentage, questions available, last studied date.

**Topic Detail:**
One subtopic expanded. Shows:
- Description and key concepts
- Mastery bar
- List of concepts/theorems for this subtopic (clickable → Concept Detail)
- "Start drill" CTA for this specific subtopic
- Recent attempt history for this subtopic

---

### 3. Lesson / Session Screen

**This is the most important screen. Design it last, but design it best.**

The student spends 90% of his time here. Every detail matters.

#### Layout within the main content area:

```
┌──────────────────────────────────────────────┐
│ Header: Topic > Subtopic  │  3 / 15  │ 04:32 │
├──────────────────────────────────────────────┤
│                                              │
│  Question stem                               │
│  (math rendered with KaTeX)                  │
│                                              │
│  ─────────────────────────────────           │
│                                              │
│  Answer input area                           │
│  (depends on question type — see below)      │
│                                              │
│  [ Submit ]          [ I need a hint ]       │
│                                              │
└──────────────────────────────────────────────┘
```

#### Question types — the input area changes per type:

**free_expression / free_numeric** — MathLive input field.
This is a visual math editor where the student types math notation
(fractions, exponents, integrals, Greek letters). It renders as proper
typeset math as he types. The input field should feel like a first-class
citizen of the layout — not an afterthought text box. It has a toolbar
(fractions, powers, trig, integral symbols). Design how this toolbar
integrates with your visual language.

**multiple_choice** — 4 options (A, B, C, D), rendered with KaTeX if they
contain math. Selectable, keyboard-navigable (1/2/3/4 or A/B/C/D).
Your UX call: does selecting an option submit immediately, or require a
confirm button? Annotate your reasoning.

**flashcard** — shows the front (term or prompt). Flipped by spacebar or
click to reveal the back (definition or theorem). After reveal: two buttons —
"Got it" and "Missed it" (self-rating). No math input required.

**ordered_steps** — a list of solution steps shown in scrambled order.
The student drags to reorder. Submit when satisfied with the sequence.

#### After submit — feedback states:

**Correct:**
- Clear positive signal — color, icon, brief text. Not a celebration,
  but unambiguous and satisfying.
- A brief contextual note if relevant:
  *"Correct. Note that the commutative form 2x·sin(x) + x²·cos(x) is equally valid."*
- "Next →" CTA appears. Keyboard shortcut: Enter or →.

**Incorrect:**
- No red alarm. No shame.
- Gentle: *"Not quite. Want to try again, or see a hint?"*
- Two options: **Try again** (clears input, same question restated)
  or **Show hint** (reveals Tier 1).

#### The hint system — this is the pedagogical core

Three tiers, revealed one at a time, always by the student's choice.
This is not an automatic reveal — the student decides when he needs more help.

**Tier 1 — Recall:**
Points at a theorem or definition. Does not name the method.
Example: *"Recall what the Product Rule says about the derivative of two functions multiplied together."*
Feels like a professor raising an eyebrow.

**Tier 2 — Apply:**
Names the method and points at the structure of this specific problem.
Example: *"Let u = x² and v = sin(x). What are u′ and v′ individually?"*

**Tier 3 — Full solution:**
Step-by-step walkthrough. Each step on its own line. Math rendered with KaTeX.
This is the full answer — the student has asked for it, so show it clearly.

**UX rules for hints (non-negotiable):**

1. Hints append below the question — they do not replace it or open in a modal.
2. Each new tier appends below the previous one. After requesting Tier 3,
   all three tiers are visible simultaneously, along with the original question
   stem and the student's answer attempt.
3. The student should be able to read all three tiers and the question together,
   scrolling if necessary.
4. After Tier 3 appears: a "I understand, continue →" button. No forced wait.
5. If the student leaves and returns to this question mid-session,
   the already-revealed hints remain visible. Progress is never hidden.

#### Session end screen:

After the last question in a session, a summary:
- Score: e.g. 12 / 15
- Time spent: e.g. 18 minutes
- List of missed questions (stem preview + "Review" link per question)
- SRS scheduling note: *"3 questions scheduled for review in 2 days."*
- Two CTAs: **Done** (back to dashboard) and **Practice missed questions** (new session, same questions)

---

### 4. Concept Detail

Shown when the student clicks a concept or theorem —
from Topic Detail, from a hint ("Recall the Product Rule"),
or from a chat citation pill.

**Functional elements:**
- Title and kind badge: Definition / Theorem / Method / Axiom
- Statement — mathematical prose with KaTeX rendering
- Proof or derivation (collapsible — collapsed by default, available for HL)
- Worked examples: 1–3, each collapsible, each showing the full solution
- "Questions that test this concept" — a short linked list of 3–5 questions
- Related concepts (as footer links or a sidebar)

This screen is a reference page. The student arrives here while studying,
reads what he needs, and goes back. It should feel like a well-typeset
textbook page — generous whitespace around the math, clear hierarchy.

---

### 5. Progress View

An honest picture of where the student stands across the whole curriculum.

**Functional elements:**
- Mastery by topic — 5 AA HL topics with percentage and a visual bar
- Accuracy over time — a simple chart: last 30 days, questions attempted vs correct
- Weak subtopics — ranked list, lowest accuracy first, with "Drill" shortcut
- Streak calendar — a heatmap of study days (GitHub contribution style)
- Session history — table: date, topic, questions, score, duration

No AI narrative in this phase. Clean data only.
The student should be able to glance at this page and immediately understand
where to focus next.

---

### 6. Function Explorer

An interactive graphing tool. Used standalone and embedded in some lesson questions.

**Functional elements:**
- A Plotly graph — you design the chrome around it
- Expression input: the student types any function, e.g. f(x) = x³ - 2x + 1
- Parameter sliders: for functions with parameters (e.g. f(x) = ax² + bx + c),
  sliders for a, b, c — drag a slider and the graph updates in real time
- Tabs: **Graph** | **Derivative** | **Integral** | **Properties**
- Properties panel: roots, extrema, inflection points, asymptotes —
  computed and listed as the function changes

Used for intuition-building. The student might spend 5 minutes here
dragging a slider and watching how the derivative changes shape.
Design for exploration, not for grading.

---

### 7. Chat Panel (persistent component on all screens)

Not a separate page — a permanent right-side panel.
Needs full design because it is complex and always visible.

**Message list:**
- Conversation history for the current session
- User messages: right-aligned
- Tutor responses: left-aligned, math rendered with KaTeX
- Streaming state: tutor response appears token by token — design the
  in-progress state (a soft cursor, partial text, typing indicator)

**Citation pills:**
When the tutor references a concept or past question, a small clickable pill
appears in or below that message:
*[Product Rule ↗]* or *[Q: Differentiate x²sin(x) ↗]*
Clicking a citation opens that content in the main area — without closing chat,
without losing the conversation.

**Input area:**
- Textarea: starts at 1 row, expands up to ~5 rows as the student types
- Enter to send, Shift+Enter for newline
- The student can type math in the chat (MathLive inline input)
- A small "context chip" at the top of the input area shows what the student
  is currently studying: *"Studying: Derivatives → Product Rule"*
  This makes the AI context-aware — and the student can see it.

**Collapsed state:**
The panel collapses to a narrow icon strip on the right edge.
It shows an unread message count if the tutor has replied.
Expanding it animates open.

**Tone:** The chat should feel like a knowledgeable tutor who is always there,
not a chatbot widget. It lives to the right and waits patiently.
When the student turns to it, it is present and capable.

---

## Functional details the design must account for

These are specific behaviors from the engineering spec.
Annotate in Figma how your design handles each one.

### Real math everywhere
All math in stems, hints, solutions, concept text, and chat responses
is rendered by KaTeX — beautiful typeset LaTeX, not plain text.
Your mockups must show actual IB-style math notation.
Do not write "formula here." Use real expressions:
$\frac{d}{dx}[x^2\sin x] = 2x\sin x + x^2\cos x$,
$\int_0^\pi \sin x\,dx = 2$, $z = re^{i\theta}$.
If you are not comfortable with LaTeX notation, ask and I will supply examples.

### MathLive input
The answer field for free_expression questions is not a text box.
It is a visual math editor that renders as the student types.
Install it and try it for 5 minutes before designing:
`npm install mathlive` — open in any browser.
It has a built-in symbol toolbar. Design how that toolbar sits in your layout.

### SRS micro-notification
After each question is answered, the SRS engine quietly schedules the next review.
The student should see a small, non-intrusive note:
*"Scheduled for review in 3 days"* — a line of text, not a modal.
It disappears when he moves to the next question.

### Keyboard shortcuts
The student is at a laptop. He should almost never need the mouse during a session.
Common shortcuts:
- Submit: Enter
- Next question: Enter or →
- Hint: H
- Multiple choice: 1/2/3/4 or A/B/C/D
- Flashcard flip: Space
- Chat send: Enter (Shift+Enter for newline)
- Collapse/expand chat: Cmd+\

Show a keyboard shortcut legend on the lesson screen
(a small ? button or a footer strip). Annotate all shortcuts in your design.

### Loading and streaming states
- Chat: response streams word by word — partial text visible with a cursor
- Answer grading: a brief (300–500ms) state between submit and feedback
- Hint loading: up to 2s if the hint comes from the server
- Session loading: first question appearing after "Start session"
- None of these should look like broken UI. Each needs a considered treatment.

### Offline / server down
The server runs on the local network. If it goes down:
- A quiet indicator in the top bar: e.g. a dot that turns amber
- The student can still browse topics and read past content (static data)
- Chat shows: *"Tutor is unavailable right now"*
- Submit shows: *"Cannot grade — server offline. Try again in a moment."*
Design these states. They will happen.

---

## Visual direction: entirely yours

Nothing below is prescribed. Context only — use it or discard it.

**Who this is for:**
17 years old. Music and sport alongside math and physics.
He switches between a MacBook and a Lenovo — both laptops, both fine.
He is not defined by his software taste. He does not spend time in Figma or Linear.
He uses Spotify, YouTube, maybe Notion for school notes.
He knows what feels good and what feels cheap, even if he cannot articulate why.

**The key tension to resolve:**
This tool needs to feel serious enough that he respects it,
and approachable enough that opening it does not feel like a chore.
A 17-year-old who also plays music has aesthetic sensibility —
he will notice if something is ugly or if something is trying too hard.
Neither is acceptable.

**Two years of daily use.**
Novelty fades in a week. Design for session 400, not session 1.
The interface should feel like a well-worn notebook — familiar, personal,
efficient. Not exciting. Reliable.

**Math is the content.**
KaTeX renders beautiful, precise typeset math — the same quality as a printed
textbook. Your design should give it space and step back.
The math is the star. The UI is the stage.

**On dark mode:**
He studies at night, with music on. Dark mode is not optional.
Design dark and light as two fully considered skins — not one inverted from the other.
The dark version should feel calm and focused, not dramatic.

**On the music / sport side of him:**
Do not design a sterile academic tool. He has taste.
There is room for a visual identity that has some character —
a considered color, a typographic choice that is not just "system default",
a moment of craft in the details. Do not be afraid of that.
But keep it subordinate to the content.

**What we do not want:**
- Gamification that feels patronising (coins, XP bars, achievement pop-ups)
- Edtech beige — the washed-out blue-and-white that every learning app uses
- Decorative illustration that competes with math notation for visual attention
- Aggressive animation
- Anything that looks like it was designed for a 12-year-old
- Anything that looks like it was designed for a 40-year-old enterprise user

**What we do want:**
- Immediate spatial clarity — he always knows where he is and what to do next
- A quiet confidence in the layout — nothing fights for attention unnecessarily
- Typography that handles Latin prose and mathematical notation equally well
  (this is harder than it sounds — math and prose want different things from a typeface)
- A design a 17-year-old would genuinely not mind spending an hour in
- Some personality. Not a lot. Some.

---

## Deliverables

**1. Figma file** — shared with edit access

**2. Full-fidelity screens** (both light and dark mode for each):

Session / Lesson screen states:
- Question: free_expression (MathLive input, blank)
- Question: free_expression (MathLive input, answer entered, before submit)
- Question: multiple_choice
- Question: flashcard (front)
- Question: flashcard (back revealed, self-rating)
- Question: ordered_steps
- Feedback: correct answer
- Feedback: incorrect answer (retry / hint prompt)
- Hint: Tier 1 revealed
- Hint: Tier 1 + Tier 2 revealed
- Hint: Tier 1 + Tier 2 + Tier 3 (full solution) revealed
- Session end summary

Other screens:
- Dashboard
- Topic List
- Topic Detail (one subtopic expanded)
- Concept Detail
- Progress View
- Function Explorer
- Chat panel: open + streaming state
- Chat panel: collapsed state
- Top bar: server offline state

**3. Component library in Figma:**
- Button (default / hover / active / disabled)
- MathLive input field (empty / active / with content)
- Hint component (each tier, each reveal state)
- Flashcard (front / back / self-rating)
- Multiple choice option (unselected / selected / correct / incorrect)
- Topic card with mastery bar
- Chat message: user / assistant / streaming
- Citation pill (default / hover)
- SRS micro-notification
- Progress / mastery bar
- Server status indicator (online / offline / degraded)
- Keyboard shortcut badge

**4. Interaction annotations** in Figma:
- Hint reveal: Tier 1 → 2 → 3, all tiers staying visible, question always in view
- Chat citation tap → concept opens in main area, chat stays open
- Chat panel collapse and expand
- Flashcard flip
- MathLive toolbar interaction
- Ordered steps drag-to-reorder
- Session end → return to dashboard

**5. A half-page design note** inside the Figma file:
Why this visual language. Why this typography. How dark mode was approached.
Anything the developer needs to know to implement it faithfully.

---

## Before you start

Try MathLive in a browser (5 minutes):
```
npm install mathlive
```
or open the live demo at https://cortexjs.io/mathlive/

Look at 2–3 IB AA HL past paper questions (available freely online) to understand
what the math looks like and how questions are formatted. The "show that" and
"hence find" command terms have a specific visual structure in IB papers.

If anything in this brief is unclear — especially about how a specific
question type works, or what a particular interaction should feel like —
ask before designing. The pedagogical details are load-bearing.

---

A 17-year-old who plays music and sport is going to sit in front of this
after training, late at night, and work through problems that genuinely challenge him.

The design should make that feel possible — not like another obligation,
not like a toy, but like a tool he is glad exists.

That is the brief.
