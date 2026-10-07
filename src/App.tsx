import { useState, useLayoutEffect } from 'react';
import LoginPage from '@/pages/LoginPage';
import QueuePage from '@/pages/QueuePage';
import ThemePage from '@/pages/ThemePage';
import { type UserState, type ThemeName } from '@/types';
import { saveSession, loadSession, clearSession } from '@/lib/session';

type Page = 'login' | 'queue' | 'themes';

const savedUser = loadSession();

export default function App() {
  const [page, setPage] = useState<Page>(savedUser !== null ? 'queue' : 'login');
  const [user, setUser] = useState<UserState | null>(savedUser);
  const [theme, setTheme] = useState<ThemeName>('forest');

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function handleEnter(u: UserState) {
    setUser(u);
    setPage('queue');
    saveSession(u);
  }

  function handleLogout() {
    setUser(null);
    setPage('login');
    clearSession();
  }

  if (page === 'themes') {
    return (
      <ThemePage
        current={theme}
        onSelect={(t) => { setTheme(t); setPage('queue'); }}
        onBack={() => setPage('queue')}
      />
    );
  }

  if (page === 'queue' && user !== null) {
    return (
      <QueuePage
        user={user}
        onLogout={handleLogout}
        onOpenThemes={() => setPage('themes')}
      />
    );
  }

  return <LoginPage onEnter={handleEnter} />;
}
