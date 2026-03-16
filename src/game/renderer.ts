import type { GameState } from "./types";
import { CELL_W, CELL_H, COLS, ROWS } from "./constants";
import { cellToPixel } from "./physics";

// ─── Canvas References ────────────────────────────────────────────────────────

let bgCanvas: HTMLCanvasElement;
let spriteCanvas: HTMLCanvasElement;
let debugCanvas: HTMLCanvasElement;
let bgCtx: CanvasRenderingContext2D;
let spriteCtx: CanvasRenderingContext2D;
let debugCtx: CanvasRenderingContext2D;

export function initRenderer(
  bg: HTMLCanvasElement,
  sprite: HTMLCanvasElement,
  dbg: HTMLCanvasElement,
): void {
  bgCanvas = bg;
  spriteCanvas = sprite;
  debugCanvas = dbg;

  const dpr = window.devicePixelRatio || 1;
  [bgCanvas, spriteCanvas, debugCanvas].forEach((c) => {
    c.width = 630 * dpr;
    c.height = 510 * dpr;
    (c.getContext("2d") as CanvasRenderingContext2D).scale(dpr, dpr);
  });

  bgCtx = bgCanvas.getContext("2d")!;
  spriteCtx = spriteCanvas.getContext("2d")!;
  debugCtx = debugCanvas.getContext("2d")!;
}

// ─── Background / Grid ────────────────────────────────────────────────────────

export function drawBackground(state: GameState): void {
  const ctx = bgCtx;
  const { map, grid } = state;
  ctx.clearRect(0, 0, 630, 510);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * CELL_W;
      const y = r * CELL_H;
      const tile = grid[r][c];

      if (tile === 1) {
        // Solid wall
        ctx.fillStyle = map.wallColor;
        ctx.fillRect(x, y, CELL_W, CELL_H);
        // Top highlight
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(x, y, CELL_W, 4);
        ctx.fillRect(x, y, 4, CELL_H);
      } else if (tile === 2) {
        // Destructible block
        ctx.fillStyle = map.blockColor;
        ctx.fillRect(x, y, CELL_W, CELL_H);
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
        // Cross pattern
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(x + CELL_W / 2 - 2, y + 4, 4, CELL_H - 8);
        ctx.fillRect(x + 4, y + CELL_H / 2 - 2, CELL_W - 8, 4);
      } else {
        // Floor
        const even = (r + c) % 2 === 0;
        ctx.fillStyle = even ? map.floorColor : shadeColor(map.floorColor, -20);
        ctx.fillRect(x, y, CELL_W, CELL_H);
      }
    }
  }

  // Draw explosions on bg layer
  for (const exp of state.explosions) {
    const alpha = Math.min(1, exp.timer / 0.5);
    const x = exp.col * CELL_W;
    const y = exp.row * CELL_H;
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(
      x + CELL_W / 2,
      y + CELL_H / 2,
      2,
      x + CELL_W / 2,
      y + CELL_H / 2,
      CELL_W / 2,
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.3, "#29b6f6");
    grad.addColorStop(1, "rgba(2,136,209,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, CELL_W, CELL_H);
    ctx.restore();
  }

  // Draw power-ups
  for (const pu of state.powerUps) {
    const { px, py } = cellToPixel(pu.row, pu.col);
    const emoji = powerUpEmoji(pu.kind as string);
    ctx.font = "22px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, px, py);
  }
}

// ─── Sprites (players + balloons) ─────────────────────────────────────────────

export function drawSprites(state: GameState, now: number): void {
  const ctx = spriteCtx;
  ctx.clearRect(0, 0, 630, 510);

  // Draw balloons
  for (const b of state.balloons) {
    const { px, py } = cellToPixel(b.row, b.col);
    const pulse = 1 + 0.06 * Math.sin(now * 8);
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(pulse, pulse);

    // Balloon body
    ctx.beginPath();
    ctx.ellipse(0, -4, 14, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = b.trapped ? "#ffd600" : "#0288d1";
    ctx.fill();
    ctx.strokeStyle = b.trapped ? "#e65100" : "#01579b";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Shine
    ctx.beginPath();
    ctx.ellipse(-4, -10, 4, 2.5, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();

    // Timer text
    const secs = b.trapped
      ? (b.trapTimer + b.timer).toFixed(1)
      : b.timer.toFixed(1);
    ctx.font = "bold 10px Nunito, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(secs, 0, 12);

    ctx.restore();
  }

  // Draw players
  for (const p of state.players) {
    if (!p.alive) continue;
    const flash = p.invincible && Math.floor(now * 8) % 2 === 0;
    if (flash) continue;

    ctx.save();
    ctx.translate(p.px, p.py);

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 14, 12, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.roundRect(-12, -14, 24, 28, 6);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Face
    ctx.beginPath();
    ctx.ellipse(0, -4, 9, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe0b2";
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.ellipse(-3, -6, 1.8, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(3, -6, 1.8, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.beginPath();
    ctx.arc(0, -3, 4, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Hat emoji
    ctx.font = "14px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(p.hat, 0, -14);

    // Player number
    ctx.font = "bold 8px Nunito, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.textBaseline = "bottom";
    ctx.fillText(`P${p.id + 1}`, 0, 14);

    ctx.restore();
  }
}

// ─── Debug overlay ────────────────────────────────────────────────────────────

export function drawDebug(state: GameState): void {
  const ctx = debugCtx;
  ctx.clearRect(0, 0, 630, 510);

  ctx.strokeStyle = "rgba(255,255,0,0.3)";
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL_H);
    ctx.lineTo(630, r * CELL_H);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL_W, 0);
    ctx.lineTo(c * CELL_W, 510);
    ctx.stroke();
  }

  // Player hitboxes
  for (const p of state.players) {
    if (!p.alive) continue;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(p.px - 12, p.py - 14, 24, 28);
    ctx.fillStyle = p.color;
    ctx.font = "9px monospace";
    ctx.fillText(`(${p.col},${p.row})`, p.px - 12, p.py - 16);
  }

  // Balloon hitboxes
  for (const b of state.balloons) {
    const { px, py } = cellToPixel(b.row, b.col);
    ctx.strokeStyle = "#ffd600";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px - 14, py - 18, 28, 32);
  }
}

// ─── Map preview (lobby thumbnails) ───────────────────────────────────────────

export function drawMapPreview(
  canvas: HTMLCanvasElement,
  map: {
    grid: number[][];
    wallColor: string;
    blockColor: string;
    floorColor: string;
  },
): void {
  const ctx = canvas.getContext("2d")!;
  const rows = map.grid.length;
  const cols = map.grid[0].length;
  const cw = canvas.width / cols;
  const ch = canvas.height / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = map.grid[r][c];
      ctx.fillStyle =
        t === 1 ? map.wallColor : t === 2 ? map.blockColor : map.floorColor;
      ctx.fillRect(c * cw, r * ch, cw, ch);
    }
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function shadeColor(hex: string, pct: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + pct));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + pct));
  const b = Math.min(255, Math.max(0, (num & 0xff) + pct));
  return `rgb(${r},${g},${b})`;
}

function powerUpEmoji(kind: string): string {
  switch (kind) {
    case "range":
      return "🔥";
    case "extra":
      return "🎈";
    case "speed":
      return "⚡";
    case "kick":
      return "👟";
    default:
      return "⭐";
  }
}
