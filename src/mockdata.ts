import {
  type Court,
  type QueueEntry,
} from './types.ts';


// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const INIT_NOW = Date.now();

function buildInitialCourts(): Court[] {
  return [
    {
      id: 1,
      startTime: INIT_NOW - (8 * 60 + 32) * 1000,
      players: [
        { id: 'p1', name: 'John', skillLevel: 2 },
        { id: 'p2', name: 'Sarah', skillLevel: 2 },
        { id: 'p3', name: 'Mike', skillLevel: 3 },
        { id: 'p4', name: 'Lisa', skillLevel: 1 },
      ],
    },
    {
      id: 2,
      startTime: INIT_NOW - (12 * 60 + 14) * 1000,
      players: [
        { id: 'p5', name: 'Chris', skillLevel: 3 },
        { id: 'p6', name: 'Emma', skillLevel: 3 },
        { id: 'p7', name: 'James', skillLevel: 2 },
        { id: 'p8', name: 'Anna', skillLevel: 3 },
      ],
    },
    {
      id: 3,
      startTime: INIT_NOW - (3 * 60 + 45) * 1000,
      players: [
        { id: 'p9', name: 'Tom', skillLevel: 1 },
        { id: 'p10', name: 'Kate', skillLevel: 1 },
        { id: 'p11', name: 'Bob', skillLevel: 1 },
        { id: 'p12', name: 'Rachel', skillLevel: 2 },
      ],
    },
    { id: 4, startTime: null, players: [] },
  ];
}

function buildInitialQueue(): QueueEntry[] {
  return [
    {
      id: 'q1',
      players: [
        { id: 'p13', name: 'David', skillLevel: 2, partyId: 'party1', isLeader: true },
        { id: 'p14', name: 'Maya', skillLevel: 2, partyId: 'party1' },
      ],
      joinedAt: INIT_NOW - 5 * 60 * 1000,
    },
    {
      id: 'q2',
      players: [{ id: 'p15', name: 'Kevin', skillLevel: 3 }],
      joinedAt: INIT_NOW - 4 * 60 * 1000,
    },
    {
      id: 'q3',
      players: [
        { id: 'p16', name: 'Amy', skillLevel: 1, partyId: 'party2', isLeader: true },
        { id: 'p17', name: 'Tyler', skillLevel: 1, partyId: 'party2' },
      ],
      joinedAt: INIT_NOW - 3 * 60 * 1000,
    },
    {
      id: 'q4',
      players: [{ id: 'p18', name: 'Sam', skillLevel: 2 }],
      joinedAt: INIT_NOW - 2 * 60 * 1000,
    },
    {
      id: 'q5',
      players: [
        { id: 'p19', name: 'Zoe', skillLevel: 2, partyId: 'party3', isLeader: true },
        { id: 'p20', name: 'Luke', skillLevel: 2, partyId: 'party3' },
      ],
      joinedAt: INIT_NOW - 60 * 1000,
    },
  ];
}