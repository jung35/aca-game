/**
 * balloonSvg.ts
 *
 * Renders water-balloon sprites into OffscreenCanvas objects using direct
 * 2D canvas calls — same pattern as characterSvg.ts and powerupSvg.ts.
 *
 * Logical canvas: 22 × 30 px, 4× oversampled internally (88 × 120 px).
 * Origin is the balloon's knot centre at logical (11, 22).
 * Draw with:
 *   ctx.drawImage(oc, px - 11, py - 22, 22, 30)
 *
 * The balloon body occupies roughly y = -22..+6 (knot), string to y = +8.
 */

export interface BalloonColors {
  body:   string;
  shadow: string;
  shine:  string;
}

// ── Canvas constants ───────────────────────────────────────────────────────────

const OC_W     = 22;   // logical width
const OC_H     = 30;   // logical height
const OC_OX    = 11;   // knot x  (horizontal centre)
const OC_OY    = 22;   // knot y  (3/4 down the canvas)
const OC_SCALE = 4;

function makeOC(): OffscreenCanvas {
  return new OffscreenCanvas(OC_W * OC_SCALE, OC_H * OC_SCALE);
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 0xff) + 255 * amt);
  const g = clamp(((n >> 8)  & 0xff) + 255 * amt);
  const b = clamp((n & 0xff)          + 255 * amt);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ── Renderer ──────────────────────────────────────────────────────────────────

function renderBalloon(
  ctx: OffscreenCanvasRenderingContext2D,
  col: BalloonColors,
): void {
  // All coordinates are relative to the knot centre (0, 0) in logical space.
  // Body sits from y=-20 (top) to y=0 (knot), rx≈9, ry≈11.
  const bx = 0;   // body centre x
  const by = -11; // body centre y (mid of the balloon oval)
  const rx = 9;   // half-width
  const ry = 11;  // half-height

  // ── Drop shadow ────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.ellipse(bx + 1, 3, rx * 0.8, 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fill();

  // ── Body ───────────────────────────────────────────────────────────────────
  const bodyGrad = ctx.createRadialGradient(bx - 3, by - 6, 1, bx, by, rx * 1.3);
  bodyGrad.addColorStop(0,    col.shine);
  bodyGrad.addColorStop(0.38, col.body);
  bodyGrad.addColorStop(1,    col.shadow);

  ctx.beginPath();
  ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = col.shadow;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // ── Water ripple — subtle horizontal wave inside the body ─────────────────
  // Two faint arcs suggesting the water sloshing inside
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  ctx.strokeStyle = lighten(col.body, 0.18);
  ctx.lineWidth = 0.7;
  ctx.globalAlpha = 0.55;

  // Upper wave
  ctx.beginPath();
  ctx.moveTo(bx - rx + 1, by - 2);
  ctx.bezierCurveTo(bx - rx / 2, by - 5, bx + rx / 2, by + 1, bx + rx - 1, by - 2);
  ctx.stroke();

  // Lower wave
  ctx.beginPath();
  ctx.moveTo(bx - rx + 2, by + 3);
  ctx.bezierCurveTo(bx - rx / 2, by,     bx + rx / 2, by + 5, bx + rx - 2, by + 3);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();

  // ── Shine blobs ────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.ellipse(bx - 3, by - 7, 2.8, 1.6, -0.45, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(bx + 2, by - 9.5, 1.1, 0.7, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.48)";
  ctx.fill();

  // ── Knot ───────────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.ellipse(bx, 0, 1.8, 1.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = col.shadow;
  ctx.fill();

  // ── String ─────────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(bx, 1.5);
  ctx.bezierCurveTo(bx + 2, 4, bx - 2, 6, bx + 1, 8);
  ctx.strokeStyle = "rgba(0,0,0,0.32)";
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

// ── Cache & API ───────────────────────────────────────────────────────────────

const _cache = new Map<string, OffscreenCanvas>();

function colorsKey(col: BalloonColors): string {
  return `${col.body}|${col.shadow}|${col.shine}`;
}

/**
 * Returns a cached OffscreenCanvas for the given balloon colours.
 * Logical size: 22 × 30 px.  Draw with:
 *   ctx.drawImage(oc, cx - 11, cy - 22, 22, 30)
 * where (cx, cy) is the desired knot position.
 */
export function getBalloonCanvas(col: BalloonColors): OffscreenCanvas {
  const key = colorsKey(col);
  let oc = _cache.get(key);
  if (oc) return oc;

  oc = makeOC();
  const ctx = oc.getContext("2d")!;
  ctx.scale(OC_SCALE, OC_SCALE);
  ctx.translate(OC_OX, OC_OY);   // knot at origin

  renderBalloon(ctx, col);

  _cache.set(key, oc);
  return oc;
}

export function clearBalloonCache(): void {
  _cache.clear();
}
