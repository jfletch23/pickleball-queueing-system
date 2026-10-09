import { useState, useEffect } from "react";
import {
  type Court,
  type QueueChip,
  type PartyLobby,
  type PartyJoinRequest,
  type UserState,
  type PracticeState,
  type DashboardState
} from '../types';
import {CourtCard, CourtAdminView} from '../components/Court.tsx';
import { QueueEntryDetailView, QueueEntryRow } from '../components/QueueEntry.tsx';
import {PartyLobbyRow} from "../components/Party.tsx"
import { useQueueSocket } from "../useQueueSocket";

// Main component

interface QueuePageProps {
  user: UserState;
  practice: PracticeState | null;
  onLogout: () => void;
  onOpenThemes: () => void;
}

export default function QueuePage({ user, practice, onLogout, onOpenThemes }: QueuePageProps) {
  const [courts, setCourts] = useState<Court[]>([]);
  const [queue, setQueue] = useState<QueueChip[]>([]);
  const [now, setNow] = useState(Date.now());
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [promotedAdminIds, setPromotedAdminIds] = useState<Set<string>>(new Set());
  const [selectedCourtNumber, setSelectedCourtNumber] = useState<number | null>(null);
  const [partyLobbies, setPartyLobbies] = useState<PartyLobby[]>([]);
  const [userLobbyId, setUserLobbyId] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<PartyJoinRequest[]>([]);
  const userEntryId = queue.find((e) => e.players.some((p) => p.id === user.id))?._id ?? null;

  function applyState(state: DashboardState) {
    setCourts(state.courts);
    setQueue(state.queue);
  }

  //update after every change
  useQueueSocket<DashboardState>(practice?.code, {
    onState: applyState,
    onDeleted: () => {
      window.alert("This practice was ended.");
      onLogout();
    },
  });

  //send updates to the server
  async function post(path: string, body: unknown) {
    if (!practice) return;
    try {
      const res = await fetch(`/api/practice/${practice.code}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        window.alert(data?.error ?? "Something went wrong, please try again.");
        return;
      }
      applyState(data as DashboardState);
    } catch {
      window.alert("Could not reach the server.");
    }
  }

  //timer ticks every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  //-----------Handlers--------------------

  //-----------Party System Handlers-------
  function handleRequestJoinPartyLobby(lobbyId: string) {
    const requestId = `req-${user.id}-${lobbyId}`;
    setJoinRequests((prev) => [
      ...prev,
      {
        id: requestId,
        lobbyId,
        player: { id: user.id, name: user.username},
        requestedAt: Date.now(),
      },
    ]);
  }

  function handleCreateParty() {
    setJoinRequests((prev) => prev.filter((r) => r.player.id !== user.id));
    const lobbyId = `lobby-${user.id}`;
    setPartyLobbies((prev) => [
      ...prev,
      {
        id: lobbyId,
        players: [{ id: user.id, name: user.username}],
        createdAt: Date.now(),
      },
    ]);
    setUserLobbyId(lobbyId);
  }

  function handleCancelPartyJoinRequest(lobbyId: string) {
    setJoinRequests((prev) =>
      prev.filter((r) => !(r.lobbyId === lobbyId && r.player.id === user.id)),
    );
  }

  function handleApprovePartyJoinRequest(requestId: string) {
    const req = joinRequests.find((r) => r.id === requestId);
    if (req === undefined) return;
    setPartyLobbies((prev) =>
      prev.map((l) => {
        if (l.id !== req.lobbyId || l.players.length >= 4) return l;
        return { ...l, players: [...l.players, req.player] };
      }),
    );
    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
  }

  function handleDenyPartyJoinRequest(requestId: string) {
    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
  }

  function handleLeavePartyLobby() {
    if (userLobbyId === null) return;
    // clear pending requests for this lobby
    setJoinRequests((prev) => prev.filter((r) => r.lobbyId !== userLobbyId));
    setPartyLobbies((prev) =>
      prev
        .map((l): PartyLobby | null => {
          if (l.id !== userLobbyId) return l;
          const remaining = l.players.filter((p) => p.id !== user.id);
          return remaining.length === 0 ? null : { ...l, players: remaining };
        })
        .filter((l): l is PartyLobby => l !== null),
    );
    setUserLobbyId(null);
  }

  function handleEnterQueueFromPartyLobby() {

  }

  //---------Other Handlers-----------

  async function handleEndGame(courtId: string, courtNumber: number) {
    void post("game/end", { queueChipId: courtId, courtNumber: courtNumber});
  }

  async function handleMakeAdmin(playerId : string) {
    //Cant use void post because it triggers a state change which is unnecessary since courts and queues not changing
    //TODO: incorporate user into state so websocket triggers an update when a player is appointed as an admin so one their side the nav bar updates with the admin tag
    const response = await fetch(`/api/practice/${practice?.code}/player/appointadmin`, {
      method: "POST",
      headers: {
        "Content-Type":"application/json"
      },
      body: JSON.stringify({playerId: playerId})
    })
    setPromotedAdminIds((prevSet) => {
      const newSet = new Set(prevSet)
      newSet.add(playerId)
      return newSet
    })
  }

  function handleJoinQueueChip() {
    void post("player/enqueue", {playerId: user.id})

  }

  function handleLeaveQueueChip() {
    void post("queue/leave", {playerId: user.id})
    setSelectedEntryId(null)
  }

  function handleLeaveQueue() {
    void post("queue/leave", { playerId: user.id });
  }

  function handleJoinQueue() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    setJoinRequests((prev) => prev.filter((r) => r.player.id !== user.id));
    void post("player/enqueue", { playerId: user.id });
  }

  const userOnCourt =
    courts.find((c) => c.players.some((p) => p.id === user.id)) ?? null;
  const userQueuePosition =
    userEntryId !== null ? queue.findIndex((e) => e._id === userEntryId) + 1 : 0;
  const activeCourtsCount = courts.filter((c) => c.players.length > 0).length;

  // Court admin view
  if (selectedCourtNumber !== null && user.isAdmin) {
    const selectedCourt = courts.find((c) => c.courtNumber === selectedCourtNumber);
    if (selectedCourt !== undefined && selectedCourt.players.length > 0) {
      return (
        <CourtAdminView
          court={selectedCourt}
          now={now}
          promotedAdminIds={promotedAdminIds}
          onBack={() => setSelectedCourtNumber(null)}
          onEndGame={() => {
            handleEndGame(selectedCourt._id, selectedCourt.courtNumber);
          }}
          onMakeAdmin={handleMakeAdmin}
        />
      );
    }
  }

  // Queue entry detail view
  if (selectedEntryId !== null) {
    const selectedEntry = queue.find((e) => e._id === selectedEntryId);
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
          onJoin={() => handleJoinQueueChip()}
          onLeave={() => handleLeaveQueueChip()}
          onMakeAdmin={handleMakeAdmin}
        />
      );
    }
  }

  // Main queue view
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
              <span className="text-xs font-medium text-th-primary-light">
                Practice
              </span>
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
              <span className="text-sm font-medium text-th-body">{user.username}</span>
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
        {(userOnCourt !== null ||
          (userEntryId !== null && userQueuePosition > 0)) && (
          <div
            className={`rounded-2xl p-4 flex items-center gap-3 ${
              userOnCourt !== null
                ? "bg-th-primary text-white"
                : "bg-yellow-50 border-2 border-yellow-300"
            }`}
          >
            <span className="text-2xl sm:text-3xl shrink-0">
              {userOnCourt !== null ? "🎾" : "⏳"}
            </span>
            <div className="min-w-0">
              {userOnCourt !== null ? (
                <>
                  <div className="font-bold text-lg sm:text-xl">You're on Court {userOnCourt.courtNumber}!</div>
                  <div className="text-sm opacity-80">Enjoy your game!</div>
                </>
              ) : (
                <>
                  <div className="font-bold text-lg sm:text-xl text-yellow-800">
                    You're #{userQueuePosition} in the queue
                  </div>
                  <div className="text-yellow-700 text-sm">
                    Est. wait: ~
                    {Math.ceil(
                      userQueuePosition / Math.max(activeCourtsCount, 1),
                    ) * 12}{" "}
                    min
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
                key={court.courtNumber}
                court={court}
                now={now}
                isAdmin={user.isAdmin}
                onEndGame={() => handleEndGame(court._id, court.courtNumber)}
                onClick={user.isAdmin && court.players.length > 0 ? () => setSelectedCourtNumber(court.courtNumber) : undefined}
              />
            ))}
          </div>
        </section>

        {/* Party Lobbies */}
        <section>
          <div className="flex items-start justify-between mb-4 gap-3">
            <div>
              <h2 className="text-xl font-bold text-th-heading">
                Party Lobbies
              </h2>
              <p className="text-xs text-th-muted mt-0.5">
                Group up with friends before you join the queue.
              </p>
            </div>
            {userEntryId === null &&
              userOnCourt === null &&
              userLobbyId === null && (
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
              <div className="text-xs mt-0.5">
                Start one to play with friends.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {partyLobbies.map((lobby) => (
                <PartyLobbyRow
                  key={lobby.id}
                  lobby={lobby}
                  isUserLobby={lobby.id === userLobbyId}
                  canJoin={
                    userEntryId === null &&
                    userOnCourt === null &&
                    userLobbyId === null
                  }
                  hasPendingRequest={joinRequests.some(
                    (r) => r.lobbyId === lobby.id && r.player.id === user.id,
                  )}
                  pendingRequests={joinRequests.filter(
                    (r) => r.lobbyId === lobby.id,
                  )}
                  onRequestJoin={() => handleRequestJoinPartyLobby(lobby.id)}
                  onCancelRequest={() => handleCancelPartyJoinRequest(lobby.id)}
                  onEnterQueue={handleEnterQueueFromPartyLobby}
                  onLeave={handleLeavePartyLobby}
                  onApprove={handleApprovePartyJoinRequest}
                  onDeny={handleDenyPartyJoinRequest}
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
              {userEntryId === null &&
                userOnCourt === null &&
                userLobbyId === null && (
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
              <div className="text-sm mt-1">
                Join the queue to get on a court.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-th-muted mb-3">
                Tap a group to view or join them.
              </p>
              {queue.map((entry, index) => (
                <QueueEntryRow
                  key={entry._id}
                  entry={entry}
                  position={index + 1}
                  isUser={entry._id === userEntryId}
                  onClick={() => setSelectedEntryId(entry._id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
