/* screens2.jsx — TopicList, TopicDetail, Concept, Progress, FunctionExplorer */

/* ───────────────────────────── Topic List ───────────────────────────── */

function TopicList({ go, openTopic }) {
  const [expanded, setExpanded] = React.useState('ca'); // calculus expanded by default

  return (
    <div style={{ padding: 'var(--pad-screen)', maxWidth: 920, margin: '0 auto' }}>
      <div className="chrome-label" style={{ marginBottom: 6 }}>Curriculum</div>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h1)',
        fontWeight: 500, margin: '0 0 24px', letterSpacing: '-0.01em',
      }}>Topics</h1>

      <div style={{ display: 'grid', gap: 'var(--gap)' }}>
        {TOPICS.map((t) => {
          const open = expanded === t.id;
          return (
            <Card key={t.id} padded={false}>
              <button
                onClick={() => setExpanded(open ? null : t.id)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 160px auto auto',
                  gap: 24, alignItems: 'center', width: '100%',
                  padding: '20px var(--pad-card)',
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', color: 'var(--ink)', textAlign: 'left',
                }}>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 22,
                    fontWeight: 500, letterSpacing: '-0.005em',
                  }}>{t.name}</div>
                  <div className="chrome-label" style={{ marginTop: 4, fontSize: 11 }}>
                    {t.subtopics.length} subtopics · {t.subtopics.reduce((s, x) => s + x.questions, 0)} questions
                  </div>
                </div>
                <MasteryBar value={t.mastery} showLabel />
                <span className="chrome-label" style={{ fontSize: 11 }}>Mastery</span>
                <Icon name={open ? 'minus' : 'plus'} size={16} style={{ color: 'var(--ink-muted)' }} />
              </button>
              {open && (
                <div style={{ borderTop: '1px solid var(--hairline)' }}>
                  {t.subtopics.map((s, i) => (
                    <div key={s.id} style={{
                      display: 'grid', gridTemplateColumns: '1fr 120px auto auto auto',
                      gap: 24, alignItems: 'center',
                      padding: '12px var(--pad-card) 12px 38px',
                      borderTop: i ? '1px solid var(--hairline)' : 'none',
                    }}>
                      <div>
                        <button
                          onClick={() => openTopic(s.id)}
                          style={{
                            background: 'transparent', border: 'none', padding: 0,
                            cursor: 'pointer', color: 'var(--ink)',
                            fontFamily: 'var(--font-display)', fontSize: 17,
                            textAlign: 'left',
                          }}>
                          {s.name}
                        </button>
                      </div>
                      <MasteryBar value={s.mastery} showLabel />
                      <span className="chrome-label" style={{ fontSize: 11, minWidth: 60, textAlign: 'right' }}>{s.questions} Qs</span>
                      <span className="chrome-label" style={{ fontSize: 11, minWidth: 70, textAlign: 'right' }}>{s.last}</span>
                      <Button variant="ghost" size="sm" iconRight="arrow-r" onClick={() => go('session')}>Drill</Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────── Topic Detail ───────────────────────────── */

function TopicDetail({ subtopicId, go, openConcept }) {
  // Find subtopic
  let parent = null, sub = null;
  for (const t of TOPICS) {
    const s = t.subtopics.find((x) => x.id === subtopicId);
    if (s) { parent = t; sub = s; break; }
  }
  if (!sub) return null;

  // Concepts in this subtopic (mocked for Derivatives)
  const concepts = sub.id === 'ca-der' ? [
    { id: 'product-rule',  name: 'Product Rule',                   kind: 'Theorem' },
    { id: 'chain-rule',    name: 'Chain Rule',                     kind: 'Theorem' },
    { id: 'quotient-rule', name: 'Quotient Rule',                  kind: 'Theorem' },
    { id: 'power-rule',    name: 'Power Rule',                     kind: 'Theorem' },
    { id: 'lim-def',       name: 'Limit Definition of Derivative', kind: 'Definition' },
  ] : [
    { id: 'c1', name: 'Definition', kind: 'Definition' },
    { id: 'c2', name: 'Method',     kind: 'Method' },
    { id: 'c3', name: 'Theorem',    kind: 'Theorem' },
  ];

  return (
    <div style={{ padding: 'var(--pad-screen)', maxWidth: 920, margin: '0 auto' }}>
      <div className="chrome-label" style={{ marginBottom: 6 }}>
        <button onClick={() => go('topics')} style={linkBtn}>{parent.name}</button> › {sub.name}
      </div>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h1)',
        fontWeight: 500, margin: '0 0 24px', letterSpacing: '-0.01em',
      }}>{sub.name}</h1>

      {/* Mastery & CTA row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center',
        padding: '20px 22px', marginBottom: 24,
        background: 'var(--surface)', border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'center' }}>
          <div>
            <div className="chrome-label">Mastery</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)' }}>
              {Math.round(sub.mastery * 100)}<span style={{ fontSize: 16, color: 'var(--ink-faint)' }}>%</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
            <MasteryBar value={sub.mastery} height={6} />
            <div className="chrome-label" style={{ fontSize: 11 }}>
              {sub.questions} questions · last practised {sub.last}
            </div>
          </div>
        </div>
        <Button variant="primary" size="md" icon="play" onClick={() => go('session')}>Start drill</Button>
      </div>

      {/* Description */}
      <div style={{ marginBottom: 28, maxWidth: 680 }}>
        <p style={{
          fontFamily: 'var(--font-prose)', fontSize: 17, lineHeight: 1.65,
          color: 'var(--ink-muted)', margin: 0,
        }}>
          The derivative $f'(x)$ measures the instantaneous rate of change of $f$ at $x$.
          For IB AA HL, you should be fluent with the standard rules
          (<em>power</em>, <em>product</em>, <em>quotient</em>, <em>chain</em>),
          and able to apply them to trigonometric, exponential, and logarithmic functions.
        </p>
      </div>

      {/* Concepts */}
      <SectionTitle kicker="Reference">Concepts in this subtopic</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)', marginBottom: 28 }}>
        {concepts.map((c) => (
          <Card key={c.id} hoverable onClick={() => openConcept(c.id)} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div>
              <div className="chrome-label" style={{ fontSize: 11, marginBottom: 4 }}>{c.kind}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)' }}>{c.name}</div>
            </div>
            <Icon name="arrow-r" size={15} style={{ color: 'var(--ink-faint)' }} />
          </Card>
        ))}
      </div>

      {/* Recent attempts */}
      <SectionTitle kicker="History">Recent attempts</SectionTitle>
      <Card padded={false}>
        {[
          { d: 'Today',        score: '4/5',  acc: 0.80 },
          { d: '2 days ago',    score: '6/8',  acc: 0.75 },
          { d: '1 week ago',    score: '5/6',  acc: 0.83 },
          { d: '2 weeks ago',   score: '7/10', acc: 0.70 },
        ].map((r, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1fr auto auto',
            gap: 16, alignItems: 'center', padding: '12px var(--pad-card)',
            borderTop: i ? '1px solid var(--hairline)' : 'none',
          }}>
            <span className="chrome-label" style={{ fontSize: 12 }}>{r.d}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{r.score}</span>
            <span style={{ width: 80 }}><MasteryBar value={r.acc} /></span>
          </div>
        ))}
      </Card>
    </div>
  );
}
const linkBtn = {
  background: 'transparent', border: 'none', padding: 0,
  color: 'var(--ink-muted)', cursor: 'pointer', font: 'inherit',
  textDecoration: 'underline', textDecorationColor: 'var(--ink-faint)',
  textUnderlineOffset: 3,
};

/* ───────────────────────────── Concept Detail ───────────────────────────── */

function ConceptDetail({ id, go, openConcept }) {
  const c = CONCEPTS[id] || CONCEPTS['product-rule'];
  const [showDeriv, setShowDeriv] = React.useState(false);
  const [openExample, setOpenExample] = React.useState(0);

  return (
    <div style={{ padding: 'var(--pad-screen)', maxWidth: 760, margin: '0 auto' }}>
      <div className="chrome-label" style={{ marginBottom: 6 }}>
        <button onClick={() => go('topics')} style={linkBtn}>{c.topic}</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 18 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h1)',
          fontWeight: 500, margin: 0, letterSpacing: '-0.01em',
        }}>{c.name}</h1>
        <Badge tone="accent">{c.kind}</Badge>
      </div>

      {/* Statement */}
      <div style={{
        fontFamily: 'var(--font-prose)', fontSize: 18, lineHeight: 1.6,
        color: 'var(--ink)', marginBottom: 6,
      }}>
        <Prose text={c.statement} />
      </div>
      <div style={{
        margin: '14px 0 32px', padding: '22px 28px',
        background: 'var(--paper)', border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
        textAlign: 'center', fontSize: 22,
      }}>
        <TeX tex={c.statementDisplay} display />
      </div>

      {/* Derivation */}
      <div style={{ marginBottom: 32 }}>
        <button onClick={() => setShowDeriv(!showDeriv)} style={{
          ...linkBtn, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8,
          color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: 18,
        }}>
          <Icon name={showDeriv ? 'minus' : 'plus'} size={14} />
          Derivation
        </button>
        {showDeriv && (
          <div style={{ marginTop: 14, paddingLeft: 22, borderLeft: '1px solid var(--hairline)' }}>
            {c.derivation.map((step, i) => (
              <div key={i} style={{
                fontFamily: 'var(--font-prose)', fontSize: 16, lineHeight: 1.6,
                color: 'var(--ink-muted)', marginBottom: 10,
              }}>
                <Prose text={step.line} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Worked examples */}
      <SectionTitle kicker="Worked examples">Examples</SectionTitle>
      <div style={{ display: 'grid', gap: 10, marginBottom: 32 }}>
        {c.examples.map((ex, i) => {
          const open = openExample === i;
          return (
            <Card key={i} padded={false}>
              <button onClick={() => setOpenExample(open ? -1 : i)} style={{
                display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12,
                width: '100%', padding: '14px var(--pad-card)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--ink)', textAlign: 'left',
                fontFamily: 'var(--font-display)', fontSize: 17,
              }}>
                <span><Prose text={ex.title} /></span>
                <Icon name={open ? 'minus' : 'plus'} size={14} style={{ color: 'var(--ink-muted)' }} />
              </button>
              {open && (
                <div style={{ padding: '0 var(--pad-card) var(--pad-card) calc(var(--pad-card) + 16px)', borderTop: '1px solid var(--hairline)' }}>
                  <ol style={{ paddingLeft: 0, listStyle: 'none', margin: '14px 0 0' }}>
                    {ex.steps.map((step, j) => (
                      <li key={j} style={{
                        display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12,
                        marginBottom: 10,
                        fontFamily: 'var(--font-prose)', fontSize: 16, lineHeight: 1.6,
                        color: 'var(--ink)',
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-faint)' }}>{String(j + 1).padStart(2, '0')}</span>
                        <span><Prose text={step} /></span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Tested-by + Related */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
        <div>
          <SectionTitle kicker="Practice">Questions that test this</SectionTitle>
          <div style={{ display: 'grid', gap: 6 }}>
            {c.testedBy.map((q, i) => (
              <button key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                gap: 12, alignItems: 'center', padding: '10px 14px',
                background: 'transparent', border: '1px solid var(--hairline)',
                borderRadius: 'var(--radius-sm)', textAlign: 'left',
                color: 'var(--ink)', cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
                <span style={{ fontSize: 15 }}><Prose text={q} /></span>
                <Icon name="arrow-r" size={13} style={{ color: 'var(--ink-faint)' }} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle kicker="See also">Related</SectionTitle>
          <div style={{ display: 'grid', gap: 4 }}>
            {c.related.map((r) => (
              <button key={r.id} onClick={() => openConcept(r.id)} style={{
                ...linkBtn, padding: '6px 0',
                fontFamily: 'var(--font-display)', fontSize: 16,
                color: 'var(--ink)', textAlign: 'left',
                textDecoration: 'none',
              }}>{r.name} <Icon name="arrow-r" size={12} style={{ verticalAlign: 'middle', color: 'var(--ink-faint)' }} /></button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Progress View ───────────────────────────── */

function Progress({ go }) {
  return (
    <div style={{ padding: 'var(--pad-screen)', maxWidth: 1080, margin: '0 auto' }}>
      <div className="chrome-label" style={{ marginBottom: 6 }}>Last 30 days</div>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h1)',
        fontWeight: 500, margin: '0 0 24px', letterSpacing: '-0.01em',
      }}>Progress</h1>

      {/* Top row: 3 stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)', marginBottom: 22 }}>
        <Card>
          <div className="chrome-label">Questions attempted</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)' }}>284</span>
            <span style={{ fontSize: 'var(--fs-small)', color: 'var(--positive)' }}>+12 from last week</span>
          </div>
        </Card>
        <Card>
          <div className="chrome-label">Accuracy</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)' }}>72<span style={{ color: 'var(--ink-faint)', fontSize: 20 }}>%</span></span>
            <span style={{ fontSize: 'var(--fs-small)', color: 'var(--positive)' }}>+3 pts</span>
          </div>
        </Card>
        <Card>
          <div className="chrome-label">Study streak</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)' }}>14</span>
            <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-muted)' }}>days</span>
          </div>
        </Card>
      </div>

      {/* Mastery by topic */}
      <Card style={{ marginBottom: 22 }}>
        <div className="chrome-label" style={{ marginBottom: 14 }}>Mastery by topic</div>
        <div style={{ display: 'grid', gap: 14 }}>
          {TOPICS.map((t) => (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 60px', gap: 16, alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{t.name}</span>
              <MasteryBar value={t.mastery} height={8} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-muted)', textAlign: 'right' }}>
                {Math.round(t.mastery * 100)}%
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Two columns: accuracy chart + heatmap */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap)', marginBottom: 22 }}>
        <Card>
          <div className="chrome-label" style={{ marginBottom: 14 }}>Accuracy over time</div>
          <AccuracyChart />
        </Card>
        <Card>
          <div className="chrome-label" style={{ marginBottom: 14 }}>Study calendar · last 12 weeks</div>
          <StreakHeatmap />
        </Card>
      </div>

      {/* Weak topics + Session history */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 'var(--gap)' }}>
        <Card padded={false}>
          <div style={{ padding: 'var(--pad-card) var(--pad-card) 8px' }}>
            <div className="chrome-label">Focus on these</div>
          </div>
          {WEAK.map((w, i) => (
            <div key={w.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 70px auto',
              gap: 12, alignItems: 'center',
              padding: '12px var(--pad-card)',
              borderTop: i ? '1px solid var(--hairline)' : 'none',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{w.name}</div>
                <div className="chrome-label" style={{ fontSize: 11 }}>{w.topic}</div>
              </div>
              <MasteryBar value={w.mastery} color="var(--negative)" showLabel />
              <Button variant="ghost" size="sm" iconRight="arrow-r" onClick={() => go('session')}>Drill</Button>
            </div>
          ))}
        </Card>

        <Card padded={false}>
          <div style={{ padding: 'var(--pad-card) var(--pad-card) 8px' }}>
            <div className="chrome-label">Session history</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 12, padding: '10px var(--pad-card)' }}>
            <span className="chrome-label" style={{ fontSize: 10 }}>Topic</span>
            <span className="chrome-label" style={{ fontSize: 10 }}>When</span>
            <span className="chrome-label" style={{ fontSize: 10 }}>Score</span>
            <span className="chrome-label" style={{ fontSize: 10 }}>Time</span>
          </div>
          {RECENT.map((r, i) => (
            <div key={r.id} style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto auto',
              gap: 12, alignItems: 'center',
              padding: '10px var(--pad-card)',
              borderTop: '1px solid var(--hairline)',
              fontSize: 'var(--fs-small)',
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>{r.topic}</span>
              <span className="chrome-label" style={{ fontSize: 11 }}>{r.date}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: r.correct / r.questions >= 0.8 ? 'var(--positive)' : 'var(--ink-muted)' }}>{r.correct}/{r.questions}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)' }}>{r.mins}m</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function AccuracyChart() {
  // 30 daily points; build a smoothed line
  const data = React.useMemo(() => {
    const pts = [];
    let v = 0.62;
    for (let i = 0; i < 30; i++) {
      v += (Math.sin(i * 0.45) * 0.025) + (Math.random() - 0.4) * 0.012;
      v = Math.max(0.5, Math.min(0.92, v));
      pts.push(v);
    }
    return pts;
  }, []);

  const W = 380, H = 140, P = 14;
  const xs = (i) => P + (i / (data.length - 1)) * (W - P * 2);
  const ys = (v) => H - P - ((v - 0.5) / (0.95 - 0.5)) * (H - P * 2);
  const linePath = data.map((v, i) => `${i ? 'L' : 'M'} ${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');
  const areaPath = linePath + ` L ${xs(data.length - 1)} ${H - P} L ${xs(0)} ${H - P} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* gridlines */}
        {[0.6, 0.7, 0.8, 0.9].map((v, i) => (
          <g key={i}>
            <line x1={P} x2={W - P} y1={ys(v)} y2={ys(v)} stroke="var(--hairline)" strokeDasharray="2 4" />
            <text x={W - P + 2} y={ys(v) + 3} fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-faint)">{Math.round(v * 100)}</text>
          </g>
        ))}
        <path d={areaPath} fill="var(--accent-soft)" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
        {data.map((v, i) => (i === data.length - 1) && (
          <circle key={i} cx={xs(i)} cy={ys(v)} r="3" fill="var(--accent)" stroke="var(--bg)" strokeWidth="1.5" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span className="chrome-label" style={{ fontSize: 10 }}>30d ago</span>
        <span className="chrome-label" style={{ fontSize: 10 }}>Today</span>
      </div>
    </div>
  );
}

function StreakHeatmap() {
  // 12 weeks × 7 days
  const days = STREAK_DAYS;
  const cells = [];
  for (let w = 0; w < 12; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      col.push(days[w * 7 + d] || 0);
    }
    cells.push(col);
  }
  const colorFor = (v) => {
    if (!v) return 'var(--hairline)';
    if (v === 1) return 'oklch(from var(--accent) l c h / 0.25)';
    if (v === 2) return 'oklch(from var(--accent) l c h / 0.45)';
    if (v === 3) return 'oklch(from var(--accent) l c h / 0.7)';
    return 'var(--accent)';
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginRight: 6 }}>
          {['M', 'W', 'F'].map((d, i) => (
            <span key={d} className="chrome-label" style={{ fontSize: 9, height: 10, marginTop: i ? 14 : 0 }}>{d}</span>
          ))}
        </div>
        {cells.map((col, w) => (
          <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {col.map((v, d) => (
              <div key={d} style={{
                width: 14, height: 10, borderRadius: 2,
                background: colorFor(v),
              }} />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, alignItems: 'center' }}>
        <span className="chrome-label" style={{ fontSize: 10 }}>Less</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {[0,1,2,3,4].map((v) => (
            <div key={v} style={{ width: 10, height: 10, borderRadius: 2, background: colorFor(v) }} />
          ))}
        </div>
        <span className="chrome-label" style={{ fontSize: 10 }}>More</span>
      </div>
    </div>
  );
}

/* ───────────────────────────── Function Explorer ───────────────────────────── */

function FunctionExplorer() {
  const [a, setA] = React.useState(0.5);
  const [b, setB] = React.useState(-1);
  const [c, setC] = React.useState(0);
  const [tab, setTab] = React.useState('Graph');

  // Compute properties live
  const props = React.useMemo(() => {
    const disc = b * b - 4 * a * c;
    let roots = '\\text{no real roots}';
    if (Math.abs(a) > 1e-6 && disc >= 0) {
      const r1 = ((-b + Math.sqrt(disc)) / (2 * a)).toFixed(3);
      const r2 = ((-b - Math.sqrt(disc)) / (2 * a)).toFixed(3);
      roots = `x = ${r1},\\ ${r2}`;
    }
    const vx = Math.abs(a) > 1e-6 ? (-b / (2 * a)).toFixed(3) : '—';
    const vy = Math.abs(a) > 1e-6 ? (a * vx * vx + b * vx + c).toFixed(3) : '—';
    return { roots, vertex: `(${vx},\\ ${vy})`, deriv: `${(2 * a).toFixed(2)}x ${b >= 0 ? '+' : '-'} ${Math.abs(b).toFixed(2)}` };
  }, [a, b, c]);

  const expr = `${a.toFixed(2)}x^2 ${b >= 0 ? '+' : '-'} ${Math.abs(b).toFixed(2)}x ${c >= 0 ? '+' : '-'} ${Math.abs(c).toFixed(2)}`;

  return (
    <div style={{ padding: 'var(--pad-screen)', maxWidth: 1080, margin: '0 auto' }}>
      <div className="chrome-label" style={{ marginBottom: 6 }}>Tool</div>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h1)',
        fontWeight: 500, margin: '0 0 24px', letterSpacing: '-0.01em',
      }}>Function Explorer</h1>

      {/* Expression input */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'center',
        marginBottom: 22, padding: '16px 20px',
        background: 'var(--surface)', border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
      }}>
        <span className="chrome-label">f(x) =</span>
        <div style={{ fontSize: 22 }}><TeX tex={`a x^2 + b x + c \\;=\\; ${expr}`} /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 'var(--gap)' }}>
        {/* Graph + tabs */}
        <Card padded={false}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--hairline)' }}>
            {['Graph', 'Derivative', 'Integral', 'Properties'].map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                background: 'transparent', border: 'none',
                padding: '14px 18px', cursor: 'pointer',
                color: tab === t ? 'var(--ink)' : 'var(--ink-muted)',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-small)',
                fontWeight: tab === t ? 600 : 400,
                borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1,
              }}>{t}</button>
            ))}
          </div>
          <div style={{ padding: 'var(--pad-card)' }}>
            <Plot a={a} b={b} c={c} mode={tab} />
          </div>
        </Card>

        {/* Side panel: sliders + properties */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          <Card>
            <div className="chrome-label" style={{ marginBottom: 12 }}>Parameters</div>
            <ParamSlider label="a" value={a} setValue={setA} min={-2} max={2} />
            <ParamSlider label="b" value={b} setValue={setB} min={-3} max={3} />
            <ParamSlider label="c" value={c} setValue={setC} min={-3} max={3} />
          </Card>
          <Card>
            <div className="chrome-label" style={{ marginBottom: 12 }}>Properties</div>
            <PropRow label="Roots"   tex={props.roots} />
            <PropRow label="Vertex"  tex={props.vertex} />
            <PropRow label="f'(x)"   tex={props.deriv} />
            <PropRow label="Concave" plain={a > 0 ? 'Upward' : a < 0 ? 'Downward' : 'Linear'} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function ParamSlider({ label, value, setValue, min, max }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontStyle: 'italic' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-small)', color: 'var(--ink-muted)' }}>{value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step="0.05" value={value}
        onChange={(e) => setValue(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)' }} />
    </div>
  );
}

function PropRow({ label, tex, plain }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '70px 1fr', gap: 12,
      alignItems: 'baseline', padding: '6px 0',
      borderTop: '1px solid var(--hairline)',
    }}>
      <span className="chrome-label" style={{ fontSize: 11 }}>{label}</span>
      <span style={{ fontSize: 15, fontFamily: tex ? 'inherit' : 'var(--font-display)' }}>
        {tex ? <TeX tex={tex} /> : plain}
      </span>
    </div>
  );
}

function Plot({ a, b, c, mode }) {
  const W = 560, H = 320;
  const xMin = -4, xMax = 4, yMin = -4, yMax = 6;
  const px = (x) => ((x - xMin) / (xMax - xMin)) * W;
  const py = (y) => H - ((y - yMin) / (yMax - yMin)) * H;
  const f  = (x) => a * x * x + b * x + c;
  const fp = (x) => 2 * a * x + b;
  const F  = (x) => (a / 3) * x ** 3 + (b / 2) * x ** 2 + c * x;

  const series = (fn, n = 200) => {
    let path = '';
    for (let i = 0; i <= n; i++) {
      const x = xMin + ((xMax - xMin) * i) / n;
      const y = fn(x);
      const cmd = i ? 'L' : 'M';
      path += ` ${cmd} ${px(x).toFixed(2)} ${py(y).toFixed(2)}`;
    }
    return path;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
      {/* grid */}
      {[-3,-2,-1,0,1,2,3].map((v) => (
        <line key={`v${v}`} x1={px(v)} x2={px(v)} y1={0} y2={H} stroke="var(--hairline)" strokeDasharray={v === 0 ? '' : '2 3'} strokeWidth={v === 0 ? 1 : 0.5} />
      ))}
      {[-3,-2,-1,0,1,2,3,4,5].map((v) => (
        <line key={`h${v}`} x1={0} x2={W} y1={py(v)} y2={py(v)} stroke="var(--hairline)" strokeDasharray={v === 0 ? '' : '2 3'} strokeWidth={v === 0 ? 1 : 0.5} />
      ))}
      {/* axis labels */}
      <text x={W - 4} y={py(0) - 4} fontFamily="var(--font-display)" fontStyle="italic" fontSize="11" fill="var(--ink-faint)" textAnchor="end">x</text>
      <text x={px(0) + 6} y={10}    fontFamily="var(--font-display)" fontStyle="italic" fontSize="11" fill="var(--ink-faint)">y</text>

      {/* curves */}
      {(mode === 'Graph' || mode === 'Properties') && (
        <path d={series(f)} fill="none" stroke="var(--accent)" strokeWidth="1.8" />
      )}
      {mode === 'Derivative' && (
        <>
          <path d={series(f)} fill="none" stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="3 3" />
          <path d={series(fp)} fill="none" stroke="var(--accent)" strokeWidth="1.8" />
        </>
      )}
      {mode === 'Integral' && (
        <>
          <path d={series(f)} fill="none" stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="3 3" />
          <path d={series(F)} fill="none" stroke="var(--accent)" strokeWidth="1.8" />
        </>
      )}

      {/* legend */}
      <g transform={`translate(${W - 130}, 18)`}>
        <rect width="118" height={mode === 'Graph' || mode === 'Properties' ? 26 : 42} fill="var(--surface)" stroke="var(--hairline)" rx="3" />
        <line x1="8" x2="22" y1="14" y2="14" stroke="var(--accent)" strokeWidth="1.8" />
        <text x="28" y="17" fontFamily="var(--font-ui)" fontSize="10" fill="var(--ink)">
          {mode === 'Derivative' ? "f '(x)" : mode === 'Integral' ? '∫f(x)dx' : 'f(x)'}
        </text>
        {(mode === 'Derivative' || mode === 'Integral') && (
          <>
            <line x1="8" x2="22" y1="32" y2="32" stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="3 3" />
            <text x="28" y="35" fontFamily="var(--font-ui)" fontSize="10" fill="var(--ink-muted)">f(x)</text>
          </>
        )}
      </g>
    </svg>
  );
}

Object.assign(window, {
  TopicList, TopicDetail, ConceptDetail, Progress, FunctionExplorer,
});
