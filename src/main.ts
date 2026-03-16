import type { GameState } from "./game/types";
import type { Direction } from "./game/types";
import { MAPS } from "./game/maps";
import { createGameState } from "./game/gameState";
import { updateGame, placeBalloon, startMove } from "./game/physics";
import {
  initRenderer,
  drawBackground,
  drawSprites,
  drawDebug,
  drawMapPreview,
} from "./game/renderer";
import { initAI, updateAI } from "./game/ai";

// ─── DOM References ───────────────────────────────────────────────────────────

const lobby = document.getElementById("lobby")!;
const gameWrap = document.getElementById("game-wrap")!;
const mapGrid = document.getElementById("map-grid")!;
const playBtn = document.getElementById("play-btn")!;
const backBtn = document.getElementById("back-btn")!;
const gtitle = document.getElementById("gtitle")!;
const hud = document.getElementById("hud")!;
const msgOverlay = document.getElementById("msg-overlay")!;
const msgBox = document.getElementById("msg-box")!;
const tipEl = document.getElementById("tip")!;
const debugToggle = document.getElementById("debug-toggle")!;

const bgCanvas = document.getElementById("bg-canvas") as HTMLCanvasElement;
const spriteCanvas = document.getElementById(
  "sprite-canvas",
) as HTMLCanvasElement;
const debugCanvas = document.getElementById(
  "debug-canvas",
) as HTMLCanvasElement;

// ─── State ────────────────────────────────────────────────────────────────────

let selectedMapId = MAPS[0].id;
let state: GameState | null = null;
let rafId = 0;
let lastTime = 0;
let showDebug = false;
const keysHeld = new Set<string>();

// ─── Lobby ────────────────────────────────────────────────────────────────────

function buildLobby(): void {
  mapGrid.innerHTML = "";
  for (const map of MAPS) {
    const card = document.createElement("div");
    card.className = "map-card" + (map.id === selectedMapId ? " selected" : "");
    card.dataset["id"] = map.id;

    const canvas = document.createElement("canvas");
    canvas.width = 260;
    canvas.height = 140;
    drawMapPreview(canvas, map);

    const badge = document.createElement("div");
    badge.className = "sel-badge";
    badge.textContent = "✓ SELECTED";

    const info = document.createElement("div");
    info.className = "map-info";
    info.innerHTML = `
      <span class="map-emoji">${map.emoji}</span>
      <div>
        <div class="map-name">${map.name}</div>
        <div class="map-desc">${map.desc}</div>
      </div>`;

    card.appendChild(canvas);
    card.appendChild(badge);
    card.appendChild(info);
    card.addEventListener("click", () => selectMap(map.id));
    mapGrid.appendChild(card);
  }
}

function selectMap(id: string): void {
  selectedMapId = id;
  document.querySelectorAll(".map-card").forEach((c) => {
    (c as HTMLElement).classList.toggle(
      "selected",
      (c as HTMLElement).dataset["id"] === id,
    );
  });
}

// ─── Game Start / Stop ────────────────────────────────────────────────────────

function startGame(): void {
  const map = MAPS.find((m) => m.id === selectedMapId) ?? MAPS[0];
  state = createGameState(map, 3);

  initRenderer(bgCanvas, spriteCanvas, debugCanvas);
  initAI(state);

  lobby.style.display = "none";
  gameWrap.style.display = "flex";
  gtitle.textContent = map.emoji + " " + map.name;

  updateHUD();
  hideMessage();
  lastTime = performance.now();
  rafId = requestAnimationFrame(gameLoop);
  tipEl.textContent = "Arrow Keys / WASD to move • Space to place balloon";
}

function stopGame(): void {
  cancelAnimationFrame(rafId);
  state = null;
  lobby.style.display = "flex";
  gameWrap.style.display = "none";
  hideMessage();
}

// ─── Game Loop ────────────────────────────────────────────────────────────────

function gameLoop(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  if (!state) return;

  const human = state.players[0];
  if (human?.alive && !human.moving) {
    const dir = consumeDir();
    if (dir) startMove(state, human, dir);
  }

  for (const p of state.players) {
    if (p.isAI && p.alive) {
      updateAI(
        state,
        p,
        dt,
        (player) => placeBalloon(state!, player),
        (player, dir) => startMove(state!, player, dir),
      );
    }
  }

  updateGame(state, dt);
  drawBackground(state);
  drawSprites(state, now / 1000);
  if (showDebug) drawDebug(state);
  updateHUD();

  if (state.gameOver) {
    showEndMessage();
    return;
  }
  rafId = requestAnimationFrame(gameLoop);
}

function consumeDir(): Direction | null {
  if (keysHeld.has("ArrowUp") || keysHeld.has("KeyW")) return "up";
  if (keysHeld.has("ArrowDown") || keysHeld.has("KeyS")) return "down";
  if (keysHeld.has("ArrowLeft") || keysHeld.has("KeyA")) return "left";
  if (keysHeld.has("ArrowRight") || keysHeld.has("KeyD")) return "right";
  return null;
}

// ─── HUD ──────────────────────────────────────────────────────────────────────

function updateHUD(): void {
  if (!state) return;
  hud.innerHTML = state.players
    .map(
      (p) => `
    <div class="hud-box" style="border-color:${p.color}40">
      <span>${p.hat}</span>
      P${p.id + 1}${p.isAI ? " 🤖" : ""}
      ${p.alive ? "" : '<span style="color:#ef5350"> ✕</span>'}
      &nbsp;🏆<span>${p.score}</span>
    </div>
  `,
    )
    .join("");
}

// ─── Messages ─────────────────────────────────────────────────────────────────

function showEndMessage(): void {
  if (!state) return;
  const winner = state.winner !== null ? state.players[state.winner] : null;
  msgBox.innerHTML = winner
    ? `<h2>${winner.hat} ${winner.isAI ? "CPU" : "You"} Win!</h2>
       <p>Player ${winner.id + 1} survived the chaos!</p>
       <button class="msg-btn" style="background:#ffd600;color:#1a237e" id="replay-btn">▶ Play Again</button>
       <button class="msg-btn" style="background:rgba(255,255,255,.15);color:#fff" id="lobby-btn">🏠 Lobby</button>`
    : `<h2>💥 Draw!</h2>
       <p>Everyone was caught in the blast!</p>
       <button class="msg-btn" style="background:#ffd600;color:#1a237e" id="replay-btn">▶ Play Again</button>
       <button class="msg-btn" style="background:rgba(255,255,255,.15);color:#fff" id="lobby-btn">🏠 Lobby</button>`;

  msgOverlay.classList.remove("hidden");
  document.getElementById("replay-btn")?.addEventListener("click", startGame);
  document.getElementById("lobby-btn")?.addEventListener("click", stopGame);
}

function hideMessage(): void {
  msgOverlay.classList.add("hidden");
}

// ─── Input ────────────────────────────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  keysHeld.add(e.code);
  if (!state?.running) return;
  if (e.code === "Space" || e.code === "KeyX") {
    e.preventDefault();
    const human = state.players[0];
    if (human?.alive) placeBalloon(state, human);
  }
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code))
    e.preventDefault();
});

document.addEventListener("keyup", (e) => keysHeld.delete(e.code));

function bindMobileBtn(id: string, action: () => void): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      action();
    },
    { passive: false },
  );
  el.addEventListener("mousedown", () => action());
}

bindMobileBtn("btn-up", () => {
  if (state?.players[0]?.alive) startMove(state!, state!.players[0], "up");
});
bindMobileBtn("btn-down", () => {
  if (state?.players[0]?.alive) startMove(state!, state!.players[0], "down");
});
bindMobileBtn("btn-left", () => {
  if (state?.players[0]?.alive) startMove(state!, state!.players[0], "left");
});
bindMobileBtn("btn-right", () => {
  if (state?.players[0]?.alive) startMove(state!, state!.players[0], "right");
});
bindMobileBtn("btn-bln", () => {
  if (state?.players[0]?.alive) placeBalloon(state!, state!.players[0]);
});

debugToggle.addEventListener("click", () => {
  showDebug = !showDebug;
  debugCanvas.classList.toggle("vis", showDebug);
  debugToggle.querySelector(".toggle-pill")?.classList.toggle("on", showDebug);
});

backBtn.addEventListener("click", stopGame);
playBtn.addEventListener("click", startGame);

// ─── Boot ─────────────────────────────────────────────────────────────────────

buildLobby();

const wrapper = document.getElementById("wrapper")!;
for (let i = 0; i < 10; i++) {
  const b = document.createElement("div");
  b.className = "bg-bubble";
  const size = 20 + Math.random() * 80;
  b.style.cssText = `width:${size}px;height:${size}px;left:${Math.random() * 100}%;bottom:${Math.random() * -200}px;animation-duration:${8 + Math.random() * 12}s;animation-delay:${-Math.random() * 15}s;`;
  wrapper.appendChild(b);
}
