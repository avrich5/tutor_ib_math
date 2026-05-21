import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Button } from '../components/ui/Button';
import { StatsRow } from '../components/ui/StatsRow';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const navigate = useNavigate();

  const { data: today } = useQuery({ queryKey: ['today'], queryFn: api.todayQueue });
  const { data: summary } = useQuery({ queryKey: ['progress-summary'], queryFn: api.progressSummary });
  const { data: weak } = useQuery({ queryKey: ['weak-topics', 3], queryFn: () => api.weakTopics(3) });
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: api.me });

  const name = user?.name ?? 'there';
  const suggested = today?.suggested_topic_slug ?? 'calculus.derivatives';

  function startSession(topicSlug: string) {
    navigate(`/session/new?topic=${encodeURIComponent(topicSlug)}`);
  }

  const stats = [
    { label: 'Streak', value: summary ? `${summary.streak_days}d` : '—' },
    { label: 'Today', value: summary ? `${summary.minutes_today}m` : '—' },
    { label: 'Accuracy', value: summary ? `${Math.round(summary.accuracy * 100)}%` : '—' },
    { label: 'Due', value: today?.due_count ?? '—', color: today?.due_count ? 'var(--accent)' : undefined },
  ];

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroText}>
          <h1>Welcome back, {name}</h1>
          <p className={styles.heroSub}>
            {today?.due_count
              ? `${today.due_count} card${today.due_count !== 1 ? 's' : ''} due for review`
              : 'No cards due — keep exploring'}
          </p>
        </div>
        <Button size="lg" onClick={() => startSession(suggested)}>
          Start today's session
        </Button>
      </div>

      {/* Stats */}
      <StatsRow stats={stats} />

      {/* Today's queue */}
      {today && today.topics.length > 0 && (
        <div className={styles.section}>
          <h2>Today's queue</h2>
          <div className={styles.topicList}>
            {today.topics.map(t => (
              <div key={t.topic_slug} className={styles.topicRow}>
                <div>
                  <div className={styles.topicName}>{t.title}</div>
                  <div className={styles.topicMeta}>{t.approved_questions} questions</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {t.due_count > 0 && (
                    <span className={styles.badge}>{t.due_count} due</span>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => startSession(t.topic_slug)}>
                    Start
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Needs attention */}
      {weak && weak.length > 0 && (
        <div className={styles.section}>
          <h2>Needs attention</h2>
          <div className={styles.weakList}>
            {weak.map(w => (
              <div key={w.topic_slug} className={styles.weakRow}>
                <span className={styles.weakName}>{w.title}</span>
                <span className={styles.weakAcc}>{Math.round(w.accuracy * 100)}%</span>
                <Button size="sm" variant="ghost" onClick={() => startSession(w.topic_slug)}>
                  Practice
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!today && !summary && (
        <p className={styles.emptyState}>Loading…</p>
      )}
    </div>
  );
}
