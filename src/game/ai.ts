import type { GameState, Player, Direction } from "./types";
import { AI_THINK_INTERVAL, CELL_W, CELL_H } from "./constants";
import { isWalkable, directionDelta, setPlayerVelocity } from "./physics";

interface AIData {
  thinkTimer: number;
  currentDir: Direction | null;
}

const aiMap = new Map<number, AIData>();

export function initAI(state: GameState): void {
  aiMap.clear();
  for (const p of state.players) {
    if (p.isAI) {
      aiMap.set(p.id, { thinkTimer: 0, currentDir: null });
    }
  }
}

function isSafe(state: GameState, row: number, col: number): boolean {
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

/** BFS to find if there is a reachable safe cell after a hypothetical balloon
 *  is placed at (bombRow, bombCol) with the given range. */
function canEscapeAfterBomb(
  state: GameState,
  player: Player,
  bombRow: number,
  bombCol: number,
): boolean {
  // Build the set of cells threatened by the new bomb (plus existing ones)
  const threatened = new Set<string>();

  const addBombThreats = (br: number, bc: number, range: number): void => {
    threatened.add(`${br},${bc}`);
    const deltas: Array<[number, number]> = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of deltas) {
      for (let r = 1; r <= range; r++) {
        const nr = br + dr * r;
        const nc = bc + dc * r;
        if (state.grid[nr]?.[nc] === 1) break;
        threatened.add(`${nr},${nc}`);
        if (state.grid[nr]?.[nc] === 2) break;
      }
    }
  };

  // Existing balloons
  for (const b of state.balloons) {
    addBombThreats(b.row, b.col, b.range);
  }
  // The hypothetical new bomb
  addBombThreats(bombRow, bombCol, player.balloonRange);

  // BFS from player's current cell — find any reachable safe cell
  const startKey = `${player.row},${player.col}`;
  const visited = new Set<string>([startKey]);
  const queue: Array<[number, number]> = [[player.row, player.col]];
  const deltas: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  while (queue.length > 0) {
    const [cr, cc] = queue.shift()!;
    const key = `${cr},${cc}`;
    if (!threatened.has(key)) return true; // found a safe cell

    for (const [dr, dc] of deltas) {
      const nr = cr + dr;
      const nc = cc + dc;
      const nk = `${nr},${nc}`;
      if (visited.has(nk)) continue;
      if (!isWalkable(state, nr, nc)) continue;
      // Allow passing through the new bomb cell (player hasn't moved yet)
      visited.add(nk);
      queue.push([nr, nc]);
    }
  }
  return false;
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
  let hasTarget = false;
  for (const [dr, dc] of dirs) {
    for (let r = 1; r <= player.balloonRange; r++) {
      const nr = row + dr * r;
      const nc = col + dc * r;
      if (state.grid[nr]?.[nc] === 1) break;
      if (state.grid[nr]?.[nc] === 2) {
        hasTarget = true;
        break;
      }
      if (
        state.players.some(
          (p) => p.alive && p.id !== player.id && p.row === nr && p.col === nc,
        )
      ) {
        hasTarget = true;
        break;
      }
    }
    if (hasTarget) break;
  }
  if (!hasTarget) return false;
  // Only place if we can actually escape afterwards
  return canEscapeAfterBomb(state, player, row, col);
}

function chooseDirection(state: GameState, player: Player): Direction | null {
  const dirs: Direction[] = ["up", "down", "left", "right"];
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
    const options = safe.length ? safe : unsafe;
    return options[Math.floor(Math.random() * options.length)] ?? null;
  }
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
  if (!player.alive || !player.isAI) return;

  const ai = aiMap.get(player.id);
  if (!ai) return;

  // The AI snaps its decision to cell centres, but now we check pixel proximity.
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
