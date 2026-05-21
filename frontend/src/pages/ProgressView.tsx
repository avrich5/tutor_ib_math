import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { StatsRow } from '../components/ui/StatsRow';
import styles from './ProgressView.module.css';

export function ProgressView() {
  const { data: summary } = useQuery({ queryKey: ['progress-summary'], queryFn: api.progressSummary });
  const { data: weak } = useQuery({ queryKey: ['weak-topics', 10], queryFn: () => api.weakTopics(10) });
  const { data: actData } = useQuery({ queryKey: ['activity', 30], queryFn: () => api.activity(30) });

  const stats = [
    { label: 'Streak', value: summary ? `${summary.streak_days}d` : '—' },
    { label: 'Today',  value: summary ? `${summary.minutes_today}m` : '—' },
    { label: 'Accuracy', value: summary ? `${Math.round(summary.accuracy * 100)}%` : '—' },
    { label: 'Due today', value: summary?.due_today ?? '—' },
  ];

  const days = actData?.days ?? [];
  const maxAttempts = Math.max(1, ...days.map(d => d.attempts));

  return (
    <div className={styles.page}>
      <h1>Progress</h1>

      <StatsRow stats={stats} />

      {/* Streak callout */}
      {summary && summary.streak_days > 0 && (
        <div>
          <div className={styles.streakBig}>{summary.streak_days}</div>
          <div className={styles.streakLabel}>
            day{summary.streak_days !== 1 ? 's' : ''} in a row · {summary.total_correct}/{summary.total_attempts} correct total
          </div>
        </div>
      )}

      {/* 30-day activity bar chart */}
      {days.length > 0 && (
        <div className={styles.section}>
          <h2>Activity — last 30 days</h2>
          <div className={styles.heatmap}>
            {days.map(d => {
              const h = d.attempts === 0 ? 4 : Math.max(8, Math.round((d.attempts / maxAttempts) * 64));
              return (
                <div
                  key={d.date}
                  className={styles.bar}
                  data-active={d.attempts > 0 ? 'true' : 'false'}
                  style={{ height: h }}
                  title={`${d.date}: ${d.attempts} attempts, ${d.correct} correct, ${d.minutes}m`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Weak topics */}
      {weak && weak.length > 0 && (
        <div className={styles.section}>
          <h2>Topics needing work</h2>
          <div className={styles.weakList}>
            {weak.map(w => (
              <div key={w.topic_slug} className={styles.weakRow}>
                <span className={styles.weakName}>{w.title}</span>
                <div className={styles.accBar}>
                  <div className={styles.accFill} style={{ width: `${Math.round(w.accuracy * 100)}%` }} />
                </div>
                <span className={styles.accNum}>{Math.round(w.accuracy * 100)}%</span>
                <span style={{ fontSize: 'var(--fs-small)', color: 'var(--ink-faint)' }}>{w.attempts}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!summary && !weak && <p style={{ color: 'var(--ink-muted)' }}>Loading…</p>}
      {summary && summary.total_attempts === 0 && (
        <p style={{ color: 'var(--ink-faint)', fontSize: 'var(--fs-body)' }}>
          No attempts yet — start a session to see your progress here.
        </p>
      )}
    </div>
  );
}
