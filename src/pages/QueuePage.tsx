import { useState, useEffect, useMemo, useRef } from "react";
import {
  type Court,
  type QueueChip,
  type PartyLobby,
  type UserState,
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
  practiceCode: string;
  onLogout: () => void;
  onOpenThemes: () => void;
}

export default function QueuePage({
  user,
  practiceCode,
  onLogout,
  onOpenThemes,
}: QueuePageProps) {
  //useRef is a React hook that returns a mutable object with a .current attribute, it does not re-render the component when .current changes like a useState would when it gets set
  //Using this hook for sending a notification only when the user is now in a court, so trying to figure out when a derived state has changed from its initial value
  const isInitialSyncDone = useRef(false)
  //States for courts and queue, main state components of page that will change
  const [courts, setCourts] = useState<Court[]>([]);
  const [queue, setQueue] = useState<QueueChip[]>([]);
  //State for current time that gets updated every 1000 milliseconds (every second)
  const [now, setNow] = useState(Date.now());
  //Loading state for displaying a spinner when state is loading
  const [loading, setLoading] = useState(true)
  //State for selected queue chip when clicking on a queue chip to get the detailed full page view of the queue chip
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  //Similar to the above state but used for clicking on a court to get the detailed full page view of that court
  const [selectedCourtNumber, setSelectedCourtNumber] = useState<number | null>(null);
  //State used to handle what players are admins, basically comes from how in the database we store an array of UUIDS of the admins instead of storing an isAdmin boolean flag with each user
  //Note because this use state has a type of Set, the set needs to be re-defined each time to trigger a state change rather than just mutated by adding an item to the set
  const [promotedAdminIds, setPromotedAdminIds] = useState<Set<string>>(
    new Set(),
  );
  //isAdmin is derived state now, gets recomputed when promotedAdminIds gets recomputed
  //This is better than doing user.isAdmin because that would not get recomputed, though I guess I could make it a useState on its own but I think derived state is better
  const isAdmin = promotedAdminIds.has(user.id)

  //Similar to the courts and queue useStates above but for parties, which is the last dynamic state component of the page
  const [partyLobbies, setPartyLobbies] = useState<PartyLobby[]>([]);

  //Derived state, it is the ID of the queue chip that has the current user, is null if the current user is not in a queue chip
  const userCurrentQueueChipId = queue.find((e) => e.players.some((p) => p.id === user.id))?._id ?? null;

  //So this line is basically replacing the useState we had before of saving the party lobbby ID the user is currently in into a useState
  //The problem with this is that it was not persisent enough, on page refresh the useState would go back to null but the other party state data would persist and there would be a mismatch
  //Now this is a derived state because partyLobbies is a useState that gets kept along even with page refreshes through a web socket and useEffect
  const userCurrentPartyLobbyId = partyLobbies.find((party) => party.players.some((u) => u.id === user.id))?._id ?? null
  
  //Sets some use states with the current state as passed into this function
  function applyState(state: DashboardState) {
    setCourts(state.courts);
    setQueue(state.queue);
    //Note need to make a new set instead of mutating current set to get state change to trigger
    setPromotedAdminIds(new Set(state.admins))
    //If useRef object .current is null (meaning first time calling applyState on this page load)
    if (!isInitialSyncDone.current) {
      //Derived state finding if current user ID is on a court
      const initialCourt = state.courts.find((c) => c.players.some((p) => p.id === user.id))
      //prevCourtId is another useRef defined below, setting it to that initial court ID or if the user is not on a court it gets set to null
      prevCourtId.current = initialCourt?._id ?? null
      //Setting this first useRef object to true, so basically ensures this block of code in the if block only gets run on the first iteration of applyState
      isInitialSyncDone.current = true
    }
  }

  //Similar to above applyState function but for party state, needs to be a separate function because I need to call it separately (see below)
  //This goes back to my server architecture of having a separate getDashboardState function from getPartiesState
  function applyPartyState(partyState : DashboardState) {
    setPartyLobbies(partyState.parties)
  }

  //Custom react hook for using websockets to update the state
  //See useQueueSocket.ts for more info
  useQueueSocket(practiceCode, {
    onState: (state) => {applyState(state); setLoading(false)},
    onPartyState: applyPartyState,
    onDeleted: () => {
      window.alert("This practice was ended.");
      onLogout();
    },
  });

  //Generic helper function to send POST requests to server
  async function post(path: string, body: unknown) {
    try {
      const res = await fetch(`/api/practice/${practiceCode}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        window.alert(data?.error ?? "Something went wrong, please try again.");
        return;
      }
      //Update page state
      applyState(data as DashboardState);
    } catch {
      window.alert("Could not reach the server.");
    }
  }

  //Needed to make a separate party post helper function because I don't want to call applyState for the party POST requests, I want to call applyPartyState instead
  async function party_post(partyId: string, path: string, body: unknown) {
    try {
      const res = await fetch(`/api/practice/${practiceCode}/party/${partyId}/${path}`, {
        method: "POST",
        headers: {"Content-Type" : "application/json"},
        body: JSON.stringify(body)
      })
      const data = await res.json()
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
    //Can't use party post helper function because I don't need a partyID to create a party
    try {
      const response = await fetch(`/api/practice/${practiceCode}/party/create`, {
        method: "POST",
        headers: {"Content-Type" : "application/json"},
        body: JSON.stringify({playerId: user.id})
      })
      const data = await response.json()
      applyPartyState(data)
    } catch (error) {
      window.alert("Error creating the party")
    }
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
    //Do not call POST request if user is not currently in a party to leave
    if (userCurrentPartyLobbyId === null) return;

    party_post(partyId, "leave", {playerId: user.id}) 
  }

  //Can't use party_post helper function because my dashboard state is changing since a queue chip is changing so I need to call applyState
  async function handleEnterQueueFromPartyLobby(partyId: string) {
    try {
      const response = await fetch(`/api/practice/${practiceCode}/party/${partyId}/enqueue`, {
        method: "POST",
        headers: {"Content-Type" : "application/json"},
        body: JSON.stringify({leaderId: user.id})
      })
      const data = await response.json()
      //Need to call setPartyLobbies to update state with 1 less party (just how the current system is working on the server, may change to make party lobby persist in the future)
      setPartyLobbies(data.partyState.parties)
      applyState(data)
    } catch (error) {
      window.alert("Error enqueueing party into queue chip")
    }
  }

  //---------Other Handlers-----------
  async function handleDeletePractice() {
    //If user does not confirm the end practice, return otherwise if the user confirms end practice continue function execution
    if (
      !window.confirm(
        "End this practice for everyone? This deletes the queue and can't be undone.",
      )
    )
      return;
    try {
      const res = await fetch(`/api/practice/${practiceCode}/delete`, {
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
    post("game/end", { queueChipId: courtId, courtNumber: courtNumber });
    
  }

  async function handleMakeAdmin(playerId : string) {
    post("player/appointadmin", {playerId: playerId})
  }

  function handleJoinQueueChip() {
    post("player/enqueue", {playerId: user.id})
  }

  function handleLeaveQueueChip() {
    post("queue/leave", {playerId: user.id})
    //This is when the user leaves the queue chip from the detailed view so need to escape from that detailed view page by setting this state to null
    setSelectedEntryId(null)
  }

  function handleLeaveQueue() {
    post("queue/leave", { playerId: user.id });
  }

  function handleJoinQueue() {
    //Get permission for notifications when user joins the queue, eventually need to make this more robust and get the notification permissions when user is put into a queue chip from a party too or when user clicks on a queue chip detailed view and manually joins the queue chip
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    post("player/enqueue", { playerId: user.id });
  }

  //Code for notifications, need to use useMemo, useEffect, and useRef in tandem to figure out when derived state updates and not send notification on reload
  //useMemo makes it so this code gets re-run when either courts state or user input changes
  const userCourt = useMemo(() => {
    //This code finds the court object that has the user on it
    return courts.find((c) => c.players.some((p) => p.id === user.id))
  }, [courts, user])

  //Get current court ID will be a string ID or null if the user is currently not on a court
  const currentCourtId = userCourt?._id ?? null
  //Initialize a useRef object with the value of that string court ID, so basically prevCourtId.current will be that string ID or null to start
  const prevCourtId = useRef(currentCourtId)

  //useEffect runs whenever currentCourtId or userCourt changes
  useEffect(() => {
    //If isInitialSyncDone is still null, then don't run the below code
    if (!isInitialSyncDone.current) {
      return
    }
    //If currentCourtId does not equal prevCourtId.current that means courts state has changed (or technically user has changed) and the useMemo function has re-run
    if (currentCourtId !== prevCourtId.current) {
      //If it did not change to null meaning the user got off the court, then it must mean the user has gotten on the court
      //Need to get the entire object and not just the ID in order to be able to reference the court number in the notification body
      if (userCourt) {
        new Notification("You're up!", {
        body: `Head over to Court ${userCourt.courtNumber} and have fun!`
      })
      }
    }
    //Update useRef current attribute so notification only triggers once
    prevCourtId.current = currentCourtId
  }, [currentCourtId, userCourt]);

  //Not sure if I need this since it is kind of repeat code but it just gets the court object of the court the user is on, or null if the user is not on any court, also note it is derived state
  const userOnCourt = courts.find((c) => c.players.some((p) => p.id === user.id)) ?? null;
  
  //Getting position of the queue chip user is in, need to add 1 to the index since it starts at 0 but I want to use real language which starts at 1
  //If user is not in a queue chip, then set this value to 0
  //Used for a status banner that only displays when userQueuePosition is greater than 0
  const userQueuePosition =
      userCurrentQueueChipId !== null
      ? queue.findIndex((e) => e._id === userCurrentQueueChipId) + 1
      : 0;
  //Amount of courts that have players
  const activeCourtsCount = courts.filter((c) => c.players.length > 0).length;

  // Court admin view
  //If in a selected court and user is an admin
  if (selectedCourtNumber !== null && isAdmin) {
    //Get the court object based on that selected court number
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
    //Get queue chip object from queue chip ID
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
            <div className="sm:flex items-center gap-1.5 px-3 py-1.5 bg-th-primary-light rounded-lg">
              <span className="hidden sm:flex text-xs font-medium text-th-primary-light">
                Practice
              </span>
              <span className="font-mono font-bold text-th-primary tracking-widest text-sm">
                {practiceCode}
              </span>
            </div>

            {isAdmin && (
              <span>
              <span className="hidden sm:inline text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                Admin
              </span>
              <span className="sm:hidden">🛡️</span>
              </span>
            )}

            {/* Skill circle + username on sm+, just skill circle on mobile */}
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border border-th">
              <span className="text-sm font-medium text-th-body">
                {user.username}
              </span>
            </div>

            {isAdmin && (
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
          (userCurrentQueueChipId !== null && userQueuePosition > 0)) && (
          <div
            className={`rounded-2xl p-4 flex items-center gap-3 ${
              userOnCourt !== null
                ? "bg-th-primary text-white"
                : "bg-yellow-50 border-2 border-yellow-300"
            }`}
          >
            <span className="text-2xl sm:text-3xl shrink-0">
              {userOnCourt !== null ? "🏓" : "⏳"}
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

        {/* Loading Spinner */}
        {loading ? 
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-gray-600">Loading...</span>
        </div> 
        : (
        <div>
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
              {userCurrentQueueChipId === null &&
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
                <div className="text-2xl mb-1">🙁</div>
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
                      userCurrentQueueChipId === null &&
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
                {userCurrentQueueChipId === null &&
                  userOnCourt === null &&
                  userCurrentPartyLobbyId === null && (
                    <button
                      onClick={handleJoinQueue}
                      className="bg-th-primary px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                    >
                      + Join Solo
                    </button>
                  )}
                {userCurrentQueueChipId !== null && (
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
                    isUser={entry._id === userCurrentQueueChipId}
                    onClick={() => setSelectedEntryId(entry._id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>)}
      </main>
    </div>
  );
}
