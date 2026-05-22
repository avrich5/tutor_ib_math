import { useState, useCallback } from 'react';
import type { Question, AttemptResponse } from '../../api/types';
import { MathText } from '../ui/Math';
import { Button } from '../ui/Button';
import { FreeExpression } from './FreeExpression';
import { MultipleChoice } from './MultipleChoice';
import { FreeNumeric } from './FreeNumeric';
import { Flashcard } from './Flashcard';
import { OrderedSteps } from './OrderedSteps';
import { HintsPanel } from './HintsPanel';
import { Feedback } from './Feedback';
import styles from './QuestionView.module.css';

interface Props {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  lastAttempt: AttemptResponse | null;
  phase: 'question' | 'submitting' | 'feedback';
  onSubmit: (answer: string) => void;
  onNext: () => void;
  onEnd: () => void;
  onHintUsed: () => void;
}

export function QuestionView({
  question, questionNumber, totalQuestions,
  lastAttempt, phase,
  onSubmit, onNext, onEnd, onHintUsed,
}: Props) {
  const [answer, setAnswer] = useState('');
  const [stepsOrder, setStepsOrder] = useState<string[]>(
    question.steps?.map(s => s.step_id) ?? []
  );
  const [flashcardAnswer, setFlashcardAnswer] = useState<'got_it' | 'missed_it' | ''>('');

  const disabled = phase !== 'question';
  const isLast = questionNumber >= totalQuestions;

  const handleSubmit = useCallback(() => {
    if (phase !== 'question') return;
    let value = answer;
    if (question.kind === 'ordered_steps') value = JSON.stringify(stepsOrder);
    if (question.kind === 'flashcard') value = flashcardAnswer;
    if (!value && question.kind !== 'flashcard') return;
    onSubmit(value);
  }, [phase, answer, stepsOrder, flashcardAnswer, question.kind, onSubmit]);

  return (
    <div className={styles.card}>
      <div className={styles.meta}>
        Question {questionNumber} / {totalQuestions} · {question.kind.replace('_', ' ')}
      </div>

      <div className={styles.stem}>
        <MathText text={question.stem_md} />
      </div>

      {question.kind === 'free_expression' && (
        <FreeExpression
          value={answer}
          onChange={setAnswer}
          onSubmit={handleSubmit}
          disabled={disabled}
        />
      )}

      {question.kind === 'multiple_choice' && question.choices && (
        <MultipleChoice
          choices={question.choices}
          selected={answer}
          onChange={setAnswer}
          disabled={disabled}
        />
      )}

      {question.kind === 'free_numeric' && (
        <FreeNumeric
          value={answer}
          onChange={setAnswer}
          onSubmit={handleSubmit}
          disabled={disabled}
        />
      )}

      {question.kind === 'flashcard' && (
        <Flashcard
          referenceAnswer={question.reference_answer}
          onChange={v => setFlashcardAnswer(v)}
          onSubmit={() => {
            if (flashcardAnswer) onSubmit(flashcardAnswer);
          }}
          disabled={disabled}
        />
      )}

      {question.kind === 'ordered_steps' && question.steps && (
        <OrderedSteps
          steps={question.steps}
          onChange={setStepsOrder}
          disabled={disabled}
        />
      )}

      {/* Submit / Next row */}
      {question.kind !== 'flashcard' && (
        <div className={styles.actions}>
          {phase === 'question' && (
            <Button onClick={handleSubmit} disabled={!answer && question.kind !== 'ordered_steps'}>
              Submit
            </Button>
          )}
          {phase === 'submitting' && (
            <Button disabled>Checking…</Button>
          )}
          {phase === 'feedback' && (
            <>
              <Button onClick={isLast ? onEnd : onNext}>
                {isLast ? 'Finish session' : 'Next question'}
              </Button>
              <Button variant="secondary" onClick={onEnd}>End session</Button>
            </>
          )}
        </div>
      )}

      {/* Hints */}
      {phase === 'question' && (
        <HintsPanel
          questionId={question.question_id}
          onHintUsed={onHintUsed}
          disabled={disabled}
        />
      )}

      {/* Feedback */}
      {phase === 'feedback' && lastAttempt && (
        <Feedback attempt={lastAttempt} />
      )}
    </div>
  );
}
