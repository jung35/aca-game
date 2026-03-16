/**
 * ai/index.ts — public API for the AI module.
 */

import type { GameState, Player, Direction } from "../types";
import { CELL_W, CELL_H, AI_THINK_INTERVAL } from "../constants";
import { setPlayerVelocity } from "../physics/movement";
import { shouldPlaceBalloon } from "./safety";
import { chooseDirection } from "./movement";
import type { AIData } from "./types";

// Per-player AI state, keyed by player id
const aiMap = new Map<number, AIData>();

export function initAI(state: GameState): void {
  aiMap.clear();
  for (const p of state.players) {
    if (p.isAI) {
      aiMap.set(p.id, { thinkTimer: 0, currentDir: null });
    }
  }
}

export function updateAI(
  state: GameState,
  player: Player,
  dt: number,
  onPlaceBalloon: (p: Player) => void,
  onMove: (p: Player, dir: Direction) => void,
): void {
  if (!player.alive || !player.isAI) return;

  const ai = aiMap.get(player.id);
  if (!ai) return;

  const cellCentreX = player.col * CELL_W + CELL_W / 2;
  const cellCentreY = player.row * CELL_H + CELL_H / 2;
  const nearCentre =
    Math.abs(player.px - cellCentreX) < CELL_W * 0.35 &&
    Math.abs(player.py - cellCentreY) < CELL_H * 0.35;

  ai.thinkTimer -= dt;

  if (ai.thinkTimer <= 0 && nearCentre) {
    ai.thinkTimer = AI_THINK_INTERVAL + Math.random() * 0.2;

    if (shouldPlaceBalloon(state, player)) {
      onPlaceBalloon(player);
    }

    const dir = chooseDirection(state, player);
    ai.currentDir = dir;
    if (dir) onMove(player, dir);
  }

  // Keep velocity applied continuously in the chosen direction
  if (ai.currentDir) {
    setPlayerVelocity(player, ai.currentDir);
  }
}
