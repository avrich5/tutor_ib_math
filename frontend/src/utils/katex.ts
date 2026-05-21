import katex from 'katex';

export function renderLatex(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      trust: false,
      strict: false,
    });
  } catch {
    return `<span class="katex-error">${latex}</span>`;
  }
}

// Split markdown text containing $...$ or $$...$$ into segments.
// Returns array of {type: 'text'|'inline'|'block', content: string}
export type MathSegment =
  | { type: 'text'; content: string }
  | { type: 'inline'; content: string }
  | { type: 'block'; content: string };

export function parseMathSegments(text: string): MathSegment[] {
  const segments: MathSegment[] = [];
  // Match $$...$$ first, then $...$
  const re = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', content: text.slice(last, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ type: 'block', content: match[1] });
    } else {
      segments.push({ type: 'inline', content: match[2] });
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    segments.push({ type: 'text', content: text.slice(last) });
  }

  return segments;
}
