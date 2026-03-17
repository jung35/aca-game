/**
 * ai/index.ts — public API for the AI module.
 */

import type { GameState, Player, Direction } from "../types";
import { CELL_W, CELL_H, AI_THINK_INTERVAL } from "../constants";
import { setPlayerVelocity } from "../physics/movement";
import { chooseAction } from "./movement";
import type { AIData } from "./types";

// Per-player AI state, keyed by player id
const aiMap = new Map<number, AIData>();

export function initAI(state: GameState): void {
  aiMap.clear();
  for (const p of state.players) {
    if (p.isAI) {
      aiMap.set(p.id, {
        thinkTimer: 0,
        currentDir: null,
        lastDir: null,
        goal: "roam",
        path: [],
        lastRow: p.row,
        lastCol: p.col,
      });
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
    Math.abs(player.px - cellCentreX) < CELL_W * 0.25 &&
    Math.abs(player.py - cellCentreY) < CELL_H * 0.25;

  ai.thinkTimer -= dt;

  const movedToNewCell = player.row !== ai.lastRow || player.col !== ai.lastCol;

  if ((ai.thinkTimer <= 0 || movedToNewCell) && nearCentre) {
    ai.thinkTimer = AI_THINK_INTERVAL + Math.random() * 0.15;
    ai.lastRow = player.row;
    ai.lastCol = player.col;

    const decision = chooseAction(state, player, ai.lastDir);
    ai.goal = decision.goal;

    const willBomb = decision.placeBomb && player.balloonCount < player.maxBalloons;
    console.debug(
      `[AI p${player.id}] goal=%s dir=%s bomb=%s  pos=(${player.row},${player.col})  range=${player.balloonRange}  balloons=${player.balloonCount}/${player.maxBalloons}`,
      decision.goal,
      decision.dir ?? "none",
      willBomb ? "YES" : "no",
    );

    if (willBomb) {
      onPlaceBalloon(player);
    }

    if (decision.dir) {
      ai.lastDir = decision.dir;
      ai.currentDir = decision.dir;
      onMove(player, decision.dir);
    } else {
      // "wait" or no valid move — stop in place
      ai.currentDir = null;
      setPlayerVelocity(player, null);
    }
  }

  // Keep velocity applied continuously in the chosen direction
  if (ai.currentDir) {
    setPlayerVelocity(player, ai.currentDir);
  }
}
