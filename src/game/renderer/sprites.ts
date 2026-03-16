import type { GameState } from "../types";
import { ARENA_W, ARENA_H, TEAM_COLORS, OUTFIT_STYLES, TEAM_OUTFIT } from "../constants";
import { cellToPixel } from "../physics/helpers";
import {
  buildCharacterImages,
  getPoseImage,
  clearCharImageCache,
} from "./characterSvg";
import type { CharColors, CharacterImages } from "./characterSvg";

// ── Balloon colours per owner index ─────────────────────────────────────────
const BALLOON_COLORS = [
  { body: "#ef5350", shadow: "#b71c1c", shine: "#ff8a80" },
  { body: "#42a5f5", shadow: "#0d47a1", shine: "#90caf9" },
  { body: "#66bb6a", shadow: "#1b5e20", shine: "#a5d6a7" },
  { body: "#ffa726", shadow: "#e65100", shine: "#ffe082" },
  { body: "#ab47bc", shadow: "#4a148c", shine: "#ce93d8" },
  { body: "#26c6da", shadow: "#006064", shine: "#80deea" },
  { body: "#d4e157", shadow: "#827717", shine: "#f0f4c3" },
  { body: "#ff7043", shadow: "#bf360c", shine: "#ffab91" },
];

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + 255 * amount));
  const g = Math.min(255, Math.round(((num >> 8)  & 0xff) + 255 * amount));
  const b = Math.min(255, Math.round((num & 0xff)          + 255 * amount));
  return `rgb(${r},${g},${b})`;
}
function darken(hex: string, amount: number): string {
  return lighten(hex, -amount);
}

// ─── Color resolution ─────────────────────────────────────────────────────────

/** Resolve outfit colours for a player, blending team override. */
function resolveColors(p: GameState["players"][0]): CharColors {
  const outfit = OUTFIT_STYLES.find(o => o.key === p.outfit) ?? OUTFIT_STYLES[0];
  const teamOverride = p.team > 0 ? TEAM_OUTFIT[p.team] : null;
  return {
    jacket:   teamOverride?.jacket ?? outfit.jacket,
    pants:    teamOverride?.pants  ?? outfit.pants,
    hat:      teamOverride?.hat    ?? outfit.hat,
    shoes:    outfit.shoes,
    skin:     p.skinTone,
    hatStyle: outfit.hatStyle,
    cape:     outfit.cape,
  };
}

/** Get balloon color — uses team color if on a team. */
function getBalloonColor(state: GameState, ownerId: number) {
  const owner = state.players.find(p => p.id === ownerId);
  if (owner && owner.team > 0) {
    const tc = TEAM_COLORS[(owner.team - 1) % TEAM_COLORS.length];
    return { body: tc, shadow: darken(tc, 0.3), shine: lighten(tc, 0.35) };
  }
  return BALLOON_COLORS[ownerId % BALLOON_COLORS.length];
}

// ─── Per-player SVG image cache ───────────────────────────────────────────────
// Keyed by player id; rebuilt whenever resolved colours change.

interface PlayerImageEntry {
  colorsKey: string;
  images: CharacterImages;
}

const _playerImages = new Map<number, PlayerImageEntry>();

function getPlayerImages(p: GameState["players"][0]): CharacterImages {
  const colors = resolveColors(p);
  const key = JSON.stringify(colors);
  const entry = _playerImages.get(p.id);
  if (entry && entry.colorsKey === key) return entry.images;
  const images = buildCharacterImages(colors);
  _playerImages.set(p.id, { colorsKey: key, images });
  return images;
}

/** Flush stale per-player images (call on game restart). */
export function clearSpriteCache(): void {
  _playerImages.clear();
  clearCharImageCache();
}

// ─────────────────────────────────────────────────────────────────────────────
//  BALLOON  (canvas-drawn — complex gradient + live timer text)
// ─────────────────────────────────────────────────────────────────────────────

function drawBalloon(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ownerId: number,
  trapped: boolean,
  timer: number,
  trapTimer: number,
  now: number,
): void {
  const pulse = 1 + 0.05 * Math.sin(now * 0.007);
  const col = trapped
    ? { body: "#ffd600", shadow: "#e65100", shine: "#fff59d" }
    : getBalloonColor(state, ownerId);

  ctx.save();
  ctx.scale(pulse, pulse);

  // Drop shadow
  ctx.beginPath();
  ctx.ellipse(2, 18, 10, 3.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fill();

  // Body
  const bodyGrad = ctx.createRadialGradient(-5, -10, 2, 0, -2, 16);
  bodyGrad.addColorStop(0, col.shine);
  bodyGrad.addColorStop(0.45, col.body);
  bodyGrad.addColorStop(1, col.shadow);
  ctx.beginPath();
  ctx.ellipse(0, -3, 13, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = col.shadow;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Shine blobs
  ctx.beginPath();
  ctx.ellipse(-4, -11, 4, 2.5, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(3, -14, 1.5, 1, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fill();

  // Knot
  ctx.beginPath();
  ctx.ellipse(0, 13, 2.5, 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = col.shadow;
  ctx.fill();

  // String
  ctx.beginPath();
  ctx.moveTo(0, 15);
  ctx.bezierCurveTo(3, 20, -3, 24, 1, 28);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Timer text
  const secs = trapped ? (trapTimer + timer).toFixed(1) : timer.toFixed(1);
  ctx.font = "bold 9px Nunito, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2.5;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(secs, 0, -3);
  ctx.fillText(secs, 0, -3);

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
//  CHARACTER  (SVG sprite via characterSvg.ts)
//
//  SVG viewBox "-15 -36 30 36": foot-centre at (0,0), extends 36px upward.
//  ctx origin is translated to foot-centre before drawing.
// ─────────────────────────────────────────────────────────────────────────────

const SPRITE_W = 30;
const WALK_FPS = 8;

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: GameState["players"][0],
  now: number,
): void {
  const dir    = p.lastDir ?? "down";
  const moving = p.moveDir !== null;
  const bobY   = moving ? Math.sin(p.walkTime * WALK_FPS * Math.PI) * 0.5 : 0;

  // ── Team glow ring ────────────────────────────────────────────────────────
  if (p.team > 0) {
    const tc = TEAM_COLORS[(p.team - 1) % TEAM_COLORS.length];
    ctx.save();
    const gAlpha = 0.5 + 0.25 * Math.sin(now * 0.006);
    ctx.globalAlpha = gAlpha;
    const rg = ctx.createRadialGradient(0, 0, 2, 0, 0, 10);
    rg.addColorStop(0, tc + "aa");
    rg.addColorStop(1, tc + "00");
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.globalAlpha = gAlpha * 0.9;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 2.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = tc;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // Invincibility flash
  if (p.invincible) {
    ctx.globalAlpha = Math.sin(now * 0.03) > 0 ? 0.9 : 0.3;
  }

  // Fetch (or build from cache) the full pose-sheet for this colour set
  const imgs = getPlayerImages(p);
  const { img, flipX } = getPoseImage(imgs, dir, p.walkTime, moving);

  ctx.save();
  ctx.translate(0, bobY);
  if (flipX) ctx.scale(-1, 1);
  // OffscreenCanvas is 4× oversampled (120×144) — draw it into 30×36 logical space
  ctx.drawImage(img, -15, -36, 30, 36);
  ctx.restore();

  ctx.globalAlpha = 1;

  // ── Name label (drawn after restore so it's never flipped) ────────────────
  const label = p.name && p.name !== `P${p.id + 1}` ? p.name : `P${p.id + 1}`;
  ctx.font = "bold 6px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 2;
  ctx.strokeText(label, 0, -35);
  ctx.fillStyle = "#fff";
  ctx.fillText(label, 0, -35);
}

// ─────────────────────────────────────────────────────────────────────────────
//  TRAPPED-IN-BUBBLE
// ─────────────────────────────────────────────────────────────────────────────

function drawTrappedBubble(
  ctx: CanvasRenderingContext2D,
  p: GameState["players"][0],
  now: number,
): void {
  const countdown = p.trapCountdown;
  // Urgent pulse when < 1.5 s remaining
  const urgency = countdown < 1.5 ? 0.5 + 0.5 * Math.abs(Math.sin(now * 0.015)) : 1;
  const bobY = Math.sin(now * 0.003) * 2;

  ctx.save();
  ctx.translate(0, bobY);

  const bubbleR = 13;

  // Colour shifts red as time runs out
  const redness = Math.max(0, 1 - countdown / 3);
  const r = Math.round(100 + redness * 155);
  const g = Math.round(180 - redness * 140);
  const b2 = Math.round(255 - redness * 120);

  const bubbleGrad = ctx.createRadialGradient(-3, -5, 0.5, 0, 0, bubbleR);
  bubbleGrad.addColorStop(0, `rgba(${r},${g + 40},${b2},0.55)`);
  bubbleGrad.addColorStop(0.7, `rgba(${r - 40},${g},${b2},0.22)`);
  bubbleGrad.addColorStop(1, `rgba(${r - 60},${g - 40},${b2 - 35},0.5)`);

  ctx.save();
  ctx.globalAlpha = urgency;
  ctx.beginPath();
  ctx.arc(0, 0, bubbleR, 0, Math.PI * 2);
  ctx.fillStyle = bubbleGrad;
  ctx.fill();
  ctx.restore();

  // Miniature character sprite scaled to fit inside bubble
  const imgs = getPlayerImages(p);
  ctx.save();
  const sc = (bubbleR * 2 * 0.8) / SPRITE_W;
  ctx.scale(sc, sc);
  ctx.drawImage(imgs.front, -15, -36, 30, 36);
  ctx.restore();

  // Bubble highlight + border
  ctx.beginPath();
  ctx.ellipse(-4, -7, 4, 2.2, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, bubbleR, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${r - 20},${g + 40},${b2},0.85)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Countdown label above the bubble
  const secs = countdown.toFixed(1);
  ctx.font = "bold 6px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 2;
  ctx.strokeText(secs, 0, -bubbleR - 2);
  ctx.fillStyle = countdown < 1.5 ? "#ff4444" : "#fff";
  ctx.fillText(secs, 0, -bubbleR - 2);

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export function drawSprites(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  now: number,
): void {
  ctx.clearRect(0, 0, ARENA_W, ARENA_H);

  // Set of balloon ids used as player traps — don't render them as regular balloons
  const trapBalloonIds = new Set(
    state.players.filter(p => p.trappedInBalloon).map(p => p.trapBalloonId)
  );

  // ── Regular Balloons ──────────────────────────────────────────────────────
  for (const b of state.balloons) {
    if (trapBalloonIds.has(b.id)) continue; // trap-player balloons rendered with players
    const { px, py } = cellToPixel(b.row, b.col);
    ctx.save();
    ctx.translate(px, py - 4);
    drawBalloon(ctx, state, b.ownerId, b.trapped, b.timer, b.trapTimer, now);
    ctx.restore();
  }

  // ── Players ───────────────────────────────────────────────────────────────
  for (const p of state.players) {
    if (!p.alive) continue;
    if (p.invincible && Math.floor(now * 0.008) % 2 === 0) continue;

    ctx.save();
    // foot-centre sits 3px above the logical py (cell centre)
    ctx.translate(p.px, p.py + 3);

    if (p.trappedInBalloon) {
      drawTrappedBubble(ctx, p, now);
    } else {
      drawPlayer(ctx, p, now);
    }

    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  LOBBY PREVIEW
// ─────────────────────────────────────────────────────────────────────────────

export function drawPreviewCharacter(
  ctx: CanvasRenderingContext2D,
  outfit: string,
  skinTone: string,
  team: number,
  _now: number,
): void {
  const outfitDef = OUTFIT_STYLES.find(o => o.key === outfit) ?? OUTFIT_STYLES[0];
  const teamOverride = team > 0 ? TEAM_OUTFIT[team] : null;
  const colors: CharColors = {
    jacket:   teamOverride?.jacket ?? outfitDef.jacket,
    pants:    teamOverride?.pants  ?? outfitDef.pants,
    hat:      teamOverride?.hat    ?? outfitDef.hat,
    shoes:    outfitDef.shoes,
    skin:     skinTone,
    hatStyle: outfitDef.hatStyle,
    cape:     outfitDef.cape,
  };

  const imgs = buildCharacterImages(colors);
  ctx.save();
  // Translate so feet sit near canvas bottom (caller has already centred x)
  ctx.translate(0, 10);
  ctx.drawImage(imgs.front, -15, -36, 30, 36);
  ctx.restore();
}
