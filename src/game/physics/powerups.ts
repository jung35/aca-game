import type { GameState, Player } from "../types";

export function checkPowerUpPickup(state: GameState, player: Player): void {
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
      /* kick mechanic — placeholder */
      break;
  }
}
