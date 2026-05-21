import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { MathText } from '../components/ui/Math';

export function ConceptDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: concept, isLoading, error } = useQuery({
    queryKey: ['concept', id],
    queryFn: () => api.getConcept(id!),
    enabled: !!id,
  });

  const wrap: React.CSSProperties = { maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 24 };
  const linkStyle: React.CSSProperties = { fontSize: 'var(--fs-small)', color: 'var(--ink-faint)', textDecoration: 'none' };
  const sectionHead: React.CSSProperties = {
    fontSize: 'var(--fs-small)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 500,
    color: 'var(--ink-faint)',
    marginBottom: 8,
  };
  const prose: React.CSSProperties = { fontFamily: 'var(--font-prose)', fontSize: 16, lineHeight: 1.7 };

  if (isLoading) return <p style={{ color: 'var(--ink-muted)' }}>Loading…</p>;

  if (error || !concept) {
    return (
      <div style={wrap}>
        <Link to="/topics" style={linkStyle}>← All topics</Link>
        <div style={{ color: 'var(--ink-muted)' }}>
          Concept not found.{' '}
          <span style={{ color: 'var(--ink-faint)', fontSize: 'var(--fs-small)' }}>
            Concepts will appear here once content is added to this topic.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <Link to={`/topics/${concept.topic_slug}`} style={linkStyle}>
        ← {concept.topic_slug}
      </Link>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-h1)', fontWeight: 600 }}>
        {concept.title}
      </h1>

      <div>
        <div style={sectionHead}>Summary</div>
        <div style={prose}><MathText text={concept.summary_md} /></div>
      </div>

      {concept.proof_md && (
        <div>
          <div style={sectionHead}>Proof</div>
          <div style={prose}><MathText text={concept.proof_md} /></div>
        </div>
      )}

      {concept.examples_md && (
        <div>
          <div style={sectionHead}>Examples</div>
          <div style={prose}><MathText text={concept.examples_md} /></div>
        </div>
      )}
    </div>
  );
}
