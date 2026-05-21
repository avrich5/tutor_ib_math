import styles from './FreeNumeric.module.css';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function FreeNumeric({ value, onChange, onSubmit, disabled }: Props) {
  return (
    <input
      className={styles.input}
      type="text"
      inputMode="decimal"
      placeholder="e.g. 3.14 or 22/7"
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
    />
  );
}
