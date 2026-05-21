import { type ReactNode } from 'react';
import styles from './Card.module.css';

interface Props {
  variant?: 'default' | 'elevated' | 'paper';
  className?: string;
  children: ReactNode;
}

export function Card({ variant = 'default', className = '', children }: Props) {
  const cls = [
    styles.card,
    variant === 'elevated' ? styles.elevated : '',
    variant === 'paper' ? styles.paper : '',
    className,
  ].filter(Boolean).join(' ');

  return <div className={cls}>{children}</div>;
}
