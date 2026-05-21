import { renderLatex, parseMathSegments } from '../../utils/katex';
import styles from './Math.module.css';

interface MathProps {
  latex: string;
  display?: boolean;
}

// Render a single LaTeX expression
export function Math({ latex, display = false }: MathProps) {
  return (
    <span
      className={display ? styles.block : styles.inline}
      dangerouslySetInnerHTML={{ __html: renderLatex(latex, display) }}
    />
  );
}

interface MathTextProps {
  text: string;  // may contain $...$ and $$...$$
}

// Render mixed markdown text with inline and block math
export function MathText({ text }: MathTextProps) {
  const segments = parseMathSegments(text);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'text') return <span key={i}>{seg.content}</span>;
        if (seg.type === 'inline') return (
          <span
            key={i}
            className={styles.inline}
            dangerouslySetInnerHTML={{ __html: renderLatex(seg.content, false) }}
          />
        );
        return (
          <span
            key={i}
            className={styles.block}
            dangerouslySetInnerHTML={{ __html: renderLatex(seg.content, true) }}
          />
        );
      })}
    </>
  );
}
