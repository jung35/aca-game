/**
 * main.ts – Entry point for Crazy Arcade.
 *
 * Handles:
 *  - DOM wiring (lobby, P2P panel, game view)
 *  - Map selection + game start
 *  - Keyboard / touch input
 *  - Main game loop (host-authoritative for online, solo for offline)
 *  - PeerJS room-code multiplayer via RoomPeer
 */

import "./style.css";
import { MAPS } from "./game/maps";
import { createGameState } from "./game/gameState";
import {
  initRenderer,
  drawBackground,
  drawSprites,
  drawDebug,
} from "./game/renderer";
import { updateGame, setPlayerVelocity, placeBalloon } from "./game/physics";
import { initAI, updateAI } from "./game/ai";
import type { GameState, Direction } from "./game/types";
import { RoomPeer } from "./game/netcode";
import type { NetMessage, StateSyncPayload } from "./game/netcode";

// ─── DOM References ────────────────────────────────────────────────────────────

const lobby = document.getElementById("lobby") as HTMLElement;
const gameWrap = document.getElementById("game-wrap") as HTMLElement;
const p2pPanel = document.getElementById("p2p-panel") as HTMLElement;
const mapGrid = document.getElementById("map-grid") as HTMLElement;
const hudEl = document.getElementById("hud") as HTMLElement;
const msgOverlay = document.getElementById("msg-overlay") as HTMLElement;
const msgBox = document.getElementById("msg-box") as HTMLElement;
const netStatus = document.getElementById("net-status") as HTMLElement;
const netLatency = document.getElementById("net-latency") as HTMLElement;

// Buttons
const playBtn = document.getElementById("play-btn") as HTMLButtonElement;
const openP2pBtn = document.getElementById("open-p2p-btn") as HTMLButtonElement;
const backBtn = document.getElementById("back-btn") as HTMLButtonElement;
const p2pCloseBtn = document.getElementById("p2p-close") as HTMLButtonElement;
const p2pHostBtn = document.getElementById("p2p-host-btn") as HTMLButtonElement;
const p2pGuestBtn = document.getElementById(
  "p2p-guest-btn",
) as HTMLButtonElement;
const p2pStartGameBtn = document.getElementById(
  "p2p-start-game-btn",
) as HTMLButtonElement;
const p2pJoinBtn = document.getElementById("p2p-join-btn") as HTMLButtonElement;
const debugToggle = document.getElementById("debug-toggle") as HTMLElement;

// P2P panel sub-sections
const p2pHostStep = document.getElementById("p2p-host-step") as HTMLElement;
const p2pGuestStep = document.getElementById("p2p-guest-step") as HTMLElement;
const p2pRoomCode = document.getElementById("p2p-room-code") as HTMLElement;
const p2pGuestCount = document.getElementById("p2p-guest-count") as HTMLElement;
const p2pJoinInput = document.getElementById(
  "p2p-join-input",
) as HTMLInputElement;
const p2pMsg = document.getElementById("p2p-msg") as HTMLElement;

// Canvases
const bgCanvas = document.getElementById("bg-canvas") as HTMLCanvasElement;
const spriteCanvas = document.getElementById(
  "sprite-canvas",
) as HTMLCanvasElement;
const debugCanvas = document.getElementById(
  "debug-canvas",
) as HTMLCanvasElement;

// Mobile controls
const btnUp = document.getElementById("btn-up") as HTMLButtonElement;
const btnDown = document.getElementById("btn-down") as HTMLButtonElement;
const btnLeft = document.getElementById("btn-left") as HTMLButtonElement;
const btnRight = document.getElementById("btn-right") as HTMLButtonElement;
const btnBln = document.getElementById("btn-bln") as HTMLButtonElement;

// ─── State ─────────────────────────────────────────────────────────────────────

let gameState: GameState | null = null;
let selectedMapId = MAPS[0].id;
let peer: RoomPeer | null = null;
let localPlayerIndex = 0; // 0 = host/solo, 1-7 = guest
let isOnline = false;
let rafId = 0;
let lastTime = 0;

/** Input queue for guest messages received by the host. */
const remoteInputQueue: NetMessage[] = [];

// ─── Keyboard Input ────────────────────────────────────────────────────────────

const keysDown = new Set<string>();

document.addEventListener("keydown", (e) => {
  keysDown.add(e.code);
  if (e.code === "Space" || e.code === "KeyX") handleBalloon(0);
  if (e.code === "KeyM") handleBalloon(localPlayerIndex);
});

document.addEventListener("keyup", (e) => {
  keysDown.delete(e.code);
});

function getDirForPlayer(idx: number): Direction | null {
  if (idx === 0) {
    if (keysDown.has("ArrowUp") || keysDown.has("KeyW")) return "up";
    if (keysDown.has("ArrowDown") || keysDown.has("KeyS")) return "down";
    if (keysDown.has("ArrowLeft") || keysDown.has("KeyA")) return "left";
    if (keysDown.has("ArrowRight") || keysDown.has("KeyD")) return "right";
  } else {
    if (keysDown.has("KeyI")) return "up";
    if (keysDown.has("KeyK")) return "down";
    if (keysDown.has("KeyJ")) return "left";
    if (keysDown.has("KeyL")) return "right";
  }
  return null;
}

function handleBalloon(playerIdx: number): void {
  if (
    !gameState ||
    !gameState.running ||
    gameState.paused ||
    gameState.gameOver
  )
    return;
  const player = gameState.players[playerIdx];
  if (!player || !player.alive) return;

  if (isOnline && peer?.role === "guest" && playerIdx === localPlayerIndex) {
    peer.sendToHost({
      type: "input",
      playerId: localPlayerIndex,
      action: "balloon",
    });
    return;
  }
  placeBalloon(gameState, player);
}

// ─── Mobile controls ───────────────────────────────────────────────────────────

function setupMobileBtn(el: HTMLButtonElement, code: string) {
  el.addEventListener("pointerdown", () => keysDown.add(code));
  el.addEventListener("pointerup", () => keysDown.delete(code));
  el.addEventListener("pointerleave", () => keysDown.delete(code));
}
setupMobileBtn(btnUp, "ArrowUp");
setupMobileBtn(btnDown, "ArrowDown");
setupMobileBtn(btnLeft, "ArrowLeft");
setupMobileBtn(btnRight, "ArrowRight");
btnBln.addEventListener("pointerdown", () => handleBalloon(0));

// ─── HUD ───────────────────────────────────────────────────────────────────────

function updateHUD(state: GameState): void {
  hudEl.innerHTML = state.players
    .map((p) => {
      const hpBar = p.alive ? "❤️" : "💀";
      const marker = p.id === localPlayerIndex && isOnline ? " ★" : "";
      return `<div class="hud-player${p.alive ? "" : " dead"}" style="border-color:${p.color}">
        <span class="hud-hat">${p.hat}</span>
        <span>P${p.id + 1}${marker}</span>
        <span>${hpBar}</span>
        <span class="hud-score">${p.score}</span>
      </div>`;
    })
    .join("");
}

// ─── Map Selection ────────────────────────────────────────────────────────────

function buildMapGrid(): void {
  mapGrid.innerHTML = "";
  for (const map of MAPS) {
    const card = document.createElement("button");
    card.className = "map-card" + (map.id === selectedMapId ? " selected" : "");
    card.innerHTML = `<span class="map-emoji">${map.emoji}</span>
      <span class="map-name">${map.name}</span>
      <span class="map-desc">${map.desc}</span>`;
    card.addEventListener("click", () => {
      selectedMapId = map.id;
      buildMapGrid();
    });
    mapGrid.appendChild(card);
  }
}

// ─── Game Start / Stop ────────────────────────────────────────────────────────

function startGame(numOnlinePlayers = 1): void {
  const map = MAPS.find((m) => m.id === selectedMapId) ?? MAPS[0];
  const numAI = isOnline ? 0 : 7; // solo: 7 AI; online: all humans
  const numHumans = isOnline ? numOnlinePlayers : 1;
  gameState = createGameState(map, numAI, numHumans);
  initAI(gameState);

  lobby.classList.add("hidden");
  p2pPanel.classList.add("hidden");
  gameWrap.classList.remove("hidden");
  msgOverlay.classList.add("hidden");

  cancelAnimationFrame(rafId);
  lastTime = 0;
  rafId = requestAnimationFrame(gameLoop);
}

function endGame(): void {
  cancelAnimationFrame(rafId);
  gameState = null;
  isOnline = false;
  localPlayerIndex = 0;
  peer?.disconnect();
  peer = null;
  remoteInputQueue.length = 0;
  setNetStatus("idle");
  gameWrap.classList.add("hidden");
  lobby.classList.remove("hidden");
  buildMapGrid();
}

// ─── Game Loop ────────────────────────────────────────────────────────────────

function gameLoop(ts: number): void {
  if (!gameState) return;
  const dt = lastTime ? Math.min((ts - lastTime) / 1000, 0.05) : 0.016;
  lastTime = ts;

  peer?.tick(dt);

  if (isOnline) {
    if (peer?.role === "host") {
      hostFrame(dt);
    } else {
      guestFrame(dt);
    }
  } else {
    soloFrame(dt);
  }

  updateHUD(gameState);
  drawBackground(gameState);
  drawSprites(gameState, performance.now());
  if (gameState.showDebug) drawDebug(gameState);

  if (peer?.role === "host" && peer.status === "connected") {
    netLatency.textContent = "";
  } else if (peer?.role === "guest") {
    netLatency.textContent = peer.latency > 0 ? `${peer.latency}ms` : "";
  }

  if (gameState.gameOver) {
    showGameOver(gameState);
    return;
  }

  rafId = requestAnimationFrame(gameLoop);
}

function soloFrame(dt: number): void {
  if (!gameState) return;
  const localPlayer = gameState.players[0];
  if (localPlayer?.alive) {
    setPlayerVelocity(localPlayer, getDirForPlayer(0));
  }
  for (const p of gameState.players) {
    if (p.isAI) {
      const state = gameState;
      updateAI(
        state,
        p,
        dt,
        (ai) => placeBalloon(state, ai),
        (ai, dir) => setPlayerVelocity(ai, dir),
      );
    }
  }
  updateGame(gameState, dt);
}

function hostFrame(dt: number): void {
  if (!gameState || !peer) return;

  // Apply local P1 input
  const localPlayer = gameState.players[0];
  if (localPlayer?.alive) setPlayerVelocity(localPlayer, getDirForPlayer(0));

  // Apply buffered guest inputs
  const msgs = remoteInputQueue.splice(0);
  for (const msg of msgs) {
    if (msg.type === "input") {
      const p = gameState.players[msg.playerId];
      if (!p || !p.alive) continue;
      if (msg.action === "move") {
        setPlayerVelocity(p, msg.dir as Direction | null);
      } else if (msg.action === "balloon") {
        placeBalloon(gameState, p);
      }
    }
  }

  updateGame(gameState, dt);

  // Snapshot to guests at ~20Hz (every frame is fine; PeerJS will coalesce)
  peer.sendStateSync(buildStateSnapshot(gameState));
}

function guestFrame(dt: number): void {
  if (!gameState || !peer) return;

  const dir = getDirForPlayer(localPlayerIndex);
  const localPlayer = gameState.players[localPlayerIndex];
  if (localPlayer?.alive) {
    setPlayerVelocity(localPlayer, dir);
    peer.sendToHost({
      type: "input",
      playerId: localPlayerIndex,
      action: "move",
      dir: dir ?? "none",
    });
  }

  // Guests do a lightweight local sim for responsiveness
  updateGame(gameState, dt);
}

// ─── State Snapshot ───────────────────────────────────────────────────────────

function buildStateSnapshot(state: GameState): StateSyncPayload {
  return {
    seq: 0, // filled in by sendStateSync
    players: state.players.map((p) => ({
      id: p.id,
      row: p.row,
      col: p.col,
      px: p.px,
      py: p.py,
      vx: p.vx,
      vy: p.vy,
      alive: p.alive,
      score: p.score,
      invincible: p.invincible,
      moveDir: p.moveDir,
      maxBalloons: p.maxBalloons,
      balloonRange: p.balloonRange,
      speed: p.speed,
    })),
    balloons: state.balloons.map((b) => ({
      id: b.id,
      row: b.row,
      col: b.col,
      ownerId: b.ownerId,
      timer: b.timer,
      range: b.range,
      trapped: b.trapped,
    })),
    explosions: state.explosions.map((e) => ({
      row: e.row,
      col: e.col,
      timer: e.timer,
    })),
    powerUps: state.powerUps.map((u) => ({
      id: u.id,
      row: u.row,
      col: u.col,
      kind: u.kind,
    })),
    grid: state.grid,
    gameOver: state.gameOver,
    winner: state.winner,
    elapsed: state.elapsed,
  };
}

function applyStateSnapshot(state: GameState, payload: StateSyncPayload): void {
  for (const snap of payload.players) {
    const p = state.players[snap.id];
    if (!p) continue;
    // Don't overwrite local player's position — let local prediction stand
    if (snap.id !== localPlayerIndex) {
      p.row = snap.row;
      p.col = snap.col;
      p.px = snap.px;
      p.py = snap.py;
      p.vx = snap.vx;
      p.vy = snap.vy;
    }
    p.alive = snap.alive;
    p.score = snap.score;
    p.invincible = snap.invincible;
    p.moveDir = snap.moveDir as Direction | null;
    p.maxBalloons = snap.maxBalloons;
    p.balloonRange = snap.balloonRange;
    p.speed = snap.speed;
  }
  state.balloons = payload.balloons.map((b) => ({
    ...b,
    trapTimer: 0,
    el: null,
  }));
  state.explosions = payload.explosions;
  state.powerUps = payload.powerUps.map((u) => ({
    ...u,
    kind: u.kind as import("./game/types").PowerUpKind,
    el: null,
  }));
  if (payload.grid)
    state.grid = payload.grid as import("./game/types").TileType[][];
  state.gameOver = payload.gameOver;
  state.winner = payload.winner;
  state.elapsed = payload.elapsed;
}

// ─── Game Over ────────────────────────────────────────────────────────────────

function showGameOver(state: GameState): void {
  let text: string;
  if (state.winner !== null) {
    const w = state.players[state.winner];
    text = `${w?.hat ?? "🎉"} Player ${state.winner + 1} wins!`;
  } else {
    text = "🤝 Draw!";
  }
  msgBox.innerHTML = `<div class="msg-title">${text}</div>
    <button id="replay-btn" class="msg-btn">▶ Play Again</button>
    <button id="lobby-btn" class="msg-btn">🏠 Lobby</button>`;
  msgOverlay.classList.remove("hidden");
  (document.getElementById("replay-btn") as HTMLButtonElement).addEventListener(
    "click",
    () => startGame(isOnline ? (gameState?.players.length ?? 1) : 1),
  );
  (document.getElementById("lobby-btn") as HTMLButtonElement).addEventListener(
    "click",
    endGame,
  );
}

// ─── Net Status Display ───────────────────────────────────────────────────────

function setNetStatus(
  s: "idle" | "connecting" | "connected" | "disconnected",
): void {
  const labels: Record<string, string> = {
    idle: "Offline",
    connecting: "Waiting for players…",
    connected: "🟢 Online",
    disconnected: "🔴 Disconnected",
  };
  netStatus.textContent = labels[s] ?? s;
}

function setP2pMsg(text: string, kind: "ok" | "err" | "" = ""): void {
  p2pMsg.textContent = text;
  p2pMsg.className = "p2p-msg" + (kind ? ` p2p-msg-${kind}` : "");
}

// ─── P2P Panel ────────────────────────────────────────────────────────────────

function showP2pPanel(): void {
  p2pPanel.classList.remove("hidden");
  p2pHostStep.style.display = "none";
  p2pGuestStep.style.display = "none";
  setP2pMsg("Choose your role to start a multiplayer session.");
}

openP2pBtn.addEventListener("click", showP2pPanel);
p2pCloseBtn.addEventListener("click", () => {
  p2pPanel.classList.add("hidden");
  if (peer) {
    peer.disconnect();
    peer = null;
  }
  isOnline = false;
  setNetStatus("idle");
});

// ── Host flow ─────────────────────────────────────────────────────────────────

p2pHostBtn.addEventListener("click", async () => {
  if (peer) {
    peer.disconnect();
    peer = null;
  }
  isOnline = true;
  localPlayerIndex = 0;

  peer = new RoomPeer({
    onGuestJoined(count) {
      p2pGuestCount.textContent = `${count} guest${count !== 1 ? "s" : ""} connected`;
      (p2pStartGameBtn as HTMLButtonElement).disabled = false;
    },
    onConnectedToHost() {
      /* unused for host */
    },
    onDisconnected() {
      setNetStatus("disconnected");
      setP2pMsg("A guest disconnected.", "err");
    },
    onMessage(msg) {
      if (msg.type === "input") remoteInputQueue.push(msg);
    },
    onStatusChange(s) {
      setNetStatus(s);
    },
    onError(msg) {
      setP2pMsg(msg, "err");
    },
  });

  p2pHostStep.style.display = "block";
  p2pGuestStep.style.display = "none";
  p2pRoomCode.textContent = "…";
  setP2pMsg("Creating room…");

  try {
    const code = await peer.createRoom();
    p2pRoomCode.textContent = code;
    setP2pMsg("Share this code with friends. Up to 7 guests can join.", "ok");
  } catch (err) {
    setP2pMsg(String(err instanceof Error ? err.message : err), "err");
    peer = null;
    isOnline = false;
  }
});

p2pStartGameBtn.addEventListener("click", () => {
  if (!peer || peer.role !== "host") return;
  const total = peer.guestCount + 1;
  const map = MAPS.find((m) => m.id === selectedMapId) ?? MAPS[0];
  peer.broadcast({ type: "start", mapId: map.id, seed: 0, playerIndex: 0 });
  startGame(total);
});

// ── Guest flow ────────────────────────────────────────────────────────────────

p2pGuestBtn.addEventListener("click", () => {
  p2pGuestStep.style.display = "block";
  p2pHostStep.style.display = "none";
  setP2pMsg("Type the host's room code and click Join.");
});

p2pJoinBtn.addEventListener("click", joinAsGuest);
p2pJoinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinAsGuest();
});

async function joinAsGuest(): Promise<void> {
  const code = p2pJoinInput.value.trim().toUpperCase();
  if (!code) {
    setP2pMsg("Enter a room code.", "err");
    return;
  }
  if (peer) {
    peer.disconnect();
    peer = null;
  }

  isOnline = true;
  p2pJoinBtn.disabled = true;
  setP2pMsg("Connecting…");

  peer = new RoomPeer({
    onGuestJoined() {
      /* unused for guest */
    },
    onConnectedToHost(playerIndex) {
      localPlayerIndex = playerIndex;
      setP2pMsg(
        `Connected as Player ${playerIndex + 1}. Waiting for host to start…`,
        "ok",
      );
      setNetStatus("connected");
    },
    onDisconnected() {
      setNetStatus("disconnected");
      setP2pMsg("Disconnected from host.", "err");
    },
    onMessage(msg) {
      if (!gameState) {
        // Pre-game: wait for "start" broadcast from host
        if (msg.type === "start" && msg.mapId) {
          selectedMapId = msg.mapId;
          startGame(localPlayerIndex + 1);
        }
      } else {
        // In-game: apply authoritative state snapshots
        if (msg.type === "state_sync") {
          applyStateSnapshot(gameState, msg.payload);
        }
      }
    },
    onStatusChange(s) {
      setNetStatus(s);
    },
    onError(msg) {
      setP2pMsg(msg, "err");
      p2pJoinBtn.disabled = false;
      isOnline = false;
      peer = null;
    },
  });

  try {
    await peer.joinRoom(code);
    p2pJoinBtn.disabled = false;
  } catch (err) {
    setP2pMsg(String(err instanceof Error ? err.message : err), "err");
    p2pJoinBtn.disabled = false;
    isOnline = false;
    peer = null;
  }
}

// ─── Lobby / Navigation ───────────────────────────────────────────────────────

playBtn.addEventListener("click", () => {
  isOnline = false;
  localPlayerIndex = 0;
  startGame(1);
});

backBtn.addEventListener("click", endGame);

// ─── Debug Toggle ──────────────────────────────────────────────────────────────

const togglePill = debugToggle.querySelector(".toggle-pill") as HTMLElement;
let debugOn = false;
debugToggle.addEventListener("click", () => {
  debugOn = !debugOn;
  togglePill.classList.toggle("on", debugOn);
  if (gameState) gameState.showDebug = debugOn;
});

// ─── Init ─────────────────────────────────────────────────────────────────────

initRenderer(bgCanvas, spriteCanvas, debugCanvas);
buildMapGrid();
