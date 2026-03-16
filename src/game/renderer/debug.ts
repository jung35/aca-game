import type { GameState } from "../types";
import { CELL_W, CELL_H, COLS, ROWS, ARENA_W, ARENA_H, PLAYER_HALF } from "../constants";
import { cellToPixel } from "../physics/helpers";

export function drawDebug(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  ctx.clearRect(0, 0, ARENA_W, ARENA_H);

  // Grid lines
  ctx.strokeStyle = "rgba(255,255,0,0.3)";
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL_H);
    ctx.lineTo(ARENA_W, r * CELL_H);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL_W, 0);
    ctx.lineTo(c * CELL_W, ARENA_H);
    ctx.stroke();
  }

  // Player hitboxes
  for (const p of state.players) {
    if (!p.alive) continue;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(p.px - PLAYER_HALF, p.py - PLAYER_HALF, PLAYER_HALF * 2, PLAYER_HALF * 2);
    ctx.fillStyle = p.color;
    ctx.font = "9px monospace";
    ctx.fillText(`(${p.col},${p.row})`, p.px - PLAYER_HALF, p.py - PLAYER_HALF - 2);
  }

  // Balloon hitboxes
  for (const b of state.balloons) {
    const { px, py } = cellToPixel(b.row, b.col);
    ctx.strokeStyle = "#ffd600";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px - 14, py - 18, 28, 32);
  }
}
