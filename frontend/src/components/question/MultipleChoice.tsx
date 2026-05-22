import { useEffect } from 'react';
import { Math as MathExpr } from '../ui/Math';
import styles from './MultipleChoice.module.css';

interface Props {
  choices: Record<string, string>;
  selected: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}

const KEYS = ['A', 'B', 'C', 'D'];

export function MultipleChoice({ choices, selected, onChange, disabled }: Props) {
  // Keyboard shortcut: 1-4 maps to A-D
  useEffect(() => {
    if (disabled) return;
    const handler = (e: KeyboardEvent) => {
      const idx = parseInt(e.key) - 1;
      const key = KEYS[idx];
      if (key && choices[key] !== undefined) {
        onChange(key);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [choices, onChange, disabled]);

  return (
    <div className={styles.choices}>
      {KEYS.filter(k => choices[k] !== undefined).map(k => (
        <button
          key={k}
          className={styles.choice}
          data-selected={selected === k ? 'true' : 'false'}
          disabled={disabled}
          onClick={() => onChange(k)}
        >
          <span className={styles.key}>{k}</span>
          <MathExpr latex={choices[k]} />
        </button>
      ))}
    </div>
  );
}
