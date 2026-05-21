import { useEffect, useRef } from 'react';
import type { MathfieldElement } from 'mathlive';

interface Options {
  onChange: (latex: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
}

export function useMathfield({ onChange, onSubmit, disabled }: Options) {
  const ref = useRef<MathfieldElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onChange(el.value);
    el.addEventListener('input', handler as EventListener);
    return () => el.removeEventListener('input', handler as EventListener);
  }, [onChange]);

  useEffect(() => {
    if (!onSubmit) return;
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (disabled) {
      el.setAttribute('disabled', '');
    } else {
      el.removeAttribute('disabled');
    }
  }, [disabled]);

  return ref;
}
