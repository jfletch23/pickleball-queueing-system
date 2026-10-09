import type { UserState } from '@/types';

const COOKIE_NAME = 'pbq_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function saveSession(user: UserState) {
  const { password, ...safe } = user;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(safe))}; path=/; max-age=${COOKIE_MAX_AGE}`;
}

export function loadSession(): UserState | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (match === null) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    // guard against a stale/corrupted cookie shape from an older version of the app
    if (typeof parsed?.id !== 'string' || typeof parsed?.username !== 'string') return null;
    return parsed as UserState;
  } catch {
    return null;
  }
}

export function clearSession() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}
