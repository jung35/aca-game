import type { GameState, Player, Balloon, Cell } from "../types";
import {
  COLS,
  ROWS,
  BALLOON_FUSE,
  EXPLOSION_LINGER,
  TRAP_FUSE,
  TRAP_PLAYER_FUSE,
  POWERUP_SPAWN_CHANCE,
  POWERUP_KINDS,
} from "../constants";
import { nextBalloonId, nextPowerUpId } from "../gameState";

export function placeBalloon(state: GameState, player: Player): boolean {
  if (!player.alive) return false;
  if (player.balloonCount >= player.maxBalloons) return false;
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

export function explodeBalloon(state: GameState, balloon: Balloon): void {
  const idx = state.balloons.indexOf(balloon);
  if (idx !== -1) state.balloons.splice(idx, 1);

  const owner = state.players.find((p) => p.id === balloon.ownerId);
  if (owner) owner.balloonCount = Math.max(0, owner.balloonCount - 1);

  const { row, col, range } = balloon;
  const affectedCells: Cell[] = [{ row, col }];

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
      if (state.grid[nr][nc] === 1) break;
      affectedCells.push({ row: nr, col: nc });
      if (state.grid[nr][nc] === 2) {
        state.grid[nr][nc] = 0;
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

  // Register explosion cells
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

  // Snapshot trap-balloon ids so we don't chain-detonate them
  const trapBalloonIds = new Set(
    state.players.filter(p => p.trappedInBalloon).map(p => p.trapBalloonId)
  );

  // Chain-detonate regular balloons caught in blast
  const chainTargets = state.balloons.filter((b) =>
    !trapBalloonIds.has(b.id) &&
    affectedCells.some((c) => c.row === b.row && c.col === b.col),
  );
  for (const b of chainTargets) {
    explodeBalloon(state, b);
  }

  // Hit players — trap if free, kill if already trapped
  for (const player of state.players) {
    if (!player.alive || player.invincible) continue;
    if (owner && owner.team > 0 && player.team === owner.team && player.id !== owner.id) continue;
    if (!affectedCells.some((c) => c.row === player.row && c.col === player.col)) continue;

    if (player.trappedInBalloon) {
      burstTrapBalloon(state, player, balloon.ownerId);
    } else {
      trapPlayerInBalloon(state, player, balloon.ownerId);
    }
  }

  // Trap regular balloons caught in blast
  for (const b of state.balloons) {
    if (
      !trapBalloonIds.has(b.id) &&
      affectedCells.some((c) => c.row === b.row && c.col === b.col) &&
      !b.trapped
    ) {
      b.trapped = true;
      b.trapTimer = TRAP_FUSE;
    }
  }
}

// ─── Player trap balloon ──

function trapPlayerInBalloon(
  state: GameState,
  player: Player,
  killerOwnerId: number,
): void {
  if (player.trappedInBalloon) return;

  const trapBalloon: Balloon = {
    id: nextBalloonId(state),
    row: player.row,
    col: player.col,
    ownerId: killerOwnerId,
    timer: TRAP_PLAYER_FUSE,
    range: 0,
    trapped: true,
    trapTimer: TRAP_PLAYER_FUSE,
    el: null,
  };
  state.balloons.push(trapBalloon);

  player.trappedInBalloon = true;
  player.trapBalloonId = trapBalloon.id;
  player.trapCountdown = TRAP_PLAYER_FUSE;
}

export function burstTrapBalloon(
  state: GameState,
  player: Player,
  killerId?: number,
): void {
  const trapBalloon = state.balloons.find(b => b.id === player.trapBalloonId);
  const killerOwnerId = killerId ?? trapBalloon?.ownerId ?? player.id;

  const balloonIdx = state.balloons.findIndex(b => b.id === player.trapBalloonId);
  if (balloonIdx !== -1) state.balloons.splice(balloonIdx, 1);

  player.trappedInBalloon = false;
  player.trapBalloonId = -1;
  player.trapCountdown = 0;

  killPlayer(state, player, killerOwnerId);
}

export function rescueTrappedPlayer(state: GameState, player: Player): void {
  const balloonIdx = state.balloons.findIndex(b => b.id === player.trapBalloonId);
  if (balloonIdx !== -1) state.balloons.splice(balloonIdx, 1);

  player.trappedInBalloon = false;
  player.trapBalloonId = -1;
  player.trapCountdown = 0;
  player.invincible = true;
  player.invincibleTimer = 2;
}

// Internal ─── ─────────────

function killPlayer(
  state: GameState,
  player: Player,
  killerOwnerId: number,
): void {
  player.alive = false;
  if (killerOwnerId !== player.id) {
    const killer = state.players.find((p) => p.id === killerOwnerId);
    if (killer) killer.score++;
  }

  // "Contenders" = alive and not stuck in a trap balloon (can still act)
  const alive = state.players.filter((p) => p.alive);
  const contenders = alive.filter((p) => !p.trappedInBalloon);

  const teamsInPlay = state.players.some((p) => p.team > 0);
  if (teamsInPlay) {
    const contenderTeams = new Set(contenders.map((p) => p.team));
    if (contenderTeams.size <= 1) {
      state.gameOver = true;
      state.running = false;
      if (contenders.length === 0) {
        state.winner = null;
        state.winnerTeam = null;
      } else {
        const winTeam = contenders[0].team;
        state.winnerTeam = winTeam > 0 ? winTeam : null;
        state.winner = winTeam === 0 ? contenders[0].id : null;
      }
    }
  } else {
    if (contenders.length <= 1) {
      state.gameOver = true;
      state.running = false;
      state.winner = contenders.length === 1 ? contenders[0].id : null;
      state.winnerTeam = null;
    }
  }
}
