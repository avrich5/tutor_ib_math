import { useEffect } from 'react';
import { useSession } from '../hooks/useSession';
import { QuestionView } from '../components/question/QuestionView';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import styles from './Session.module.css';

export function Session() {
  const session = useSession('calculus.derivatives');

  // Keyboard: Enter advances when in feedback phase
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && session.phase === 'feedback') {
        if (session.questionNumber >= session.totalQuestions) {
          session.endSession();
        } else {
          session.nextQuestion();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [session]);

  if (session.phase === 'idle') {
    return (
      <div className={styles.page}>
        <div className={styles.startWrap}>
          <h1 className={styles.startTitle}>Calculus: Derivatives</h1>
          <p className={styles.startSub}>34 questions · SRS-scheduled for today</p>
          <Button size="lg" onClick={session.startSession}>
            Start session
          </Button>
        </div>
      </div>
    );
  }

  if (session.phase === 'starting') {
    return (
      <div className={styles.page}>
        <div className={styles.startWrap}>
          <span style={{ color: 'var(--ink-muted)' }}>Loading…</span>
        </div>
      </div>
    );
  }

  if (session.phase === 'error') {
    return (
      <div className={styles.page}>
        <div className={styles.startWrap}>
          <div className={styles.error}>{session.error}</div>
          <Button variant="secondary" onClick={session.startSession}>Retry</Button>
        </div>
      </div>
    );
  }

  if (session.phase === 'finished' && session.summary) {
    const s = session.summary;
    const pct = Math.round((s.correct / s.total_questions) * 100);
    const mins = Math.round(s.duration_seconds / 60);

    return (
      <div className={styles.page}>
        <div className={styles.summary}>
          <h1 className={styles.summaryTitle}>Session complete</h1>
          <div className={styles.summaryGrid}>
            <Card className={styles.statCard}>
              <div className={styles.statNum}>{pct}%</div>
              <div className={styles.statLabel}>Correct</div>
            </Card>
            <Card className={styles.statCard}>
              <div className={styles.statNum}>{s.correct}/{s.total_questions}</div>
              <div className={styles.statLabel}>Questions</div>
            </Card>
            <Card className={styles.statCard}>
              <div className={styles.statNum}>{mins}m</div>
              <div className={styles.statLabel}>Duration</div>
            </Card>
            <Card className={styles.statCard}>
              <div className={styles.statNum} style={{ color: s.mastery_delta >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                {s.mastery_delta >= 0 ? '+' : ''}{Math.round(s.mastery_delta * 100)}%
              </div>
              <div className={styles.statLabel}>Mastery Δ</div>
            </Card>
          </div>
          <Button onClick={() => window.location.reload()}>New session</Button>
        </div>
      </div>
    );
  }

  if (!session.question) return null;

  const progressPct = session.totalQuestions > 0
    ? (session.questionNumber / session.totalQuestions) * 100
    : 0;

  return (
    <div className={styles.page}>
      <div className={styles.progress}>
        <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
      </div>

      <QuestionView
        question={session.question}
        questionNumber={session.questionNumber}
        totalQuestions={session.totalQuestions}
        lastAttempt={session.lastAttempt}
        phase={session.phase as 'question' | 'submitting' | 'feedback'}
        onSubmit={session.submitAnswer}
        onNext={session.nextQuestion}
        onEnd={session.endSession}
        onHintUsed={session.incrementHints}
      />
    </div>
  );
}
