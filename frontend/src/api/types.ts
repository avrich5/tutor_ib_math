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

export interface TodayQueueResponse {
  due_count: number;
  topics: Array<{ topic_slug: string; due: number }>;
}
