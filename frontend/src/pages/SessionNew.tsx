import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

export function SessionNew() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const topicSlug = params.get('topic') ?? 'calculus.derivatives';

  useEffect(() => {
    api.createSession(topicSlug)
      .then(session => navigate(`/session/${session.session_id}`, { replace: true }))
      .catch(e => setError(String(e)));
  }, [topicSlug, navigate]);

  if (error) {
    return (
      <div style={{ padding: 'var(--pad-screen)', color: 'var(--negative)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-small)' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--pad-screen)', color: 'var(--ink-muted)' }}>
      Starting session…
    </div>
  );
}
