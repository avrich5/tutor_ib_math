import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { TopBar } from './TopBar';
import { ChatPanel } from './ChatPanel';
import styles from './AppLayout.module.css';

const NAV = [
  { to: '/',         icon: '⌂', label: 'Home'     },
  { to: '/topics',   icon: '◈', label: 'Topics'   },
  { to: '/progress', icon: '◎', label: 'Progress' },
];

interface Props {
  children: ReactNode;
}

export function AppLayout({ children }: Props) {
  return (
    <div className={styles.root}>
      <TopBar />
      <div className={styles.body}>
        <nav className={styles.nav}>
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `${styles.navLink}${isActive ? ' ' + styles.active : ''}`
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <main className={styles.main}>{children}</main>
        <aside className={styles.chat}>
          <ChatPanel />
        </aside>
      </div>
    </div>
  );
}
