import { type ReactNode } from 'react';
import { TopBar } from './TopBar';
import { ChatPanel } from './ChatPanel';
import styles from './AppLayout.module.css';

interface Props {
  children: ReactNode;
}

export function AppLayout({ children }: Props) {
  return (
    <div className={styles.root}>
      <TopBar />
      <div className={styles.body}>
        <main className={styles.main}>{children}</main>
        <aside className={styles.chat}>
          <ChatPanel />
        </aside>
      </div>
    </div>
  );
}
