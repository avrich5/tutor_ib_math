/* app.jsx — App shell: TopBar, ChatPanel, layout, routing */

function App() {
  const [screen, setScreen] = React.useState('dashboard');
  const [screenParams, setScreenParams] = React.useState({});
  const [chatOpen, setChatOpen] = React.useState(true);
  const [chatWidth, setChatWidth] = React.useState(380);
  const [srsNotice, setSrsNotice] = React.useState(null);
  const [serverStatus, setServerStatus] = React.useState('online'); // 'online' | 'offline'
  const [accent, setAccent] = React.useState(null); // null = theme default

  // Apply accent override (hue only; lightness/chroma is per-theme + per-mode)
  React.useEffect(() => {
    if (accent && accent.hue != null) {
      document.body.style.setProperty('--accent-hue', accent.hue);
    } else {
      document.body.style.removeProperty('--accent-hue');
    }
  }, [accent]);

  // Listen for tweak messages from parent
  React.useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type !== 'tutor:tweaks') return;
      const t = e.data.tweaks || {};
      if (t.mode)      document.body.dataset.mode = t.mode;
      if (t.density)   document.body.dataset.density = t.density;
      if (t.chatWidth) setChatWidth(t.chatWidth);
      if (t.accent)    setAccent(t.accent);
      if (typeof t.serverOffline === 'boolean') setServerStatus(t.serverOffline ? 'offline' : 'online');
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Keyboard: cmd+\ toggles chat
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setChatOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (s, params = {}) => { setScreen(s); setScreenParams(params); };
  const openConcept = (id) => go('concept', { conceptId: id });
  const openTopic = (id) => go('topic', { subtopicId: id });

  // Breadcrumb for top bar
  const crumbs = (() => {
    if (screen === 'dashboard') return ['Dashboard'];
    if (screen === 'session')   return [SESSION[0].topic, SESSION[0].subtopic, 'Session'];
    if (screen === 'topics')    return ['Topics'];
    if (screen === 'topic')     {
      const sub = TOPICS.flatMap((t) => t.subtopics.map((s) => ({...s, parent: t}))).find((s) => s.id === screenParams.subtopicId);
      return sub ? [sub.parent.name, sub.name] : ['Topic'];
    }
    if (screen === 'concept')   return ['Concept', CONCEPTS[screenParams.conceptId]?.name || 'Product Rule'];
    if (screen === 'progress')  return ['Progress'];
    if (screen === 'explorer')  return ['Function Explorer'];
    return [];
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      <TopBar crumbs={crumbs} streak={14} go={go} screen={screen} chatOpen={chatOpen} setChatOpen={setChatOpen} serverStatus={serverStatus} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left rail nav — slim */}
        <SideRail screen={screen} go={go} />
        {/* Main area */}
        <main style={{
          flex: 1, overflow: 'auto',
          borderRight: '1px solid var(--hairline)',
        }}>
          {screen === 'dashboard' && <Dashboard go={go} openConcept={openConcept} />}
          {screen === 'session'   && <Session goBack={() => go('dashboard')} openConcept={openConcept} srsNotice={srsNotice} setSrsNotice={setSrsNotice} />}
          {screen === 'topics'    && <TopicList go={go} openTopic={openTopic} />}
          {screen === 'topic'     && <TopicDetail subtopicId={screenParams.subtopicId || 'ca-der'} go={go} openConcept={openConcept} />}
          {screen === 'concept'   && <ConceptDetail id={screenParams.conceptId || 'product-rule'} go={go} openConcept={openConcept} />}
          {screen === 'progress'  && <Progress go={go} />}
          {screen === 'explorer'  && <FunctionExplorer />}
        </main>
        {/* Chat panel */}
        <ChatPanel
          open={chatOpen} setOpen={setChatOpen}
          width={chatWidth}
          openConcept={openConcept}
          studyingContext={screen === 'session' ? `${SESSION[0].subtopic} → ${CONCEPTS['product-rule'].name}` : crumbs.join(' → ')}
          serverStatus={serverStatus}
        />
      </div>
    </div>
  );
}

/* ───────────────────────────── Top bar ───────────────────────────── */

function TopBar({ crumbs, streak, go, screen, chatOpen, setChatOpen, serverStatus }) {
  return (
    <header style={{
      flex: '0 0 56px', height: 56,
      display: 'grid', gridTemplateColumns: '220px 1fr auto',
      alignItems: 'center', gap: 24,
      padding: '0 22px',
      borderBottom: '1px solid var(--hairline)',
      background: 'var(--bg)',
    }}>
      {/* Logo / wordmark */}
      <button onClick={() => go('dashboard')} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: 0, color: 'var(--ink)',
      }}>
        <Logo />
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 17,
          fontStyle: 'italic', fontWeight: 500, letterSpacing: '-0.005em',
        }}>Tutor</span>
        <span className="chrome-label" style={{ fontSize: 10, marginLeft: 4 }}>
          AA HL
        </span>
      </button>

      {/* Breadcrumb */}
      <nav style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--ink-muted)' }}>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: 'var(--ink-faint)' }}>›</span>}
            <span className="chrome-label" style={{ color: i === crumbs.length - 1 ? 'var(--ink)' : 'var(--ink-muted)' }}>
              {c}
            </span>
          </React.Fragment>
        ))}
      </nav>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <ServerStatus status={serverStatus} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px',
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--chip-radius)',
        }}>
          <Icon name="flame" size={13} style={{ color: 'var(--accent)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)' }}>{streak}</span>
          <span className="chrome-label" style={{ fontSize: 10 }}>days</span>
        </div>
        <Button variant="quiet" icon="gear" size="sm" />
        {!chatOpen && <Button variant="secondary" size="sm" icon="chat" onClick={() => setChatOpen(true)} kbd="⌘\">Chat</Button>}
      </div>
    </header>
  );
}

function Logo() {
  // Simple typographic wordmark — placeholder per the brief
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="10" stroke="currentColor" strokeWidth="1" />
      <text x="11" y="15" textAnchor="middle"
        fontFamily="var(--font-display)" fontSize="12" fontStyle="italic" fontWeight="500"
        fill="currentColor">∂</text>
    </svg>
  );
}

function ServerStatus({ status }) {
  const online = status === 'online';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: online ? 'var(--positive)' : 'var(--warn)',
        boxShadow: online ? `0 0 0 3px oklch(from var(--positive) l c h / 0.2)` : `0 0 0 3px oklch(from var(--warn) l c h / 0.2)`,
      }} />
      <span className="chrome-label" style={{ fontSize: 10 }}>
        {online ? 'Online' : 'Server offline'}
      </span>
    </div>
  );
}

/* ───────────────────────────── Side rail ───────────────────────────── */

function SideRail({ screen, go }) {
  const items = [
    { id: 'dashboard', icon: 'home',    label: 'Dashboard' },
    { id: 'topics',    icon: 'book',    label: 'Topics' },
    { id: 'progress',  icon: 'chart',   label: 'Progress' },
    { id: 'explorer',  icon: 'curve',   label: 'Explorer' },
  ];
  return (
    <aside style={{
      flex: '0 0 64px', width: 64,
      borderRight: '1px solid var(--hairline)',
      padding: '14px 0',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      background: 'var(--bg)',
    }}>
      {items.map((it) => {
        const active = screen === it.id || (it.id === 'topics' && (screen === 'topic' || screen === 'concept')) || (it.id === 'dashboard' && screen === 'session');
        return <RailBtn key={it.id} {...it} active={active} onClick={() => go(it.id)} />;
      })}
    </aside>
  );
}

function RailBtn({ icon, label, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: 44, height: 44,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 2,
        background: active ? 'var(--surface)' : 'transparent',
        border: '1px solid', borderColor: active ? 'var(--hairline)' : 'transparent',
        borderRadius: 'var(--radius-sm)',
        color: active || hover ? 'var(--ink)' : 'var(--ink-muted)',
        cursor: 'pointer',
        transition: 'all 120ms',
      }}>
      <Icon name={icon} size={17} stroke={active ? 1.8 : 1.5} />
      <span className="chrome-label" style={{ fontSize: 9, color: 'inherit' }}>{label}</span>
    </button>
  );
}

/* ───────────────────────────── Chat panel ───────────────────────────── */

function ChatPanel({ open, setOpen, width, openConcept, studyingContext, serverStatus }) {
  const [messages, setMessages] = React.useState(CHAT_SEED);
  const [draft, setDraft] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);
  const [streamText, setStreamText] = React.useState('');
  const listRef = React.useRef(null);

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, streamText, streaming]);

  const send = () => {
    if (!draft.trim() || streaming) return;
    const userMsg = { id: 'u' + Date.now(), role: 'user', text: draft.trim() };
    setMessages((m) => [...m, userMsg]);
    setDraft('');
    setStreaming(true);
    // Mock streaming response
    const response = "Let's break it down. The Chain Rule says that if $y = f(g(x))$, then $\\dfrac{dy}{dx} = f'(g(x)) \\cdot g'(x)$. So you differentiate the outer function evaluated at the inner one, then multiply by the derivative of the inner.";
    let i = 0;
    setStreamText('');
    const tick = () => {
      i = Math.min(response.length, i + Math.ceil(Math.random() * 6) + 2);
      setStreamText(response.slice(0, i));
      if (i < response.length) {
        setTimeout(tick, 28 + Math.random() * 30);
      } else {
        setStreaming(false);
        setStreamText('');
        setMessages((m) => [...m, {
          id: 'a' + Date.now(), role: 'assistant', text: response,
          pills: [{ id: 'chain-rule', label: 'Chain Rule' }],
        }]);
      }
    };
    setTimeout(tick, 250);
  };

  if (!open) {
    return <CollapsedChat onExpand={() => setOpen(true)} />;
  }

  return (
    <aside style={{
      flex: `0 0 ${width}px`, width,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)',
      borderLeft: '1px solid var(--hairline)',
      minHeight: 0,
    }}>
      {/* Header */}
      <div style={{
        flex: '0 0 auto',
        display: 'grid', gridTemplateColumns: '1fr auto',
        alignItems: 'center', gap: 12,
        padding: '14px 18px',
        borderBottom: '1px solid var(--hairline)',
      }}>
        <div>
          <div className="chrome-label" style={{ fontSize: 10 }}>Tutor</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)' }}>
            Ask anything
          </div>
        </div>
        <Button variant="quiet" size="sm" icon="expand" onClick={() => setOpen(false)} kbd="⌘\" />
      </div>

      {/* Message list */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 16px' }}>
        {serverStatus === 'offline' ? (
          <OfflineChat />
        ) : (
          <>
            {messages.map((m) => <ChatMessage key={m.id} m={m} openConcept={openConcept} />)}
            {streaming && (
              <ChatMessage m={{ role: 'assistant', text: streamText, streaming: true }} openConcept={openConcept} />
            )}
          </>
        )}
      </div>

      {/* Context chip + composer */}
      <div style={{ flex: '0 0 auto', borderTop: '1px solid var(--hairline)', padding: '10px 14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span className="chrome-label" style={{ fontSize: 10 }}>Studying</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 8px',
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--chip-radius)',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--ink)',
          }}>{studyingContext}</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          padding: '10px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
        }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask the tutor… (Shift+Enter for newline)"
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)',
              resize: 'none', outline: 'none', lineHeight: 1.4,
              maxHeight: 110, minHeight: 22,
            }}
          />
          <button onClick={send} disabled={!draft.trim() || streaming || serverStatus === 'offline'} style={{
            width: 30, height: 30, borderRadius: 'var(--radius-sm)',
            background: draft.trim() && !streaming ? 'var(--accent)' : 'transparent',
            color: draft.trim() && !streaming ? 'var(--accent-ink)' : 'var(--ink-faint)',
            border: '1px solid', borderColor: draft.trim() && !streaming ? 'var(--accent)' : 'var(--line)',
            cursor: draft.trim() && !streaming ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 140ms',
          }}>
            <Icon name="send" size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function ChatMessage({ m, openConcept }) {
  if (m.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <div style={{
          maxWidth: '80%',
          padding: '9px 13px',
          background: 'var(--accent-soft)',
          color: 'var(--ink)',
          borderRadius: 'var(--radius)',
          border: '1px solid oklch(from var(--accent) l c h / 0.25)',
          fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 1.5,
        }}>
          <Prose text={m.text} />
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="chrome-label" style={{ fontSize: 10, marginBottom: 4, color: 'var(--ink-faint)' }}>
        Tutor
      </div>
      <div style={{
        fontFamily: 'var(--font-prose)', fontSize: 'var(--fs-body)', lineHeight: 1.55,
        color: 'var(--ink)',
      }}>
        <Prose text={m.text} />
        {m.streaming && (
          <span style={{
            display: 'inline-block', width: 7, height: 14, marginLeft: 3,
            background: 'var(--accent)',
            verticalAlign: 'middle',
            animation: 'blink 1.1s steps(2) infinite',
          }} />
        )}
      </div>
      {m.block && (
        <div style={{
          margin: '10px 0', padding: '10px 14px',
          background: 'var(--paper)',
          border: '1px solid var(--hairline)',
          borderLeft: '2px solid var(--accent)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 18,
        }}><TeX tex={m.block} display /></div>
      )}
      {m.after && (
        <div style={{
          marginTop: 8,
          fontFamily: 'var(--font-prose)', fontSize: 'var(--fs-body)', lineHeight: 1.55,
          color: 'var(--ink)',
        }}><Prose text={m.after} /></div>
      )}
      {m.pills && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {m.pills.map((p) => (
            <CitationPill key={p.id} onClick={() => openConcept(p.id)}>{p.label}</CitationPill>
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsedChat({ onExpand }) {
  return (
    <aside style={{
      flex: '0 0 56px', width: 56,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '14px 0', gap: 14,
      background: 'var(--bg)',
      borderLeft: '1px solid var(--hairline)',
    }}>
      <button onClick={onExpand} style={{
        width: 36, height: 36, borderRadius: 'var(--radius-sm)',
        background: 'var(--surface)', border: '1px solid var(--hairline)',
        color: 'var(--ink)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <Icon name="chat" size={16} />
        <span style={{
          position: 'absolute', top: -4, right: -4,
          width: 14, height: 14, borderRadius: '50%',
          background: 'var(--accent)', color: 'var(--accent-ink)',
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>2</span>
      </button>
      <span className="chrome-label" style={{
        fontSize: 9, writingMode: 'vertical-rl',
        transform: 'rotate(180deg)', marginTop: 12,
      }}>Tutor</span>
    </aside>
  );
}

function OfflineChat() {
  return (
    <div style={{
      padding: '32px 20px', textAlign: 'center',
      color: 'var(--ink-muted)',
    }}>
      <Icon name="dot" size={10} style={{ color: 'var(--warn)' }} />
      <div className="chrome-label" style={{ marginTop: 6, fontSize: 11 }}>Tutor unavailable</div>
      <div style={{
        marginTop: 10, fontFamily: 'var(--font-prose)', fontSize: 14,
        fontStyle: 'italic', color: 'var(--ink-muted)', textWrap: 'pretty',
      }}>
        The server isn't responding. You can keep browsing topics and past content.
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
