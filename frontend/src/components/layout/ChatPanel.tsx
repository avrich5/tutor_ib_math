import styles from './ChatPanel.module.css';

export function ChatPanel() {
  return (
    <div className={styles.panel}>
      <span className={styles.heading}>Tutor Chat</span>
      <div className={styles.placeholder}>
        Tutor chat — coming in Phase 4
      </div>
    </div>
  );
}
