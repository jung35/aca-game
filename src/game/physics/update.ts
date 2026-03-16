import type { GameState, Balloon } from "../types";
import { updateMovement } from "./movement";
import { explodeBalloon, burstTrapBalloon, rescueTrappedPlayer } from "./balloons";
import { checkPowerUpPickup } from "./powerups";
import { CELL_W, CELL_H } from "../constants";

const RESCUE_DIST_SQ = (CELL_W * 0.6) ** 2; // pixels² — how close to trigger rescue/kill

export function updateGame(state: GameState, dt: number): void {
  if (!state.running || state.paused || state.gameOver) return;

  state.elapsed += dt;

  // Update player movement & invincibility
  for (const p of state.players) {
    if (!p.alive) continue;

    if (p.trappedInBalloon) {
      // Trapped players cannot move — stop velocity and count down
      p.vx = 0;
      p.vy = 0;
      p.moveDir = null;
      p.walkTime = 0;
      p.trapCountdown -= dt;

      if (p.trapCountdown <= 0) {
        // Time's up — burst the balloon and kill the player
        burstTrapBalloon(state, p);
        continue;
      }

      // Keep the trap balloon's position synced to player (in case player was mid-cell)
      const trapBalloon = state.balloons.find(b => b.id === p.trapBalloonId);
      if (trapBalloon) {
        trapBalloon.timer = p.trapCountdown;
        trapBalloon.trapTimer = p.trapCountdown;
      }
    } else {
      updateMovement(state, p, dt);
    }

    if (p.invincible) {
      p.invincibleTimer -= dt;
      if (p.invincibleTimer <= 0) p.invincible = false;
    }
    checkPowerUpPickup(state, p);
  }

  // Check for players touching trapped-player balloons (rescue or kill)
  for (const trapped of state.players) {
    if (!trapped.alive || !trapped.trappedInBalloon) continue;
    const trapBalloon = state.balloons.find(b => b.id === trapped.trapBalloonId);
    if (!trapBalloon) continue;

    // Pixel centre of the trap balloon
    const bpx = trapBalloon.col * CELL_W + CELL_W / 2;
    const bpy = trapBalloon.row * CELL_H + CELL_H / 2;

    for (const other of state.players) {
      if (!other.alive || other.id === trapped.id || other.trappedInBalloon) continue;
      const dx = other.px - bpx;
      const dy = other.py - bpy;
      if (dx * dx + dy * dy > RESCUE_DIST_SQ) continue;

      const isFriendly =
        trapped.team > 0 && other.team === trapped.team && other.id !== trapped.id;

      if (isFriendly) {
        rescueTrappedPlayer(state, trapped);
      } else {
        // Enemy contact — burst and kill
        burstTrapBalloon(state, trapped);
      }
      break; // only one interaction per trapped player per frame
    }
  }

  // Update regular balloons (not trap-player balloons — those are managed above)
  const toExplode: Balloon[] = [];
  for (const b of [...state.balloons]) {
    // Skip trap-player balloons (timer managed via player.trapCountdown)
    if (state.players.some(p => p.trappedInBalloon && p.trapBalloonId === b.id)) continue;

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
