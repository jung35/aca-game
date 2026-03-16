import type { GameState, Player, Direction } from "./types";
import { AI_THINK_INTERVAL, AI_SAFE_MARGIN } from "./constants";
import { isWalkable, directionDelta, cellToPixel } from "./physics";

interface AIData {
  thinkTimer: number;
  pendingDir: Direction | null;
}

const aiMap = new Map<number, AIData>();

export function initAI(state: GameState): void {
  aiMap.clear();
  for (const p of state.players) {
    if (p.isAI) {
      aiMap.set(p.id, { thinkTimer: 0, pendingDir: null });
    }
  }
}

function isSafe(state: GameState, row: number, col: number): boolean {
  // Check if a cell is NOT in explosion radius of any balloon
  for (const b of state.balloons) {
    if (b.row === row && b.col === col) return false;
    const deltas: Array<[number, number]> = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of deltas) {
      for (let r = 1; r <= b.range; r++) {
        const nr = b.row + dr * r;
        const nc = b.col + dc * r;
        if (state.grid[nr]?.[nc] === 1) break;
        if (nr === row && nc === col) return false;
        if (state.grid[nr]?.[nc] === 2) break;
      }
    }
  }
  return true;
}

function shouldPlaceBalloon(state: GameState, player: Player): boolean {
  if (player.balloonCount >= player.maxBalloons) return false;
  const { row, col } = player;
  const dirs: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of dirs) {
    for (let r = 1; r <= player.balloonRange; r++) {
      const nr = row + dr * r;
      const nc = col + dc * r;
      if (state.grid[nr]?.[nc] === 1) break;
      if (state.grid[nr]?.[nc] === 2) return true;
      // Target alive enemy
      if (
        state.players.some(
          (p) => p.alive && p.id !== player.id && p.row === nr && p.col === nc,
        )
      )
        return true;
    }
  }
  return false;
}

function chooseDirection(state: GameState, player: Player): Direction | null {
  const dirs: Direction[] = ["up", "down", "left", "right"];
  // Prefer directions that lead to safe cells, away from danger
  const safe: Direction[] = [];
  const unsafe: Direction[] = [];

  for (const dir of dirs) {
    const [dr, dc] = directionDelta(dir);
    const nr = player.row + dr;
    const nc = player.col + dc;
    if (!isWalkable(state, nr, nc)) continue;
    if (isSafe(state, nr, nc)) safe.push(dir);
    else unsafe.push(dir);
  }

  if (!isSafe(state, player.row, player.col)) {
    // Escape: try safe dirs first
    const options = safe.length ? safe : unsafe;
    return options[Math.floor(Math.random() * options.length)] ?? null;
  }

  // Wander: prefer dirs that move toward enemies or blocks
  if (safe.length === 0) return null;
  return safe[Math.floor(Math.random() * safe.length)];
}

export function updateAI(
  state: GameState,
  player: Player,
  dt: number,
  onPlaceBalloon: (p: Player) => void,
  onMove: (p: Player, dir: Direction) => void,
): void {
  if (!player.alive || player.isAI === false) return;

  const ai = aiMap.get(player.id);
  if (!ai) return;

  ai.thinkTimer -= dt;
  if (ai.thinkTimer > 0) return;
  ai.thinkTimer = AI_THINK_INTERVAL + Math.random() * 0.2;

  // Only decide when centred in a cell
  const { px, py } = cellToPixel(player.row, player.col);
  const dx = Math.abs(player.px - px);
  const dy = Math.abs(player.py - py);
  if (dx > AI_SAFE_MARGIN * 10 || dy > AI_SAFE_MARGIN * 10) return;

  if (shouldPlaceBalloon(state, player)) {
    onPlaceBalloon(player);
  }

  const dir = chooseDirection(state, player);
  if (dir) {
    onMove(player, dir);
    ai.pendingDir = dir;
  }
}
