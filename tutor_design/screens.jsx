/* screens.jsx — Dashboard, Session, Concept, TopicList, TopicDetail, Progress, FunctionExplorer */

/* ───────────────────────────── Dashboard ───────────────────────────── */

function Dashboard({ go, openConcept }) {
  const dueCount = SESSION.length;
  const topicMix = ['Derivatives', 'Integration', 'Complex Numbers'];

  return (
    <div style={{ padding: 'var(--pad-screen)', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div className="chrome-label" style={{ marginBottom: 6 }}>Saturday · 17 May</div>
        <h1 style={{
          margin: 0, fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-h1)', fontWeight: 500,
          letterSpacing: '-0.01em', textWrap: 'pretty',
        }}>Good evening.</h1>
      </div>

      {/* Primary CTA card: today's queue */}
      <Card style={{ padding: 28, marginBottom: 22, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 24 }}>
          <div>
            <div className="chrome-label" style={{ marginBottom: 8 }}>Today's queue</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 500,
                letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--ink)',
              }}>{dueCount}</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 20,
                color: 'var(--ink-muted)', fontStyle: 'italic',
              }}>questions due</span>
            </div>
            <div style={{ color: 'var(--ink-muted)', fontSize: 'var(--fs-small)' }}>
              From <span style={{ color: 'var(--ink)' }}>{topicMix.join(', ')}</span> · approx 18 minutes
            </div>
          </div>
          <Button variant="primary" size="lg" iconRight="arrow-r" onClick={() => go('session')}>
            Start session
          </Button>
        </div>
      </Card>

      {/* Two columns: weak topics + recent activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)', marginBottom: 22 }}>
        <Card padded={false}>
          <div style={{ padding: 'var(--pad-card) var(--pad-card) 8px' }}>
            <div className="chrome-label">Weak subtopics</div>
          </div>
          <div>
            {WEAK.map((w, i) => (
              <div key={w.id} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto',
                gap: 16, alignItems: 'center',
                padding: '12px var(--pad-card)',
                borderTop: i ? '1px solid var(--hairline)' : 'none',
              }}>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)',
                  }}>{w.name}</div>
                  <div className="chrome-label" style={{ fontSize: 11 }}>{w.topic}</div>
                </div>
                <div style={{ width: 64 }}>
                  <MasteryBar value={w.mastery} showLabel color="var(--negative)" />
                </div>
                <Button variant="ghost" size="sm" iconRight="arrow-r" onClick={() => go('session')}>Drill</Button>
              </div>
            ))}
          </div>
        </Card>

        <Card padded={false}>
          <div style={{ padding: 'var(--pad-card) var(--pad-card) 8px' }}>
            <div className="chrome-label">Recent sessions</div>
          </div>
          <div>
            {RECENT.slice(0, 5).map((r, i) => (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                gap: 12, alignItems: 'center',
                padding: '12px var(--pad-card)',
                borderTop: i ? '1px solid var(--hairline)' : 'none',
              }}>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)',
                  }}>{r.topic}</div>
                  <div className="chrome-label" style={{ fontSize: 11 }}>{r.date}</div>
                </div>
                <span className="chrome-label" style={{ fontSize: 11 }}>{r.mins} min</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-small)',
                  color: r.correct / r.questions >= 0.8 ? 'var(--positive)' : 'var(--ink-muted)',
                }}>{r.correct}/{r.questions}</span>
                <Icon name="arrow-r" size={14} style={{ color: 'var(--ink-faint)' }} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Topic overview row */}
      <div>
        <SectionTitle kicker="Browse by topic">The curriculum</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--gap)' }}>
          {TOPICS.map((t) => (
            <Card key={t.id} hoverable onClick={() => go('topics', { topicId: t.id })} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 16,
                  color: 'var(--ink)', fontWeight: 500,
                  lineHeight: 1.25, textWrap: 'balance',
                }}>{t.name}</div>
                <div className="chrome-label" style={{ fontSize: 11, marginTop: 4 }}>
                  {t.subtopics.length} subtopics
                </div>
              </div>
              <MasteryBar value={t.mastery} showLabel />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Session ───────────────────────────── */

function Session({ goBack, openConcept, srsNotice, setSrsNotice }) {
  const [idx, setIdx] = React.useState(0);
  const [phase, setPhase] = React.useState('asking'); // asking | grading | correct | incorrect | done
  const [hintTier, setHintTier] = React.useState(0); // 0..3
  const [answer, setAnswer] = React.useState('');
  const [mcSelected, setMcSelected] = React.useState(null);
  const [stepsOrder, setStepsOrder] = React.useState(null);
  const [flashFlipped, setFlashFlipped] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(272); // seconds — starts at 04:32
  const [perQuestion, setPerQuestion] = React.useState({});

  const q = SESSION[idx];
  const total = SESSION.length;

  // Reset per-question state when index changes
  React.useEffect(() => {
    setPhase('asking');
    setHintTier(0);
    setAnswer('');
    setMcSelected(null);
    setFlashFlipped(false);
    if (q && q.type === 'ordered_steps') {
      // Start scrambled
      setStepsOrder([q.steps[1], q.steps[3], q.steps[0], q.steps[4], q.steps[2]]);
    } else {
      setStepsOrder(null);
    }
    // Pre-fill an answer for the first question so reviewers see a hi-fi state
    if (idx === 0 && q && q.type === 'free_expression') {
      setAnswer('2x \\sin x + x^2 \\cos x');
    }
  }, [idx]);

  // Elapsed timer
  React.useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  // Submit handlers
  const submit = () => {
    if (phase !== 'asking') return;
    setPhase('grading');
    setTimeout(() => {
      const correct = judge(q, { answer, mcSelected, stepsOrder, flashFlipped });
      setPhase(correct ? 'correct' : 'incorrect');
      setPerQuestion((p) => ({ ...p, [q.id]: { correct, hintTier } }));
      setSrsNotice(`Scheduled for review in ${correct ? hintTier === 0 ? 5 : 3 : 1} day${correct && hintTier === 0 ? 's' : correct ? 's' : ''}`);
    }, 350);
  };

  const next = () => {
    if (idx < total - 1) setIdx(idx + 1);
    else setPhase('done');
  };
  const retry = () => { setPhase('asking'); setAnswer(''); setMcSelected(null); };

  // Keyboard
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Enter' && phase === 'asking') { e.preventDefault(); submit(); return; }
      }
      if (e.key === 'h' && phase !== 'done') { revealHint(); }
      if (e.key === 'Enter' && (phase === 'correct' || phase === 'incorrect')) { next(); }
      if (e.key === 'ArrowRight' && (phase === 'correct')) { next(); }
      if (e.key === ' ' && q && q.type === 'flashcard') { e.preventDefault(); setFlashFlipped((f) => !f); }
      if (q && q.type === 'multiple_choice' && /^[1-4]$/.test(e.key)) {
        const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        setMcSelected(map[e.key]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const revealHint = () => { if (hintTier < 3) setHintTier(hintTier + 1); };

  if (phase === 'done') {
    return <SessionSummary results={perQuestion} elapsed={elapsed} goBack={goBack} restart={() => { setIdx(0); setPerQuestion({}); }} />;
  }

  return (
    <div style={{ padding: 'var(--pad-screen) var(--pad-screen) 60px', maxWidth: 820, margin: '0 auto' }}>
      {/* Session header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto auto',
        gap: 24, alignItems: 'center',
        marginBottom: 28,
        paddingBottom: 16, borderBottom: '1px solid var(--hairline)',
      }}>
        <div className="chrome-label">
          {q.topic} <span style={{ opacity: 0.5 }}>›</span> {q.subtopic}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-small)', color: 'var(--ink)' }}>
            {idx + 1}
          </span>
          <span className="chrome-label">/ {total}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-small)', color: 'var(--ink-muted)' }}>
          {mmss}
        </div>
      </div>

      {/* Progress bar — subtle */}
      <div style={{
        height: 2, background: 'var(--hairline)', borderRadius: 2, marginBottom: 32,
      }}>
        <div style={{
          width: `${((idx + (phase === 'correct' || phase === 'incorrect' ? 1 : 0)) / total) * 100}%`,
          height: '100%', background: 'var(--accent)',
          transition: 'width 400ms cubic-bezier(.3,.7,.3,1)',
        }} />
      </div>

      {/* Question stem */}
      <QuestionStem q={q} />

      {/* Answer area */}
      <div style={{ marginTop: 32 }}>
        <AnswerArea
          q={q}
          answer={answer} setAnswer={setAnswer}
          mcSelected={mcSelected} setMcSelected={setMcSelected}
          stepsOrder={stepsOrder} setStepsOrder={setStepsOrder}
          flashFlipped={flashFlipped} setFlashFlipped={setFlashFlipped}
          phase={phase}
        />
      </div>

      {/* Submit row */}
      {phase === 'asking' && q.type !== 'flashcard' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginTop: 24,
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="primary" onClick={submit} kbd="↵"
              disabled={isAnswerEmpty(q, { answer, mcSelected })}>
              Submit
            </Button>
            <Button variant="secondary" icon="lightbulb" onClick={revealHint} kbd="H">
              {hintTier === 0 ? 'I need a hint' : hintTier < 3 ? 'Next hint' : 'Hints revealed'}
            </Button>
          </div>
          <span className="chrome-label" style={{ fontSize: 11 }}>
            Press <Kbd>↵</Kbd> to submit
          </span>
        </div>
      )}

      {phase === 'grading' && (
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-muted)' }}>
          <Spinner /> <span className="chrome-label">Grading…</span>
        </div>
      )}

      {/* Feedback */}
      {(phase === 'correct' || phase === 'incorrect') && (
        <FeedbackBlock q={q} phase={phase} next={next} retry={retry} revealHint={revealHint} hintTier={hintTier} />
      )}

      {/* Hint cascade */}
      {hintTier > 0 && <HintCascade q={q} tier={hintTier} openConcept={openConcept} />}

      {/* SRS notice */}
      {(phase === 'correct' || phase === 'incorrect') && srsNotice && (
        <div style={{
          marginTop: 22, paddingTop: 14,
          borderTop: '1px dashed var(--hairline)',
          fontSize: 'var(--fs-small)', color: 'var(--ink-faint)', fontStyle: 'italic',
        }}>
          {srsNotice}
        </div>
      )}

      {/* Footer keyboard hints strip */}
      <KeyboardHints phase={phase} qType={q.type} />
    </div>
  );
}

function judge(q, { answer, mcSelected, stepsOrder, flashFlipped }) {
  if (q.type === 'free_expression') {
    // Loose match: normalize whitespace
    const norm = (s) => String(s).replace(/\s+/g, '').replace(/\\,/g, '');
    return [q.answer, ...(q.altForms || [])].some((a) => norm(a) === norm(answer));
  }
  if (q.type === 'free_numeric') return Number(answer) === Number(q.answer);
  if (q.type === 'multiple_choice') return mcSelected === q.correct;
  if (q.type === 'ordered_steps') return stepsOrder && stepsOrder.map((s) => s.id).join() === q.steps.map((s) => s.id).join();
  return true;
}
function isAnswerEmpty(q, { answer, mcSelected }) {
  if (q.type === 'free_expression' || q.type === 'free_numeric') return !String(answer).trim();
  if (q.type === 'multiple_choice') return !mcSelected;
  return false;
}

function QuestionStem({ q }) {
  return (
    <div style={{
      fontFamily: 'var(--font-prose)', fontSize: 21, lineHeight: 1.55,
      color: 'var(--ink)', textWrap: 'pretty',
    }}>
      <Prose text={q.stem || ''} />
      {q.type === 'flashcard' && (
        <div style={{ marginTop: 8 }}>
          <Prose text={q.front.kind === 'term' ? `State the formula or definition for **${q.front.text}**.` : q.front.text} />
        </div>
      )}
    </div>
  );
}

function AnswerArea({ q, answer, setAnswer, mcSelected, setMcSelected, stepsOrder, setStepsOrder, flashFlipped, setFlashFlipped, phase }) {
  if (q.type === 'free_expression' || q.type === 'free_numeric') {
    return <MathLiveInput value={answer} setValue={setAnswer} phase={phase} numeric={q.type === 'free_numeric'} />;
  }
  if (q.type === 'multiple_choice') {
    return <MultipleChoice q={q} selected={mcSelected} setSelected={setMcSelected} phase={phase} />;
  }
  if (q.type === 'flashcard') {
    return <Flashcard q={q} flipped={flashFlipped} setFlipped={setFlashFlipped} />;
  }
  if (q.type === 'ordered_steps') {
    return <OrderedSteps steps={stepsOrder} setSteps={setStepsOrder} />;
  }
  return null;
}

/* ───────────────────────────── MathLive-style input (mocked) ───────────────────────────── */

function MathLiveInput({ value, setValue, phase, numeric }) {
  const [focused, setFocused] = React.useState(true);
  return (
    <div>
      {/* Toolbar */}
      {!numeric && (
        <div style={{
          display: 'flex', gap: 4, marginBottom: 8,
          padding: '6px 8px',
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderBottom: 'none',
          borderTopLeftRadius: 'var(--radius)',
          borderTopRightRadius: 'var(--radius)',
        }}>
          {[
            { label: 'frac',    tex: '\\frac{a}{b}', insert: '\\frac{}{}' },
            { label: 'pow',     tex: 'a^b',         insert: '^{}' },
            { label: 'sqrt',    tex: '\\sqrt{x}',   insert: '\\sqrt{}' },
            { label: 'int',     tex: '\\int',       insert: '\\int' },
            { label: 'sum',     tex: '\\sum',       insert: '\\sum' },
            { label: 'sin',     tex: '\\sin',       insert: '\\sin' },
            { label: 'cos',     tex: '\\cos',       insert: '\\cos' },
            { label: 'ln',      tex: '\\ln',        insert: '\\ln' },
            { label: 'pi',      tex: '\\pi',        insert: '\\pi' },
            { label: 'theta',   tex: '\\theta',     insert: '\\theta' },
            { label: 'inf',     tex: '\\infty',     insert: '\\infty' },
          ].map((s) => (
            <ToolbarBtn key={s.label} onClick={() => setValue((v) => v + s.insert)}>
              <TeX tex={s.tex} />
            </ToolbarBtn>
          ))}
        </div>
      )}

      {/* Input area — looks like a math editor */}
      <div
        onClick={() => setFocused(true)}
        style={{
          background: 'var(--surface)',
          border: `1.5px solid ${focused && phase === 'asking' ? 'var(--accent)' : 'var(--hairline)'}`,
          borderTopLeftRadius: numeric ? 'var(--radius)' : 0,
          borderTopRightRadius: numeric ? 'var(--radius)' : 0,
          borderBottomLeftRadius: 'var(--radius)',
          borderBottomRightRadius: 'var(--radius)',
          padding: '18px 18px',
          minHeight: 64,
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'text',
          transition: 'border-color 120ms',
        }}
      >
        {numeric ? (
          <input
            type="number" value={value} onChange={(e) => setValue(e.target.value)}
            placeholder="Enter a number"
            style={{
              flex: 1, background: 'transparent', border: 'none', color: 'var(--ink)',
              fontFamily: 'var(--font-prose)', fontSize: 22, outline: 'none',
            }}
          />
        ) : (
          <>
            <div style={{ flex: 1, minHeight: 28, display: 'flex', alignItems: 'center', gap: 4 }}>
              {value ? (
                <span style={{ fontSize: 18 }}><TeX tex={value} /></span>
              ) : (
                <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic', fontFamily: 'var(--font-prose)', fontSize: 18 }}>
                  Type your answer…
                </span>
              )}
              <span style={{
                width: 1.5, height: 22, background: 'var(--accent)',
                animation: focused ? 'blink 1.1s steps(2) infinite' : 'none',
                marginLeft: 2,
              }} />
            </div>
            <span className="chrome-label" style={{ fontSize: 10, marginLeft: 8 }}>
              <Icon name="kbd" size={12} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
              MathLive
            </span>
          </>
        )}
      </div>
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

function ToolbarBtn({ children, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'var(--elevated)' : 'transparent',
        border: '1px solid transparent',
        borderColor: hover ? 'var(--hairline)' : 'transparent',
        borderRadius: 'var(--radius-sm)',
        padding: '4px 8px', minWidth: 32,
        color: 'var(--ink)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14,
      }}>{children}</button>
  );
}

/* ───────────────────────────── Multiple choice ───────────────────────────── */

function MultipleChoice({ q, selected, setSelected, phase }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {q.options.map((opt, i) => {
        const isSelected = selected === opt.id;
        const isCorrect = phase === 'correct' && opt.id === q.correct;
        const isWrong = phase === 'incorrect' && isSelected;
        const showCorrect = phase === 'incorrect' && opt.id === q.correct;

        let borderColor = 'var(--hairline)';
        let bg = 'var(--surface)';
        let ink = 'var(--ink)';
        if (isSelected && phase === 'asking') { borderColor = 'var(--accent)'; bg = 'var(--accent-soft)'; }
        if (isCorrect) { borderColor = 'var(--positive)'; bg = 'oklch(from var(--positive) l c h / 0.10)'; }
        if (isWrong) { borderColor = 'var(--negative)'; bg = 'oklch(from var(--negative) l c h / 0.10)'; }
        if (showCorrect) { borderColor = 'var(--positive)'; }

        return (
          <button
            key={opt.id}
            disabled={phase !== 'asking'}
            onClick={() => setSelected(opt.id)}
            style={{
              display: 'grid', gridTemplateColumns: '32px 1fr auto',
              alignItems: 'center', gap: 16,
              padding: '16px 18px', textAlign: 'left',
              background: bg, color: ink,
              border: `1.5px solid ${borderColor}`,
              borderRadius: 'var(--radius)',
              cursor: phase === 'asking' ? 'pointer' : 'default',
              transition: 'all 140ms',
              fontFamily: 'inherit',
            }}
          >
            <span style={{
              width: 26, height: 26,
              border: `1.5px solid ${isSelected || isCorrect ? borderColor : 'var(--line)'}`,
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: isSelected || isCorrect ? borderColor : 'var(--ink-muted)',
              background: (isSelected || isCorrect) ? 'transparent' : 'transparent',
            }}>{opt.id}</span>
            <span style={{ fontSize: 19 }}><TeX tex={opt.tex} /></span>
            {(isCorrect || showCorrect) && <Icon name="check" size={18} style={{ color: 'var(--positive)' }} />}
            {isWrong && <Icon name="x" size={18} style={{ color: 'var(--negative)' }} />}
          </button>
        );
      })}
      <div className="chrome-label" style={{ fontSize: 11, marginTop: 4 }}>
        <Kbd>1</Kbd> <Kbd>2</Kbd> <Kbd>3</Kbd> <Kbd>4</Kbd> select · <Kbd>↵</Kbd> confirm
      </div>
    </div>
  );
}

/* ───────────────────────────── Flashcard ───────────────────────────── */

function Flashcard({ q, flipped, setFlipped }) {
  const [rated, setRated] = React.useState(null);
  return (
    <div>
      <div
        onClick={() => setFlipped(!flipped)}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--radius)',
          padding: '48px 40px',
          minHeight: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 14,
          cursor: 'pointer',
          transition: 'background 200ms',
        }}>
        {!flipped ? (
          <>
            <div className="chrome-label">Front</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 32,
              fontWeight: 500, color: 'var(--ink)',
            }}>{q.front.text}</div>
            <div className="chrome-label" style={{ marginTop: 8, fontSize: 11 }}>
              Press <Kbd>Space</Kbd> or click to flip
            </div>
          </>
        ) : (
          <>
            <div className="chrome-label">Back</div>
            <div style={{ fontSize: 28 }}><TeX tex={q.back.tex} display /></div>
          </>
        )}
      </div>

      {flipped && (
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Button variant="secondary" icon="x" onClick={() => setRated('missed')}>Missed it</Button>
          <Button variant="primary"   icon="check" onClick={() => setRated('got')}>Got it</Button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── Ordered steps ───────────────────────────── */

function OrderedSteps({ steps, setSteps }) {
  const move = (i, dir) => {
    const ni = i + dir;
    if (ni < 0 || ni >= steps.length) return;
    const copy = steps.slice();
    [copy[i], copy[ni]] = [copy[ni], copy[i]];
    setSteps(copy);
  };
  return (
    <div>
      <div className="chrome-label" style={{ marginBottom: 10 }}>Drag to reorder</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {(steps || []).map((s, i) => (
          <div key={s.id} style={{
            display: 'grid', gridTemplateColumns: '28px 1fr auto auto',
            gap: 12, alignItems: 'center',
            padding: '14px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius)',
          }}>
            <Icon name="grip" size={16} style={{ color: 'var(--ink-faint)', cursor: 'grab' }} />
            <span style={{ fontSize: 18 }}><TeX tex={s.tex} /></span>
            <button onClick={() => move(i, -1)} style={arrowBtn}><Icon name="collapse" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
            <button onClick={() => move(i, +1)} style={arrowBtn}><Icon name="expand" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
const arrowBtn = {
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: '1px solid var(--hairline)',
  borderRadius: 'var(--radius-sm)', color: 'var(--ink-muted)', cursor: 'pointer',
};

/* ───────────────────────────── Feedback ───────────────────────────── */

function FeedbackBlock({ q, phase, next, retry, revealHint, hintTier }) {
  if (phase === 'correct') {
    return (
      <div style={{
        marginTop: 28, padding: '20px 22px',
        background: 'oklch(from var(--positive) l c h / 0.08)',
        border: '1px solid oklch(from var(--positive) l c h / 0.4)',
        borderLeft: '3px solid var(--positive)',
        borderRadius: 'var(--radius)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Icon name="check" size={16} style={{ color: 'var(--positive)' }} />
          <span className="chrome-label" style={{ color: 'var(--positive)' }}>Correct</span>
        </div>
        {q.note && (
          <div style={{ fontFamily: 'var(--font-prose)', fontSize: 16, color: 'var(--ink-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
            <Prose text={q.note} />
          </div>
        )}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" iconRight="arrow-r" onClick={next} kbd="↵">Next</Button>
        </div>
      </div>
    );
  }
  return (
    <div style={{
      marginTop: 28, padding: '20px 22px',
      background: 'var(--surface)',
      border: '1px solid var(--hairline)',
      borderLeft: '3px solid var(--negative)',
      borderRadius: 'var(--radius)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span className="chrome-label" style={{ color: 'var(--negative)' }}>Not quite</span>
      </div>
      <div style={{ fontFamily: 'var(--font-prose)', fontSize: 17, color: 'var(--ink)', lineHeight: 1.5, marginBottom: 14 }}>
        Want to try again, or see a hint?
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="secondary" onClick={retry}>Try again</Button>
        <Button variant="primary" icon="lightbulb" onClick={revealHint}>
          {hintTier === 0 ? 'Show hint' : 'Next hint'}
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────────────── Hint cascade ───────────────────────────── */

function HintCascade({ q, tier, openConcept }) {
  return (
    <div style={{ marginTop: 28, display: 'grid', gap: 16 }}>
      {q.hints.slice(0, tier).map((h, i) => {
        const isFullSolution = Array.isArray(h);
        return (
          <div key={i} style={{
            padding: '18px 20px',
            background: 'var(--paper)',
            border: '1px solid var(--hairline)',
            borderLeft: `3px solid var(--accent)`,
            borderRadius: 'var(--radius)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span className="chrome-label" style={{ color: 'var(--accent)' }}>
                Hint · Tier {i + 1} {i === 0 ? '· Recall' : i === 1 ? '· Apply' : '· Full solution'}
              </span>
              {i === 0 && q.concept && (
                <CitationPill onClick={() => openConcept(q.concept.id)}>{q.concept.name}</CitationPill>
              )}
            </div>
            {!isFullSolution ? (
              <div style={{ fontFamily: 'var(--font-prose)', fontSize: 17, lineHeight: 1.55, color: 'var(--ink)' }}>
                <Prose text={h} />
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {h.map((step, j) => (
                  <div key={j} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12, alignItems: 'baseline' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-faint)',
                    }}>{String(j + 1).padStart(2, '0')}</span>
                    <div style={{ fontFamily: 'var(--font-prose)', fontSize: 16, lineHeight: 1.55, color: 'var(--ink)' }}>
                      <Prose text={step.line} />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button variant="secondary" iconRight="arrow-r">I understand, continue</Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── Session summary ───────────────────────────── */

function SessionSummary({ results, elapsed, goBack, restart }) {
  const total = SESSION.length;
  const correct = Object.values(results).filter((r) => r.correct).length;
  const mins = Math.round(elapsed / 60);
  const missed = SESSION.filter((q) => results[q.id] && !results[q.id].correct);

  return (
    <div style={{ padding: 'var(--pad-screen)', maxWidth: 720, margin: '0 auto' }}>
      <div className="chrome-label" style={{ marginBottom: 6 }}>Session complete</div>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h1)',
        fontWeight: 500, margin: '0 0 28px', letterSpacing: '-0.01em',
      }}>Well done.</h1>

      <Card style={{ padding: 28, marginBottom: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          <div>
            <div className="chrome-label">Score</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 500, color: 'var(--ink)' }}>
              {correct}<span style={{ color: 'var(--ink-faint)', fontSize: 24 }}>/{total}</span>
            </div>
          </div>
          <div>
            <div className="chrome-label">Time</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 500, color: 'var(--ink)' }}>
              {mins} <span style={{ color: 'var(--ink-faint)', fontSize: 20, fontStyle: 'italic' }}>min</span>
            </div>
          </div>
          <div>
            <div className="chrome-label">Accuracy</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 500, color: 'var(--ink)' }}>
              {Math.round((correct / total) * 100)}<span style={{ color: 'var(--ink-faint)', fontSize: 20 }}>%</span>
            </div>
          </div>
        </div>
      </Card>

      {missed.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionTitle kicker={`${missed.length} missed`}>Review these</SectionTitle>
          <div style={{ display: 'grid', gap: 8 }}>
            {missed.map((q) => (
              <Card key={q.id} hoverable padded={false} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div className="chrome-label" style={{ fontSize: 11, marginBottom: 4 }}>{q.subtopic}</div>
                  <div style={{ fontFamily: 'var(--font-prose)', fontSize: 16 }}>
                    <Prose text={q.stem || q.front?.text || ''} />
                  </div>
                </div>
                <Button variant="quiet" iconRight="arrow-r">Review</Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontStyle: 'italic', fontFamily: 'var(--font-prose)', color: 'var(--ink-muted)', marginBottom: 22 }}>
        {missed.length} questions scheduled for review in 2 days.
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="secondary" onClick={goBack}>Done</Button>
        {missed.length > 0 && <Button variant="primary" icon="play" onClick={restart}>Practice missed questions</Button>}
      </div>
    </div>
  );
}

/* ───────────────────────────── Keyboard hints strip ───────────────────────────── */

function KeyboardHints({ phase, qType }) {
  const items = [];
  if (phase === 'asking') {
    items.push(['↵', 'Submit']);
    items.push(['H', 'Hint']);
    if (qType === 'multiple_choice') items.push(['1-4', 'Select']);
    if (qType === 'flashcard') items.push(['Space', 'Flip']);
  }
  if (phase === 'correct' || phase === 'incorrect') {
    items.push(['↵', 'Next']);
    items.push(['→', 'Skip']);
  }
  items.push(['⌘\\', 'Chat']);
  return (
    <div style={{
      marginTop: 32, paddingTop: 14,
      borderTop: '1px solid var(--hairline)',
      display: 'flex', gap: 18, alignItems: 'center',
      color: 'var(--ink-faint)',
    }}>
      {items.map(([k, label], i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <Kbd>{k}</Kbd>
          <span className="chrome-label" style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{label}</span>
        </span>
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
      border: '1.5px solid var(--hairline)', borderTopColor: 'var(--accent)',
      animation: 'spin 0.8s linear infinite',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

Object.assign(window, {
  Dashboard, Session, SessionSummary,
});
