import { useState, type FormEvent } from 'react';
import { type SkillLevel, SKILL_LABELS, type UserState } from '../types';

type AuthMode = 'login' | 'join' | 'create';

interface LoginPageProps {
  onEnter: (user: UserState) => void;
}

// bg-white only lives in INACTIVE so it can't override the active color
const SKILL_ACTIVE: Record<SkillLevel, string> = {
  1: 'bg-blue-500 text-white border-blue-500',
  2: 'bg-amber-500 text-white border-amber-500',
  3: 'bg-red-500 text-white border-red-500',
};

const SKILL_INACTIVE: Record<SkillLevel, string> = {
  1: 'bg-white text-blue-600 border-gray-200 hover:bg-blue-50',
  2: 'bg-white text-amber-600 border-gray-200 hover:bg-amber-50',
  3: 'bg-white text-red-600 border-gray-200 hover:bg-red-50',
};

function SkillSelector({
  value,
  onChange,
}: {
  value: SkillLevel;
  onChange: (v: SkillLevel) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-th-heading">Skill Level</label>
      <div className="grid grid-cols-3 gap-2">
        {([1, 2, 3] as SkillLevel[]).map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={`py-3 rounded-xl font-bold transition-all border-2 ${
              value === level ? SKILL_ACTIVE[level] : SKILL_INACTIVE[level]
            }`}
          >
            <div className="text-sm font-bold">{SKILL_LABELS[level]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage({ onEnter }: LoginPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(2);
  const [numCourts, setNumCourts] = useState(4);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!username.trim()) return;

    const user: UserState = {
      id: Math.random().toString(36).slice(2),
      username: username.trim(),
      password,
      skillLevel: mode === 'login' ? 2 : skillLevel,
      isAdmin: mode === 'create',
      sessionCode:
        mode === 'create'
          ? Math.random().toString(36).slice(2, 8).toUpperCase()
          : sessionCode.toUpperCase() || 'DEMO01',
      numCourts: mode === 'create' ? numCourts : undefined,
    };

    onEnter(user);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--th-login-gradient)' }}
    >
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm mb-5 shadow-xl overflow-hidden">
            <img
              src="/pickleball-bat-and-ball-free-vector.jpg"
              alt="Pickleball"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow">
            Pickleball Queue
          </h1>
          <p className="mt-2 text-lg font-medium" style={{ color: 'var(--th-login-sub)' }}>
            WPI Club Pickleball
          </p>
        </div>

        {/* Card */}
        <div className="bg-th-card rounded-3xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-th">
            {(['login', 'join', 'create'] as AuthMode[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMode(tab)}
                className={`flex-1 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition-all border-b-2 ${
                  mode === tab ? 'tab-th-active' : 'border-transparent text-th-muted hover:text-th-heading'
                }`}
              >
                {tab === 'login' ? 'Sign In' : tab === 'join' ? 'Join Session' : 'Create Session'}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-th-heading">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your name"
                required
                className="input-th w-full px-4 py-3 rounded-xl border-2 transition-colors"
              />
            </div>

            {/* Password */}
            {(mode === 'login' || mode === 'create' || mode === 'join') && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-th-heading">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="input-th w-full px-4 py-3 rounded-xl border-2 transition-colors"
                />
              </div>
            )}

            {/* Skill Level */}
            {(mode === 'join' || mode === 'create') && (
              <SkillSelector value={skillLevel} onChange={setSkillLevel} />
            )}

            {/* Session Code */}
            {mode === 'join' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-th-heading">Session Code</label>
                <input
                  type="text"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  required
                  className="input-th w-full px-4 py-3 rounded-xl border-2 transition-colors uppercase tracking-[0.3em] font-mono text-center text-xl"
                />
              </div>
            )}

            {/* Number of Courts */}
            {mode === 'create' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-th-heading">
                  Number of Courts
                </label>
                <div className="flex gap-2">
                  {[2, 3, 4, 6, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNumCourts(n)}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                        numCourts === n
                          ? 'bg-th-primary border-transparent'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="bg-th-primary w-full py-3.5 rounded-xl text-base font-bold shadow-lg transition-colors"
            >
              {mode === 'login' && 'Sign In →'}
              {mode === 'join' && 'Join Session →'}
              {mode === 'create' && 'Create Session →'}
            </button>

            <p className="text-center text-xs text-th-muted">
              {mode === 'login' && 'Sign in with your existing credentials.'}
              {mode === 'join' && 'Get the 6-character session code from your admin.'}
              {mode === 'create' && "As admin, you'll control courts and advance the queue."}
            </p>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--th-login-sub)' }}>
          Session data is cleared at the end of each practice
        </p>
      </div>
    </div>
  );
}
