import styles from './Flashcard.module.css';

interface Props {
  onChange: (v: 'got_it' | 'missed_it') => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function Flashcard({ onChange, onSubmit, disabled }: Props) {
  function pick(v: 'got_it' | 'missed_it') {
    onChange(v);
    onSubmit();
  }

  return (
    <div className={styles.actions}>
      <button className={`${styles.btn} ${styles.gotIt}`} disabled={disabled} onClick={() => pick('got_it')}>
        Got it ✓
      </button>
      <button className={`${styles.btn} ${styles.missedIt}`} disabled={disabled} onClick={() => pick('missed_it')}>
        Missed it ✗
      </button>
    </div>
  );
}
