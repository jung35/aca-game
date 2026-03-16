// ─── Core Types ───────────────────────────────────────────────────────────────

export type Direction = "up" | "down" | "left" | "right";

export interface Cell {
  row: number;
  col: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

// ─── Map / Tile ───────────────────────────────────────────────────────────────

export type TileType = 0 | 1 | 2; // 0 = floor, 1 = solid wall, 2 = destructible block

export interface MapDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  grid: TileType[][];
  floorColor: string;
  wallColor: string;
  blockColor: string;
  accentColor: string;
}

// ─── Player ───────────────────────────────────────────────────────────────────

export interface Player {
  id: number;
  row: number;
  col: number;
  /** pixel position (centre of player) */
  px: number;
  py: number;
  /** pixel velocity */
  vx: number;
  vy: number;
  color: string;
  hat: string;
  maxBalloons: number;
  balloonRange: number;
  speed: number; // pixels per second
  alive: boolean;
  isAI: boolean;
  score: number;
  /** balloons currently placed by this player */
  balloonCount: number;
  invincible: boolean;
  invincibleTimer: number;
  /** facing direction for rendering */
  moveDir: Direction | null;
}

// ─── Balloon ──────────────────────────────────────────────────────────────────

export interface Balloon {
  id: number;
  row: number;
  col: number;
  ownerId: number;
  timer: number; // seconds remaining
  range: number;
  trapped: boolean;
  trapTimer: number;
  el: HTMLElement | null;
}

// ─── Explosion / Splash ───────────────────────────────────────────────────────

export interface ExplosionCell {
  row: number;
  col: number;
  timer: number;
}

// ─── Power-up ─────────────────────────────────────────────────────────────────

export type PowerUpKind = "range" | "extra" | "speed" | "kick";

export interface PowerUp {
  id: number;
  row: number;
  col: number;
  kind: PowerUpKind;
  el: HTMLElement | null;
}

// ─── Network ──────────────────────────────────────────────────────────────────

/** Which player slot the local human controls (0 = P1 host, 1 = P2 guest). */
export type LocalPlayerIndex = 0 | 1;

// ─── Game State ───────────────────────────────────────────────────────────────

export interface GameState {
  map: MapDef;
  grid: TileType[][];
  players: Player[];
  balloons: Balloon[];
  explosions: ExplosionCell[];
  powerUps: PowerUp[];
  running: boolean;
  paused: boolean;
  gameOver: boolean;
  winner: number | null; // player id or null for draw
  nextBalloonId: number;
  nextPowerUpId: number;
  showDebug: boolean;
  /** seconds elapsed */
  elapsed: number;
}
