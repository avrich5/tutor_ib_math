import type {
  ActivityResponse, AttemptRequest, AttemptResponse,
  ChatMessage, ChatSession, ChatSessionSummary,
  ConceptDetail, HealthResponse, Hint, NextQuestionResponse,
  ProgressSummary, Session, SessionSummary, Solution,
  TodayQueueResponse, TopicDetail, TopicSummary, UserResponse,
  WeakTopic,
} from './types';

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4800';
const API_USER = import.meta.env.VITE_API_USER ?? '';
const API_PASS = import.meta.env.VITE_API_PASS ?? '';

export function authHeader(): string {
  return 'Basic ' + btoa(`${API_USER}:${API_PASS}`);
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
      ...init?.headers,
    },
  });

  if (res.status === 401) throw new Error('Unauthorized — check VITE_API_USER / VITE_API_PASS');
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ─── Exported API calls ───────────────────────────────────────────────────────

export const api = {
  health: () =>
    apiFetch<HealthResponse>('/health'),

  me: () =>
    apiFetch<UserResponse>('/me'),

  todayQueue: () =>
    apiFetch<TodayQueueResponse>('/sessions/today'),

  createSession: (topic_slug: string) =>
    apiFetch<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ topic_slug }),
    }),

  nextQuestion: (sessionId: string) =>
    apiFetch<NextQuestionResponse>(`/sessions/${sessionId}/next`, { method: 'POST' }),

  submitAttempt: (req: AttemptRequest) =>
    apiFetch<AttemptResponse>('/attempts', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  getHint: (questionId: string, tier: number) =>
    apiFetch<Hint>(`/questions/${questionId}/hint?tier=${tier}`),

  getSolution: (questionId: string) =>
    apiFetch<Solution>(`/questions/${questionId}/solution`),

  endSession: (sessionId: string) =>
    apiFetch<SessionSummary>(`/sessions/${sessionId}/end`, { method: 'POST' }),

  // Topics
  listTopics: () =>
    apiFetch<TopicSummary[]>('/topics'),

  getTopic: (slug: string) =>
    apiFetch<TopicDetail>(`/topics/${slug}`),

  // Concepts
  getConcept: (id: string) =>
    apiFetch<ConceptDetail>(`/concepts/${id}`),

  // Progress
  progressSummary: () =>
    apiFetch<ProgressSummary>('/progress/summary'),

  weakTopics: (limit = 5) =>
    apiFetch<WeakTopic[]>(`/progress/weak-topics?limit=${limit}`),

  activity: (days = 30) =>
    apiFetch<ActivityResponse>(`/progress/activity?days=${days}`),

  // Chat
  createChatSession: (studySessionId?: string | null, title?: string) =>
    apiFetch<ChatSession>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ study_session_id: studySessionId ?? null, title: title ?? null }),
    }),

  listChatSessions: () =>
    apiFetch<ChatSessionSummary[]>('/chat/sessions'),

  getChatMessages: (chatSessionId: string) =>
    apiFetch<ChatMessage[]>(`/chat/sessions/${chatSessionId}/messages`),
};
