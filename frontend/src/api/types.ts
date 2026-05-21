// ─── Core domain types ───────────────────────────────────────────────────────

export type QuestionKind =
  | 'free_expression'
  | 'multiple_choice'
  | 'free_numeric'
  | 'flashcard'
  | 'ordered_steps';

export interface Question {
  question_id: string;
  kind: QuestionKind;
  stem_md: string;               // markdown + inline $...$ KaTeX
  choices?: Record<string, string>; // multiple_choice: {A: "...", B: "...", ...}
  steps?: Array<{ step_id: string; label_md: string }>; // ordered_steps
  reference_answer?: string;     // LaTeX (not shown to student during quiz)
  topic_slug: string;
  concept_id: string;
}

export interface Session {
  session_id: string;
  topic_slug: string;
  created_at: string;
  total_questions: number;
  completed: number;
}

export interface NextQuestionResponse {
  question: Question | null;     // null = session finished
  session_id: string;
  question_number: number;
  total_questions: number;
}

export interface AttemptRequest {
  session_id: string;
  question_id: string;
  student_answer: string;        // LaTeX | option key | number string | step_id[] | "got_it"|"missed_it"
  time_seconds: number;
  hints_used: number;
}

export interface AttemptResponse {
  attempt_id: string;
  correct: boolean;
  feedback_md: string;
  show_solution_next: boolean;
  response_quality: number;      // 1–5
  srs_next_review_at: string;    // ISO datetime
}

export interface Hint {
  tier: number;
  hint_md: string;
}

export interface Solution {
  solution_md: string;
}

export interface SessionSummary {
  session_id: string;
  total_questions: number;
  correct: number;
  incorrect: number;
  duration_seconds: number;
  mastery_delta: number;
}

// ─── Health & user ────────────────────────────────────────────────────────────

export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface HealthResponse {
  status: HealthStatus;
  backend: HealthStatus;
  db: HealthStatus;
  orchestrator: HealthStatus;
}

export interface UserResponse {
  user_id: string;
  name: string;
  email?: string;
}

// ─── SRS queue (GET /sessions/today) ─────────────────────────────────────────

export interface TodayTopic {
  topic_slug: string;
  title: string;
  due_count: number;
  approved_questions: number;
}

export interface TodayQueueResponse {
  due_count: number;
  topics: TodayTopic[];
  suggested_topic_slug: string | null;
}

// ─── Topics ──────────────────────────────────────────────────────────────────

export type TopicKind = 'leaf' | 'category';

export interface TopicSummary {
  slug: string;
  title: string;
  kind: TopicKind;
  approved_questions: number;
  due_count: number;
}

export interface ConceptSummary {
  concept_id: string;
  title: string;
  summary_md: string;
}

export interface TopicDetail extends TopicSummary {
  description_md: string;
  concepts: ConceptSummary[];
  mastery: number | null;
}

// ─── Concepts ────────────────────────────────────────────────────────────────

export interface ConceptDetail {
  concept_id: string;
  title: string;
  summary_md: string;
  topic_slug: string;
  proof_md?: string;
  examples_md?: string;
}

// ─── Progress ────────────────────────────────────────────────────────────────

export interface ProgressSummary {
  total_attempts: number;
  total_correct: number;
  accuracy: number;
  streak_days: number;
  minutes_today: number;
  minutes_week: number;
  due_today: number;
  due_this_week: number;
}

export interface WeakTopic {
  topic_slug: string;
  title: string;
  accuracy: number;
  attempts: number;
}

export interface ActivityDay {
  date: string;
  attempts: number;
  correct: number;
  minutes: number;
}

export interface ActivityResponse {
  days: ActivityDay[];
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatSession {
  chat_session_id: string;
  started_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content_md: string;
  cited_sources: unknown[] | null;
  created_at: string;
}

export interface ChatSessionSummary {
  id: string;
  title: string | null;
  study_session_id: string | null;
  started_at: string;
  last_message_at: string;
  message_count: number;
}

export interface SendMessageResponse {
  user_message_id: string;
  assistant_message_id: string;
  content_md: string;
}

export interface StreamDoneInfo {
  message_id: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
}
