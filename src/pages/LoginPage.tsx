import { useState, type FormEvent } from 'react';
import { type PracticeState, type UserState } from '../types';

type AuthMode = 'join' | 'create';

interface LoginPageProps {
  onEnter: (user: UserState, practice: PracticeState) => void;
}

export default function LoginPage({ onEnter }: LoginPageProps) {
  const [mode, setMode] = useState<AuthMode>('join');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [practiceCode, setPracticeCode] = useState('');
  const [numCourts, setNumCourts] = useState(4);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let user : UserState
    let practice : PracticeState
    //TODO: make this work
    user = {
      id: "fakeid",
      username: "fakeusername",
      password: "fakepassword"
    }
    practice = {
      code: "ABC123",
      players: [user],
      admins: [user.id],
      numCourts: 4
    }
    console.log(user)
    console.log(practice)
    onEnter(user, practice);
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
            {(['join', 'create'] as AuthMode[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMode(tab)}
                className={`flex-1 py-3 sm:py-4 text-xs sm:text-sm font-semibold transition-all border-b-2 ${
                  mode === tab ? 'tab-th-active' : 'border-transparent text-th-muted hover:text-th-heading'
                }`}
              >
                {tab === 'join' ? 'Join Session' : 'Create Session'}
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
            {(mode === 'join' || mode === 'create') && (
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

            {(mode === 'join') && (
              <p className="text-center text-xs text-th-muted">
                First time playing today? Enter a new username and password and an account will be automatically created for you. 
              </p>
            )}

            {/* Session Code */}
            {mode === 'join' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-th-heading">Session Code</label>
                <input
                  type="text"
                  value={practiceCode}
                  onChange={(e) => setPracticeCode(e.target.value.toUpperCase())}
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
              {mode === 'join' && 'Join Session →'}
              {mode === 'create' && 'Create Session →'}
            </button>

            <p className="text-center text-xs text-th-muted">
              {mode === 'join' && 'Get the 6-character session code from your admin.'}
              {mode === 'create' && "You'll be admin, you can manage courts and advance the queue."}
            </p>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--th-login-sub)' }}>
          Data resets after each practice
        </p>
      </div>
    </div>
  );
}
