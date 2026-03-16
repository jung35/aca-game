import type { GameState, Player, TileType, MapDef } from "./types";
import {
  DEFAULT_MAX_BALLOONS,
  DEFAULT_RANGE,
  DEFAULT_SPEED,
  PLAYER_COLORS,
  PLAYER_HATS,
  CELL_W,
  CELL_H,
} from "./constants";

let _balloonId = 0;
let _powerUpId = 0;

export function createPlayer(id: number, isAI: boolean): Player {
  // 8 spawn positions spread around the 21×17 arena
  // Corners + mid-edge points — all have 2-cell clear radius in the maps
  const spawns: [number, number][] = [
    [1, 1], // P1 top-left
    [1, 19], // P2 top-right
    [15, 1], // P3 bottom-left
    [15, 19], // P4 bottom-right
    [1, 10], // P5 top-mid
    [8, 1], // P6 mid-left
    [8, 19], // P7 mid-right
    [15, 10], // P8 bottom-mid
  ];
  const [row, col] = spawns[id] ?? spawns[0];
  return {
    id,
    row,
    col,
    px: col * CELL_W + CELL_W / 2,
    py: row * CELL_H + CELL_H / 2,
    vx: 0,
    vy: 0,
    color: PLAYER_COLORS[id] ?? "#ffffff",
    hat: PLAYER_HATS[id] ?? "🎩",
    maxBalloons: DEFAULT_MAX_BALLOONS,
    balloonRange: DEFAULT_RANGE,
    speed: DEFAULT_SPEED,
    alive: true,
    isAI,
    score: 0,
    balloonCount: 0,
    invincible: false,
    invincibleTimer: 0,
    moveDir: null,
  };
}

export function createGameState(
  map: MapDef,
  numAI: number,
  numHumans = 1,
): GameState {
  _balloonId = 0;
  _powerUpId = 0;

  // Deep-copy grid from map (so we can mutate destructible blocks)
  const grid: TileType[][] = map.grid.map((r) => [...r]);

  const players: Player[] = [];
  // First numHumans slots are human; rest are AI
  for (let i = 0; i < numHumans; i++) {
    players.push(createPlayer(i, false));
  }
  for (let i = numHumans; i < numHumans + numAI; i++) {
    players.push(createPlayer(i, true));
  }

  return {
    map,
    grid,
    players,
    balloons: [],
    explosions: [],
    powerUps: [],
    running: true,
    paused: false,
    gameOver: false,
    winner: null,
    nextBalloonId: _balloonId,
    nextPowerUpId: _powerUpId,
    showDebug: false,
    elapsed: 0,
  };
}

export function nextBalloonId(state: GameState): number {
  return state.nextBalloonId++;
}

export function nextPowerUpId(state: GameState): number {
  return state.nextPowerUpId++;
}
