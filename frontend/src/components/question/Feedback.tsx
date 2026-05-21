import type { AttemptResponse } from '../../api/types';
import { MathText } from '../ui/Math';
import styles from './Feedback.module.css';

interface Props {
  attempt: AttemptResponse;
}

function daysUntil(isoDate: string): number {
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.max(1, Math.round(diff / 86_400_000));
}

export function Feedback({ attempt }: Props) {
  const days = daysUntil(attempt.srs_next_review_at);

  return (
    <div className={styles.feedback} data-correct={String(attempt.correct)}>
      <div className={styles.header}>
        <span className={styles.icon}>{attempt.correct ? '✓' : '✗'}</span>
        <span className={attempt.correct ? styles.correct : styles.incorrect}>
          {attempt.correct ? 'Correct' : 'Incorrect'}
        </span>
      </div>

      <MathText text={attempt.feedback_md} />

      <div className={styles.srs}>
        Scheduled for review in {days} day{days !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
