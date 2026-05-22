import { useState } from 'react';
import { MathText } from '../ui/Math';
import styles from './Flashcard.module.css';

interface Props {
  referenceAnswer?: string;
  onChange: (v: 'got_it' | 'missed_it') => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function Flashcard({ referenceAnswer, onChange, onSubmit, disabled }: Props) {
  const [revealed, setRevealed] = useState(false);

  function pick(v: 'got_it' | 'missed_it') {
    onChange(v);
    onSubmit();
  }

  if (!revealed) {
    return (
      <button className={`${styles.btn} ${styles.reveal}`} disabled={disabled} onClick={() => setRevealed(true)}>
        Reveal answer
      </button>
    );
  }

  return (
    <div className={styles.revealBlock}>
      {referenceAnswer && (
        <div className={styles.answer}>
          <MathText text={referenceAnswer} />
        </div>
      )}
      <div className={styles.actions}>
        <button className={`${styles.btn} ${styles.gotIt}`} disabled={disabled} onClick={() => pick('got_it')}>
          Got it ✓
        </button>
        <button className={`${styles.btn} ${styles.missedIt}`} disabled={disabled} onClick={() => pick('missed_it')}>
          Missed it ✗
        </button>
      </div>
    </div>
  );
}
