import {type Court} from "../types.ts"

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Court card, display only (admin End button still works)

export function CourtCard({
  court,
  now,
  isAdmin,
  onEndGame,
  onClick,
}: {
  court: Court;
  now: number;
  isAdmin: boolean;
  onEndGame: () => void;
  onClick?: () => void;
}) {
  const isActive = court.players.length > 0;
  const elapsed =
    isActive && court.playingStartTime !== null
      ? Math.floor((now - court.playingStartTime) / 1000)
      : 0;

  return (
    <div
      className={`rounded-2xl overflow-hidden shadow-md border border-th flex flex-col ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      onClick={onClick}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 flex items-center justify-between gap-2 ${
          isActive ? 'bg-th-court' : 'bg-gray-100'
        }`}
      >
        <span className={`font-bold text-sm shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`}>
          Court {court.courtNumber}
        </span>
        {isActive ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-th-timer text-xs font-mono font-bold shrink-0">
              ⏱ {formatTime(elapsed)}
            </span>
            {isAdmin && (
              <button
                onClick={(e) => { e.stopPropagation(); onEndGame(); }}
                className="text-[10px] font-bold text-white/80 hover:text-white bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded-full transition-colors shrink-0"
              >
                End ▶
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs font-semibold text-th-primary bg-th-primary-light px-2 py-0.5 rounded-full">
            Open
          </span>
        )}
      </div>

      {/* Body */}
      {isActive ? (
        <div className="bg-th-card p-3 space-y-2 flex-1">
          {court.players.map((player) => (
            <div key={player.id} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
                {player.username.charAt(0)}
              </div>
              <span className="text-sm font-medium text-th-body flex-1 truncate">
                {player.username}
              </span>
            </div>
          ))}
          {Array.from({ length: 4 - court.players.length }).map((_, i) => (
            <div key={`empty-${i}`} className="flex items-center gap-2 opacity-30">
              <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0">
                <span className="text-gray-400 text-xs">+</span>
              </div>
              <span className="text-xs text-th-muted">Open slot</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-th-card p-8 text-center flex-1 flex flex-col items-center justify-center">
          <img
            src="/pickleball-bat-and-ball-free-vector.jpg"
            alt="Pickleball"
            className="w-12 h-12 object-cover rounded-full opacity-40 mb-2"
          />
          <div className="font-semibold text-th-primary">Available</div>
          <div className="text-xs text-th-muted mt-0.5">Waiting for a full group</div>
        </div>
      )}
    </div>
  );
}

// Court admin view, tap a court to manage its players

export function CourtAdminView({
  court,
  now,
  promotedAdminIds,
  onBack,
  onEndGame,
  onMakeAdmin,
}: {
  court: Court;
  now: number;
  promotedAdminIds: Set<string>;
  onBack: () => void;
  onEndGame: () => void;
  onMakeAdmin: (playerId: string) => void;
}) {
  const elapsed =
    court.playingStartTime !== null ? Math.floor((now - court.playingStartTime) / 1000) : 0;

  return (
    <div className="min-h-screen bg-th-page">
      <header className="bg-th-header shadow-sm sticky top-0 z-10 border-b border-th">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-sm font-semibold text-th-muted hover:text-th-heading transition-colors px-2 py-1 rounded-lg"
          >
            ← Courts
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-th-heading text-lg">Court {court.courtNumber}</h1>
            <p className="text-xs text-th-muted">⏱ {formatTime(elapsed)} · {court.players.length}/4 players</p>
          </div>
          <button
            onClick={onEndGame}
            className="bg-red-500 hover:bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
          >
            End Game
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h2 className="text-base font-bold text-th-heading">Players</h2>
        <div className="grid grid-cols-2 gap-3">
          {court.players.length > 0 && court.players.map((player) => {
            const isPromoted = promotedAdminIds.has(player.id);
            return (
              <div
                key={player.id}
                className="bg-th-card rounded-2xl p-4 flex flex-col items-center text-center border border-th"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black text-white mb-2`}
                >
                  {player.username.charAt(0)}
                </div>
                <div className="font-bold text-th-heading text-sm">{player.username}</div>
                {isPromoted ? (
                  <span className="mt-1 text-[10px] font-black text-orange-800 bg-orange-100 px-2 py-0.5 rounded-full">
                    Admin
                  </span>
                ) : (
                  <button
                    onClick={() => onMakeAdmin(player.id)}
                    className="mt-1.5 text-[10px] font-semibold text-th-muted hover:text-orange-600 border border-dashed border-th hover:border-orange-400 px-2 py-0.5 rounded-full transition-colors"
                  >
                    Make Admin
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}