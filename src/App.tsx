import { useState, useEffect, useLayoutEffect } from 'react';
import LoginPage from '@/pages/LoginPage';
import QueuePage from '@/pages/QueuePage';
import ThemePage from '@/pages/ThemePage';
import { type UserState, type ThemeName, type PracticeState } from '@/types';
import { saveSession, loadSession, clearSession } from '@/lib/session';

type Page = 'login' | 'queue' | 'themes';

const savedUser = loadSession();

export default function App() {
  const [page, setPage] = useState<Page>(savedUser !== null ? 'queue' : 'login');
  const [user, setUser] = useState<UserState | null>(savedUser);
  const [theme, setTheme] = useState<ThemeName>('forest');
  const [practice, setPractice] = useState<PracticeState | null>(null);
  const [practiceFetchAttempt, setPracticeFetchAttempt] = useState(0);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function handleEnter(u: UserState, p: PracticeState) {
    setUser(u);
    setPractice(p);
    setPage('queue');
    saveSession(u);
    localStorage.setItem('pbq_practice_code', p.code);
  }

  function handleLogout() {
    setUser(null);
    setPractice(null);
    setPage('login');
    clearSession();
    localStorage.removeItem('pbq_practice_code');
  }

  // Restore practice from localStorage on refresh
  useEffect(() => {
    if (user === null || practice !== null) {
      return;
    }
    const code = localStorage.getItem('pbq_practice_code');
    if (!code) {
      handleLogout();
      return;
    }
    let cancelled = false;
    fetch(`/api/practice/${code}`)
      .then((r) => {
        // only a confirmed 404 means this session is actually stale
        if (r.status === 404) {
          if (!cancelled) handleLogout();
          return null;
        }
        if (!r.ok) throw new Error('practice fetch failed');
        return r.json();
      })
      .then((data) => {
        if (data !== null && !cancelled) setPractice(data);
      })
      .catch(() => {
        // network hiccup or server not up yet, keep the session and retry shortly
        if (!cancelled) setTimeout(() => setPracticeFetchAttempt((n) => n + 1), 2000);
      });
    return () => {
      cancelled = true;
    };
  }, [user, practice, practiceFetchAttempt]);

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
    if (practice === null) return <div className="p-6">Loading…</div>;
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