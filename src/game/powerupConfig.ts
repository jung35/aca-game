/**
 * powerupConfig.ts – Tune powerup drop rates and weights here.
 *
 * `dropChance`  – probability (0–1) that a destroyed block drops ANYTHING.
 * `weights`     – relative weight for each kind; higher = more common.
 *                 They are normalised automatically, so only ratios matter.
 */

import type { PowerUpKind } from "./types";

export interface PowerUpConfig {
  /** Probability that a destroyed block drops any powerup at all (0–1). */
  dropChance: number;
  /** Relative weight for each powerup kind. Higher = more frequent. */
  weights: Record<PowerUpKind, number>;
}

export const POWERUP_CONFIG: PowerUpConfig = {
  dropChance: 0.2,
  weights: {
    range: 10,   // most common — fire range up
    extra: 7,   // extra balloon slot
    speed: 3,   // speed boost
    kick:  3,   // rarest — balloon kick
  },
};

/**
 * Pick a random PowerUpKind according to the configured weights,
 * using the provided seeded random function.
 */
export function pickPowerUpKind(rng: () => number): PowerUpKind {
  const { weights } = POWERUP_CONFIG;
  const entries = Object.entries(weights) as [PowerUpKind, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [kind, w] of entries) {
    roll -= w;
    if (roll <= 0) return kind;
  }
  return entries[entries.length - 1][0];
}
