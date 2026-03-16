import type { GameState } from "../types";
import { CELL_W, CELL_H, COLS, ROWS, ARENA_W, ARENA_H } from "../constants";
import { cellToPixel } from "../physics/helpers";
import { shadeColor, powerUpEmoji } from "./utils";

// ── 2.5D block helpers ───────────────────────────────────────────────────────
// Each cell is CELL_W × CELL_H. The "3-D" illusion uses:
//   • a top face  (lighter shade, inset upward by TOP_H px)
//   • a right side face (darker shade, inset rightward by SIDE_W px)
// Both faces share the CELL_W × CELL_H footprint — only the shading differs.
const TOP_H  = 5; // height of the top face in px
const SIDE_W = 5; // width of the right-side face in px

function drawWallBlock(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  baseColor: string,
): void {
  const top   = shadeColor(baseColor,  55);
  const right = shadeColor(baseColor, -40);

  // Front face (full cell)
  ctx.fillStyle = baseColor;
  ctx.fillRect(x, y + TOP_H, CELL_W - SIDE_W, CELL_H - TOP_H);

  // Top face (parallelogram)
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(x,                y + TOP_H);
  ctx.lineTo(x + SIDE_W,       y);
  ctx.lineTo(x + CELL_W,       y);
  ctx.lineTo(x + CELL_W - SIDE_W, y + TOP_H);
  ctx.closePath();
  ctx.fill();

  // Right-side face (parallelogram)
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(x + CELL_W - SIDE_W, y + TOP_H);
  ctx.lineTo(x + CELL_W,           y);
  ctx.lineTo(x + CELL_W,           y + CELL_H - TOP_H);
  ctx.lineTo(x + CELL_W - SIDE_W, y + CELL_H);
  ctx.closePath();
  ctx.fill();

  // Thin outline to separate cells
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(x, y + TOP_H, CELL_W - SIDE_W, CELL_H - TOP_H);

  // Subtle brick rows on front face
  const midY = y + TOP_H + (CELL_H - TOP_H) / 2;
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x, midY);
  ctx.lineTo(x + CELL_W - SIDE_W, midY);
  ctx.stroke();
}

function drawCrateBlock(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  baseColor: string,
): void {
  const top   = shadeColor(baseColor,  60);
  const right = shadeColor(baseColor, -35);
  const border = shadeColor(baseColor, -50);

  // Front face
  ctx.fillStyle = baseColor;
  ctx.fillRect(x, y + TOP_H, CELL_W - SIDE_W, CELL_H - TOP_H);

  // Top face
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(x,                    y + TOP_H);
  ctx.lineTo(x + SIDE_W,           y);
  ctx.lineTo(x + CELL_W,           y);
  ctx.lineTo(x + CELL_W - SIDE_W, y + TOP_H);
  ctx.closePath();
  ctx.fill();

  // Right face
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(x + CELL_W - SIDE_W, y + TOP_H);
  ctx.lineTo(x + CELL_W,           y);
  ctx.lineTo(x + CELL_W,           y + CELL_H - TOP_H);
  ctx.lineTo(x + CELL_W - SIDE_W, y + CELL_H);
  ctx.closePath();
  ctx.fill();

  // Crate border/planks on front face
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 1, y + TOP_H + 1, CELL_W - SIDE_W - 2, CELL_H - TOP_H - 2);

  // X cross
  const fw = CELL_W - SIDE_W;
  const fh = CELL_H - TOP_H;
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 3, y + TOP_H + 3);
  ctx.lineTo(x + fw - 3, y + TOP_H + fh - 3);
  ctx.moveTo(x + fw - 3, y + TOP_H + 3);
  ctx.lineTo(x + 3, y + TOP_H + fh - 3);
  ctx.stroke();

  // Top face highlight stripes
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + 2,        y + TOP_H - 1);
  ctx.lineTo(x + SIDE_W + 2, y - 1);
  ctx.moveTo(x + CELL_W / 2 - 2, y + TOP_H - 1);
  ctx.lineTo(x + CELL_W / 2 + SIDE_W / 2, y - 1);
  ctx.stroke();
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  state: GameState,
): void {
  const { map, grid } = state;
  ctx.clearRect(0, 0, ARENA_W, ARENA_H);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * CELL_W;
      const y = r * CELL_H;
      const tile = grid[r][c];

      if (tile === 1) {
        drawWallBlock(ctx, x, y, map.wallColor);
      } else if (tile === 2) {
        drawCrateBlock(ctx, x, y, map.blockColor);
      } else {
        // Floor — checkerboard wood planks
        const even = (r + c) % 2 === 0;
        const base = even ? map.floorColor : shadeColor(map.floorColor, -12);
        ctx.fillStyle = base;
        ctx.fillRect(x, y, CELL_W, CELL_H);
        // Subtle plank grain
        ctx.strokeStyle = "rgba(0,0,0,0.06)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + CELL_H * 0.33);
        ctx.lineTo(x + CELL_W, y + CELL_H * 0.33);
        ctx.moveTo(x, y + CELL_H * 0.66);
        ctx.lineTo(x + CELL_W, y + CELL_H * 0.66);
        ctx.stroke();
        ctx.strokeStyle = "rgba(0,0,0,0.08)";
        ctx.strokeRect(x, y, CELL_W, CELL_H);
      }
    }
  }

  // Explosions — bright water-balloon splash
  for (const exp of state.explosions) {
    const alpha = Math.min(1, exp.timer / 0.5);
    const x = exp.col * CELL_W;
    const y = exp.row * CELL_H;
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(
      x + CELL_W / 2, y + CELL_H / 2, 1,
      x + CELL_W / 2, y + CELL_H / 2, CELL_W * 0.7,
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.25, "#80d8ff");
    grad.addColorStop(0.6, "#0288d1");
    grad.addColorStop(1, "rgba(2,136,209,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, CELL_W, CELL_H);
    // Splash droplets
    ctx.fillStyle = `rgba(129,212,250,${alpha * 0.8})`;
    const offsets = [[-7, -8], [8, -6], [-9, 6], [7, 9], [0, -11], [11, 0]];
    for (const [ox, oy] of offsets) {
      ctx.beginPath();
      ctx.arc(x + CELL_W / 2 + ox, y + CELL_H / 2 + oy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Power-ups — glowing item boxes
  for (const pu of state.powerUps) {
    const { px, py } = cellToPixel(pu.row, pu.col);
    // Glowing background
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(px - 12, py - 12, 24, 24, 5);
    ctx.fillStyle = "rgba(255,214,0,0.85)";
    ctx.fill();
    ctx.strokeStyle = "#ff9800";
    ctx.lineWidth = 2;
    ctx.stroke();
    // Shine
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(px - 10, py - 10, 20, 6);
    ctx.restore();
    // Emoji
    ctx.font = "16px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(powerUpEmoji(pu.kind), px, py + 1);
  }
}
