import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import styles from './TopicList.module.css';

export function TopicList() {
  const [filter, setFilter] = useState('');
  const { data: topics, isLoading } = useQuery({ queryKey: ['topics'], queryFn: api.listTopics });

  const filtered = (topics ?? []).filter(t =>
    !filter || t.title.toLowerCase().includes(filter.toLowerCase()) || t.slug.includes(filter.toLowerCase())
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Topics</h1>
        <input
          className={styles.search}
          placeholder="Filter…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {isLoading && <p className={styles.empty}>Loading…</p>}

      {!isLoading && filtered.length === 0 && (
        <p className={styles.empty}>{filter ? 'No matches.' : 'No topics yet.'}</p>
      )}

      <div className={styles.list}>
        {filtered.map(t => (
          <Link key={t.slug} to={`/topics/${t.slug}`} className={styles.row}>
            <div className={styles.rowMain}>
              <div className={styles.title}>{t.title}</div>
            </div>
            {t.due_count > 0 && (
              <span className={styles.badge}>{t.due_count} due</span>
            )}
            {t.approved_questions > 0 && (
              <span className={styles.qCount}>{t.approved_questions}q</span>
            )}
            <span className={styles.arrow}>›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
