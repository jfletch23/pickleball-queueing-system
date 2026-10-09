// Party lobby row
import { type PartyLobby, type PartyJoinRequest } from "../types";


export function PartyLobbyRow({
  lobby,
  isUserLobby,
  isPartyLeader,
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
  isPartyLeader: boolean;
  canJoin: boolean;
  hasPendingRequest: boolean;
  pendingRequests: PartyJoinRequest[];
  onRequestJoin: () => void;
  onCancelRequest: () => void;
  onEnterQueue: (lobbyid: string) => void;
  onLeave: (lobbyid : string) => void;
  onApprove: (partyId: string, requesteeId: string) => void;
  onDeny: (partyId: string, requesteeId: string) => void;
}) {
  const spotsLeft = 4 - lobby.players.length;
  const isFull = spotsLeft === 0;

  const actions = isUserLobby ? (
  <div className="flex gap-1.5 shrink-0 items-center">
    {/* Only shown if user is in the lobby AND is the party leader */}
    {isPartyLeader && (
      <button
        onClick={() => onEnterQueue(lobby._id)}
        className="bg-th-primary px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer transition-all duration-200 hover:bg-th-primary/5 hover:-translate-y-0.5 hover:shadow-sm"
      >
        Enter Queue →
      </button>
    )}

    {/* Shown for any user in the lobby regardless of leadership */}
    <button
      onClick={() => onLeave(lobby._id)}
      className="px-2.5 py-2 rounded-xl text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors cursor-pointer transition-all duration-200 hover:bg-th-primary/5 hover:-translate-y-0.5 hover:shadow-sm"
    >
      Leave
    </button>
  </div>
) : hasPendingRequest ? (
  <button
    onClick={onCancelRequest}
    className="px-3 py-2 rounded-xl text-xs font-semibold text-th-muted border border-th hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
  >
    Pending…
  </button>
) : canJoin && !isFull ? (
  <button
    onClick={onRequestJoin}
    className="bg-th-primary px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
              className="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-sm font-bold text-white bg-th-primary"
            >
              {p.username.charAt(0)}
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
              {lobby.players[0]?.username ?? 'Unknown'}'s Party
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
              {p.username}
            </span>
          ))}
        </div>
        <div className="sm:hidden shrink-0">{actions}</div>
      </div>

      {/* Pending join requests, visible to the party owner only */}
      {isUserLobby && pendingRequests.length > 0 && (
        <div className="mt-3 pt-3 border-t border-th space-y-2">
          <div className="text-xs font-bold text-th-heading">
            {pendingRequests.length} join request{pendingRequests.length !== 1 ? 's' : ''}
          </div>
          {pendingRequests.map((req) => (
            <div key={req.id} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white bg-th-primary shrink-0"
              >
                {req.username.charAt(0)}
              </div>
              <span className="text-sm font-medium text-th-body flex-1 truncate">
                {req.username}
              </span>
              <button
                onClick={() => onApprove(lobby._id, req.id)}
                className="text-xs font-bold text-green-700 bg-green-100 hover:bg-green-200 px-2.5 py-1 rounded-full transition-colors"
              >
                ✓
              </button>
              <button
                onClick={() => onDeny(lobby._id, req.id)}
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