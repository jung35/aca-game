/**
 * powerupSvg.ts
 *
 * Renders each powerup kind into an OffscreenCanvas using direct 2D canvas
 * calls (same approach as characterSvg.ts — synchronous, no image loading).
 *
 * Canvas size: 20×20 px at 4× oversample → 80×80 internal.
 * Centre of icon sits at (OC_SIZE/2, OC_SIZE/2).
 * Draw with: ctx.drawImage(canvas, cx - 10, cy - 10, 20, 20)
 */

import type { PowerUpKind } from "../types";

const OC_SIZE  = 20;
const OC_SCALE = 4;
const OC_PX    = OC_SIZE * OC_SCALE; // 80

function makeOC(): OffscreenCanvas {
  return new OffscreenCanvas(OC_PX, OC_PX);
}

function gc(oc: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const ctx = oc.getContext("2d")!;
  // Scale up and translate so (0,0) = icon centre at logical coords
  ctx.scale(OC_SCALE, OC_SCALE);
  ctx.translate(OC_SIZE / 2, OC_SIZE / 2);
  return ctx;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 0xff) + 255 * amt);
  const g = clamp(((n >> 8)  & 0xff) + 255 * amt);
  const b = clamp((n & 0xff)          + 255 * amt);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
const darken = (hex: string, amt: number) => lighten(hex, -amt);

/** Soft drop-shadow underneath any icon. */
function drawDropShadow(ctx: OffscreenCanvasRenderingContext2D): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0.5, 8, 6, 1.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fill();
  ctx.restore();
}

// ─── Range (fire flame) ───────────────────────────────────────────────────────

function drawRange(ctx: OffscreenCanvasRenderingContext2D): void {
  drawDropShadow(ctx);

  // Outer flame — orange/red
  const og = ctx.createRadialGradient(0, 2, 0, 0, -1, 9);
  og.addColorStop(0,   "#fff176");
  og.addColorStop(0.3, "#ff9800");
  og.addColorStop(1,   "#b71c1c");

  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.bezierCurveTo( 5, -6,  7,  0,  4,  5);
  ctx.bezierCurveTo( 7,  3,  6, -2,  3, -4);
  ctx.bezierCurveTo( 5,  0,  2,  5,  0,  7);
  ctx.bezierCurveTo(-2,  5, -5,  0, -3, -4);
  ctx.bezierCurveTo(-6, -2, -7,  3, -4,  5);
  ctx.bezierCurveTo(-7,  0, -5, -6,  0, -9);
  ctx.closePath();
  ctx.fillStyle = og;
  ctx.fill();

  // Inner hot core — yellow-white
  const ig = ctx.createRadialGradient(0, 3, 0, 0, 2, 4);
  ig.addColorStop(0,   "#fffde7");
  ig.addColorStop(0.6, "#ffee58");
  ig.addColorStop(1,   "rgba(255,235,59,0)");

  ctx.beginPath();
  ctx.moveTo(0,  2);
  ctx.bezierCurveTo( 2, -1,  3,  2,  1,  5);
  ctx.bezierCurveTo( 0,  6, -1,  6, -1,  5);
  ctx.bezierCurveTo(-3,  2, -2, -1,  0,  2);
  ctx.closePath();
  ctx.fillStyle = ig;
  ctx.fill();
}

// ─── Extra balloon (balloon) ──────────────────────────────────────────────────

function drawExtra(ctx: OffscreenCanvasRenderingContext2D): void {
  drawDropShadow(ctx);

  const body = "#e91e63";
  const shine = "#f8bbd0";
  const shadow = "#880e4f";

  // Balloon body
  const bg = ctx.createRadialGradient(-3, -6, 1, 0, -2, 8);
  bg.addColorStop(0,   shine);
  bg.addColorStop(0.4, body);
  bg.addColorStop(1,   shadow);
  ctx.beginPath();
  ctx.ellipse(0, -2, 6.5, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = shadow;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Shine blob
  ctx.beginPath();
  ctx.ellipse(-2, -7, 2, 1.2, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fill();

  // Knot
  ctx.beginPath();
  ctx.ellipse(0, 6.5, 1.2, 1, 0, 0, Math.PI * 2);
  ctx.fillStyle = shadow;
  ctx.fill();

  // String
  ctx.beginPath();
  ctx.moveTo(0, 7.5);
  ctx.bezierCurveTo(2, 10, -1, 12, 1, 14);
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Highlight "+" to indicate extra
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, -1);
  ctx.moveTo(-2, -3); ctx.lineTo(2, -3);
  ctx.stroke();
}

// ─── Speed (lightning bolt) ───────────────────────────────────────────────────

function drawSpeed(ctx: OffscreenCanvasRenderingContext2D): void {
  drawDropShadow(ctx);

  const boltColor = "#ffd600";
  const boltDark  = "#f57f17";

  // Glow halo
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 9);
  glow.addColorStop(0,   "rgba(255,235,59,0.55)");
  glow.addColorStop(0.6, "rgba(255,193,7,0.18)");
  glow.addColorStop(1,   "rgba(255,193,7,0)");
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // Bolt shape
  ctx.beginPath();
  ctx.moveTo( 2,  -9);   // top-right tip
  ctx.lineTo(-1,  -1);   // mid-left indent
  ctx.lineTo( 2,  -1);   // mid-right bulge
  ctx.lineTo(-2,   9);   // bottom-left tip
  ctx.lineTo( 1,   1);   // mid-right indent
  ctx.lineTo(-2,   1);   // mid-left bulge
  ctx.closePath();

  const lg = ctx.createLinearGradient(0, -9, 0, 9);
  lg.addColorStop(0,   lighten(boltColor, 0.25));
  lg.addColorStop(0.5, boltColor);
  lg.addColorStop(1,   boltDark);
  ctx.fillStyle = lg;
  ctx.fill();
  ctx.strokeStyle = boltDark;
  ctx.lineWidth = 0.6;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Bright inner highlight
  ctx.beginPath();
  ctx.moveTo(1.5, -8);
  ctx.lineTo(-0.5, -2);
  ctx.lineTo(1.5, -2);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

// ─── Kick (boot) ─────────────────────────────────────────────────────────────

function drawKick(ctx: OffscreenCanvasRenderingContext2D): void {
  drawDropShadow(ctx);

  const shoeBody  = "#1565c0"; // dark blue boot
  const shoeLight = "#42a5f5";
  const shoeDark  = "#0d47a1";
  const sole      = "#263238";

  // Leg / shin
  ctx.beginPath();
  ctx.roundRect(-3.5, -9, 7, 9, 1.5);
  ctx.fillStyle = shoeLight;
  ctx.fill();
  ctx.strokeStyle = darken(shoeLight, 0.25);
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // Boot body
  const bootG = ctx.createLinearGradient(-6, -1, 7, 5);
  bootG.addColorStop(0, shoeLight);
  bootG.addColorStop(0.4, shoeBody);
  bootG.addColorStop(1, shoeDark);
  ctx.beginPath();
  ctx.moveTo(-3.5, 0);
  ctx.lineTo(-3.5, 3);
  ctx.bezierCurveTo(-3.5, 6, -4, 7, -4, 7);
  ctx.lineTo(7, 7);
  ctx.bezierCurveTo(8, 7, 8, 4, 7, 3);
  ctx.lineTo(3.5, 0);
  ctx.closePath();
  ctx.fillStyle = bootG;
  ctx.fill();
  ctx.strokeStyle = shoeDark;
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // Sole
  ctx.beginPath();
  ctx.roundRect(-4.5, 7, 12, 2.5, 1);
  ctx.fillStyle = sole;
  ctx.fill();

  // Lace highlight
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 0.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-1, 2); ctx.lineTo(5, 2);
  ctx.moveTo(0, 4.5); ctx.lineTo(4.5, 4.5);
  ctx.stroke();

  // Motion lines (kick energy)
  ctx.strokeStyle = "#ffd600";
  ctx.lineWidth = 1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(8, -4); ctx.lineTo(10, -5);
  ctx.moveTo(8,  0); ctx.lineTo(11,  0);
  ctx.moveTo(8,  4); ctx.lineTo(10,  5);
  ctx.stroke();
}

// ─── Cache & lookup ───────────────────────────────────────────────────────────

type DrawFn = (ctx: OffscreenCanvasRenderingContext2D) => void;

const DRAW_FNS: Record<PowerUpKind, DrawFn> = {
  range: drawRange,
  extra: drawExtra,
  speed: drawSpeed,
  kick:  drawKick,
};

const _cache = new Map<PowerUpKind, OffscreenCanvas>();

export function getPowerUpCanvas(kind: PowerUpKind): OffscreenCanvas {
  let oc = _cache.get(kind);
  if (oc) return oc;

  oc = makeOC();
  const ctx = gc(oc);
  DRAW_FNS[kind](ctx);
  _cache.set(kind, oc);
  return oc;
}

/** Call on game restart if needed (currently icons are static, so optional). */
export function clearPowerUpCache(): void {
  _cache.clear();
}
