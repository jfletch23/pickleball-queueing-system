import { useState, useEffect } from "react";
import {
  type Court,
  type QueueChip,
  type PartyLobby,
  type PartyJoinRequest,
  type UserState,
  type PracticeState,
  type DashboardState,
} from "../types";
import { CourtCard, CourtAdminView } from "../components/Court.tsx";
import {
  QueueEntryDetailView,
  QueueEntryRow,
} from "../components/QueueEntry.tsx";
import { PartyLobbyRow } from "../components/Party.tsx";
import { useQueueSocket } from "../useQueueSocket";

// Main component

interface QueuePageProps {
  user: UserState;
  practice: PracticeState | null;
  onLogout: () => void;
  onOpenThemes: () => void;
}

export default function QueuePage({
  user,
  practice,
  onLogout,
  onOpenThemes,
}: QueuePageProps) {
  const [courts, setCourts] = useState<Court[]>([]);
  const [queue, setQueue] = useState<QueueChip[]>([]);
  const [now, setNow] = useState(Date.now());
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [promotedAdminIds, setPromotedAdminIds] = useState<Set<string>>(
    new Set(),
  );
  const isAdmin = promotedAdminIds.has(user.id)
  const [selectedCourtNumber, setSelectedCourtNumber] = useState<number | null>(
    null,
  );

  const [partyLobbies, setPartyLobbies] = useState<PartyLobby[]>([]);
  //const [userCurrentPartyLobbyId, setUserCurrentPartyLobbyId] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<PartyJoinRequest[]>([]);

  const userEntryId = queue.find((e) => e.players.some((p) => p.id === user.id))?._id ?? null;

  //So this line is basically replacing the useState we had before of saving the party lobbby ID the user is currently in into a useState
  //The problem with this is that it was not persisent enough, on page refresh the useState would go back to null but the other party state data would persist and there would be a mismatch
  //Now this is a derived state because partyLobbies is a useState that gets kept along even with page refreshes through a web socket and useEffect
  const userCurrentPartyLobbyId = partyLobbies.find((party) => party.players.some((u) => u.id === user.id))?._id ?? null
  

  function applyState(state: DashboardState) {
    setCourts(state.courts);
    setQueue(state.queue);
    setPromotedAdminIds(new Set(state.admins))
  }

  function applyPartyState(partyState : DashboardState) {
    console.log("Setting party to ", partyState)
    setPartyLobbies(partyState.parties)
  }

  //update after every change
  useQueueSocket<DashboardState>(practice?.code, {
    onState: applyState,
    onPartyState: applyPartyState,
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

  async function party_post(partyId: string, path: string, body: unknown) {
    if (!practice) return
    try {
      const res = await fetch(`/api/practice/${practice.code}/party/${partyId}/${path}`, {
        method: "POST",
        headers: {"Content-Type" : "application/json"},
        body: JSON.stringify(body)
      })
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        window.alert(data?.error ?? "Something went wrong, please try again.")
        return
      }
      applyPartyState(data)
    } catch (err) {
      window.alert("Could not reach server.")
    }
  }

  //timer ticks every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  //-----------Handlers--------------------

  //-----------Party System Handlers-------
  async function handleCreateParty() {
    if (!practice) return
    const response = await fetch(`/api/practice/${practice.code}/party/create`, {
      method: "POST",
      headers: {"Content-Type" : "application/json"},
      body: JSON.stringify({playerId: user.id})
    })
    const data = await response.json()
    console.log("Data is ", data)
    applyPartyState(data)
  }

  function handleRequestJoinPartyLobby(partyId: string) {
    party_post(partyId, 'request', {playerId: user.id})
  }

  function handleCancelPartyJoinRequest(partyId: string) {
    party_post(partyId, 'request/cancel', {playerId: user.id})
  }

  function handleApprovePartyJoinRequest(partyId: string, requesteeId: string) {
    party_post(partyId, 'request/respond', {leaderId: user.id, playerId: requesteeId, accept: true})
  }

  function handleDenyPartyJoinRequest(partyId: string, requesteeId: string) {
    party_post(partyId, 'request/respond', {leaderId: user.id, playerId: requesteeId, accept: false})
  }

  function handleLeavePartyLobby(partyId: string) {
    if (userCurrentPartyLobbyId === null) return;

    party_post(partyId, "leave", {playerId: user.id}) 
  }

  async function handleEnterQueueFromPartyLobby(partyId: string) {
    if (!practice) return
    const response = await fetch(`/api/practice/${practice.code}/party/${partyId}/enqueue`, {
      method: "POST",
      headers: {"Content-Type" : "application/json"},
      body: JSON.stringify({leaderId: user.id})
    })
    const data = await response.json()
    console.log("New data is", data)
    setPartyLobbies(data.partyState.parties)
    applyState(data)

  }

  //---------Other Handlers-----------
  async function handleDeletePractice() {
    if (!practice) return;
    if (
      !window.confirm(
        "End this practice for everyone? This deletes the queue and can't be undone.",
      )
    )
      return;
    try {
      const res = await fetch(`/api/practice/${practice.code}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: user.id }),
      });

      if (!res.ok) {
        window.alert("Could not end the practice.");
        return;
      }
      onLogout();
    } catch {
      window.alert("Could not reach the server.");
    }
  }

  async function handleEndGame(courtId: string, courtNumber: number) {
    void post("game/end", { queueChipId: courtId, courtNumber: courtNumber });
  }

  async function handleMakeAdmin(playerId : string) {
    void post("player/appointadmin", {playerId: playerId})
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
    void post("player/enqueue", { playerId: user.id });
  }

  const userOnCourt =
    courts.find((c) => c.players.some((p) => p.id === user.id)) ?? null;
  const userQueuePosition =
    userEntryId !== null
      ? queue.findIndex((e) => e._id === userEntryId) + 1
      : 0;
  const activeCourtsCount = courts.filter((c) => c.players.length > 0).length;

  // Court admin view
  if (selectedCourtNumber !== null && isAdmin) {
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
          isAdmin={isAdmin}
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

            {isAdmin && (
              <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                Admin
              </span>
            )}

            {/* Skill circle + username on sm+, just skill circle on mobile */}
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border border-th">
              <span className="text-sm font-medium text-th-body">
                {user.username}
              </span>
            </div>

            {user.isAdmin && (
              <button
                onClick={handleDeletePractice}
                className="text-sm font-medium text-red-600 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 transition-colors px-2 sm:px-3 py-1.5 rounded-lg cursor-pointer"
              >
                <span className="sm:hidden">🗑</span>
                <span className="hidden sm:inline">End Practice</span>
              </button>
            )}

            <button
              onClick={onOpenThemes}
              className="flex items-center gap-2 text-sm font-medium text-th-muted hover:text-th-primary border border-th hover:border-th-primary px-2 sm:px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 hover:bg-th-primary/5 hover:-translate-y-0.5 hover:shadow-sm"
            >
              <span className="sm:hidden">🎨</span>
              <span className="hidden sm:inline">🎨 Themes</span>
            </button>

            <button
              onClick={onLogout}
              className="text-sm font-medium text-th-muted hover:text-red-500 transition-colors px-2 py-1.5"
            >
              <span className="sm:hidden cursor-pointer">✕</span>
              <span className="hidden sm:inline cursor-pointer">Leave</span>
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
                  <div className="font-bold text-lg sm:text-xl">
                    You're on Court {userOnCourt.courtNumber}!
                  </div>
                  <div className="text-sm opacity-80">Enjoy your game!</div>
                </>
              ) : (
                <>
                  <div className="font-bold text-lg sm:text-xl text-yellow-800">
                    You're #{userQueuePosition} in the queue
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
                isAdmin={isAdmin}
                onEndGame={() => handleEndGame(court._id, court.courtNumber)}
                onClick={isAdmin && court.players.length > 0 ? () => setSelectedCourtNumber(court.courtNumber) : undefined}
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
              userCurrentPartyLobbyId === null && (
                <button
                  onClick={handleCreateParty}
                  className="px-4 py-2 rounded-xl text-sm font-bold border border-th hover:border-th-primary text-th-primary transition-colors cursor-pointer transition-all duration-200 hover:bg-th-primary/5 hover:-translate-y-0.5 hover:shadow-sm"
                >
                  🎉 Start a Party
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
                  key={lobby._id}
                  lobby={lobby}
                  isUserLobby={lobby._id === userCurrentPartyLobbyId}
                  isPartyLeader={lobby.leaderId === user.id}
                  canJoin={
                    userEntryId === null &&
                    userOnCourt === null &&
                    userCurrentPartyLobbyId === null
                  }
                  hasPendingRequest={lobby.requests.some((request) => request.id === user.id)}
                  pendingRequests={lobby.requests}
                  onRequestJoin={() => handleRequestJoinPartyLobby(lobby._id)}
                  onCancelRequest={() => handleCancelPartyJoinRequest(lobby._id)}
                  onEnterQueue={() => handleEnterQueueFromPartyLobby(lobby._id)}
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
                userCurrentPartyLobbyId === null && (
                  <button
                    onClick={handleJoinQueue}
                    className="bg-th-primary px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                  >
                    + Join Solo
                  </button>
                )}
              {userEntryId !== null && (
                <button
                  onClick={handleLeaveQueue}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 transition-colors cursor-pointer"
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
