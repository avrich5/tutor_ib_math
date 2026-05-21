import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Session } from './pages/Session';
import { SessionNew } from './pages/SessionNew';
import { TopicList } from './pages/TopicList';
import { TopicDetail } from './pages/TopicDetail';
import { ConceptDetail } from './pages/ConceptDetail';
import { ProgressView } from './pages/ProgressView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000 },
  },
});

export function App() {
  useEffect(() => {
    const saved = localStorage.getItem('tutor-mode') ?? 'dark';
    document.documentElement.dataset.mode = saved;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/"                  element={<Dashboard />} />
            <Route path="/topics"            element={<TopicList />} />
            <Route path="/topics/:slug/*"    element={<TopicDetail />} />
            <Route path="/concepts/:id"      element={<ConceptDetail />} />
            <Route path="/session/new"       element={<SessionNew />} />
            <Route path="/session/:sessionId" element={<Session />} />
            <Route path="/session"           element={<Session />} />
            <Route path="/progress"          element={<ProgressView />} />
            <Route path="*"                  element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
