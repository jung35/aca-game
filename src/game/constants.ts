// ─── Layout Constants ─────────────────────────────────────────────────────────

export const COLS = 21;
export const ROWS = 17;
export const ARENA_W = 630;
export const ARENA_H = 510;
export const CELL_W = ARENA_W / COLS; // 30 px
export const CELL_H = ARENA_H / ROWS; // 30 px

// ─── Timing ───────────────────────────────────────────────────────────────────

export const BALLOON_FUSE = 3.0; // seconds until explosion
export const EXPLOSION_LINGER = 0.5; // seconds splash stays
export const TRAP_FUSE = 3.0; // extra seconds when trapped
export const INVINCIBLE_DURATION = 2; // seconds of invincibility after hit

// ─── Gameplay ─────────────────────────────────────────────────────────────────

export const DEFAULT_RANGE = 2;
export const DEFAULT_MAX_BALLOONS = 1;
export const DEFAULT_SPEED = 4.5; // cells per second (multiplied by CELL_W/H in physics)
export const PLAYER_HALF = 10; // collision half-size in pixels (slightly smaller than cell)

export const POWERUP_SPAWN_CHANCE = 0.45; // chance a destroyed block drops a powerup
export const POWERUP_KINDS = ["range", "extra", "speed", "kick"] as const;

// ─── AI ───────────────────────────────────────────────────────────────────────

export const AI_THINK_INTERVAL = 0.35; // seconds between AI decisions
export const AI_SAFE_MARGIN = 0.9; // how close to centre before deciding

// ─── Player palette ───────────────────────────────────────────────────────────

export const PLAYER_COLORS = [
  "#ef5350", // P1 red
  "#42a5f5", // P2 blue
  "#66bb6a", // P3 green
  "#ffa726", // P4 orange
  "#ab47bc", // P5 purple
  "#26c6da", // P6 cyan
  "#d4e157", // P7 lime
  "#ff7043", // P8 deep orange
];
export const PLAYER_HATS = ["🎩", "🪖", "👒", "⛑️", "🎓", "👑", "🪄", "🎭"];
