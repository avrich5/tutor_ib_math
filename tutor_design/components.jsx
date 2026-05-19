/* components.jsx — shared primitives. TeX rendering, icons, buttons, chips. */

/* ───────────────────────────── KaTeX rendering ───────────────────────────── */

function TeX({ tex, display = false, style, className }) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const render = () => {
      if (window.katex && ref.current) {
        try {
          window.katex.render(tex, ref.current, {
            throwOnError: false,
            displayMode: display,
            output: 'html',
          });
        } catch (e) {
          ref.current.textContent = tex;
        }
      } else {
        // KaTeX not loaded yet — retry shortly
        setTimeout(render, 60);
      }
    };
    render();
  }, [tex, display]);
  const Tag = display ? 'div' : 'span';
  return <Tag ref={ref} className={className} style={{ ...(display ? {textAlign: 'left'} : {}), ...style }} />;
}

/* Prose-with-math: splits a string on $...$ and renders math inline.
   Block math is wrapped in $$...$$. */
function Prose({ text, style }) {
  // Split on $$...$$ first, then on $...$
  const blocks = String(text).split(/(\$\$[^$]+\$\$)/g);
  return (
    <span style={style}>
      {blocks.map((blk, i) => {
        if (blk.startsWith('$$')) {
          return <TeX key={i} display tex={blk.slice(2, -2)} />;
        }
        const parts = blk.split(/(\$[^$]+\$)/g);
        return parts.map((p, j) => {
          if (p.startsWith('$')) {
            return <TeX key={`${i}-${j}`} tex={p.slice(1, -1)} />;
          }
          return <span key={`${i}-${j}`}>{p}</span>;
        });
      })}
    </span>
  );
}

/* ───────────────────────────── Icons (tabler-ish) ───────────────────────────── */

function Icon({ name, size = 16, stroke = 1.6, style }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: stroke,
    strokeLinecap: 'round', strokeLinejoin: 'round', style,
  };
  switch (name) {
    case 'flame':    return <svg {...props}><path d="M12 3c2 3 4 5 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C9 9.5 10 7 12 3z"/><path d="M14 14a2 2 0 1 1-4 0c0-1 .8-1.8 2-3 1.2 1.2 2 2 2 3z"/></svg>;
    case 'arrow-r':  return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrow-l':  return <svg {...props}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>;
    case 'arrow-ul': return <svg {...props}><path d="M7 17 17 7M7 7h10v10"/></svg>;
    case 'check':    return <svg {...props}><path d="M5 12l5 5L20 7"/></svg>;
    case 'x':        return <svg {...props}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'gear':     return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.4l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.6 7l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case 'chat':     return <svg {...props}><path d="M21 12a8 8 0 0 1-12 7l-5 1 1.4-4.4A8 8 0 1 1 21 12z"/></svg>;
    case 'home':     return <svg {...props}><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2z"/></svg>;
    case 'book':     return <svg {...props}><path d="M4 4h12a3 3 0 0 1 3 3v13a3 3 0 0 0-3-2H4z"/><path d="M4 4v14"/></svg>;
    case 'chart':    return <svg {...props}><path d="M4 20V8M10 20v-6M16 20V4M22 20H2"/></svg>;
    case 'curve':    return <svg {...props}><path d="M3 18s3-12 9-12 6 12 9 12"/></svg>;
    case 'concept':  return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M9 10c0-2 1-3 3-3s3 1 3 3-3 2-3 4M12 17h0"/></svg>;
    case 'play':     return <svg {...props}><path d="M6 4l14 8L6 20z" fill="currentColor" stroke="none"/></svg>;
    case 'plus':     return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'minus':    return <svg {...props}><path d="M5 12h14"/></svg>;
    case 'send':     return <svg {...props}><path d="M4 12 20 4l-4 16-4-7-8-1z"/></svg>;
    case 'collapse': return <svg {...props}><path d="M15 5l-6 7 6 7"/></svg>;
    case 'expand':   return <svg {...props}><path d="M9 5l6 7-6 7"/></svg>;
    case 'enter':    return <svg {...props}><path d="M9 10l-4 4 4 4"/><path d="M5 14h11a4 4 0 0 0 4-4V6"/></svg>;
    case 'kbd':      return <svg {...props}><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12"/></svg>;
    case 'grip':     return <svg {...props}><circle cx="9" cy="6"  r=".7" fill="currentColor"/><circle cx="9" cy="12" r=".7" fill="currentColor"/><circle cx="9" cy="18" r=".7" fill="currentColor"/><circle cx="15" cy="6"  r=".7" fill="currentColor"/><circle cx="15" cy="12" r=".7" fill="currentColor"/><circle cx="15" cy="18" r=".7" fill="currentColor"/></svg>;
    case 'dot':      return <svg {...props}><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></svg>;
    case 'lightbulb':return <svg {...props}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5c-.6.6-1 1.4-1 2.3V17H9v-1.2c0-.9-.4-1.7-1-2.3A6 6 0 0 1 12 3z"/></svg>;
    case 'pause':    return <svg {...props}><path d="M7 5v14M17 5v14"/></svg>;
    case 'eye':      return <svg {...props}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    default:         return null;
  }
}

/* ───────────────────────────── Button ───────────────────────────── */

function Button({ children, variant = 'primary', size = 'md', icon, iconRight, kbd, onClick, disabled, style }) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);

  const sizes = {
    sm: { pad: '6px 10px',  fs: 'var(--fs-small)', gap: 6, h: 30 },
    md: { pad: '10px 16px', fs: 'var(--fs-body)',  gap: 8, h: 38 },
    lg: { pad: '14px 22px', fs: 'var(--fs-body)',  gap: 10, h: 48 },
  };
  const s = sizes[size];

  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: s.gap, padding: s.pad, height: s.h, minHeight: s.h,
    fontSize: s.fs, fontFamily: 'var(--font-ui)',
    fontWeight: 500, letterSpacing: 0,
    border: '1px solid transparent', borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 120ms, color 120ms, border-color 120ms, transform 80ms',
    opacity: disabled ? 0.45 : 1,
    transform: active ? 'translateY(0.5px)' : 'none',
    whiteSpace: 'nowrap',
    ...style,
  };

  const variants = {
    primary: {
      background: hover ? 'oklch(from var(--accent) calc(l - 0.04) c h)' : 'var(--accent)',
      color: 'var(--accent-ink)',
      fontWeight: 600,
    },
    secondary: {
      background: hover ? 'var(--elevated)' : 'var(--surface)',
      color: 'var(--ink)',
      borderColor: 'var(--line)',
    },
    ghost: {
      background: hover ? 'var(--surface)' : 'transparent',
      color: 'var(--ink-muted)',
      borderColor: 'transparent',
    },
    quiet: {
      background: 'transparent',
      color: hover ? 'var(--ink)' : 'var(--ink-muted)',
      borderColor: 'transparent',
      padding: '4px 6px',
    },
  };

  return (
    <button
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)} onMouseUp={() => setActive(false)}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant] }}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 18 : 15} />}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} size={size === 'lg' ? 18 : 15} />}
      {kbd && <Kbd>{kbd}</Kbd>}
    </button>
  );
}

/* ───────────────────────────── Kbd badge ───────────────────────────── */

function Kbd({ children, style }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      padding: '1.5px 5px',
      border: '1px solid currentColor',
      borderRadius: '3px',
      opacity: 0.7,
      marginLeft: 4,
      lineHeight: 1.2,
      ...style,
    }}>{children}</span>
  );
}

/* ───────────────────────────── Card surface ───────────────────────────── */

function Card({ children, padded = true, style, onClick, hoverable }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius)',
        padding: padded ? 'var(--pad-card)' : 0,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 140ms, background 140ms, transform 100ms',
        borderColor: hoverable && hover ? 'var(--line)' : 'var(--hairline)',
        background: hoverable && hover ? 'var(--elevated)' : 'var(--surface)',
        ...style,
      }}
    >{children}</div>
  );
}

/* ───────────────────────────── Mastery bar ───────────────────────────── */

function MasteryBar({ value, height = 4, showLabel = false, color }) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        flex: 1, height, borderRadius: height,
        background: 'var(--hairline)', overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: color || 'var(--accent)',
          transition: 'width 400ms cubic-bezier(.3,.7,.3,1)',
        }} />
      </div>
      {showLabel && <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-small)',
        color: 'var(--ink-muted)', minWidth: 36, textAlign: 'right',
      }}>{pct}%</span>}
    </div>
  );
}

/* ───────────────────────────── Citation pill ───────────────────────────── */

function CitationPill({ children, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px 2px 10px',
        background: hover ? 'var(--accent-soft)' : 'transparent',
        color: 'var(--accent)',
        border: '1px solid var(--accent)',
        borderRadius: 'var(--chip-radius)',
        fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-small)',
        fontWeight: 500,
        cursor: 'pointer',
        marginRight: 4,
      }}
    >
      {children}
      <Icon name="arrow-ul" size={11} />
    </button>
  );
}

/* ───────────────────────────── Section heading w/ rule ───────────────────────────── */

function SectionTitle({ kicker, children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--gap)' }}>
      <div>
        {kicker && (
          <div className="chrome-label" style={{ marginBottom: 4 }}>{kicker}</div>
        )}
        <h2 style={{
          margin: 0, fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-h2)', fontWeight: 500,
          letterSpacing: '-0.005em',
          color: 'var(--ink)',
        }}>{children}</h2>
      </div>
      {action}
    </div>
  );
}

/* ───────────────────────────── Badge ───────────────────────────── */

function Badge({ children, tone = 'neutral', style }) {
  const tones = {
    neutral:  { bg: 'var(--hairline)',   fg: 'var(--ink-muted)' },
    accent:   { bg: 'var(--accent-soft)',fg: 'var(--accent)' },
    positive: { bg: 'oklch(from var(--positive) l c h / 0.16)', fg: 'var(--positive)' },
    negative: { bg: 'oklch(from var(--negative) l c h / 0.16)', fg: 'var(--negative)' },
  };
  const t = tones[tone];
  return (
    <span className="chrome-label" style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 'var(--chip-radius)',
      background: t.bg, color: t.fg, fontSize: '11px',
      ...style,
    }}>{children}</span>
  );
}

Object.assign(window, { TeX, Prose, Icon, Button, Kbd, Card, MasteryBar, CitationPill, SectionTitle, Badge });
