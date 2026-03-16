import type { GameState, Player, TileType, MapDef } from "./types";
import {
  DEFAULT_MAX_BALLOONS,
  DEFAULT_RANGE,
  DEFAULT_SPEED,
  PLAYER_COLORS,
  PLAYER_HATS,
  CELL_W,
  CELL_H,
  SKIN_TONES,
  OUTFIT_STYLES,
} from "./constants";

let _balloonId = 0;
let _powerUpId = 0;

export interface PlayerConfig {
  team?: number;
  outfit?: string;
  skinTone?: string;
  name?: string;
}

export function createPlayer(
  id: number,
  isAI: boolean,
  cfg: PlayerConfig = {},
  row = 1,
  col = 1,
): Player {
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
    lastDir: "down",
    team: cfg.team ?? 0,
    outfit: cfg.outfit ?? OUTFIT_STYLES[id % OUTFIT_STYLES.length].key,
    skinTone: cfg.skinTone ?? SKIN_TONES[id % SKIN_TONES.length],
    name: cfg.name ?? `P${id + 1}`,
    walkTime: 0,
    trappedInBalloon: false,
    trapBalloonId: -1,
    trapCountdown: 0,
  };
}

export function createGameState(
  map: MapDef,
  numAI: number,
  numHumans = 1,
  playerConfigs: PlayerConfig[] = [],
): GameState {
  _balloonId = 0;
  _powerUpId = 0;

  // Deep-copy grid from map (so we can mutate destructible blocks)
  // Collect spawn points (TileType 3) and convert them to floor (0) in the live grid
  const grid: TileType[][] = map.grid.map((r) => [...r]);
  const spawns: [number, number][] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === 3) {
        spawns.push([r, c]);
        grid[r][c] = 0;
      }
    }
  }

  const players: Player[] = [];

  // Shuffle spawn points and assign one per player
  const shuffledSpawns = spawns.sort(() => Math.random() - 0.5);
  const totalPlayers = numHumans + numAI;
  const getSpawn = (i: number): [number, number] =>
    shuffledSpawns[i % shuffledSpawns.length];

  // First numHumans slots are human; rest are AI
  for (let i = 0; i < numHumans; i++) {
    const [row, col] = getSpawn(i);
    players.push(createPlayer(i, false, playerConfigs[i] ?? {}, row, col));
  }
  for (let i = numHumans; i < totalPlayers; i++) {
    const [row, col] = getSpawn(i);
    players.push(createPlayer(i, true, playerConfigs[i] ?? {}, row, col));
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
    winnerTeam: null,
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
