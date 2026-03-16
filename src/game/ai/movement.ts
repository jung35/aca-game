import type { GameState, Player, Direction } from "../types";
import { isWalkable, directionDelta } from "../physics/helpers";
import { isSafe } from "./safety";

export function chooseDirection(
  state: GameState,
  player: Player,
): Direction | null {
  const dirs: Direction[] = ["up", "down", "left", "right"];
  const safe: Direction[] = [];
  const unsafe: Direction[] = [];

  for (const dir of dirs) {
    const [dr, dc] = directionDelta(dir);
    const nr = player.row + dr;
    const nc = player.col + dc;
    if (!isWalkable(state, nr, nc, player)) continue;
    if (isSafe(state, nr, nc)) safe.push(dir);
    else unsafe.push(dir);
  }

  if (!isSafe(state, player.row, player.col)) {
    const options = safe.length ? safe : unsafe;
    return options[Math.floor(Math.random() * options.length)] ?? null;
  }
  if (safe.length === 0) return null;
  return safe[Math.floor(Math.random() * safe.length)];
}
