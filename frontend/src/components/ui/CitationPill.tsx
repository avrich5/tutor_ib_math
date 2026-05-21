import { useState } from 'react';
import styles from './CitationPill.module.css';

interface Props {
  type: 'Q' | 'C' | 'hint';
  id: string;
  tier?: number;
  children?: string;
}

export function CitationPill({ type, id, tier, children }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);

  const label = children ?? (
    type === 'hint'
      ? `hint:${id.slice(0, 8)}:${tier}`
      : `${type}:${id.slice(0, 8)}`
  );

  const fullRef =
    type === 'hint' ? `[hint:${id}:${tier}]` : `[${type}:${id}]`;

  return (
    <span
      className={`${styles.pill} ${styles[`type${type}`]}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {label}
      {showTooltip && (
        <span className={styles.tooltip}>{fullRef}</span>
      )}
    </span>
  );
}
