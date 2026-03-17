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

  // Balloon blast radii
  for (const b of state.balloons) {
    const { px: bpx, py: bpy } = cellToPixel(b.row, b.col);

    // Centre cell
    ctx.fillStyle = "rgba(255, 80, 0, 0.35)";
    ctx.fillRect(b.col * CELL_W, b.row * CELL_H, CELL_W, CELL_H);

    // Four arms — stop at solid walls and destructible blocks (matching isSafe logic)
    const deltas: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of deltas) {
      for (let step = 1; step <= b.range; step++) {
        const nr = b.row + dr * step;
        const nc = b.col + dc * step;
        const tile = state.grid[nr]?.[nc];
        if (tile === 1) break; // solid wall — arm stops before this cell
        ctx.fillStyle = "rgba(255, 80, 0, 0.25)";
        ctx.fillRect(nc * CELL_W, nr * CELL_H, CELL_W, CELL_H);
        if (tile === 2) break; // destructible block — arm stops after highlighting it
      }
    }

    // Timer label
    ctx.fillStyle = "#ff5000";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${b.timer.toFixed(1)}s`, bpx, bpy + 4);
    ctx.textAlign = "left";
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
