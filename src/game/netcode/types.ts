/**
 * netcode/types.ts – Shared types for the netcode module.
 */

export type NetRole = "host" | "guest" | "none";
export type NetStatus = "idle" | "connecting" | "connected" | "disconnected";

export type NetMessage =
  | { type: "input"; playerId: number; action: "move"; dir: string }
  | { type: "input"; playerId: number; action: "balloon" }
  | { type: "state_sync"; payload: StateSyncPayload }
  | { type: "start"; mapId: string; seed: number; playerIndex: number; playerCount?: number; playerConfigs?: Array<{ name: string; outfit: string; skinTone: string; team: number }> }
  | { type: "ping"; t: number }
  | { type: "pong"; t: number }
  | { type: "chat"; text: string }
  /** Guest → host: introduce yourself with name after receiving slot assignment. */
  | { type: "hello"; name: string; playerIndex: number; outfit: string; skinTone: string }
  /** Host → all guests: current lobby state (slots + selected map). */
  | { type: "lobby_state"; slots: LobbySlot[]; mapId: string }
  /** Host → one guest: you are being kicked. */
  | { type: "kick" }
  /** Host → all guests: host changed the map. */
  | { type: "map_change"; mapId: string };

export interface LobbySlot {
  index: number;
  name: string;
  kind: "host" | "human" | "ai" | "empty";
  team: number; // 0 = no team, 1-4 = team
}

export interface StateSyncPayload {
  seq: number;
  players: Array<{
    id: number;
    row: number;
    col: number;
    px: number;
    py: number;
    vx: number;
    vy: number;
    alive: boolean;
    score: number;
    invincible: boolean;
    moveDir: string | null;
    maxBalloons: number;
    balloonRange: number;
    speed: number;
    trappedInBalloon: boolean;
    trapBalloonId: number;
    trapCountdown: number;
  }>;
  balloons: Array<{
    id: number;
    row: number;
    col: number;
    ownerId: number;
    timer: number;
    range: number;
    trapped: boolean;
    trapTimer: number;
  }>;
  explosions: Array<{ row: number; col: number; timer: number }>;
  powerUps: Array<{ id: number; row: number; col: number; kind: string }>;
  /** Serialised blockPowerUps: [key, kind|null][] */
  blockPowerUps: Array<[string, string | null]>;
  grid: number[][];
  gameOver: boolean;
  winner: number | null;
  winnerTeam?: number | null;
  elapsed: number;
}

export interface NetCallbacks {
  /** Host: called whenever a guest connects. playerIndex is the slot (1-7). */
  onGuestJoined: (guestCount: number, playerIndex: number) => void;
  /** Guest: called once the host sends the slot-assignment handshake. */
  onConnectedToHost: (playerIndex: number) => void;
  onDisconnected: (playerIndex?: number) => void;
  onMessage: (msg: NetMessage, fromId?: string) => void;
  onStatusChange: (s: NetStatus) => void;
  onError: (msg: string) => void;
}
