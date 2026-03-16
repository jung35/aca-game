import type { GameState, Player, Direction } from "../types";
import { COLS, ROWS, CELL_W, CELL_H, PLAYER_HALF } from "../constants";
import { isSolidTile, hasBalloon } from "./helpers";

/**
 * Set the player's velocity based on a held direction.
 * Pass null to stop.
 */
export function setPlayerVelocity(player: Player, dir: Direction | null): void {
  if (player.trappedInBalloon) return; // cannot move while trapped
  const spd = player.speed * CELL_W;
  if (!dir) {
    player.vx = 0;
    player.vy = 0;
    player.moveDir = null;
    return;
  }
  player.moveDir = dir;
  player.lastDir = dir;
  switch (dir) {
    case "up":
      player.vx = 0;
      player.vy = -spd;
      break;
    case "down":
      player.vx = 0;
      player.vy = spd;
      break;
    case "left":
      player.vx = -spd;
      player.vy = 0;
      break;
    case "right":
      player.vx = spd;
      player.vy = 0;
      break;
  }
}

/**
 * Integrate player position with AABB sliding collision.
 * Walls, solid blocks, and enemy balloons are solid; own balloon cell is passable.
 */
export function updateMovement(
  state: GameState,
  player: Player,
  dt: number,
): void {
  if (!player.alive) return;
  if (player.trappedInBalloon) return; // frozen while trapped

  let nx = player.px + player.vx * dt;
  let ny = player.py + player.vy * dt;
  const h = PLAYER_HALF;

  // ── Resolve X axis ───────────────────────────────────────────────────────
  if (player.vx !== 0) {
    // Use current py (pre-move Y) with a 1px inset to avoid false corner hits
    const topRow    = Math.floor((player.py - h + 1) / CELL_H);
    const bottomRow = Math.floor((player.py + h - 1) / CELL_H);
    const testRows  = [topRow, bottomRow];

    if (player.vx > 0) {
      const rightCol = Math.floor((nx + h) / CELL_W);
      if (
        testRows.some(
          (r) =>
            isSolidTile(state, r, rightCol) ||
            hasBalloon(state, r, rightCol, player),
        )
      ) {
        nx = rightCol * CELL_W - h - 0.01;
        player.vx = 0;
      }
    } else {
      const leftCol = Math.floor((nx - h) / CELL_W);
      if (
        testRows.some(
          (r) =>
            isSolidTile(state, r, leftCol) ||
            hasBalloon(state, r, leftCol, player),
        )
      ) {
        nx = (leftCol + 1) * CELL_W + h + 0.01;
        player.vx = 0;
      }
    }
  }

  // ── Resolve Y axis ───────────────────────────────────────────────────────
  if (player.vy !== 0) {
    // Use resolved nx (post-X) with a 1px inset to avoid false corner hits
    const leftCol  = Math.floor((nx - h + 1) / CELL_W);
    const rightCol = Math.floor((nx + h - 1) / CELL_W);
    const testCols = [leftCol, rightCol];

    if (player.vy > 0) {
      const bottomRow = Math.floor((ny + h) / CELL_H);
      if (
        testCols.some(
          (c) =>
            isSolidTile(state, bottomRow, c) ||
            hasBalloon(state, bottomRow, c, player),
        )
      ) {
        ny = bottomRow * CELL_H - h - 0.01;
        player.vy = 0;
      }
    } else {
      const topRow = Math.floor((ny - h) / CELL_H);
      if (
        testCols.some(
          (c) =>
            isSolidTile(state, topRow, c) ||
            hasBalloon(state, topRow, c, player),
        )
      ) {
        ny = (topRow + 1) * CELL_H + h + 0.01;
        player.vy = 0;
      }
    }
  }

  // Clamp to arena bounds
  nx = Math.max(h, Math.min(COLS * CELL_W - h, nx));
  ny = Math.max(h, Math.min(ROWS * CELL_H - h, ny));

  player.px = nx;
  player.py = ny;
  player.row = Math.floor(ny / CELL_H);
  player.col = Math.floor(nx / CELL_W);

  // Advance walk animation timer when moving
  const isMoving = player.vx !== 0 || player.vy !== 0;
  if (isMoving) {
    player.walkTime += dt;
  } else {
    player.walkTime = 0;
  }
}
