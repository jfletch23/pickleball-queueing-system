export type SkillLevel = 1 | 2 | 3;

export const SKILL_LABELS: Record<SkillLevel, string> = {
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Advanced',
};

export interface Player {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  partyId?: string;
  isLeader?: boolean;
}

export interface Court {
  id: number;
  players: Player[];
  startTime: number | null;
}

export interface QueueEntry {
  id: string;
  players: Player[];
  joinedAt: number;
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

export interface UserState {
  id: string;
  username: string;
  password?: string;
  skillLevel: SkillLevel;
  isAdmin: boolean;
  sessionCode: string;
  numCourts?: number;
}

export type ThemeName = 'forest' | 'dark' | 'ocean' | 'sunset';

export interface ThemeInfo {
  name: string;
  description: string;
  swatches: string[];
}

export const THEMES: Record<ThemeName, ThemeInfo> = {
  forest: {
    name: 'Forest',
    description: 'Green, like the court',
    swatches: ['#15803d', '#16a34a', '#84cc16', '#f9fafb'],
  },
  dark: {
    name: 'Dark',
    description: 'For practices that run late',
    swatches: ['#111827', '#1f2937', '#22c55e', '#374151'],
  },
  ocean: {
    name: 'Ocean',
    description: 'Blue, kinda chill',
    swatches: ['#1e3a8a', '#2563eb', '#7dd3fc', '#eff6ff'],
  },
  sunset: {
    name: 'Sunset',
    description: 'Orange and warm',
    swatches: ['#9a3412', '#ea580c', '#fb923c', '#fff7ed'],
  },
};
