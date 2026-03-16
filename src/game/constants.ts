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
export const TRAP_PLAYER_FUSE = 3.0; // seconds a player is trapped in a balloon before dying
export const INVINCIBLE_DURATION = 2; // seconds of invincibility after hit

// ─── Gameplay ─────────────────────────────────────────────────────────────────

export const DEFAULT_RANGE = 2;
export const DEFAULT_MAX_BALLOONS = 1;
export const DEFAULT_SPEED = 4.5; // cells per second (multiplied by CELL_W/H in physics)
export const PLAYER_HALF = 7; // collision half-size in pixels — matches the ~14px wide sprite

export const POWERUP_SPAWN_CHANCE = 0.45; // chance a destroyed block drops a powerup
export const POWERUP_KINDS = ["range", "extra", "speed", "kick"] as const;

// ─── AI ───────────────────────────────────────────────────────────────────────

export const AI_THINK_INTERVAL = 0.35; // seconds between AI decisions

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

// ─── Team system ──────────────────────────────────────────────────────────────

/** 0 = no team (free-for-all). Indices 1-4 correspond to TEAM_COLORS[0-3]. */
export const TEAM_COLORS = ["#ef5350", "#42a5f5", "#66bb6a", "#ffa726"] as const;
export const TEAM_NAMES  = ["Red", "Blue", "Green", "Orange"] as const;

// ─── Outfit styles ────────────────────────────────────────────────────────────
// Each outfit defines the BASE colours when no team is assigned.
// When a team is active, jacket + hat are overridden by the team palette below.

export interface OutfitStyle {
  key: string;
  label: string;
  emoji: string;
  /** Jacket/top color (overridden by team) */
  jacket: string;
  /** Pants/bottom color */
  pants: string;
  /** Hat color (overridden by team) */
  hat: string;
  /** Shoe color */
  shoes: string;
  /** Special hat shape: "beanie" | "pirate" | "cap" | "witch" | "crown" | "hood" */
  hatStyle: string;
  /** Optional cape/coat behind torso */
  cape?: string;
}

export const OUTFIT_STYLES: OutfitStyle[] = [
  { key: "classic",  label: "Classic",  emoji: "👕", jacket: "#1e88e5", pants: "#37474f", hat: "#c62828", shoes: "#333",    hatStyle: "beanie" },
  { key: "pirate",   label: "Pirate",   emoji: "🏴‍☠️", jacket: "#212121", pants: "#1a1a1a", hat: "#1a1a1a", shoes: "#2c1810", hatStyle: "pirate", cape: "#8d1515" },
  { key: "sport",    label: "Sport",    emoji: "⚽", jacket: "#ffffff", pants: "#1565c0", hat: "#0d47a1", shoes: "#222",    hatStyle: "cap" },
  { key: "witch",    label: "Witch",    emoji: "🧙", jacket: "#4a148c", pants: "#311b92", hat: "#1a0050", shoes: "#1a0050", hatStyle: "witch", cape: "#6a1b9a" },
  { key: "candy",    label: "Candy",    emoji: "🍬", jacket: "#f06292", pants: "#ce93d8", hat: "#e91e63", shoes: "#880e4f", hatStyle: "beanie" },
  { key: "crown",    label: "Royal",    emoji: "👑", jacket: "#f9a825", pants: "#e65100", hat: "#f9a825", shoes: "#bf360c", hatStyle: "crown" },
];

/** Team palette — jacket+hat colors per team index (0=no team, 1-4=teams). */
export const TEAM_OUTFIT: Record<number, { jacket: string; hat: string; pants: string }> = {
  0: { jacket: "#1e88e5", hat: "#c62828", pants: "#ef5350" }, // free-for-all (player-index driven)
  1: { jacket: "#ef5350", hat: "#b71c1c", pants: "#c62828" }, // Red
  2: { jacket: "#42a5f5", hat: "#0d47a1", pants: "#1565c0" }, // Blue
  3: { jacket: "#66bb6a", hat: "#1b5e20", pants: "#2e7d32" }, // Green
  4: { jacket: "#ffa726", hat: "#e65100", pants: "#bf360c" }, // Orange
};

// ─── Skin tones ───────────────────────────────────────────────────────────────

export const SKIN_TONES = [
  "#ffcc9a", // light
  "#f0a870", // medium-light
  "#c07840", // medium
  "#8b5e3c", // medium-dark
  "#5c3317", // dark
] as const;
