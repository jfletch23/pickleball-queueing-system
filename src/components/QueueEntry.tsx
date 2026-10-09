import { type QueueChip, type UserState, type Court } from "@/types";


// Queue entry detail page
export function QueueEntryDetailView({
  entry,
  position,
  user,
  userOnCourt,
  promotedAdminIds,
  onBack,
  onJoin,
  onLeave,
  onMakeAdmin,
}: {
  entry: QueueChip;
  position: number;
  user: UserState;
  userOnCourt: Court | null;
  promotedAdminIds: Set<string>;
  onBack: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onMakeAdmin: (playerId: string) => void;
}) {
  const userInGroup = entry.players.some((p) => p.id === user.id);
  const hasOpenSlot = entry.players.length < 4;
  const isFull = entry.players.length === 4;

  return (
    <div className="min-h-screen bg-th-page">
      {/* Header */}
      <header className="bg-th-header shadow-sm sticky top-0 z-10 border-b border-th">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-sm font-semibold text-th-muted hover:text-th-heading transition-colors px-2 py-1 rounded-lg"
          >
            ← Queue
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-th-heading text-lg">#{position} in Queue</h1>
            <p className="text-xs text-th-muted">
              {entry.players.length}/4 players · {isFull ? 'Ready to play!' : `${4 - entry.players.length} spot${4 - entry.players.length !== 1 ? 's' : ''} open`}
            </p>
          </div>
          {isFull && (
            <span className="text-xs font-bold text-white bg-th-primary px-2.5 py-1 rounded-full">
              Full
            </span>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Status banner */}
        <div
          className={`rounded-2xl p-4 flex items-center gap-3 ${
            isFull ? 'bg-th-primary' : 'bg-th-primary-light'
          }`}
        >
          <span className="text-3xl">{isFull ? '🎾' : '⏳'}</span>
          <div>
            <div className={`font-bold text-lg ${isFull ? 'text-white' : 'text-th-primary'}`}>
              {isFull ? "Group's full, next court is yours" : 'Waiting for players'}
            </div>
            <div className={`text-sm ${isFull ? 'text-white/70' : 'text-th-muted'}`}>
              {isFull
                ? "You'll get bumped to the next open court."
                : `Need ${4 - entry.players.length} more player${4 - entry.players.length !== 1 ? 's' : ''}.`}
            </div>
          </div>
        </div>

        {/* Players grid */}
        <div>
          <h2 className="text-base font-bold text-th-heading mb-3">Group</h2>
          <div className="grid grid-cols-2 gap-3">
            {entry.players.map((player) => {
              const isPromotedAdmin = promotedAdminIds.has(player.id);
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
                  {player.id === user.id && (
                    <span className="mt-1.5 text-[10px] font-black text-yellow-800 bg-yellow-200 px-2 py-0.5 rounded-full">
                      YOU
                    </span>
                  )}
                  {isPromotedAdmin && (
                    <span className="mt-1 text-[10px] font-black text-orange-800 bg-orange-100 px-2 py-0.5 rounded-full">
                      Admin
                    </span>
                  )}
                  {user.isAdmin && player.id !== user.id && !isPromotedAdmin && (
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

            {/* Open slots */}
            {Array.from({ length: 4 - entry.players.length }).map((_, i) => (
              <div
                key={`open-${i}`}
                className="rounded-2xl p-4 flex flex-col items-center text-center border-2 border-dashed border-th"
              >
                <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center mb-2">
                  <span className="text-2xl text-gray-300">+</span>
                </div>
                <div className="text-th-muted text-sm font-medium">Open Slot</div>
              </div>
            ))}
          </div>
        </div>

        {/* Action */}
        {userInGroup ? (
          <div className="space-y-3">
            <div className="text-center py-2 font-semibold text-th-primary">
              You're in this group ✓
            </div>
            {!isFull && (
              <div className="bg-th-primary-light rounded-xl p-3 text-center">
                <div className="font-semibold text-th-primary text-sm">
                  Looking for {4 - entry.players.length} more player{4 - entry.players.length !== 1 ? 's' : ''}!
                </div>
                <div className="text-xs text-th-muted mt-0.5">
                  Tell others your name so they can find and join your group.
                </div>
              </div>
            )}
            <button
              onClick={onLeave}
              className="w-full py-3.5 rounded-2xl text-base font-bold border-2 border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              Leave Group
            </button>
          </div>
        ) : userOnCourt !== null ? (
          <div className="text-center py-3 text-th-muted font-medium">
            You're currently playing on Court {userOnCourt.courtNum}.
          </div>
        ) : hasOpenSlot ? (
          <button
            onClick={onJoin}
            className="bg-th-primary w-full py-4 rounded-2xl text-lg font-bold transition-colors shadow-md"
          >
            Join This Group →
          </button>
        ) : (
          <div className="text-center py-3 text-th-muted font-medium">
            This group is full.
          </div>
        )}
      </main>
    </div>
  );
}

// Queue entry row (clickable)

export function QueueEntryRow({
  entry,
  position,
  isUser,
  onClick,
}: {
  entry: QueueChip;
  position: number;
  isUser: boolean;
  onClick: () => void;
}) {
  const isParty = entry.players.length > 1;
  const spotsLeft = 4 - entry.players.length;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors cursor-pointer ${
        isUser
          ? 'bg-yellow-50 border-2 border-yellow-300 hover:border-yellow-400'
          : 'bg-th-card border border-th hover:shadow-sm hover:border-th-primary'
      }`}
    >
      <div className="w-8 text-center font-black text-2xl text-gray-300 shrink-0 leading-none">
        {position}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 flex-1 min-w-0">
        {entry.players.length > 0 && entry.players.map((player) => (
          <div key={player.id} className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
              {player.username.charAt(0)}
            </div>
            <span className="text-sm font-medium text-th-body">{player.username}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isParty && (
          <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
            Party
          </span>
        )}
        {spotsLeft > 0 && (
          <span className="text-xs font-semibold text-th-primary bg-th-primary-light px-2.5 py-0.5 rounded-full">
            +{spotsLeft}
          </span>
        )}
        {isUser && (
          <span className="text-xs font-black text-yellow-800 bg-yellow-200 px-2.5 py-1 rounded-full">
            YOU
          </span>
        )}
      </div>
    </div>
  );
}