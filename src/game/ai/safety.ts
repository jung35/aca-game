import type { GameState, Player } from "../types";
import { isWalkable } from "../physics/helpers";

/** True if the cell at (row, col) is not threatened by any active balloon blast. */
export function isSafe(state: GameState, row: number, col: number): boolean {
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

/**
 * BFS check: can the player reach a safe cell after a hypothetical bomb is
 * placed at (bombRow, bombCol)?
 */
export function canEscapeAfterBomb(
  state: GameState,
  player: Player,
  bombRow: number,
  bombCol: number,
): boolean {
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

  for (const b of state.balloons) addBombThreats(b.row, b.col, b.range);
  addBombThreats(bombRow, bombCol, player.balloonRange);

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
    if (!threatened.has(`${cr},${cc}`)) return true;

    for (const [dr, dc] of deltas) {
      const nr = cr + dr;
      const nc = cc + dc;
      const nk = `${nr},${nc}`;
      if (visited.has(nk)) continue;
      if (!isWalkable(state, nr, nc, player)) continue;
      visited.add(nk);
      queue.push([nr, nc]);
    }
  }
  return false;
}

/** Returns true if placing a balloon right now has a valid target and an escape route. */
export function shouldPlaceBalloon(state: GameState, player: Player): boolean {
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
  return canEscapeAfterBomb(state, player, row, col);
}
