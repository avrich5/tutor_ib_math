import { useState } from 'react';
import { MathText } from '../ui/Math';
import styles from './OrderedSteps.module.css';

interface Step {
  step_id: string;
  label_md: string;
}

interface Props {
  steps: Step[];
  onChange: (orderedIds: string[]) => void;
  disabled?: boolean;
}

export function OrderedSteps({ steps, onChange, disabled }: Props) {
  const [ordered, setOrdered] = useState<Step[]>(steps);
  const [dragging, setDragging] = useState<number | null>(null);

  function handleDragStart(idx: number) {
    setDragging(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragging === null || dragging === idx) return;
    const next = [...ordered];
    const [item] = next.splice(dragging, 1);
    next.splice(idx, 0, item);
    setDragging(idx);
    setOrdered(next);
    onChange(next.map(s => s.step_id));
  }

  function handleDrop() {
    setDragging(null);
  }

  return (
    <div className={styles.list}>
      {ordered.map((step, idx) => (
        <div
          key={step.step_id}
          className={styles.item}
          draggable={!disabled}
          onDragStart={() => handleDragStart(idx)}
          onDragOver={e => handleDragOver(e, idx)}
          onDrop={handleDrop}
        >
          <span className={styles.handle}>⠿</span>
          <span className={styles.num}>{idx + 1}</span>
          <MathText text={step.label_md} />
        </div>
      ))}
    </div>
  );
}
