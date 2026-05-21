import { useState, useCallback, useRef } from 'react';
import { api } from '../api/client';
import type { Question, AttemptResponse, SessionSummary } from '../api/types';

type SessionPhase =
  | 'idle'
  | 'starting'
  | 'question'
  | 'submitting'
  | 'feedback'
  | 'finished'
  | 'error';

interface SessionState {
  phase: SessionPhase;
  sessionId: string | null;
  question: Question | null;
  questionNumber: number;
  totalQuestions: number;
  lastAttempt: AttemptResponse | null;
  summary: SessionSummary | null;
  error: string | null;
  hintsUsed: number;
  startTime: number | null;
}

const INITIAL: SessionState = {
  phase: 'idle',
  sessionId: null,
  question: null,
  questionNumber: 0,
  totalQuestions: 0,
  lastAttempt: null,
  summary: null,
  error: null,
  hintsUsed: 0,
  startTime: null,
};

export function useSession(topicSlug = 'calculus.derivatives') {
  const [state, setState] = useState<SessionState>(INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;

  const startSession = useCallback(async () => {
    setState(s => ({ ...s, phase: 'starting', error: null }));
    try {
      const session = await api.createSession(topicSlug);
      const next = await api.nextQuestion(session.session_id);
      if (!next.question) {
        const summary = await api.endSession(session.session_id);
        setState(s => ({ ...s, phase: 'finished', summary }));
        return;
      }
      setState(s => ({
        ...s,
        phase: 'question',
        sessionId: session.session_id,
        question: next.question,
        questionNumber: next.question_number,
        totalQuestions: next.total_questions,
        hintsUsed: 0,
        startTime: Date.now(),
      }));
    } catch (e) {
      setState(s => ({ ...s, phase: 'error', error: String(e) }));
    }
  }, [topicSlug]);

  const submitAnswer = useCallback(async (studentAnswer: string) => {
    const { sessionId, question, hintsUsed, startTime } = stateRef.current;
    if (!sessionId || !question) return;

    setState(s => ({ ...s, phase: 'submitting' }));
    try {
      const attempt = await api.submitAttempt({
        session_id: sessionId,
        question_id: question.question_id,
        student_answer: studentAnswer,
        time_seconds: startTime ? Math.round((Date.now() - startTime) / 1000) : 0,
        hints_used: hintsUsed,
      });
      setState(s => ({ ...s, phase: 'feedback', lastAttempt: attempt }));
    } catch (e) {
      setState(s => ({ ...s, phase: 'error', error: String(e) }));
    }
  }, []);

  const nextQuestion = useCallback(async () => {
    const { sessionId } = stateRef.current;
    if (!sessionId) return;

    setState(s => ({ ...s, phase: 'starting', error: null }));
    try {
      const next = await api.nextQuestion(sessionId);
      if (!next.question) {
        const summary = await api.endSession(sessionId);
        setState(s => ({ ...s, phase: 'finished', summary }));
        return;
      }
      setState(s => ({
        ...s,
        phase: 'question',
        question: next.question,
        questionNumber: next.question_number,
        totalQuestions: next.total_questions,
        hintsUsed: 0,
        lastAttempt: null,
        startTime: Date.now(),
      }));
    } catch (e) {
      setState(s => ({ ...s, phase: 'error', error: String(e) }));
    }
  }, []);

  const endSession = useCallback(async () => {
    const { sessionId } = stateRef.current;
    if (!sessionId) return;
    try {
      const summary = await api.endSession(sessionId);
      setState(s => ({ ...s, phase: 'finished', summary }));
    } catch (e) {
      setState(s => ({ ...s, phase: 'error', error: String(e) }));
    }
  }, []);

  const incrementHints = useCallback(() => {
    setState(s => ({ ...s, hintsUsed: s.hintsUsed + 1 }));
  }, []);

  return { ...state, startSession, submitAnswer, nextQuestion, endSession, incrementHints };
}
