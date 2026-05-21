import styles from './StatsRow.module.css';

export interface StatItem {
  label: string;
  value: string | number;
  color?: string;
}

interface Props {
  stats: StatItem[];
}

export function StatsRow({ stats }: Props) {
  return (
    <div className={styles.row}>
      {stats.map((s) => (
        <div key={s.label} className={styles.card}>
          <div className={styles.num} style={s.color ? { color: s.color } : undefined}>
            {s.value}
          </div>
          <div className={styles.label}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}
