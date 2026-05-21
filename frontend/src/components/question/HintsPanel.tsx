import { useState } from 'react';
import { api } from '../../api/client';
import { MathText } from '../ui/Math';
import styles from './HintsPanel.module.css';

interface Props {
  questionId: string;
  onHintUsed: () => void;
  disabled?: boolean;
}

interface HintEntry {
  tier: number;
  text: string;
}

export function HintsPanel({ questionId, onHintUsed, disabled }: Props) {
  const [revealed, setRevealed] = useState<HintEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const nextTier = revealed.length + 1;
  const canShowMore = nextTier <= 3;

  async function showHint() {
    if (!canShowMore || loading) return;
    setLoading(true);
    try {
      const hint = await api.getHint(questionId, nextTier);
      setRevealed(prev => [...prev, { tier: hint.tier, text: hint.hint_md }]);
      onHintUsed();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.panel}>
      {revealed.map(h => (
        <div key={h.tier} className={styles.hint}>
          <div className={styles.hintLabel}>Hint {h.tier}</div>
          <MathText text={h.text} />
        </div>
      ))}
      <div className={styles.actions}>
        {canShowMore && (
          <button
            className={styles.tierBtn}
            onClick={showHint}
            disabled={disabled || loading}
          >
            {loading ? 'Loading…' : `Show hint ${nextTier}`}
          </button>
        )}
      </div>
    </div>
  );
}
