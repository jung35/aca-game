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

export type TileType = 0 | 1 | 2 | 3; // 0 = floor, 1 = solid wall, 2 = destructible block, 3 = spawn point (treated as floor at runtime)

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
  /** last non-null direction, for idle facing */
  lastDir: Direction;
  /** 0 = no team, 1-4 = team index */
  team: number;
  /** Chosen outfit style key, e.g. "classic", "ninja", "sport" */
  outfit: string;
  /** Skin tone hex */
  skinTone: string;
  /** Display name */
  name: string;
  /** Walk animation frame accumulator (seconds) */
  walkTime: number;
  /** True when the player is trapped inside a water balloon */
  trappedInBalloon: boolean;
  /** Id of the balloon trapping this player, or -1 */
  trapBalloonId: number;
  /** Countdown until the trapping balloon auto-explodes and kills the player */
  trapCountdown: number;
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
  winnerTeam: number | null; // winning team index, or null
  nextBalloonId: number;
  nextPowerUpId: number;
  showDebug: boolean;
  /** seconds elapsed */
  elapsed: number;
}
