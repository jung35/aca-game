import type { GameState, Direction } from "../types";
import { COLS, ROWS, CELL_W, CELL_H, PLAYER_HALF } from "../constants";

export function cellToPixel(
  row: number,
  col: number,
): { px: number; py: number } {
  return {
    px: col * CELL_W + CELL_W / 2,
    py: row * CELL_H + CELL_H / 2,
  };
}

export function pixelToCell(
  px: number,
  py: number,
): { row: number; col: number } {
  return {
    col: Math.floor(px / CELL_W),
    row: Math.floor(py / CELL_H),
  };
}

/** True when tile at (row,col) blocks movement. */
export function isSolidTile(
  state: GameState,
  row: number,
  col: number,
): boolean {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return state.grid[row][col] !== 0;
}

/**
 * True when tile at (row,col) has a balloon that is solid to the given player.
 *
 * A balloon is passable as long as the player's AABB still physically overlaps
 * that balloon's cell — this covers the full time the player is on or straddling
 * the cell, not just when their logical row/col matches.  Once the player's body
 * no longer overlaps the balloon cell it becomes solid, preventing re-entry.
 */
export function hasBalloon(
  state: GameState,
  row: number,
  col: number,
  player: { id: number; row: number; col: number; px: number; py: number },
): boolean {
  return state.balloons.some((b) => {
    if (b.row !== row || b.col !== col) return false;

    // Trap-player balloons (a player is inside) are always passable to OTHER
    // players so they can walk into the cell to rescue or pop the balloon.
    const isPlayerTrap = state.players.some(
      p => p.trappedInBalloon && p.trapBalloonId === b.id,
    );
    if (isPlayerTrap) return false;

    // Balloon is passable while the player's AABB overlaps the balloon's cell.
    // Cell pixel bounds (exclusive):
    const cellLeft   = b.col * CELL_W;
    const cellRight  = cellLeft + CELL_W;
    const cellTop    = b.row * CELL_H;
    const cellBottom = cellTop + CELL_H;
    // Player AABB (using a slightly shrunk half to match movement inset)
    const h = PLAYER_HALF - 1;
    const playerLeft   = player.px - h;
    const playerRight  = player.px + h;
    const playerTop    = player.py - h;
    const playerBottom = player.py + h;
    const overlaps =
      playerRight  > cellLeft  &&
      playerLeft   < cellRight &&
      playerBottom > cellTop   &&
      playerTop    < cellBottom;
    if (overlaps) return false; // still on the cell → passable
    return true;
  });
}

/**
 * A cell is "walkable" for the given player if it has no solid tile and no
 * balloon that is currently solid to them (see hasBalloon).
 */
export function isWalkable(
  state: GameState,
  row: number,
  col: number,
  player?: { id: number; row: number; col: number; px: number; py: number },
): boolean {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
  if (state.grid[row][col] !== 0) return false;
  if (player) return !hasBalloon(state, row, col, player);
  // No player context — treat any balloon as blocking, EXCEPT trap-player balloons
  // (those should be walkable so AI pathfinding can route through them for rescue/kill)
  return !state.balloons.some(
    (b) =>
      b.row === row &&
      b.col === col &&
      !state.players.some(p => p.trappedInBalloon && p.trapBalloonId === b.id),
  );
}

export function directionDelta(dir: Direction): [number, number] {
  switch (dir) {
    case "up":
      return [-1, 0];
    case "down":
      return [1, 0];
    case "left":
      return [0, -1];
    case "right":
      return [0, 1];
  }
}
