import type { GameState, Player, Balloon, Direction, Cell } from "./types";
import {
  COLS,
  ROWS,
  CELL_W,
  CELL_H,
  BALLOON_FUSE,
  EXPLOSION_LINGER,
  TRAP_FUSE,
  POWERUP_SPAWN_CHANCE,
  POWERUP_KINDS,
} from "./constants";
import { nextBalloonId, nextPowerUpId } from "./gameState";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function cellToPixel(
  row: number,
  col: number,
): { px: number; py: number } {
  return {
    px: col * CELL_W + CELL_W / 2,
    py: row * CELL_H + CELL_H / 2,
  };
}

export function isWalkable(
  state: GameState,
  row: number,
  col: number,
): boolean {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
  if (state.grid[row][col] !== 0) return false;
  // Can't walk into a cell with a balloon
  if (state.balloons.some((b) => b.row === row && b.col === col)) return false;
  return true;
}

export function directionDelta(dir: Direction): [number, number] {
  switch (dir) {
    case "up":
      return [-1, 0];
    case "down":
      return [1, 0];
    case "left":
      return [0, -1];
    case "right":
      return [0, 1];
  }
}

// ─── Movement ─────────────────────────────────────────────────────────────────

export function startMove(
  state: GameState,
  player: Player,
  dir: Direction,
): boolean {
  if (player.moving) return false;
  const [dr, dc] = directionDelta(dir);
  const nr = player.row + dr;
  const nc = player.col + dc;
  if (!isWalkable(state, nr, nc)) return false;

  player.fromRow = player.row;
  player.fromCol = player.col;
  player.moving = true;
  player.moveDir = dir;
  player.moveProgress = 0;
  player.row = nr;
  player.col = nc;
  return true;
}

export function updateMovement(player: Player, dt: number): void {
  if (!player.moving) {
    const { px, py } = cellToPixel(player.row, player.col);
    player.px = px;
    player.py = py;
    return;
  }

  player.moveProgress += dt * player.speed;
  if (player.moveProgress >= 1) {
    player.moveProgress = 1;
    player.moving = false;
    player.moveDir = null;
  }

  const t = player.moveProgress;
  const from = cellToPixel(player.fromRow, player.fromCol);
  const to = cellToPixel(player.row, player.col);
  player.px = from.px + (to.px - from.px) * t;
  player.py = from.py + (to.py - from.py) * t;
}

// ─── Balloons ─────────────────────────────────────────────────────────────────

export function placeBalloon(state: GameState, player: Player): boolean {
  if (!player.alive) return false;
  if (player.balloonCount >= player.maxBalloons) return false;
  // Don't place on top of existing balloon
  if (state.balloons.some((b) => b.row === player.row && b.col === player.col))
    return false;

  const balloon: Balloon = {
    id: nextBalloonId(state),
    row: player.row,
    col: player.col,
    ownerId: player.id,
    timer: BALLOON_FUSE,
    range: player.balloonRange,
    trapped: false,
    trapTimer: 0,
    el: null,
  };

  state.balloons.push(balloon);
  player.balloonCount++;
  return true;
}

// ─── Explosion ────────────────────────────────────────────────────────────────

function explodeBalloon(state: GameState, balloon: Balloon): void {
  // Remove balloon from array
  const idx = state.balloons.indexOf(balloon);
  if (idx !== -1) state.balloons.splice(idx, 1);

  const owner = state.players.find((p) => p.id === balloon.ownerId);
  if (owner) owner.balloonCount = Math.max(0, owner.balloonCount - 1);

  const { row, col, range } = balloon;
  const affectedCells: Cell[] = [{ row, col }];

  // Spread in 4 directions
  const dirs: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of dirs) {
    for (let r = 1; r <= range; r++) {
      const nr = row + dr * r;
      const nc = col + dc * r;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
      if (state.grid[nr][nc] === 1) break; // solid wall stops blast
      affectedCells.push({ row: nr, col: nc });
      if (state.grid[nr][nc] === 2) {
        // Destructible block — destroy it and stop
        state.grid[nr][nc] = 0;
        // Maybe spawn power-up
        if (Math.random() < POWERUP_SPAWN_CHANCE) {
          const kind =
            POWERUP_KINDS[Math.floor(Math.random() * POWERUP_KINDS.length)];
          state.powerUps.push({
            id: nextPowerUpId(state),
            row: nr,
            col: nc,
            kind,
            el: null,
          });
        }
        break;
      }
    }
  }

  // Register explosion cells (linger for rendering)
  for (const c of affectedCells) {
    const existing = state.explosions.find(
      (e) => e.row === c.row && e.col === c.col,
    );
    if (existing) {
      existing.timer = EXPLOSION_LINGER;
    } else {
      state.explosions.push({ ...c, timer: EXPLOSION_LINGER });
    }
  }

  // Chain-detonate any balloon caught in the blast
  const chainTargets = state.balloons.filter((b) =>
    affectedCells.some((c) => c.row === b.row && c.col === b.col),
  );
  for (const b of chainTargets) {
    explodeBalloon(state, b);
  }

  // Kill / score players in blast
  for (const player of state.players) {
    if (!player.alive || player.invincible) continue;
    if (
      affectedCells.some((c) => c.row === player.row && c.col === player.col)
    ) {
      killPlayer(state, player, balloon.ownerId);
    }
  }

  // Trap players who placed on the same cell (water trap mechanic)
  for (const b of state.balloons) {
    if (
      affectedCells.some((c) => c.row === b.row && c.col === b.col) &&
      !b.trapped
    ) {
      b.trapped = true;
      b.trapTimer = TRAP_FUSE;
    }
  }
}

function killPlayer(
  state: GameState,
  player: Player,
  killerOwnerId: number,
): void {
  player.alive = false;
  // Award point to killer if not self-kill
  if (killerOwnerId !== player.id) {
    const killer = state.players.find((p) => p.id === killerOwnerId);
    if (killer) killer.score++;
  }

  const alive = state.players.filter((p) => p.alive);
  if (alive.length <= 1) {
    state.gameOver = true;
    state.running = false;
    state.winner = alive.length === 1 ? alive[0].id : null;
  }
}

// ─── Power-up pickup ──────────────────────────────────────────────────────────

function checkPowerUpPickup(state: GameState, player: Player): void {
  const idx = state.powerUps.findIndex(
    (p) => p.row === player.row && p.col === player.col,
  );
  if (idx === -1) return;
  const pu = state.powerUps[idx];
  state.powerUps.splice(idx, 1);

  switch (pu.kind) {
    case "range":
      player.balloonRange = Math.min(player.balloonRange + 1, 8);
      break;
    case "extra":
      player.maxBalloons = Math.min(player.maxBalloons + 1, 5);
      break;
    case "speed":
      player.speed = Math.min(player.speed + 0.8, 9);
      break;
    case "kick":
      /* kick mechanic — placeholder */ break;
  }
}

// ─── Main Update ──────────────────────────────────────────────────────────────

export function updateGame(state: GameState, dt: number): void {
  if (!state.running || state.paused || state.gameOver) return;

  state.elapsed += dt;

  // Update player movement & invincibility
  for (const p of state.players) {
    if (!p.alive) continue;
    updateMovement(p, dt);
    if (p.invincible) {
      p.invincibleTimer -= dt;
      if (p.invincibleTimer <= 0) p.invincible = false;
    }
    if (!p.moving) checkPowerUpPickup(state, p);
  }

  // Update balloons
  const toExplode: Balloon[] = [];
  for (const b of [...state.balloons]) {
    if (b.trapped) {
      b.trapTimer -= dt;
      if (b.trapTimer <= 0) {
        b.trapped = false;
        b.timer = Math.max(b.timer, 0.05);
      }
    } else {
      b.timer -= dt;
      if (b.timer <= 0) toExplode.push(b);
    }
  }
  for (const b of toExplode) {
    if (state.balloons.includes(b)) explodeBalloon(state, b);
  }

  // Decay explosion cells
  state.explosions = state.explosions.filter((e) => {
    e.timer -= dt;
    return e.timer > 0;
  });
}
