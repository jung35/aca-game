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
import type { PlayerConfig } from "./game/gameState";
import {
  initRenderer,
  resizeRenderer,
  drawBackground,
  drawSprites,
  drawDebug,
} from "./game/renderer/index";
import { drawPreviewCharacter } from "./game/renderer/sprites";
import {
  updateGame,
  setPlayerVelocity,
  placeBalloon,
} from "./game/physics/index";
import { initAI, updateAI } from "./game/ai/index";
import type { GameState, Direction } from "./game/types";
import { RoomPeer } from "./game/netcode/index";
import type { NetMessage, StateSyncPayload, LobbySlot } from "./game/netcode/index";
import {
  SKIN_TONES,
  TEAM_COLORS,
  OUTFIT_STYLES,
} from "./game/constants";
// ─── DOM References ────────────────────────────────────────────────────────────

const lobby = document.getElementById("lobby") as HTMLElement;
const gameWrap = document.getElementById("game-wrap") as HTMLElement;
const mapGrid = document.getElementById("map-grid") as HTMLElement;
const hudEl = document.getElementById("hud") as HTMLElement;
const msgOverlay = document.getElementById("msg-overlay") as HTMLElement;
const msgBox = document.getElementById("msg-box") as HTMLElement;
const netStatus = document.getElementById("net-status") as HTMLElement;
const netLatency = document.getElementById("net-latency") as HTMLElement;

// Buttons
const playBtn = document.getElementById("play-btn") as HTMLButtonElement;
const backBtn = document.getElementById("back-btn") as HTMLButtonElement;
const debugToggle = document.getElementById("debug-toggle") as HTMLElement;

// Room panel (always-on inline room UI)
const lobbyRoomCode = document.getElementById("lobby-room-code") as HTMLElement;
const roomStatusLine = document.getElementById("room-status-line") as HTMLElement;
const roomCopyBtn = document.getElementById("room-copy-btn") as HTMLButtonElement;
const roomRefreshBtn = document.getElementById("room-refresh-btn") as HTMLButtonElement;
const roomJoinInput = document.getElementById("room-join-input") as HTMLInputElement;
const roomJoinBtn = document.getElementById("room-join-btn") as HTMLButtonElement;
const roomJoinMsg = document.getElementById("room-join-msg") as HTMLElement;
const slotsGrid = document.getElementById("slots-grid") as HTMLElement;

// Canvases
const bgCanvas = document.getElementById("bg-canvas") as HTMLCanvasElement;
const spriteCanvas = document.getElementById("sprite-canvas") as HTMLCanvasElement;
const debugCanvas = document.getElementById("debug-canvas") as HTMLCanvasElement;

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

/** Last known direction per remote player index (host side). */
const remoteDir = new Map<number, Direction | null>();

// ─── Character Customization State ────────────────────────────────────────────

const CHAR_CONFIG_KEY = "crazarc_char_config";

interface CharConfig {
  outfit: string;
  skinTone: string;
  team: number; // 0 = none, 1-4 = team
}

let localCharConfig: CharConfig = {
  outfit: OUTFIT_STYLES[0].key,
  skinTone: SKIN_TONES[0],
  team: 1,
};

function loadCharConfig(): void {
  try {
    const saved = localStorage.getItem(CHAR_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<CharConfig>;
      localCharConfig = { ...localCharConfig, ...parsed };
    }
  } catch {}
}

function saveCharConfig(): void {
  try {
    localStorage.setItem(CHAR_CONFIG_KEY, JSON.stringify(localCharConfig));
  } catch {}
}

// Char preview canvas
let charPreviewAnimId = 0;

function buildCharPicker(): void {
  buildOutfitCards();
  buildSkinSwatches();
  renderCharPreview();
}

function buildOutfitCards(): void {
  const container = document.getElementById("outfit-cards");
  if (!container) return;
  container.innerHTML = "";
  for (const outfit of OUTFIT_STYLES) {
    const btn = document.createElement("button");
    btn.className = "outfit-card" + (outfit.key === localCharConfig.outfit ? " outfit-active" : "");
    btn.innerHTML = `<span class="outfit-emoji">${outfit.emoji}</span><span class="outfit-label">${outfit.label}</span>`;
    btn.title = outfit.label;
    btn.addEventListener("click", () => {
      localCharConfig.outfit = outfit.key;
      saveCharConfig();
      buildOutfitCards();
      renderCharPreview();
    });
    container.appendChild(btn);
  }
}

function buildSkinSwatches(): void {
  const container = document.getElementById("skin-swatches");
  if (!container) return;
  container.innerHTML = "";
  for (const tone of SKIN_TONES) {
    const btn = document.createElement("button");
    btn.className = "swatch" + (tone === localCharConfig.skinTone ? " swatch-active" : "");
    btn.style.background = tone;
    btn.title = tone;
    btn.addEventListener("click", () => {
      localCharConfig.skinTone = tone;
      saveCharConfig();
      container.querySelectorAll(".swatch").forEach(s => s.classList.remove("swatch-active"));
      btn.classList.add("swatch-active");
      renderCharPreview();
    });
    container.appendChild(btn);
  }
}

function renderCharPreview(): void {
  const canvas = document.getElementById("char-preview") as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  cancelAnimationFrame(charPreviewAnimId);

  function frame() {
    if (!ctx) return;
    const now = performance.now();
    ctx.clearRect(0, 0, canvas!.width, canvas!.height);
    ctx.save();
    // Centre in canvas, shift down so feet sit near the bottom (leaving ~8px gap)
    ctx.translate(canvas!.width / 2, canvas!.height - 8);
    drawPreviewCharacter(ctx, localCharConfig.outfit, localCharConfig.skinTone, localCharConfig.team, now);
    ctx.restore();
    charPreviewAnimId = requestAnimationFrame(frame);
  }

  frame();
}

// ─── Keyboard Input ────────────────────────────────────────────────────────────

const keysDown = new Set<string>();

document.addEventListener("keydown", (e) => {
  keysDown.add(e.code);
  if (e.code === "Space" || e.code === "KeyX") handleBalloon(localPlayerIndex);
  if (e.code === "KeyM") handleBalloon(localPlayerIndex);
});

document.addEventListener("keyup", (e) => {
  keysDown.delete(e.code);
});

function getDirForPlayer(idx: number): Direction | null {
  // In online mode the guest is always on their own machine — always use
  // Arrow / WASD as primary keys regardless of player slot index.
  // IJKL is kept as an alternative for local split-screen (solo only).
  if (idx === 0 || isOnline) {
    if (keysDown.has("ArrowUp")    || keysDown.has("KeyW")) return "up";
    if (keysDown.has("ArrowDown")  || keysDown.has("KeyS")) return "down";
    if (keysDown.has("ArrowLeft")  || keysDown.has("KeyA")) return "left";
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
  if (!player || !player.alive || player.trappedInBalloon) return;

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
// (buttons removed — keyboard only)


// ─── HUD ───────────────────────────────────────────────────────────────────────

function updateHUD(state: GameState): void {
  const TEAM_CLR = ["#ef5350","#42a5f5","#66bb6a","#ffa726"];
  const TEAM_NM  = ["Red","Blue","Green","Orange"];
  hudEl.innerHTML = state.players
    .map((p) => {
      const isLocal = p.id === localPlayerIndex && isOnline;
      const statusIcon = p.alive ? (p.invincible ? "⚡" : "❤️") : "💀";
      const marker = isLocal ? " ★" : "";
      const teamDot = p.team > 0
        ? `<span class="hud-team-dot" style="background:${TEAM_CLR[p.team-1]}" title="${TEAM_NM[p.team-1]} Team"></span>`
        : "";
      const displayName = p.name && p.name !== `P${p.id + 1}` ? p.name : `P${p.id + 1}`;
      return `<div class="hud-player${p.alive ? "" : " dead"}" style="border-color:${p.color};color:${p.color}">
        <span class="hud-hat">${p.hat}</span>
        <div style="flex:1;min-width:0;">
          <div class="hud-name">${displayName}${marker}${teamDot}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.5);display:flex;gap:4px;margin-top:1px;">
            <span title="Balloons">💣×${p.maxBalloons}</span>
            <span title="Range">💥${p.balloonRange}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
          <span class="hud-score">${p.score}</span>
          <span class="hud-status">${statusIcon}</span>
        </div>
      </div>`;
    })
    .join("");
}

// ─── Map Selection ────────────────────────────────────────────────────────────

/** Lock or unlock map cards. Guests cannot change the map. */
function setMapGridLocked(locked: boolean): void {
  mapGrid.classList.toggle("map-grid-locked", locked);
  mapGrid.querySelectorAll<HTMLButtonElement>(".map-card").forEach((btn) => {
    btn.disabled = locked;
  });
}

function buildMapGrid(): void {
  mapGrid.innerHTML = "";
  for (const map of MAPS) {
    const card = document.createElement("button");
    card.className = "map-card" + (map.id === selectedMapId ? " selected" : "");
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="map-emoji">${map.emoji}</span>
        <div style="text-align:left;">
          <div class="map-name">${map.name}</div>
          <div class="map-desc">${map.desc}</div>
        </div>
        ${map.id === selectedMapId ? '<span class="sel-badge">✔ SELECTED</span>' : ''}
      </div>`;
    card.addEventListener("click", () => {
      selectedMapId = map.id;
      buildMapGrid();
      // Broadcast map change to all guests if hosting
      if (peer?.role === "host") peer.broadcast({ type: "map_change", mapId: map.id });
    });
    mapGrid.appendChild(card);
  }
}

// ─── Game Start / Stop ────────────────────────────────────────────────────────

function startGame(numOnlinePlayers = 1): void {
  const map = MAPS.find((m) => m.id === selectedMapId) ?? MAPS[0];
  const numAI = isOnline ? aiSlots.size : Math.max(aiSlots.size, 1); // solo: at least 1 AI; online: host-added AI only
  const numHumans = isOnline ? numOnlinePlayers : 1;

  // Sorted AI slot indices so we can map grid-slot→team in a stable order
  const sortedAISlots = [...aiSlots].sort((a, b) => a - b);
  // If solo with no AI added yet, synthesise one extra slot (team 2 as complement to host team 1)
  const soloFallbackTeam = (slotTeams.get(0) ?? 1) % TEAM_COLORS.length + 1;

  // Build player configs — merge local config, guest configs, and host-assigned teams
  const playerConfigs: PlayerConfig[] = [];
  for (let i = 0; i < numHumans + numAI; i++) {
    if (i === localPlayerIndex) {
      playerConfigs[i] = {
        outfit: localCharConfig.outfit,
        skinTone: localCharConfig.skinTone,
        team: slotTeams.get(i) ?? 1,
        name: getPlayerName(),
      };
    } else if (i < numHumans) {
      // Other human players (online guests)
      const gc = guestConfigs.get(i);
      playerConfigs[i] = {
        outfit: gc?.outfit,
        skinTone: gc?.skinTone,
        team: slotTeams.get(i) ?? 1,
        name: connectedPlayers.get(i) ?? `P${i + 1}`,
      };
    } else {
      // AI players: map the (i - numHumans)-th AI to its grid slot index
      const aiIndex = i - numHumans;
      const gridSlot = sortedAISlots[aiIndex]; // undefined when solo fallback
      const team = gridSlot !== undefined
        ? (slotTeams.get(gridSlot) ?? soloFallbackTeam)
        : soloFallbackTeam;
      playerConfigs[i] = {
        team,
        name: gridSlot !== undefined ? `CPU ${gridSlot}` : "CPU",
      };
    }
  }

  gameState = createGameState(map, numAI, numHumans, playerConfigs);
  initAI(gameState);

  cancelAnimationFrame(charPreviewAnimId);

  lobby.classList.add("hidden");
  gameWrap.classList.remove("hidden");
  msgOverlay.classList.add("hidden");

  cancelAnimationFrame(rafId);
  lastTime = 0;
  // Let the DOM paint so offsetHeight values are correct before scaling
  requestAnimationFrame(() => {
    fitArena();
    rafId = requestAnimationFrame(gameLoop);
  });
}

function endGame(): void {
  cancelAnimationFrame(rafId);
  gameState = null;
  isOnline = false;
  localPlayerIndex = 0;
  peer?.disconnect();
  peer = null;
  remoteInputQueue.length = 0;
  remoteDir.clear();
  connectedPlayers.clear();
  aiSlots.clear();
  slotTeams.clear();
  guestConfigs.clear();
  msgOverlay.classList.add("hidden");
  gameWrap.classList.add("hidden");
  lobby.classList.remove("hidden");
  setMapGridLocked(false);
  buildMapGrid();
  buildSlotsGrid();
  renderCharPreview();
  // Re-create the host room so returning players can share a fresh code
  initHostRoom();
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
  if (localPlayer?.alive && !localPlayer.trappedInBalloon) {
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
  if (localPlayer?.alive && !localPlayer.trappedInBalloon) setPlayerVelocity(localPlayer, getDirForPlayer(0));

  // Process buffered guest inputs — update last-known direction per player
  const msgs = remoteInputQueue.splice(0);
  for (const msg of msgs) {
    if (msg.type === "input") {
      if (msg.action === "move") {
        remoteDir.set(msg.playerId, (msg.dir || null) as Direction | null);
      } else if (msg.action === "balloon") {
        const p = gameState.players[msg.playerId];
        if (p?.alive) placeBalloon(gameState, p);
      }
    }
  }

  // Re-apply last known velocity every frame for all remote players
  for (const [playerId, dir] of remoteDir) {
    const p = gameState.players[playerId];
    if (p?.alive) setPlayerVelocity(p, dir);
  }

  updateGame(gameState, dt);

  // Snapshot to guests at ~20Hz (every frame is fine; PeerJS will coalesce)
  peer.sendStateSync(buildStateSnapshot(gameState));
}

function guestFrame(_dt: number): void {
  if (!gameState || !peer) return;

  const dir = getDirForPlayer(localPlayerIndex);
  const localPlayer = gameState.players[localPlayerIndex];
  if (localPlayer?.alive && !localPlayer.trappedInBalloon) {
    // Send input to host every frame; host is authoritative for all physics
    peer.sendToHost({
      type: "input",
      playerId: localPlayerIndex,
      action: "move",
      dir: dir ?? "",
    });
  }
  // Guest does NOT run updateGame — all physics is authoritative on the host.
  // State is applied via applyStateSnapshot when state_sync messages arrive.
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
      trappedInBalloon: p.trappedInBalloon,
      trapBalloonId: p.trapBalloonId,
      trapCountdown: p.trapCountdown,
    })),
    balloons: state.balloons.map((b) => ({
      id: b.id,
      row: b.row,
      col: b.col,
      ownerId: b.ownerId,
      timer: b.timer,
      range: b.range,
      trapped: b.trapped,
      trapTimer: b.trapTimer,
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
    blockPowerUps: [...state.blockPowerUps.entries()],
    grid: state.grid,
    gameOver: state.gameOver,
    winner: state.winner,
    winnerTeam: state.winnerTeam,
    elapsed: state.elapsed,
  };
}

function applyStateSnapshot(state: GameState, payload: StateSyncPayload): void {
  for (const snap of payload.players) {
    const p = state.players[snap.id];
    if (!p) continue;
    // Host is authoritative for all player state including position
    p.row = snap.row;
    p.col = snap.col;
    p.px = snap.px;
    p.py = snap.py;
    p.vx = snap.vx;
    p.vy = snap.vy;
    p.alive = snap.alive;
    p.score = snap.score;
    p.invincible = snap.invincible;
    p.moveDir = snap.moveDir as Direction | null;
    p.maxBalloons = snap.maxBalloons;
    p.balloonRange = snap.balloonRange;
    p.speed = snap.speed;
    p.trappedInBalloon = snap.trappedInBalloon;
    p.trapBalloonId = snap.trapBalloonId;
    p.trapCountdown = snap.trapCountdown;
  }
  state.balloons = payload.balloons.map((b) => ({
    ...b,
    trapTimer: b.trapTimer,
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
  if (payload.blockPowerUps) {
    state.blockPowerUps = new Map(
      payload.blockPowerUps.map(([k, v]) => [k, v as import("./game/types").PowerUpKind | null])
    );
  }
  state.gameOver = payload.gameOver;
  state.winner = payload.winner;
  state.winnerTeam = payload.winnerTeam ?? null;
  state.elapsed = payload.elapsed;
}

// ─── Game Over ────────────────────────────────────────────────────────────────

function showGameOver(state: GameState): void {
  const TEAM_CLR = ["#ef5350","#42a5f5","#66bb6a","#ffa726"];
  const TEAM_NM  = ["Red","Blue","Green","Orange"];
  let text: string;
  if (state.winnerTeam !== null && state.winnerTeam > 0) {
    const tc = TEAM_CLR[state.winnerTeam - 1];
    const tn = TEAM_NM[state.winnerTeam - 1];
    text = `<span style="color:${tc}">🏆 ${tn} Team Wins!</span>`;
  } else if (state.winner !== null) {
    const w = state.players[state.winner];
    const name = w?.name && w.name !== `P${state.winner + 1}` ? w.name : `P${state.winner + 1}`;
    text = `${w?.hat ?? "🎉"} ${name} wins!`;
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
    idle: "🔴 Not connected",
    connecting: "🟡 Waiting for players…",
    connected: "🟢 Online",
    disconnected: "🔴 Disconnected",
  };
  netStatus.textContent = labels[s] ?? s;
}

function setRoomStatus(text: string, kind: "ok" | "err" | "" = ""): void {
  roomStatusLine.textContent = text;
  roomStatusLine.className = "room-status-line" + (kind ? ` room-status-${kind}` : "");
}

function setJoinMsg(text: string, kind: "ok" | "err" | "" = ""): void {
  roomJoinMsg.textContent = text;
  roomJoinMsg.className = "room-join-msg" + (kind ? ` room-join-${kind}` : "");
}

// ─── Slots Grid ───────────────────────────────────────────────────────────────

/** Connected guests: Map of playerIndex → name */
const connectedPlayers = new Map<number, string>();
/** Slots that the host has toggled to AI: Set of playerIndex (1-7) */
const aiSlots = new Set<number>();
/** Team assignment per slot index (0-7). Host-authoritative. 0 = no team. */
const slotTeams = new Map<number, number>();
/** Guest character configs received via "hello": playerIndex → config */
const guestConfigs = new Map<number, { outfit: string; skinTone: string }>();

/** Refresh the single Start button label + enabled state. */
function refreshStartBtn(): void {
  if (isOnline && peer?.role === "host") {
    // Online host: need at least one guest or one AI slot
    const hasPlayers = connectedPlayers.size > 0 || aiSlots.size > 0;
    playBtn.disabled = !hasPlayers;
    playBtn.textContent = "▶ Start Online";
  } else if (isOnline && peer?.role === "guest") {
    // Guest: cannot start
    playBtn.disabled = true;
    playBtn.textContent = "⏳ Waiting for host…";
  } else {
    // Solo: always ready — describe the team layout
    playBtn.disabled = false;
    playBtn.textContent = `▶ ${getSoloModeLabel()}`;
  }
}

/** Build a label like "1v1", "2v2", "1v3", "1v1v1v1" describing the match layout. */
function getSoloModeLabel(): string {
  // Slot 0 = human, sorted AI slots = opponents
  const sortedAISlots = [...aiSlots].sort((a, b) => a - b);
  const soloFallbackTeam = (slotTeams.get(0) ?? 1) % TEAM_COLORS.length + 1;

  // Build a map of team → player count
  const teamCounts = new Map<number, number>();
  // Human (slot 0)
  const humanTeam = slotTeams.get(0) ?? 1;
  teamCounts.set(humanTeam, (teamCounts.get(humanTeam) ?? 0) + 1);
  // AI slots (or 1 fallback)
  const aiCount = Math.max(aiSlots.size, 1);
  for (let a = 0; a < aiCount; a++) {
    const gridSlot = sortedAISlots[a];
    const team = gridSlot !== undefined
      ? (slotTeams.get(gridSlot) ?? soloFallbackTeam)
      : soloFallbackTeam;
    teamCounts.set(team, (teamCounts.get(team) ?? 0) + 1);
  }

  // Sort teams so biggest group is first, then join with "v"
  const groups = [...teamCounts.values()].sort((a, b) => b - a);
  return groups.join("v");
}
function updateCharPickerTeamBg(): void {
  const charPicker = document.getElementById("char-picker");
  if (!charPicker) return;
  const team = slotTeams.get(localPlayerIndex) ?? 0;
  if (team > 0) {
    const c = TEAM_COLORS[team - 1];
    charPicker.style.borderColor = c;
    charPicker.style.background = `${c}22`;
    charPicker.style.boxShadow = `0 0 18px ${c}44`;
  } else {
    charPicker.style.borderColor = "";
    charPicker.style.background = "";
    charPicker.style.boxShadow = "";
  }
}

function buildSlotsGrid(): void {
  slotsGrid.innerHTML = "";
  const MAX_SLOTS = 8;
  const isHost = !peer || peer.role === "host";

  for (let i = 0; i < MAX_SLOTS; i++) {
    const slot = document.createElement("div");
    const team = slotTeams.get(i) ?? 0;
    const teamColor = team > 0 ? TEAM_COLORS[team - 1] : null;
    const isMe = i === localPlayerIndex;

    // Determine slot name: guests read from connectedPlayers (populated from lobby_state)
    // Slot 0 name: host always knows their own name; guests receive it via lobby_state
    let slotName = "";
    let slotKind: "self" | "host" | "ready" | "ai" | "empty" = "empty";

    if (i === 0) {
      slotName = isHost ? getPlayerName() : (connectedPlayers.get(0) ?? "Host");
      slotKind = isMe ? "self" : "host";
    } else if (connectedPlayers.has(i)) {
      slotName = connectedPlayers.get(i)!;
      slotKind = isMe ? "self" : "ready";
    } else if (aiSlots.has(i)) {
      slotName = `CPU ${i}`;
      slotKind = "ai";
    } else {
      slotKind = "empty";
    }

    // Base class
    const classMap: Record<string, string> = {
      self: "slot-self", host: "slot-ready", ready: "slot-ready", ai: "slot-ai", empty: "slot-empty",
    };
    slot.className = `player-slot ${classMap[slotKind]}`;

    // Team color tint via border + shadow
    if (teamColor) {
      slot.style.borderColor = teamColor;
      slot.style.boxShadow = `0 0 10px ${teamColor}55`;
      slot.style.background = `${teamColor}22`;
    }

    // Build inner HTML
    const icon = slotKind === "self" ? "🎮" : slotKind === "ai" ? "🤖" : slotKind === "empty" ? "➕" : "👤";
    const tag = isMe
      ? `<span class="slot-tag">You</span>`
      : slotKind === "ready" || slotKind === "host"
        ? `<span class="slot-tag">READY</span>`
        : slotKind === "ai"
          ? `<span class="slot-tag">AI</span>`
          : "";
    const teamBadge = teamColor
      ? `<span class="slot-team-dot" style="background:${teamColor}"></span>`
      : "";

    slot.innerHTML = `<span class="slot-icon">${icon}</span><span class="slot-name">${slotName}${teamBadge}</span>${tag}`;

    // Host: kick button on human slots
    if (isHost && slotKind === "ready" && i !== 0) {
      const kickBtn = document.createElement("button");
      kickBtn.className = "slot-kick-btn";
      kickBtn.title = "Kick player";
      kickBtn.textContent = "✕";
      kickBtn.addEventListener("click", (e) => { e.stopPropagation(); kickPlayer(i); });
      slot.appendChild(kickBtn);
    }

    // Host: left-click empty→AI, click AI→empty
    if (isHost && slotKind === "empty") {
      slot.title = "Click to add AI";
      slot.style.cursor = "pointer";
      slot.addEventListener("click", () => { aiSlots.add(i); buildSlotsGrid(); broadcastLobbyState(); refreshStartBtn(); });
    } else if (isHost && slotKind === "ai") {
      slot.title = "Click to remove AI";
      slot.style.cursor = "pointer";
      slot.addEventListener("click", () => { aiSlots.delete(i); buildSlotsGrid(); broadcastLobbyState(); refreshStartBtn(); });
    }

    // Host: right-click any non-empty slot → cycle team
    if (isHost && slotKind !== "empty") {
      slot.title = (slot.title ? slot.title + " · " : "") + "Right-click to change team";
      slot.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const cur = slotTeams.get(i) ?? 1;
        // Cycle 1→2→3→4→1 (team 0 = no team is not allowed)
        slotTeams.set(i, (cur % TEAM_COLORS.length) + 1);
        // Update local player's team if host right-clicks their own slot
        if (i === 0) {
          localCharConfig.team = slotTeams.get(0) ?? 0;
          saveCharConfig();
          updateCharPickerTeamBg();
        }
        buildSlotsGrid();
        broadcastLobbyState();
        refreshStartBtn();
      });
    }

    // Update char picker background if this is the local player's slot
    if (isMe && teamColor) updateCharPickerTeamBg();

    slotsGrid.appendChild(slot);
  }

  // Also refresh char picker bg for the local player
  updateCharPickerTeamBg();
}

// ─── Host Room (auto-created on page load) ────────────────────────────────────

/** Broadcast current lobby state (slots + map) to all guests. Host only. */
function broadcastLobbyState(): void {
  if (!peer || peer.role !== "host") return;
  const slots: LobbySlot[] = [];
  for (let i = 0; i < 8; i++) {
    const team = slotTeams.get(i) ?? 0;
    if (i === 0) {
      slots.push({ index: 0, name: getPlayerName(), kind: "host", team });
    } else if (connectedPlayers.has(i)) {
      slots.push({ index: i, name: connectedPlayers.get(i)!, kind: "human", team });
    } else if (aiSlots.has(i)) {
      slots.push({ index: i, name: `CPU ${i}`, kind: "ai", team });
    } else {
      slots.push({ index: i, name: "", kind: "empty", team });
    }
  }
  peer.broadcast({ type: "lobby_state", slots, mapId: selectedMapId });
}

/** Host kicks a guest at the given player index. */
function kickPlayer(playerIndex: number): void {
  if (!peer || peer.role !== "host") return;
  // RoomPeer exposes sendToPlayer for targeted messages
  peer.sendToPlayer(playerIndex, { type: "kick" });
  connectedPlayers.delete(playerIndex);
  // Re-number remaining guests so the slot stays occupied
  buildSlotsGrid();
  broadcastLobbyState();
  refreshStartBtn();
}

async function initHostRoom(): Promise<void> {
  if (peer) {
    peer.disconnect();
    peer = null;
  }
  isOnline = false;
  localPlayerIndex = 0;
  connectedPlayers.clear();
  aiSlots.clear();
  slotTeams.clear();
  // Assign only the host's default team; empty slots get no team
  slotTeams.set(0, 1);
  guestConfigs.clear();
  setRoomStatus("Creating room…");

  peer = new RoomPeer({
    onGuestJoined(count, playerIndex) {
      setRoomStatus(`${count} guest${count !== 1 ? "s" : ""} connected — share the code!`, "ok");
      isOnline = true;
      // Name will arrive via "hello"; placeholder until then
      if (!connectedPlayers.has(playerIndex)) connectedPlayers.set(playerIndex, `P${playerIndex + 1}`);
      // Assign a default team for this new guest slot if not already set
      if (!slotTeams.has(playerIndex)) slotTeams.set(playerIndex, (playerIndex % TEAM_COLORS.length) + 1);
      buildSlotsGrid();
      broadcastLobbyState();
      refreshStartBtn();
    },
    onConnectedToHost() { /* host doesn't use this */ },
    onDisconnected(playerIndex?: number) {
      setNetStatus("disconnected");
      // Sync connected players from the authoritative peer connection map
      const active = peer?.activePlayerIndices ?? new Set<number>();
      for (const idx of [...connectedPlayers.keys()]) {
        if (!active.has(idx)) connectedPlayers.delete(idx);
      }

      // Mid-game: kill the disconnected player and check for game over
      if (gameState && playerIndex !== undefined) {
        remoteDir.delete(playerIndex); // stop applying stale inputs
        const p = gameState.players[playerIndex];
        if (p && p.alive) {
          p.alive = false;
          // Check if the game should end
          const stillAlive = gameState.players.filter(q => q.alive && !q.trappedInBalloon);
          const teamsInPlay = gameState.players.some(q => q.team > 0);
          if (teamsInPlay) {
            const teamsLeft = new Set(stillAlive.map(q => q.team));
            if (teamsLeft.size <= 1) {
              gameState.gameOver = true;
              gameState.running = false;
              gameState.winnerTeam = stillAlive[0]?.team ?? null;
              gameState.winner = null;
            }
          } else {
            if (stillAlive.length <= 1) {
              gameState.gameOver = true;
              gameState.running = false;
              gameState.winner = stillAlive[0]?.id ?? null;
              gameState.winnerTeam = null;
            }
          }
        }
      }

      // If not mid-game, clear the team assignment so the slot goes back to empty
      if (!gameState && playerIndex !== undefined) {
        slotTeams.delete(playerIndex);
      }

      const count = connectedPlayers.size;
      setRoomStatus(count > 0
        ? `${count} guest${count !== 1 ? "s" : ""} connected — share the code!`
        : "A guest disconnected.", count > 0 ? "ok" : "err");
      buildSlotsGrid();
      broadcastLobbyState();
      refreshStartBtn();
    },
    onMessage(msg) {
      if (msg.type === "hello") {
        // Guest introduced themselves — store name and char config
        connectedPlayers.set(msg.playerIndex, msg.name || `P${msg.playerIndex + 1}`);
        guestConfigs.set(msg.playerIndex, { outfit: msg.outfit, skinTone: msg.skinTone });
        buildSlotsGrid();
        broadcastLobbyState();
        return;
      }
      if (msg.type === "input") remoteInputQueue.push(msg);
      if (msg.type === "state_sync" && gameState) {
        applyStateSnapshot(gameState, msg.payload);
      }
    },
    onStatusChange(s) { setNetStatus(s); },
    onError(msg) { setRoomStatus(msg, "err"); },
  });

  try {
    const code = await peer.createRoom();
    lobbyRoomCode.textContent = code;
    setRoomStatus("Share this code with friends — up to 7 can join.");
    refreshStartBtn();
  } catch (err) {
    lobbyRoomCode.textContent = "ERR";
    setRoomStatus(String(err instanceof Error ? err.message : err), "err");
    peer = null;
  }
}

// Copy room code to clipboard
roomCopyBtn.addEventListener("click", () => {
  const code = lobbyRoomCode.textContent ?? "";
  if (code && code !== "……" && code !== "ERR") {
    navigator.clipboard.writeText(code).then(() => {
      roomCopyBtn.textContent = "✅";
      setTimeout(() => (roomCopyBtn.textContent = "📋"), 1500);
    });
  }
});

// Refresh = create a new room
roomRefreshBtn.addEventListener("click", () => {
  connectedPlayers.clear();
  buildSlotsGrid();
  initHostRoom();
});

// Single unified Start button — solo or online depending on state
playBtn.addEventListener("click", () => {
  if (isOnline && peer?.role === "host") {
    // Online host start
    const total = peer.guestCount + 1;
    const map = MAPS.find((m) => m.id === selectedMapId) ?? MAPS[0];
    const numAI = aiSlots.size;
    const serializedConfigs = Array.from({ length: total + numAI }, (_, i) => {
      const team = slotTeams.get(i) ?? 1;
      if (i === 0) {
        return { name: getPlayerName(), outfit: localCharConfig.outfit, skinTone: localCharConfig.skinTone, team };
      }
      const gc = guestConfigs.get(i);
      return { name: connectedPlayers.get(i) ?? `P${i + 1}`, outfit: gc?.outfit ?? "", skinTone: gc?.skinTone ?? "", team };
    });
    peer.broadcast({ type: "start", mapId: map.id, seed: 0, playerIndex: 0, playerCount: total, playerConfigs: serializedConfigs });
    startGame(total);
  } else if (!isOnline) {
    // Solo vs AI
    startGame(1);
  }
});

// ─── Join a Room ──────────────────────────────────────────────────────────────

roomJoinBtn.addEventListener("click", joinAsGuest);
roomJoinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinAsGuest();
});

async function joinAsGuest(): Promise<void> {
  const code = roomJoinInput.value.trim().toUpperCase();
  if (!code) { setJoinMsg("Enter a room code.", "err"); return; }

  // Destroy the host room we auto-created
  if (peer) { peer.disconnect(); peer = null; }

  isOnline = true;
  roomJoinBtn.disabled = true;
  setJoinMsg("Connecting…");

  peer = new RoomPeer({
    onGuestJoined() { /* guest doesn't use this */ },
    onConnectedToHost(playerIndex) {
      localPlayerIndex = playerIndex;
      setJoinMsg(`Connected as P${playerIndex + 1} — waiting for host to start…`, "ok");
      setNetStatus("connected");
      lobbyRoomCode.textContent = code;
      setRoomStatus(`Joined room ${code} as P${playerIndex + 1}`, "ok");
      refreshStartBtn(); // guest: button disabled with "waiting for host"

      // Introduce ourselves to the host
      peer?.sendToHost({
        type: "hello",
        name: getPlayerName(),
        playerIndex,
        outfit: localCharConfig.outfit,
        skinTone: localCharConfig.skinTone,
      });

      // Lock map selection — guest cannot change map
      setMapGridLocked(true);
    },
    onDisconnected(_playerIndex?: number) {
      roomJoinBtn.disabled = false;
      setMapGridLocked(false);
      connectedPlayers.clear();
      buildSlotsGrid();
    },
    onMessage(msg) {
      if (msg.type === "kick") {
        setJoinMsg("You were kicked from the room.", "err");
        isOnline = false;
        peer?.disconnect();
        peer = null;
        roomJoinBtn.disabled = false;
        setMapGridLocked(false);
        connectedPlayers.clear();
        buildSlotsGrid();
        initHostRoom();
        return;
      }
      if (msg.type === "lobby_state") {
        // Update slots from host's authoritative lobby state
        connectedPlayers.clear();
        aiSlots.clear();
        slotTeams.clear();
        for (const s of msg.slots) {
          if (s.kind === "host") connectedPlayers.set(s.index, s.name);
          if (s.kind === "human") connectedPlayers.set(s.index, s.name);
          if (s.kind === "ai") aiSlots.add(s.index);
          if (s.team > 0) slotTeams.set(s.index, s.team);
        }
        buildSlotsGrid();
        updateCharPickerTeamBg();
        // Update map selection to match host
        if (msg.mapId && msg.mapId !== selectedMapId) {
          selectedMapId = msg.mapId;
          buildMapGrid();
        }
        return;
      }
      if (msg.type === "map_change") {
        selectedMapId = msg.mapId;
        buildMapGrid();
        return;
      }
      if (!gameState) {
        if (msg.type === "start" && msg.mapId) {
          selectedMapId = msg.mapId;
          const total = msg.playerCount ?? localPlayerIndex + 1;
          // Apply host-provided player configs (outfit, skin, team, name for all slots)
          if (msg.playerConfigs) {
            guestConfigs.clear();
            slotTeams.clear();
            msg.playerConfigs.forEach((cfg, i) => {
              if (i === localPlayerIndex) return; // own config stays as-is
              guestConfigs.set(i, { outfit: cfg.outfit, skinTone: cfg.skinTone });
              if (cfg.team > 0) slotTeams.set(i, cfg.team);
            });
            // Apply own team from the host's config
            const myTeam = msg.playerConfigs[localPlayerIndex]?.team ?? 0;
            slotTeams.set(localPlayerIndex, myTeam);
          }
          setMapGridLocked(false);
          startGame(total);
        }
      } else {
        if (msg.type === "state_sync") {
          applyStateSnapshot(gameState, msg.payload);
        }
      }
    },
    onStatusChange(s) { setNetStatus(s); },
    onError(msg) {
      setJoinMsg(msg, "err");
      roomJoinBtn.disabled = false;
      isOnline = false;
      peer = null;
      setMapGridLocked(false);
      // Re-create host room after failed join
      initHostRoom();
    },
  });

  try {
    await peer.joinRoom(code);
    roomJoinBtn.disabled = false;
  } catch (err) {
    setJoinMsg(String(err instanceof Error ? err.message : err), "err");
    roomJoinBtn.disabled = false;
    isOnline = false;
    peer = null;
    setMapGridLocked(false);
    initHostRoom();
  }
}

// ─── Lobby / Navigation ───────────────────────────────────────────────────────

backBtn.addEventListener("click", endGame);

// ─── Debug Toggle ──────────────────────────────────────────────────────────────

const togglePill = debugToggle.querySelector(".toggle-pill") as HTMLElement;
let debugOn = false;
debugToggle.addEventListener("click", () => {
  debugOn = !debugOn;
  togglePill.classList.toggle("on", debugOn);
  debugCanvas.classList.toggle("vis", debugOn);
  if (!debugOn) {
    const ctx = debugCanvas.getContext("2d")!;
    ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
  }
  if (gameState) gameState.showDebug = debugOn;
});

// ─── Player Name ──────────────────────────────────────────────────────────────

const NAME_KEY = "crazarc_player_name";

const RANDOM_NAMES = [
  "BombKing", "PixelPete", "BlastQueen", "NeonNinja", "FuseWizard",
  "TurboToad", "GlitchGuru", "ChaosClown", "MegaMuffin", "ZapZebra",
  "RocketRex", "BubbleBob", "CrunchBear", "StormRider", "SparkPlug",
  "WarpWalrus", "DoomDuck", "BounceBoss", "VortexVic", "PanicPanda",
];

function randomName(): string {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
}

const nameInput = document.getElementById("name-input") as HTMLInputElement;
const nameRandomBtn = document.getElementById("name-random-btn") as HTMLButtonElement;

function loadName(): string {
  return localStorage.getItem(NAME_KEY) || randomName();
}

function saveName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim() || randomName());
}

nameInput.value = loadName();
nameInput.addEventListener("change", () => saveName(nameInput.value));
nameInput.addEventListener("blur", () => {
  if (!nameInput.value.trim()) nameInput.value = randomName();
  saveName(nameInput.value);
});
nameRandomBtn.addEventListener("click", () => {
  nameInput.value = randomName();
  saveName(nameInput.value);
});

export function getPlayerName(): string {
  return nameInput.value.trim() || loadName();
}

// ─── Arena Scale-to-Fit ───────────────────────────────────────────────────────

function fitArena(): void {
  const gameBody = document.getElementById("game-body") as HTMLElement | null;
  const sidebar  = document.getElementById("sidebar")   as HTMLElement | null;
  const topbar   = document.getElementById("game-topbar") as HTMLElement | null;
  const tip      = document.getElementById("tip")         as HTMLElement | null;

  const totalW   = gameBody?.offsetWidth  ?? window.innerWidth;
  const sidebarW = (sidebar?.offsetWidth  ?? 0) + 10; // +gap
  const topH     = (topbar?.offsetHeight  ?? 0) + 6;
  const tipH     = (tip?.offsetHeight     ?? 0) + 5;

  const availW = Math.max(totalW - sidebarW - 8, 100);
  const availH = Math.max(window.innerHeight - topH - tipH - 16, 100);
  resizeRenderer(availW, availH);
}

window.addEventListener("resize", () => {
  if (!gameWrap.classList.contains("hidden")) fitArena();
});

// ─── Init ─────────────────────────────────────────────────────────────────────

initRenderer(bgCanvas, spriteCanvas, debugCanvas);
buildMapGrid();
loadCharConfig();
buildCharPicker();
buildSlotsGrid();
refreshStartBtn();
initHostRoom();
