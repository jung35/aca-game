import type { GameState, Player, TileType, MapDef } from "./types";
import {
  COLS,
  ROWS,
  DEFAULT_MAX_BALLOONS,
  DEFAULT_RANGE,
  DEFAULT_SPEED,
  PLAYER_COLORS,
  PLAYER_HATS,
} from "./constants";

let _balloonId = 0;
let _powerUpId = 0;

export function createPlayer(id: number, isAI: boolean): Player {
  // Spawn corners (row, col)
  const spawns: [number, number][] = [
    [1, 1],
    [1, COLS - 2],
    [ROWS - 2, 1],
    [ROWS - 2, COLS - 2],
  ];
  const [row, col] = spawns[id] ?? spawns[0];
  return {
    id,
    row,
    col,
    px: 0,
    py: 0,
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
    moving: false,
    moveDir: null,
    moveProgress: 0,
    fromRow: row,
    fromCol: col,
  };
}

export function createGameState(map: MapDef, numAI: number): GameState {
  _balloonId = 0;
  _powerUpId = 0;

  // Deep-copy grid from map (so we can mutate destructible blocks)
  const grid: TileType[][] = map.grid.map((r) => [...r]);

  const players: Player[] = [];
  // Player 0 is human
  players.push(createPlayer(0, false));
  for (let i = 1; i <= numAI; i++) {
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
