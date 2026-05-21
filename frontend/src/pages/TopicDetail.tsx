import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Button } from '../components/ui/Button';
import styles from './TopicDetail.module.css';

export function TopicDetail() {
  const { slug } = useParams<{ slug: string }>();
  // React Router captures slug/* so we need to reassemble for nested slugs like calculus.derivatives.chain_rule
  const { '*': rest } = useParams<{ '*': string }>();
  const fullSlug = rest ? `${slug}/${rest}`.replace(/\//g, '.') : (slug ?? '');

  const navigate = useNavigate();

  const { data: topic, isLoading, error } = useQuery({
    queryKey: ['topic', fullSlug],
    queryFn: () => api.getTopic(fullSlug),
    enabled: !!fullSlug,
  });

  function startSession() {
    navigate(`/session/new?topic=${encodeURIComponent(fullSlug)}`);
  }

  if (isLoading) return <p style={{ color: 'var(--ink-muted)' }}>Loading…</p>;
  if (error || !topic) return (
    <div className={styles.notFound}>
      Topic not found. <Link to="/topics" className={styles.breadcrumb}>← All topics</Link>
    </div>
  );

  const masteryPct = topic.mastery !== null && topic.mastery !== undefined
    ? Math.round(topic.mastery * 100)
    : null;

  return (
    <div className={styles.page}>
      <Link to="/topics" className={styles.breadcrumb}>← All topics</Link>

      <div className={styles.hero}>
        <div>
          <h1>{topic.title}</h1>
          {topic.description_md && <p className={styles.desc}>{topic.description_md}</p>}
        </div>
        {topic.approved_questions > 0 && (
          <Button size="lg" onClick={startSession}>Start session</Button>
        )}
      </div>

      <div className={styles.metaRow}>
        <span>{topic.approved_questions} question{topic.approved_questions !== 1 ? 's' : ''}</span>
        {topic.due_count > 0 && <span style={{ color: 'var(--accent)' }}>{topic.due_count} due</span>}
        {masteryPct !== null && (
          <div className={styles.masteryWrap}>
            <div className={styles.masteryBar}>
              <div className={styles.masteryFill} style={{ width: `${masteryPct}%` }} />
            </div>
            <span className={styles.masteryLabel}>Mastery {masteryPct}%</span>
          </div>
        )}
      </div>

      {topic.concepts.length > 0 && (
        <div className={styles.section}>
          <h2>Concepts</h2>
          <div className={styles.conceptList}>
            {topic.concepts.map(c => (
              <Link key={c.concept_id} to={`/concepts/${c.concept_id}`} className={styles.conceptRow}>
                <span>{c.title}</span>
                <span style={{ color: 'var(--ink-faint)', fontSize: 'var(--fs-small)' }}>›</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
