import { useEffect, useRef } from 'react';
import 'mathlive';
import type { MathfieldElement } from 'mathlive';
import styles from './FreeExpression.module.css';

interface Props {
  value: string;
  onChange: (latex: string) => void;
  onSubmit: () => void;
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
    el.addEventListener('input', handler as EventListener);
    return () => el.removeEventListener('input', handler as EventListener);
  }, [onChange]);

  // Enter to submit
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
    <div className={styles.wrap}>
      <math-field
        ref={ref as never}
        class={styles.field}
        disabled={disabled || undefined}
      />
    </div>
  );
}
