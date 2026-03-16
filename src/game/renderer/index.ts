/**
 * renderer/index.ts
 *
 * Owns the three canvas contexts and exposes the public draw functions.
 * Delegates all drawing logic to sub-modules.
 *
 * Scaling strategy:
 *   All game logic uses fixed logical coordinates (ARENA_W × ARENA_H = 630×510).
 *   On resize, we compute a scale factor = min(availW/ARENA_W, availH/ARENA_H),
 *   set each canvas's physical pixel size to ARENA_W*scale*DPR × ARENA_H*scale*DPR,
 *   set the canvas CSS size to ARENA_W*scale × ARENA_H*scale,
 *   and bake (scale × DPR) into ctx.setTransform() so all draw calls can keep
 *   using logical 630×510 pixel coordinates unchanged.
 */

import type { GameState } from "../types";
import { ARENA_W, ARENA_H } from "../constants";
import { drawBackground as _drawBackground } from "./background";
import { drawSprites as _drawSprites } from "./sprites";
import { drawDebug as _drawDebug } from "./debug";
export { drawMapPreview } from "./preview";

// ─── Canvas state ─────────────────────────────────────────────────────────────

let bgCtx: CanvasRenderingContext2D;
let spriteCtx: CanvasRenderingContext2D;
let debugCtx: CanvasRenderingContext2D;
let canvases: HTMLCanvasElement[] = [];
let ctxs: CanvasRenderingContext2D[] = [];
let arenaEl: HTMLElement | null = null;

/** Current logical→CSS scale (1.0 = no scale). */
let _scale = 1;

export function getCanvasScale(): number { return _scale; }

/**
 * Resize all canvases to fit within availW × availH while keeping the
 * ARENA_W:ARENA_H aspect ratio. Sets physical pixel buffer and bakes the
 * combined (scale × DPR) into each context's transform.
 * Also sets #arena's explicit CSS size so it doesn't collapse to 0.
 */
export function resizeRenderer(availW: number, availH: number): void {
  const dpr = window.devicePixelRatio || 1;
  _scale = Math.min(availW / ARENA_W, availH / ARENA_H);

  const cssW = Math.floor(ARENA_W * _scale);
  const cssH = Math.floor(ARENA_H * _scale);
  const physW = Math.round(cssW * dpr);
  const physH = Math.round(cssH * dpr);

  // Size the #arena container so #arena-outer wraps it correctly
  if (arenaEl) {
    arenaEl.style.width  = `${cssW}px`;
    arenaEl.style.height = `${cssH}px`;
  }

  for (let i = 0; i < canvases.length; i++) {
    const c = canvases[i];
    const ctx = ctxs[i];
    if (c.width !== physW || c.height !== physH) {
      c.width  = physW;
      c.height = physH;
    }
    // CSS size matches the scaled logical size (no CSS transform needed)
    c.style.width  = `${cssW}px`;
    c.style.height = `${cssH}px`;
    // Bake scale+DPR so all draw code uses unscaled logical coords
    ctx.setTransform(_scale * dpr, 0, 0, _scale * dpr, 0, 0);
  }
}

export function initRenderer(
  bg: HTMLCanvasElement,
  sprite: HTMLCanvasElement,
  dbg: HTMLCanvasElement,
): void {
  canvases = [bg, sprite, dbg];
  bgCtx     = bg.getContext("2d", { alpha: false })!;
  spriteCtx = sprite.getContext("2d")!;
  debugCtx  = dbg.getContext("2d")!;
  ctxs = [bgCtx, spriteCtx, debugCtx];
  arenaEl = document.getElementById("arena");
  // Initial size is handled by the first resizeRenderer() call from main.ts
}

// ─── Public draw calls ────────────────────────────────────────────────────────

export function drawBackground(state: GameState): void {
  _drawBackground(bgCtx, state);
}

export function drawSprites(state: GameState, now: number): void {
  _drawSprites(spriteCtx, state, now);
}

export function drawDebug(state: GameState): void {
  _drawDebug(debugCtx, state);
}
