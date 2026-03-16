/**
 * characterSvg.ts
 *
 * Generates SVG strings for character sprites with CSS-variable–based
 * colour customisation. Each SVG uses:
 *
 *   --c-jacket   jacket / top colour
 *   --c-pants    pants colour
 *   --c-hat      hat colour
 *   --c-shoes    shoes colour
 *   --c-skin     skin-tone colour
 *   --c-cape     cape colour  (used only when outfit has a cape)
 *
 * Character viewBox:  "-15 -36 30 36"
 *   • x-axis: 0 = horizontal centre
 *   • y-axis: 0 = foot level, -36 = top of hat
 *
 * Exported API
 * ─────────────
 *   buildCharacterImages(opts)  → CharacterImages
 *     Returns a set of HTMLImageElement objects (one per pose) that are
 *     ready to draw with ctx.drawImage().  Images are re-used / cached so
 *     colours are baked in via a serialised SVG data-URL.
 *
 *   CharPose = keyof CharacterImages
 *     "front" | "back" | "left" | "right"
 *     + walk variants:  "front_w1" | "front_w2" |  …
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CharColors {
  jacket: string;
  pants:  string;
  hat:    string;
  shoes:  string;
  skin:   string;
  cape?:  string;
  hatStyle: string;
}

export type CharPose =
  | "front"   | "front_w1"   | "front_w2"
  | "side"    | "side_w1"    | "side_w2"
  | "back"    | "back_w1"    | "back_w2";

export interface CharacterImages {
  front:    OffscreenCanvas;
  front_w1: OffscreenCanvas;
  front_w2: OffscreenCanvas;
  side:     OffscreenCanvas;
  side_w1:  OffscreenCanvas;
  side_w2:  OffscreenCanvas;
  back:     OffscreenCanvas;
  back_w1:  OffscreenCanvas;
  back_w2:  OffscreenCanvas;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function lightenHex(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 0xff) + 255 * amt);
  const g = clamp(((n >> 8)  & 0xff) + 255 * amt);
  const b = clamp((n & 0xff)          + 255 * amt);
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}
const darkenHex = (hex: string, amt: number) => lightenHex(hex, -amt);

// ─── Sub-part builders ────────────────────────────────────────────────────────

/** Ground shadow ellipse */
function svgShadow(): string {
  return `<ellipse cx="0" cy="0" rx="7" ry="2" fill="rgba(0,0,0,0.18)"/>`;
}

/** Legs + shoes.  legL / legR are rotation angles in degrees (swing). */
function svgLegs(c: CharColors, legL: number, legR: number): string {
  function leg(cx: number, angle: number): string {
    const pants   = c.pants;
    const pantsDk = darkenHex(pants, 0.1);
    const shoe    = c.shoes;
    // pivot at waist (y=-10)
    return `<g transform="translate(${cx},-10) rotate(${angle})">
      <rect x="-2" y="0" width="4" height="5" rx="1.5" fill="${pants}" stroke="${darkenHex(pants,0.25)}" stroke-width="0.6"/>
      <rect x="-1.5" y="4.5" width="3" height="4" rx="1" fill="${pantsDk}"/>
      <ellipse cx="0.5" cy="9" rx="3" ry="1.5" fill="${shoe}"/>
    </g>`;
  }
  return leg(-3, legL) + leg(3, legR);
}

/** Cape (behind torso) */
function svgCape(c: CharColors): string {
  if (!c.cape) return "";
  const color = c.cape;
  return `<polygon points="-6.5,-16.5 6.5,-16.5 9,-4 -9,-4"
    fill="${color}" stroke="${darkenHex(color,0.3)}" stroke-width="0.6"/>
  <line x1="0" y1="-16.5" x2="0" y2="-4"
    stroke="${lightenHex(color,0.25)}" stroke-width="0.8"/>`;
}

/** Torso trapezoid */
function svgTorso(c: CharColors): string {
  const j = c.jacket;
  const jl = lightenHex(j, 0.28);
  const jd = darkenHex(j, 0.12);
  const jdk = darkenHex(j, 0.3);
  return `<defs>
    <linearGradient id="jg" x1="-7" y1="-17" x2="7" y2="-10" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${jl}"/>
      <stop offset="50%" stop-color="${j}"/>
      <stop offset="100%" stop-color="${jd}"/>
    </linearGradient>
  </defs>
  <polygon points="-7,-17 7,-17 5,-10 -5,-10"
    fill="url(#jg)" stroke="${jdk}" stroke-width="0.7"/>
  <line x1="0" y1="-16" x2="0" y2="-11"
    stroke="${darkenHex(j,0.35)}" stroke-width="0.5"/>`;
}

/** Arms. armL / armR are rotation angles in degrees. */
function svgArms(c: CharColors, armL: number, armR: number): string {
  const j = c.jacket;
  function arm(cx: number, angle: number): string {
    return `<g transform="translate(${cx},-17) rotate(${angle})">
      <rect x="-1.5" y="0" width="3" height="5" rx="1.5"
        fill="${j}" stroke="${darkenHex(j,0.3)}" stroke-width="0.6"/>
      <rect x="-1.2" y="4.5" width="2.5" height="4" rx="1" fill="${darkenHex(j,0.05)}"/>
    </g>`;
  }
  return arm(-8, armL) + arm(8, armR);
}

/** Front-facing head (down = face visible, side = angled) */
function svgHeadFront(c: CharColors, isFacingDown: boolean): string {
  const sk   = c.skin;
  const skl  = lightenHex(sk, 0.22);
  const skd  = darkenHex(sk, 0.2);
  const skm  = darkenHex(sk, 0.15);
  const skdk = darkenHex(sk, 0.4);

  const base = `<defs>
    <radialGradient id="hg" cx="-1.5" cy="-1.5" r="6.5" gradientUnits="userSpaceOnUse" fx="-1.5" fy="-21.5">
      <stop offset="0%" stop-color="${skl}"/>
      <stop offset="100%" stop-color="${sk}"/>
    </radialGradient>
  </defs>
  <ellipse cx="0" cy="-20" rx="5" ry="5.5" fill="url(#hg)" stroke="${skd}" stroke-width="0.7"/>`;

  if (isFacingDown) {
    return base + `
  <ellipse cx="-2" cy="-20" rx="1" ry="1.3" fill="#1a0e00"/>
  <ellipse cx="2"  cy="-20" rx="1" ry="1.3" fill="#1a0e00"/>
  <ellipse cx="-1.5" cy="-20.7" rx="0.4" ry="0.4" fill="rgba(255,255,255,0.85)"/>
  <ellipse cx="2.5"  cy="-20.7" rx="0.4" ry="0.4" fill="rgba(255,255,255,0.85)"/>
  <ellipse cx="0" cy="-18.5" rx="0.6" ry="0.4" fill="${skm}"/>
  <path d="M-2,-17.5 A2,2 0 0,0 2,-17.5" fill="none" stroke="${skdk}" stroke-width="0.8"/>
  <ellipse cx="-3.8" cy="-18.5" rx="1.5" ry="0.9" fill="#ff6e6e" opacity="0.28"/>
  <ellipse cx="3.8"  cy="-18.5" rx="1.5" ry="0.9" fill="#ff6e6e" opacity="0.28"/>`;
  } else {
    // side-facing
    return base + `
  <ellipse cx="-0.5" cy="-20" rx="0.9" ry="1.2" fill="#1a0e00"/>
  <ellipse cx="2.5"  cy="-20" rx="0.9" ry="1.2" fill="#1a0e00"/>
  <ellipse cx="0"    cy="-20.6" rx="0.35" ry="0.35" fill="rgba(255,255,255,0.85)"/>
  <ellipse cx="3"    cy="-20.6" rx="0.35" ry="0.35" fill="rgba(255,255,255,0.85)"/>
  <ellipse cx="4.5"  cy="-18.5" rx="0.9" ry="0.6"   fill="${skm}"/>
  <path d="M1,-17.2 A1.5,1.5 0 0,0 4,-17.2" fill="none" stroke="${skdk}" stroke-width="0.8"/>
  <ellipse cx="4" cy="-18" rx="1.3" ry="0.8" fill="#ff6e6e" opacity="0.28"/>`;
  }
}

/** Back-facing head */
function svgHeadBack(c: CharColors): string {
  const sk  = c.skin;
  const skl = lightenHex(sk, 0.12);
  const skd = darkenHex(sk, 0.1);
  const skd2 = darkenHex(sk, 0.2);
  return `<defs>
    <radialGradient id="hg" cx="2" cy="-21.5" r="7" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${skl}"/>
      <stop offset="100%" stop-color="${skd}"/>
    </radialGradient>
  </defs>
  <ellipse cx="0" cy="-20" rx="5" ry="5.5" fill="url(#hg)" stroke="${skd2}" stroke-width="0.7"/>
  <ellipse cx="-5.5" cy="-19.5" rx="1.5" ry="2" fill="${sk}" transform="rotate(11.5,-5.5,-19.5)"/>
  <ellipse cx="5.5"  cy="-19.5" rx="1.5" ry="2" fill="${sk}" transform="rotate(-11.5,5.5,-19.5)"/>`;
}

// ─── Hat builders ─────────────────────────────────────────────────────────────

function svgBeanie(c: CharColors): string {
  const h = c.hat;
  const hl = lightenHex(h, 0.2);
  const hd = darkenHex(h, 0.2);
  const hp = lightenHex(h, 0.35);
  const hpd = darkenHex(h, 0.1);
  return `<rect x="-5.5" y="-25.5" width="11" height="3" rx="1.5"
    fill="${hl}" stroke="${hd}" stroke-width="0.5"/>
  <ellipse cx="0" cy="-28" rx="4.5" ry="4"
    fill="${h}" stroke="${hd}" stroke-width="0.5"/>
  <rect x="-4" y="-30" width="8" height="1.2" rx="0.6" fill="rgba(255,255,255,0.22)"/>
  <circle cx="0" cy="-32.5" r="2.2"
    fill="${hp}" stroke="${hpd}" stroke-width="0.4"/>`;
}

function svgPirateHat(c: CharColors): string {
  const h = c.hat;
  const hl = lightenHex(h, 0.15);
  const hd = darkenHex(h, 0.25);
  const hdk = darkenHex(h, 0.3);
  return `<ellipse cx="0" cy="-25.5" rx="8" ry="2.2"
    fill="${hl}" stroke="${hd}" stroke-width="0.5"/>
  <polygon points="-6,-25 0,-33 6,-25"
    fill="${h}" stroke="${hdk}" stroke-width="0.5"/>
  <line x1="-2" y1="-29" x2="2" y2="-29" stroke="rgba(255,255,255,0.7)" stroke-width="1"/>
  <line x1="0"  y1="-31" x2="0" y2="-27" stroke="rgba(255,255,255,0.7)" stroke-width="1"/>`;
}

function svgBaseballCap(c: CharColors): string {
  const h = c.hat;
  const hd = darkenHex(h, 0.15);
  const hdk = darkenHex(h, 0.25);
  const hdkk = darkenHex(h, 0.3);
  const hl = lightenHex(h, 0.25);
  // Half-ellipse dome (top half only via clip or path)
  return `<path d="M-5.5,-25.5 A5.5,5 0 0,1 5.5,-25.5 Z"
    fill="${h}" stroke="${hdk}" stroke-width="0.6"/>
  <ellipse cx="4.5" cy="-23" rx="4.5" ry="1.5" transform="rotate(-14.3,4.5,-23)"
    fill="${hd}" stroke="${hdkk}" stroke-width="0.5"/>
  <path d="M-5.5,-25.5 A5.5,5 0 0,1 5.5,-25.5"
    fill="none" stroke="${darkenHex(h,0.2)}" stroke-width="1.2"/>
  <circle cx="0" cy="-30" r="1.1" fill="${hl}"/>`;
}

function svgWitchHat(c: CharColors): string {
  const h = c.hat;
  const hl = lightenHex(h, 0.2);
  const hd = darkenHex(h, 0.25);
  const hdk = darkenHex(h, 0.3);
  const hlight = lightenHex(h, 0.15);
  return `<ellipse cx="0" cy="-25.5" rx="8" ry="2.2"
    fill="${hl}" stroke="${hd}" stroke-width="0.5"/>
  <polygon points="-5,-25 1,-36 5.5,-25"
    fill="${h}" stroke="${hdk}" stroke-width="0.5"/>
  <rect x="-4.5" y="-27" width="9" height="1.8" rx="0.5" fill="#ffd600"/>
  <path d="M-8,-24.5 Q-10,-22 -9,-21" fill="none" stroke="${hlight}" stroke-width="1"/>`;
}

function svgCrown(c: CharColors): string {
  const h = c.hat;
  const hd = darkenHex(h, 0.3);
  // 3 spikes + jewels
  const spikes = [-3.5, 0, 3.5].map((x, i) => {
    const jewel = i === 1 ? "#e53935" : "#42a5f5";
    return `<polygon points="${x-2},-25.5 ${x},-32 ${x+2},-25.5"
      fill="${h}" stroke="${hd}" stroke-width="0.5"/>
    <circle cx="${x}" cy="-29.5" r="1.1" fill="${jewel}" stroke="rgba(255,255,255,0.6)" stroke-width="0.4"/>`;
  }).join("");
  return `<rect x="-5.5" y="-27" width="11" height="3" rx="1"
    fill="${h}" stroke="${hd}" stroke-width="0.6"/>
  ${spikes}`;
}

function svgHat(c: CharColors): string {
  switch (c.hatStyle) {
    case "pirate": return svgPirateHat(c);
    case "cap":    return svgBaseballCap(c);
    case "witch":  return svgWitchHat(c);
    case "crown":  return svgCrown(c);
    default:       return svgBeanie(c);
  }
}

// ─── Full character SVG assembler ─────────────────────────────────────────────

interface PoseParams {
  legL: number;   // left leg rotation degrees
  legR: number;   // right leg rotation degrees
  armL: number;   // left arm rotation degrees
  armR: number;   // right arm rotation degrees
  dir: "front" | "side" | "back";
}

const WALK_ANG = 20; // degrees

// Neutral + two walk phases
const POSES: Record<CharPose, PoseParams> = {
  front:    { legL: 0,          legR: 0,           armL: 0,           armR: 0,          dir: "front" },
  front_w1: { legL: WALK_ANG,   legR: -WALK_ANG,   armL: -WALK_ANG,  armR: WALK_ANG,   dir: "front" },
  front_w2: { legL: -WALK_ANG,  legR: WALK_ANG,    armL: WALK_ANG,   armR: -WALK_ANG,  dir: "front" },
  side:     { legL: 0,          legR: 0,            armL: 0,           armR: 0,          dir: "side"  },
  side_w1:  { legL: WALK_ANG,   legR: -WALK_ANG,    armL: -WALK_ANG,  armR: WALK_ANG,   dir: "side"  },
  side_w2:  { legL: -WALK_ANG,  legR: WALK_ANG,     armL: WALK_ANG,   armR: -WALK_ANG,  dir: "side"  },
  back:     { legL: 0,          legR: 0,            armL: 0,           armR: 0,          dir: "back"  },
  back_w1:  { legL: WALK_ANG,   legR: -WALK_ANG,    armL: -WALK_ANG,  armR: WALK_ANG,   dir: "back"  },
  back_w2:  { legL: -WALK_ANG,  legR: WALK_ANG,     armL: WALK_ANG,   armR: -WALK_ANG,  dir: "back"  },
};

/** Build a complete SVG string for a given pose + colour set. */
export function buildCharSvg(colors: CharColors, pose: CharPose): string {
  const { legL, legR, armL, armR, dir } = POSES[pose];
  const isFront = dir === "front";
  const isBack  = dir === "back";
  // isSide is used below by flip transform in the caller

  const shadow  = svgShadow();
  const legs    = svgLegs(colors, legL, legR);
  const cape    = svgCape(colors);
  const torso   = svgTorso(colors);
  const arms    = svgArms(colors, armL, armR);
  const head    = isBack ? svgHeadBack(colors) : svgHeadFront(colors, isFront);
  const hat     = svgHat(colors);

  // Layer order: shadow → legs → cape → torso → arms → head → hat
  const body = `${shadow}${legs}${cape}${torso}${arms}${head}${hat}`;

  // viewBox origin = foot-centre; character extends 36px upward, 15px each side
  return `<svg xmlns="http://www.w3.org/2000/svg"
    viewBox="-15 -36 30 36" width="30" height="36"
    overflow="visible">${body}</svg>`;
}

// ─── OffscreenCanvas renderer ─────────────────────────────────────────────────
// Each pose is rendered synchronously into an OffscreenCanvas using 2D canvas
// calls — no async image loading. Always ready for ctx.drawImage().
//
// Canvas size: 30×36 px, with foot-centre at (OC_OX=15, OC_OY=36).

const OC_W  = 30;
const OC_H  = 36;
const OC_OX = 15; // foot-centre x
const OC_OY = 36; // foot-centre y

/** Oversample scale — canvas is rendered at OC_SCALE× resolution to avoid blur. */
const OC_SCALE = 4;

function makeOC(): OffscreenCanvas { return new OffscreenCanvas(OC_W * OC_SCALE, OC_H * OC_SCALE); }

const ocDarken  = (h: string, a: number) => lightenHex(h, -a);
const ocLighten = lightenHex;

function ocShadow(ctx: OffscreenCanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fill();
}

function ocLeg(ctx: OffscreenCanvasRenderingContext2D, cx: number, angleDeg: number, pants: string, shoes: string): void {
  ctx.save();
  ctx.translate(cx, -10);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.beginPath(); ctx.roundRect(-2, 0, 4, 5, 1.5);
  ctx.fillStyle = pants; ctx.fill();
  ctx.strokeStyle = ocDarken(pants, 0.25); ctx.lineWidth = 0.6; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-1.5, 4.5, 3, 4, 1);
  ctx.fillStyle = ocDarken(pants, 0.1); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0.5, 9, 3, 1.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = shoes; ctx.fill();
  ctx.restore();
}

function ocCape(ctx: OffscreenCanvasRenderingContext2D, color: string): void {
  ctx.beginPath();
  ctx.moveTo(-6.5, -16.5); ctx.lineTo(6.5, -16.5);
  ctx.lineTo(9, -4); ctx.lineTo(-9, -4); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = ocDarken(color, 0.3); ctx.lineWidth = 0.6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -16.5); ctx.lineTo(0, -4);
  ctx.strokeStyle = ocLighten(color, 0.25); ctx.lineWidth = 0.8; ctx.stroke();
}

function ocTorso(ctx: OffscreenCanvasRenderingContext2D, jacket: string): void {
  const g = ctx.createLinearGradient(-7, -17, 7, -10);
  g.addColorStop(0, ocLighten(jacket, 0.28));
  g.addColorStop(0.5, jacket);
  g.addColorStop(1, ocDarken(jacket, 0.12));
  ctx.beginPath();
  ctx.moveTo(-7, -17); ctx.lineTo(7, -17); ctx.lineTo(5, -10); ctx.lineTo(-5, -10); ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = ocDarken(jacket, 0.3); ctx.lineWidth = 0.7; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, -11);
  ctx.strokeStyle = ocDarken(jacket, 0.35); ctx.lineWidth = 0.5; ctx.stroke();
}

function ocArm(ctx: OffscreenCanvasRenderingContext2D, cx: number, angleDeg: number, jacket: string): void {
  ctx.save();
  ctx.translate(cx, -17);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.beginPath(); ctx.roundRect(-1.5, 0, 3, 5, 1.5);
  ctx.fillStyle = jacket; ctx.fill();
  ctx.strokeStyle = ocDarken(jacket, 0.3); ctx.lineWidth = 0.6; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-1.2, 4.5, 2.5, 4, 1);
  ctx.fillStyle = ocDarken(jacket, 0.05); ctx.fill();
  ctx.restore();
}

function ocHeadFront(ctx: OffscreenCanvasRenderingContext2D, skin: string, isFacingDown: boolean): void {
  const g = ctx.createRadialGradient(-1.5, -21.5, 0.5, 0, -20, 6.5);
  g.addColorStop(0, ocLighten(skin, 0.22));
  g.addColorStop(1, skin);
  ctx.beginPath(); ctx.ellipse(0, -20, 5, 5.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = ocDarken(skin, 0.2); ctx.lineWidth = 0.7; ctx.stroke();

  if (isFacingDown) {
    ctx.fillStyle = "#1a0e00";
    ctx.beginPath(); ctx.ellipse(-2, -20, 1, 1.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 2, -20, 1, 1.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath(); ctx.ellipse(-1.5, -20.7, 0.4, 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 2.5, -20.7, 0.4, 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -18.5, 0.6, 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = ocDarken(skin, 0.15); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -17.5, 2, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = ocDarken(skin, 0.4); ctx.lineWidth = 0.8; ctx.stroke();
    ctx.globalAlpha = 0.28; ctx.fillStyle = "#ff6e6e";
    ctx.beginPath(); ctx.ellipse(-3.8, -18.5, 1.5, 0.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 3.8, -18.5, 1.5, 0.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = "#1a0e00";
    ctx.beginPath(); ctx.ellipse(-0.5, -20, 0.9, 1.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 2.5, -20, 0.9, 1.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath(); ctx.ellipse(0, -20.6, 0.35, 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3, -20.6, 0.35, 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4.5, -18.5, 0.9, 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = ocDarken(skin, 0.15); ctx.fill();
    ctx.beginPath(); ctx.arc(2.5, -17.2, 1.5, 0.15, Math.PI - 0.15);
    ctx.strokeStyle = ocDarken(skin, 0.4); ctx.lineWidth = 0.8; ctx.stroke();
    ctx.globalAlpha = 0.28; ctx.fillStyle = "#ff6e6e";
    ctx.beginPath(); ctx.ellipse(4, -18, 1.3, 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function ocHeadBack(ctx: OffscreenCanvasRenderingContext2D, skin: string): void {
  const g = ctx.createRadialGradient(2, -21.5, 0.5, 0, -20, 7);
  g.addColorStop(0, ocLighten(skin, 0.12));
  g.addColorStop(1, ocDarken(skin, 0.1));
  ctx.beginPath(); ctx.ellipse(0, -20, 5, 5.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = ocDarken(skin, 0.2); ctx.lineWidth = 0.7; ctx.stroke();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(-5.5, -19.5, 1.5, 2, (11.5 * Math.PI) / 180, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 5.5, -19.5, 1.5, 2, (-11.5 * Math.PI) / 180, 0, Math.PI * 2); ctx.fill();
}

function ocBeanie(ctx: OffscreenCanvasRenderingContext2D, hat: string): void {
  ctx.beginPath(); ctx.roundRect(-5.5, -25.5, 11, 3, 1.5);
  ctx.fillStyle = ocLighten(hat, 0.2); ctx.fill();
  ctx.strokeStyle = ocDarken(hat, 0.2); ctx.lineWidth = 0.5; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -28, 4.5, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = hat; ctx.fill();
  ctx.strokeStyle = ocDarken(hat, 0.2); ctx.lineWidth = 0.5; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-4, -30, 8, 1.2, 0.6);
  ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fill();
  ctx.beginPath(); ctx.arc(0, -32.5, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = ocLighten(hat, 0.35); ctx.fill();
  ctx.strokeStyle = ocDarken(hat, 0.1); ctx.lineWidth = 0.4; ctx.stroke();
}

function ocPirateHat(ctx: OffscreenCanvasRenderingContext2D, hat: string): void {
  ctx.beginPath(); ctx.ellipse(0, -25.5, 8, 2.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = ocLighten(hat, 0.15); ctx.fill();
  ctx.strokeStyle = ocDarken(hat, 0.25); ctx.lineWidth = 0.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, -25); ctx.lineTo(0, -33); ctx.lineTo(6, -25); ctx.closePath();
  ctx.fillStyle = hat; ctx.fill();
  ctx.strokeStyle = ocDarken(hat, 0.3); ctx.lineWidth = 0.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-2, -29); ctx.lineTo(2, -29);
  ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -31); ctx.lineTo(0, -27);
  ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1; ctx.stroke();
}

function ocBaseballCap(ctx: OffscreenCanvasRenderingContext2D, hat: string): void {
  ctx.beginPath();
  ctx.moveTo(-5.5, -25.5); ctx.arc(0, -25.5, 5.5, Math.PI, 0); ctx.closePath();
  ctx.fillStyle = hat; ctx.fill();
  ctx.strokeStyle = ocDarken(hat, 0.25); ctx.lineWidth = 0.6; ctx.stroke();
  ctx.save(); ctx.translate(4.5, -23); ctx.rotate(-0.25);
  ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 1.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = ocDarken(hat, 0.15); ctx.fill();
  ctx.strokeStyle = ocDarken(hat, 0.3); ctx.lineWidth = 0.5; ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, -25.5, 5.5, Math.PI, 0);
  ctx.strokeStyle = ocDarken(hat, 0.2); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -30, 1.1, 0, Math.PI * 2);
  ctx.fillStyle = ocLighten(hat, 0.25); ctx.fill();
}

function ocWitchHat(ctx: OffscreenCanvasRenderingContext2D, hat: string): void {
  ctx.beginPath(); ctx.ellipse(0, -25.5, 8, 2.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = ocLighten(hat, 0.2); ctx.fill();
  ctx.strokeStyle = ocDarken(hat, 0.25); ctx.lineWidth = 0.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-5, -25); ctx.lineTo(1, -36); ctx.lineTo(5.5, -25); ctx.closePath();
  ctx.fillStyle = hat; ctx.fill();
  ctx.strokeStyle = ocDarken(hat, 0.3); ctx.lineWidth = 0.5; ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-4.5, -27, 9, 1.8, 0.5);
  ctx.fillStyle = "#ffd600"; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-8, -24.5); ctx.quadraticCurveTo(-10, -22, -9, -21);
  ctx.strokeStyle = ocLighten(hat, 0.15); ctx.lineWidth = 1; ctx.stroke();
}

function ocCrown(ctx: OffscreenCanvasRenderingContext2D, hat: string): void {
  ctx.beginPath(); ctx.roundRect(-5.5, -27, 11, 3, 1);
  ctx.fillStyle = hat; ctx.fill();
  ctx.strokeStyle = ocDarken(hat, 0.3); ctx.lineWidth = 0.6; ctx.stroke();
  for (const [x, jewel] of [[-3.5, "#42a5f5"], [0, "#e53935"], [3.5, "#42a5f5"]] as [number, string][]) {
    ctx.beginPath(); ctx.moveTo(x - 2, -25.5); ctx.lineTo(x, -32); ctx.lineTo(x + 2, -25.5); ctx.closePath();
    ctx.fillStyle = hat; ctx.fill();
    ctx.strokeStyle = ocDarken(hat, 0.3); ctx.lineWidth = 0.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, -29.5, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = jewel; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 0.4; ctx.stroke();
  }
}

function ocHat(ctx: OffscreenCanvasRenderingContext2D, c: CharColors): void {
  switch (c.hatStyle) {
    case "pirate": ocPirateHat(ctx, c.hat);   break;
    case "cap":    ocBaseballCap(ctx, c.hat); break;
    case "witch":  ocWitchHat(ctx, c.hat);    break;
    case "crown":  ocCrown(ctx, c.hat);       break;
    default:       ocBeanie(ctx, c.hat);      break;
  }
}

/** Render one pose into an OffscreenCanvas synchronously. */
function renderPose(colors: CharColors, pose: CharPose): OffscreenCanvas {
  const { legL, legR, armL, armR, dir } = POSES[pose];
  const isFront = dir === "front";
  const isBack  = dir === "back";

  const oc  = makeOC();
  const ctx = oc.getContext("2d")!;
  // Scale up so details are crisp at any zoom level
  ctx.scale(OC_SCALE, OC_SCALE);
  ctx.translate(OC_OX, OC_OY); // move origin to foot-centre

  ocShadow(ctx);
  ocLeg(ctx, -3, legL, colors.pants, colors.shoes);
  ocLeg(ctx,  3, legR, colors.pants, colors.shoes);
  if (colors.cape) ocCape(ctx, colors.cape);
  ocTorso(ctx, colors.jacket);
  ocArm(ctx, -8, armL, colors.jacket);
  ocArm(ctx,  8, armR, colors.jacket);
  if (isBack) ocHeadBack(ctx, colors.skin);
  else        ocHeadFront(ctx, colors.skin, isFront);
  ocHat(ctx, colors);

  return oc;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const _ocCache = new Map<string, OffscreenCanvas>();

function getCachedPose(colors: CharColors, pose: CharPose): OffscreenCanvas {
  const key = JSON.stringify(colors) + pose;
  if (_ocCache.has(key)) return _ocCache.get(key)!;
  const oc = renderPose(colors, pose);
  _ocCache.set(key, oc);
  return oc;
}

/**
 * Build (or retrieve from cache) the full set of pose canvases for a character.
 * All rendering is synchronous — safe to use immediately with ctx.drawImage().
 */
export function buildCharacterImages(colors: CharColors): CharacterImages {
  const poses: CharPose[] = [
    "front","front_w1","front_w2",
    "side","side_w1","side_w2",
    "back","back_w1","back_w2",
  ];
  const result = {} as CharacterImages;
  for (const p of poses) {
    (result as unknown as Record<string, OffscreenCanvas>)[p] = getCachedPose(colors, p);
  }
  return result;
}

/**
 * Get the correct canvas for the current animation state.
 */
export function getPoseImage(
  imgs: CharacterImages,
  dir: "up"|"down"|"left"|"right",
  walkTime: number,
  moving: boolean,
): { img: OffscreenCanvas; flipX: boolean } {
  const WALK_FPS = 8;
  const phase = moving ? (Math.floor(walkTime * WALK_FPS) % 4) : 0;
  const suffix = phase === 1 ? "_w1" : phase === 3 ? "_w2" : "";
  const flipX  = dir === "left";
  const base   = dir === "up" ? "back" : dir === "down" ? "front" : "side";
  return { img: imgs[(base + suffix) as CharPose], flipX };
}

/** Invalidate all cached canvases (call on game restart). */
export function clearCharImageCache(): void {
  _ocCache.clear();
}
