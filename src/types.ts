export interface UserState {
  id: string;
  username: string;
  password: string;
  isAdmin: boolean;
}

export interface PracticeState {
  code: string;
  players: UserState[];
  admins: string[];
  numCourts: number;
}

//Come back to this, may need to make modifications (maybe remove rank key, add courtNum, and playingStartTime key??)
export interface QueueChip {
  id: string;
  practiceCode: string;
  players: UserState[];
  status: string;
  createdAt: Date;
  rank: number;
}

//Maybe no longer needed?
export interface Player {
  id: string;
  name: string;
  partyId?: string;
  isLeader?: boolean;
}

//Maybe no longer needed?
export interface Court {
  //Same id as queueChip id but is basically a specific type of queueChip with the status of playing
  _id: string;
  courtNumber: number;
  players: UserState[];
  //Date.now() returns a number
  playingStartTime: number;
}
export interface QueueEntry {
  id: string;
  players: Player[];
  joinedAt: number;
}
export interface DashboardState {
  queue: QueueChip[];
  courts: Court[];
}

export interface PartyLobby {
  id: string;
  players: Player[];
  createdAt: number;
}

export interface PartyJoinRequest {
  id: string;
  lobbyId: string;
  player: Player;
  requestedAt: number;
}

export type ThemeName = "forest" | "dark" | "ocean" | "sunset";

export interface ThemeInfo {
  name: string;
  description: string;
  swatches: string[];
}

export const THEMES: Record<ThemeName, ThemeInfo> = {
  forest: {
    name: "Forest",
    description: "Green, like the court",
    swatches: ["#15803d", "#16a34a", "#84cc16", "#f9fafb"],
  },
  dark: {
    name: "Dark",
    description: "For practices that run late",
    swatches: ["#111827", "#1f2937", "#22c55e", "#374151"],
  },
  ocean: {
    name: "Ocean",
    description: "Blue, kinda chill",
    swatches: ["#1e3a8a", "#2563eb", "#7dd3fc", "#eff6ff"],
  },
  sunset: {
    name: "Sunset",
    description: "Orange and warm",
    swatches: ["#9a3412", "#ea580c", "#fb923c", "#fff7ed"],
  },
};
