import { useState, useEffect, useRef } from 'react';
import {
  type SkillLevel,
  type Court,
  type QueueEntry,
  type PartyLobby,
  type PartyJoinRequest,
  type UserState,
  type Player,
  SKILL_LABELS,
  type PracticeState,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SKILL_BG: Record<SkillLevel, string> = {
  1: 'bg-blue-500',
  2: 'bg-amber-500',
  3: 'bg-red-500',
};

// Returns the dominant skill level for a queue entry.
// Homogeneous parties return their level directly; mixed parties use
// whichever level appears most (first player breaks ties).
function getEntrySkillLevel(entry: QueueEntry): SkillLevel {
  const counts = new Map<SkillLevel, number>();
  for (const p of entry.players) {
    counts.set(p.skillLevel, (counts.get(p.skillLevel) ?? 0) + 1);
  }
  let best = entry.players[0].skillLevel;
  let bestCount = 0;
  for (const [level, count] of counts) {
    if (count > bestCount) { best = level; bestCount = count; }
  }
  return best;
}

// Gather entries from the queue until we have exactly 4 players.
// Only entries with the same dominant skill level are combined —
// beginners with beginners, intermediates with intermediates, etc.
// Tries each distinct skill level in queue order (FIFO within bracket).
function tryFillCourt(queue: QueueEntry[]): { players: Player[]; usedIds: Set<string> } | null {
  const triedLevels = new Set<SkillLevel>();

  for (const startEntry of queue) {
    const targetSkill = getEntrySkillLevel(startEntry);
    if (triedLevels.has(targetSkill)) continue;
    triedLevels.add(targetSkill);

    const gathered: Player[] = [];
    const usedIds = new Set<string>();

    for (const entry of queue) {
      if (getEntrySkillLevel(entry) !== targetSkill) continue;
      if (gathered.length + entry.players.length <= 4) {
        gathered.push(...entry.players);
        usedIds.add(entry.id);
        if (gathered.length === 4) break;
      }
      // Entry would overflow — skip it, keep looking within this bracket
    }

    if (gathered.length === 4) return { players: gathered, usedIds };
  }

  return null;
}



// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function SkillBadge({ level }: { level: SkillLevel }) {
  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0 ${SKILL_BG[level]}`}
      title={SKILL_LABELS[level]}
    >
      {SKILL_LABELS[level]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Court card (display only — admin End button still works)
// ---------------------------------------------------------------------------

function CourtCard({
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
    isActive && court.startTime !== null
      ? Math.floor((now - court.startTime) / 1000)
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
          Court {court.id}
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
                {player.name.charAt(0)}
              </div>
              <span className="text-sm font-medium text-th-body flex-1 truncate">
                {player.name}
              </span>
              <SkillBadge level={player.skillLevel} />
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

// ---------------------------------------------------------------------------
// Court admin view (admin taps a court → manage players)
// ---------------------------------------------------------------------------

function CourtAdminView({
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
    court.startTime !== null ? Math.floor((now - court.startTime) / 1000) : 0;

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
            <h1 className="font-bold text-th-heading text-lg">Court {court.id}</h1>
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
          {court.players.map((player) => {
            const isPromoted = promotedAdminIds.has(player.id);
            return (
              <div
                key={player.id}
                className="bg-th-card rounded-2xl p-4 flex flex-col items-center text-center border border-th"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black text-white mb-2 ${SKILL_BG[player.skillLevel]}`}
                >
                  {player.name.charAt(0)}
                </div>
                <div className="font-bold text-th-heading text-sm">{player.name}</div>
                <div className="mt-1">
                  <SkillBadge level={player.skillLevel} />
                </div>
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

// ---------------------------------------------------------------------------
// Queue entry detail page
// ---------------------------------------------------------------------------

function QueueEntryDetailView({
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
  entry: QueueEntry;
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
              {isFull ? 'Group is full — heading to a court!' : 'Waiting for players'}
            </div>
            <div className={`text-sm ${isFull ? 'text-white/70' : 'text-th-muted'}`}>
              {isFull
                ? 'This group will be assigned to the next available court.'
                : `Need ${4 - entry.players.length} more player${4 - entry.players.length !== 1 ? 's' : ''} to start a game.`}
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
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black text-white mb-2 ${SKILL_BG[player.skillLevel]}`}
                  >
                    {player.name.charAt(0)}
                  </div>
                  <div className="font-bold text-th-heading text-sm">{player.name}</div>
                  <div className="mt-1">
                    <SkillBadge level={player.skillLevel} />
                  </div>
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
                  Tell others your name — they can tap your group in the queue to join your party.
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
            You're currently playing on Court {userOnCourt.id}.
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

// ---------------------------------------------------------------------------
// Queue entry row (clickable)
// ---------------------------------------------------------------------------

function QueueEntryRow({
  entry,
  position,
  isUser,
  onClick,
}: {
  entry: QueueEntry;
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
        {entry.players.map((player) => (
          <div key={player.id} className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
              {player.name.charAt(0)}
            </div>
            <span className="text-sm font-medium text-th-body">{player.name}</span>
            <SkillBadge level={player.skillLevel} />
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

// ---------------------------------------------------------------------------
// Party lobby row
// ---------------------------------------------------------------------------

function PartyLobbyRow({
  lobby,
  isUserLobby,
  canJoin,
  hasPendingRequest,
  pendingRequests,
  onRequestJoin,
  onCancelRequest,
  onEnterQueue,
  onLeave,
  onApprove,
  onDeny,
}: {
  lobby: PartyLobby;
  isUserLobby: boolean;
  canJoin: boolean;
  hasPendingRequest: boolean;
  pendingRequests: PartyJoinRequest[];
  onRequestJoin: () => void;
  onCancelRequest: () => void;
  onEnterQueue: () => void;
  onLeave: () => void;
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
}) {
  const spotsLeft = 4 - lobby.players.length;
  const isFull = spotsLeft === 0;

  const actions = isUserLobby ? (
    <div className="flex gap-1.5 shrink-0">
      <button
        onClick={onEnterQueue}
        className="bg-th-primary px-3 py-2 rounded-xl text-xs font-bold transition-colors"
      >
        Enter Queue →
      </button>
      <button
        onClick={onLeave}
        className="px-2.5 py-2 rounded-xl text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
      >
        Leave
      </button>
    </div>
  ) : hasPendingRequest ? (
    <button
      onClick={onCancelRequest}
      className="px-3 py-2 rounded-xl text-xs font-semibold text-th-muted border border-th hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
    >
      Pending…
    </button>
  ) : canJoin && !isFull ? (
    <button
      onClick={onRequestJoin}
      className="bg-th-primary px-3 py-2 rounded-xl text-xs font-bold transition-colors"
    >
      Request to Join
    </button>
  ) : isFull ? (
    <span className="text-xs font-semibold text-th-muted">Full</span>
  ) : null;

  return (
    <div
      className={`rounded-2xl p-4 border-2 transition-colors ${
        isUserLobby ? 'border-th-primary bg-th-primary-light' : 'bg-th-card border-th'
      }`}
    >
      {/* Top row: avatars + info + actions inline on sm+ */}
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2 shrink-0">
          {lobby.players.map((p) => (
            <div
              key={p.id}
              className={`w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-sm font-bold text-white ${SKILL_BG[p.skillLevel]}`}
            >
              {p.name.charAt(0)}
            </div>
          ))}
          {Array.from({ length: spotsLeft }).map((_, i) => (
            <div
              key={`open-${i}`}
              className="w-9 h-9 rounded-full border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center"
            >
              <span className="text-gray-400 text-sm font-bold">+</span>
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-th-heading text-sm">
              {lobby.players[0]?.name ?? 'Unknown'}'s Party
            </span>
            {/* Red badge for pending requests (owner only) */}
            {isUserLobby && pendingRequests.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                {pendingRequests.length}
              </span>
            )}
          </div>
          <div className="text-xs text-th-muted">
            {lobby.players.length}/4 ·{' '}
            {isFull ? 'Ready to queue!' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} open`}
          </div>
        </div>

        <div className="hidden sm:block shrink-0">{actions}</div>
      </div>

      {/* Bottom row: player name pills + mobile actions */}
      <div className="flex items-center justify-between mt-3 gap-2">
        <div className="flex flex-wrap gap-1.5 flex-1">
          {lobby.players.map((p) => (
            <span
              key={p.id}
              className="text-xs font-medium text-th-body bg-th-page px-2 py-0.5 rounded-full border border-th"
            >
              {p.name}
            </span>
          ))}
        </div>
        <div className="sm:hidden shrink-0">{actions}</div>
      </div>

      {/* Pending join requests — visible to party owner only */}
      {isUserLobby && pendingRequests.length > 0 && (
        <div className="mt-3 pt-3 border-t border-th space-y-2">
          <div className="text-xs font-bold text-th-heading">
            {pendingRequests.length} join request{pendingRequests.length !== 1 ? 's' : ''}
          </div>
          {pendingRequests.map((req) => (
            <div key={req.id} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${SKILL_BG[req.player.skillLevel]}`}
              >
                {req.player.name.charAt(0)}
              </div>
              <span className="text-sm font-medium text-th-body flex-1 truncate">
                {req.player.name}
              </span>
              <SkillBadge level={req.player.skillLevel} />
              <button
                onClick={() => onApprove(req.id)}
                className="text-xs font-bold text-green-700 bg-green-100 hover:bg-green-200 px-2.5 py-1 rounded-full transition-colors"
              >
                ✓
              </button>
              <button
                onClick={() => onDeny(req.id)}
                className="text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-2.5 py-1 rounded-full transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface QueuePageProps {
  user: UserState;
  practice: PracticeState | null
  onLogout: () => void;
  onOpenThemes: () => void;
}

export default function QueuePage({ user, practice, onLogout, onOpenThemes }: QueuePageProps) {
  const [courts, setCourts] = useState<Court[]>(practice?.courts || []);
  const [queue, setQueue] = useState<QueueEntry[]>(practice?.queueChips || []);
  const [now, setNow] = useState(Date.now());
  const [userEntryId, setUserEntryId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [promotedAdminIds, setPromotedAdminIds] = useState<Set<string>>(new Set());
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);
  const [partyLobbies, setPartyLobbies] = useState<PartyLobby[]>([]);
  const [userLobbyId, setUserLobbyId] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<PartyJoinRequest[]>([]);

  // Tick every second for timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  //add polling and savestate

  useEffect(()=>{if (!practice)return;
    async function loadState() {
      const res = await fetch(`/api/practices/${practice!.code}`);
      if (!res.ok) return;
      const data = await res.json();
      setCourts(data.courts);
      setQueue(data.queueChips);
    }
    loadState();
    const id = setInterval(loadState, 3000);
    return () => clearInterval(id);
  },[practice]);

   function saveState(newCourts: Court[], newQueue: QueueEntry[]) {
     if (!practice) return;
     fetch(`/api/practices/${practice.code}/state`, {
       method: "PUT",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ courts: newCourts, queueChips: newQueue }),
     });
   }
    // Auto-fill: whenever a court is empty, try to gather exactly 4 players from
  // the front of the queue. If we can't make a full game yet, leave it empty.
  useEffect(() => {
    const hasEmpty = courts.some((c) => c.players.length === 0);
    if (!hasEmpty || queue.length === 0) return;

    let remainingQueue = [...queue];
    let changed = false;

    const newCourts = courts.map((court) => {
      if (court.players.length > 0) return court;
      const result = tryFillCourt(remainingQueue);
      if (result === null) return court;
      changed = true;
      remainingQueue = remainingQueue.filter((e) => !result.usedIds.has(e.id));
      return { ...court, players: result.players, startTime: Date.now() };
    });

    if (!changed) return;

    setCourts(newCourts);
    setQueue(remainingQueue);
    saveState(newCourts, remainingQueue);

    if (userEntryId !== null && !remainingQueue.some((e) => e.id === userEntryId)) {
      setUserEntryId(null);
    }
  }, [courts, queue, userEntryId]);

  // If the selected entry was consumed by auto-fill, go back to queue view
  useEffect(() => {
    if (selectedEntryId !== null && !queue.some((e) => e.id === selectedEntryId)) {
      setSelectedEntryId(null);
    }
  }, [queue, selectedEntryId]);

  // If the admin ends a game while viewing that court, return to main view
  useEffect(() => {
    if (selectedCourtId !== null) {
      const court = courts.find((c) => c.id === selectedCourtId);
      if (court === undefined || court.players.length === 0) {
        setSelectedCourtId(null);
      }
    }
  }, [courts, selectedCourtId]);

  const myCourt = courts.find((c)=> c.players.some((p)=> p.id === user.id));
  const prevCourtId = useRef<number | null | undefined>(undefined);

  useEffect(()=>{
    const courtId = myCourt?.id?? null;
    if(
      prevCourtId.current === null &&
      courtId !== null &&
      "Notification" in window && 
      Notification.permission === "granted"
    ){
      new Notification( "Youre Up! ", {body: `Head to Court ${courtId}`})
    }
    prevCourtId.current = courtId
  },[myCourt?.id])

  function handleEndGame(courtId: number) {
    const newCourts = courts.map((c) =>
      c.id === courtId ? { ...c, players: [], startTime: null } : c
    );
    setCourts(newCourts);
    saveState(newCourts, queue);
  }

  function handleJoinQueue() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const entryId = `user-${user.id}`;
    setJoinRequests((prev) => prev.filter((r) => r.player.id !== user.id));
    const newQueue = [
      ...queue,
      {
        id: entryId,
        players: [{ id: user.id, name: user.username, skillLevel: user.skillLevel ?? 1 }],
        joinedAt: Date.now(),
      },
    ];
    setQueue(newQueue);
    saveState(courts, newQueue);
    setUserEntryId(entryId);
  }

  function handleLeaveQueue() {
    const newQueue = queue.filter((e) => e.id !== userEntryId);
    setQueue(newQueue);
    saveState(courts, newQueue);
    setUserEntryId(null);
  }

  function handleCreateParty() {
    setJoinRequests((prev) => prev.filter((r) => r.player.id !== user.id));
    const lobbyId = `lobby-${user.id}`;
    setPartyLobbies((prev) => [
      ...prev,
      {
        id: lobbyId,
        players: [{ id: user.id, name: user.username, skillLevel: user.skillLevel ?? 1 }],
        createdAt: Date.now(),
      },
    ]);
    setUserLobbyId(lobbyId);
  }

  function handleRequestJoinLobby(lobbyId: string) {
    const requestId = `req-${user.id}-${lobbyId}`;
    setJoinRequests((prev) => [
      ...prev,
      {
        id: requestId,
        lobbyId,
        player: { id: user.id, name: user.username, skillLevel: user.skillLevel?? 1 },
        requestedAt: Date.now(),
      },
    ]);
  }

  function handleCancelJoinRequest(lobbyId: string) {
    setJoinRequests((prev) => prev.filter((r) => !(r.lobbyId === lobbyId && r.player.id === user.id)));
  }

  function handleApproveJoinRequest(requestId: string) {
    const req = joinRequests.find((r) => r.id === requestId);
    if (req === undefined) return;
    setPartyLobbies((prev) =>
      prev.map((l) => {
        if (l.id !== req.lobbyId || l.players.length >= 4) return l;
        return { ...l, players: [...l.players, req.player] };
      })
    );
    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
  }

  function handleDenyJoinRequest(requestId: string) {
    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
  }

  function handleLeavePartyLobby() {
    if (userLobbyId === null) return;
    // Cancel all requests for the lobby (they'll be re-opened if lobby continues)
    setJoinRequests((prev) => prev.filter((r) => r.lobbyId !== userLobbyId));
    setPartyLobbies((prev) =>
      prev
        .map((l): PartyLobby | null => {
          if (l.id !== userLobbyId) return l;
          const remaining = l.players.filter((p) => p.id !== user.id);
          return remaining.length === 0 ? null : { ...l, players: remaining };
        })
        .filter((l): l is PartyLobby => l !== null)
    );
    setUserLobbyId(null);
  }

  function handleEnterQueueFromLobby() {
    const lobby = partyLobbies.find((l) => l.id === userLobbyId);
    if (lobby === undefined) return;
    const entryId = `entry-${userLobbyId}`;
    setQueue((prev) => [...prev, { id: entryId, players: lobby.players, joinedAt: Date.now() }]);
    setPartyLobbies((prev) => prev.filter((l) => l.id !== userLobbyId));
    setJoinRequests((prev) => prev.filter((r) => r.lobbyId !== userLobbyId));
    setUserEntryId(entryId);
    setUserLobbyId(null);
  }

  function handleMakeAdmin(playerId: string) {
    setPromotedAdminIds((prev) => new Set([...prev, playerId]));
  }

  // Join a specific queue entry's group (replaces user's current queue entry)
  function handleJoinQueueEntry(entryId: string) {

    setQueue((prev) => {
      let updated = prev;

      // Remove user from their current entry (delete entry if it becomes empty)
      if (userEntryId !== null) {
        updated = updated
          .map((e): QueueEntry | null => {
            if (e.id !== userEntryId) return e;
            const remaining = e.players.filter((p) => p.id !== user.id);
            return remaining.length === 0 ? null : { ...e, players: remaining };
          })
          .filter((e): e is QueueEntry => e !== null);
      }

      // Add user to the target entry
      updated = updated.map((e) => {
        if (e.id !== entryId || e.players.length >= 4) return e;
        return {
          ...e,
          players: [...e.players, { id: user.id, name: user.username, skillLevel: user.skillLevel ?? 1}],
        };
      });

      return updated;
    });

    setUserEntryId(entryId);
    setSelectedEntryId(null);
  }

  // Leave the current group (removes user from that entry)
  function handleLeaveGroup(entryId: string) {
    setQueue((prev) =>
      prev
        .map((e): QueueEntry | null => {
          if (e.id !== entryId) return e;
          const remaining = e.players.filter((p) => p.id !== user.id);
          return remaining.length === 0 ? null : { ...e, players: remaining };
        })
        .filter((e): e is QueueEntry => e !== null)
    );
    setUserEntryId(null);
    setSelectedEntryId(null);
  }

  const userOnCourt = courts.find((c) => c.players.some((p) => p.id === user.id)) ?? null;
  const userQueuePosition =
    userEntryId !== null ? queue.findIndex((e) => e.id === userEntryId) + 1 : 0;
  const activeCourtsCount = courts.filter((c) => c.players.length > 0).length;

  // ── Court admin view ─────────────────────────────────────────────────────
  if (selectedCourtId !== null && user.isAdmin) {
    const selectedCourt = courts.find((c) => c.id === selectedCourtId);
    if (selectedCourt !== undefined && selectedCourt.players.length > 0) {
      return (
        <CourtAdminView
          court={selectedCourt}
          now={now}
          promotedAdminIds={promotedAdminIds}
          onBack={() => setSelectedCourtId(null)}
          onEndGame={() => { handleEndGame(selectedCourtId); }}
          onMakeAdmin={handleMakeAdmin}
        />
      );
    }
  }

  // ── Queue entry detail view ──────────────────────────────────────────────
  if (selectedEntryId !== null) {
    const selectedEntry = queue.find((e) => e.id === selectedEntryId);
    if (selectedEntry !== undefined) {
      const position = queue.indexOf(selectedEntry) + 1;
      return (
        <QueueEntryDetailView
          entry={selectedEntry}
          position={position}
          user={user}
          userOnCourt={userOnCourt}
          promotedAdminIds={promotedAdminIds}
          onBack={() => setSelectedEntryId(null)}
          onJoin={() => handleJoinQueueEntry(selectedEntryId)}
          onLeave={() => handleLeaveGroup(selectedEntryId)}
          onMakeAdmin={handleMakeAdmin}
        />
      );
    }
  }

  // ── Main queue view ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-th-page">
      {/* Header */}
      <header className="bg-th-header shadow-sm sticky top-0 z-10 border-b border-th">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <img
              src="/pickleball-bat-and-ball-free-vector.jpg"
              alt="Pickleball"
              className="w-8 h-8 object-cover rounded-full"
            />
            <span className="font-bold text-th-heading text-lg hidden sm:block">
              Pickleball Queue
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-th-primary-light rounded-lg">
              <span className="text-xs font-medium text-th-primary-light">Practice</span>
              <span className="font-mono font-bold text-th-primary tracking-widest text-sm">
                {practice?.code}
              </span>
            </div>

            {user.isAdmin && (
              <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                Admin
              </span>
            )}

            {/* Skill circle + username on sm+, just skill circle on mobile */}
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border border-th">
              {user.skillLevel !== null && (
                <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${SKILL_BG[user.skillLevel]}`}
              >
                {user.skillLevel}
              </span>
              )}
              <span className="text-sm font-medium text-th-body hidden sm:block">{user.username}</span>
            </div>

            <button
              onClick={onOpenThemes}
              className="text-sm font-medium text-th-muted hover:text-th-primary transition-colors px-2 sm:px-3 py-1.5 rounded-lg border border-th hover:border-th-primary"
            >
              <span className="sm:hidden">🎨</span>
              <span className="hidden sm:inline">🎨 Themes</span>
            </button>

            <button
              onClick={onLogout}
              className="text-sm font-medium text-th-muted hover:text-red-500 transition-colors px-2 py-1.5"
            >
              <span className="sm:hidden">✕</span>
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Status Banner */}
        {(userOnCourt !== null || (userEntryId !== null && userQueuePosition > 0)) && (
          <div
            className={`rounded-2xl p-4 flex items-center gap-3 ${
              userOnCourt !== null
                ? 'bg-th-primary text-white'
                : 'bg-yellow-50 border-2 border-yellow-300'
            }`}
          >
            <span className="text-2xl sm:text-3xl shrink-0">{userOnCourt !== null ? '🎾' : '⏳'}</span>
            <div className="min-w-0">
              {userOnCourt !== null ? (
                <>
                  <div className="font-bold text-lg sm:text-xl">You're on Court {userOnCourt.id}!</div>
                  <div className="text-sm opacity-80">Enjoy your game!</div>
                </>
              ) : (
                <>
                  <div className="font-bold text-lg sm:text-xl text-yellow-800">
                    You're #{userQueuePosition} in the queue
                  </div>
                  <div className="text-yellow-700 text-sm">
                    Est. wait: ~{Math.ceil(userQueuePosition / Math.max(activeCourtsCount, 1)) * 12} min
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Courts */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-th-heading">Courts</h2>
            <span className="text-sm text-th-muted font-medium">
              {activeCourtsCount}/{courts.length} active
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {courts.map((court) => (
              <CourtCard
                key={court.id}
                court={court}
                now={now}
                isAdmin={user.isAdmin}
                onEndGame={() => handleEndGame(court.id)}
                onClick={user.isAdmin && court.players.length > 0 ? () => setSelectedCourtId(court.id) : undefined}
              />
            ))}
          </div>
        </section>

        {/* Party Lobbies */}
        <section>
          <div className="flex items-start justify-between mb-4 gap-3">
            <div>
              <h2 className="text-xl font-bold text-th-heading">Party Lobbies</h2>
              <p className="text-xs text-th-muted mt-0.5">Assemble your group before entering the queue.</p>
            </div>
            {userEntryId === null && userOnCourt === null && userLobbyId === null && (
              <button
                onClick={handleCreateParty}
                className="px-4 py-2 rounded-xl text-sm font-bold border border-th hover:border-th-primary text-th-primary transition-colors"
              >
                🎾 Start a Party
              </button>
            )}
          </div>

          {partyLobbies.length === 0 ? (
            <div className="text-center py-8 text-th-muted border-2 border-dashed border-th rounded-2xl">
              <div className="text-2xl mb-1">🎾</div>
              <div className="font-semibold">No open parties</div>
              <div className="text-xs mt-0.5">Start one to play with friends!</div>
            </div>
          ) : (
            <div className="space-y-3">
              {partyLobbies.map((lobby) => (
                <PartyLobbyRow
                  key={lobby.id}
                  lobby={lobby}
                  isUserLobby={lobby.id === userLobbyId}
                  canJoin={userEntryId === null && userOnCourt === null && userLobbyId === null}
                  hasPendingRequest={joinRequests.some((r) => r.lobbyId === lobby.id && r.player.id === user.id)}
                  pendingRequests={joinRequests.filter((r) => r.lobbyId === lobby.id)}
                  onRequestJoin={() => handleRequestJoinLobby(lobby.id)}
                  onCancelRequest={() => handleCancelJoinRequest(lobby.id)}
                  onEnterQueue={handleEnterQueueFromLobby}
                  onLeave={handleLeavePartyLobby}
                  onApprove={handleApproveJoinRequest}
                  onDeny={handleDenyJoinRequest}
                />
              ))}
            </div>
          )}
        </section>

        {/* Queue */}
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-th-heading">Queue</h2>
              <span className="text-sm font-bold text-white bg-gray-400 px-2.5 py-0.5 rounded-full">
                {queue.length}
              </span>
            </div>

            <div className="flex gap-2">
              {userEntryId === null && userOnCourt === null && userLobbyId === null && (
                <button
                  onClick={handleJoinQueue}
                  className="bg-th-primary px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                >
                  + Join Solo
                </button>
              )}
              {userEntryId !== null && (
                <button
                  onClick={handleLeaveQueue}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 transition-colors"
                >
                  Leave Queue
                </button>
              )}
            </div>
          </div>

          {queue.length === 0 ? (
            <div className="text-center py-14 text-th-muted">
              <img
                src="/pickleball-bat-and-ball-free-vector.jpg"
                alt="Pickleball"
                className="w-14 h-14 object-cover rounded-full opacity-30 mx-auto mb-3"
              />
              <div className="font-semibold text-lg">Queue is empty</div>
              <div className="text-sm mt-1">Join the queue to get on a court!</div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-th-muted mb-3">Tap a group to view or join them.</p>
              {queue.map((entry, index) => (
                <QueueEntryRow
                  key={entry.id}
                  entry={entry}
                  position={index + 1}
                  isUser={entry.id === userEntryId}
                  onClick={() => setSelectedEntryId(entry.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
