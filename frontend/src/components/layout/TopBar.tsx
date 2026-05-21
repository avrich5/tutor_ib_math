import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { HealthStatus } from '../../api/types';
import styles from './TopBar.module.css';

function toggleMode() {
  const current = document.documentElement.dataset.mode ?? 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.mode = next;
  localStorage.setItem('tutor-mode', next);
}

function ModeIcon({ mode }: { mode: string }) {
  return mode === 'dark'
    ? <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5A5.5 5.5 0 1 1 8 13.5 5.5 5.5 0 0 1 8 2.5z"/></svg>
    : <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 11A3 3 0 1 1 8 5a3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7-4a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1A.5.5 0 0 1 1 8zm13 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1A.5.5 0 0 1 14 8zM8 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 8 1zm0 13a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 8 14z"/></svg>;
}

export function TopBar() {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 30_000,
    retry: false,
  });

  const status: HealthStatus = health?.status ?? 'error';
  const mode = document.documentElement.dataset.mode ?? 'dark';

  const statusLabel = status === 'ok' ? 'Online' : status === 'degraded' ? 'Degraded' : 'Offline';

  return (
    <header className={styles.bar}>
      <span className={styles.logo}>Tutor</span>
      <span className={styles.breadcrumb}>calculus · derivatives</span>

      <div className={styles.status}>
        <span className={styles.dot} data-status={status} />
        <span>{statusLabel}</span>
      </div>

      <button className={styles.modeToggle} onClick={toggleMode} title="Toggle dark/light">
        <ModeIcon mode={mode} />
      </button>
    </header>
  );
}
