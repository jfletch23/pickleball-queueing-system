import { useState, useLayoutEffect } from 'react';
import LoginPage from '@/pages/LoginPage';
import QueuePage from '@/pages/QueuePage';
import ThemePage from '@/pages/ThemePage';
import { type UserState, type ThemeName, type PracticeState } from '@/types';

type Page = 'login' | 'queue' | 'themes';

export default function App() {
  const [page, setPage] = useState<Page>('login');
  const [user, setUser] = useState<UserState | null>(null);
  const [practice, setPractice] = useState<PracticeState | null>(null);
  const [theme, setTheme] = useState<ThemeName>('forest');

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function handleEnter(u: UserState, p: PracticeState) {
    setUser(u);
    setPractice(p)
    console.log("Practice is ", p)
    setPage('queue');
  }

  function handleLogout() {
    setUser(null);
    setPage('login');
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
        practice={practice}
        onLogout={handleLogout}
        onOpenThemes={() => setPage('themes')}
      />
    );
  }

  return <LoginPage onEnter={handleEnter} />;
}
