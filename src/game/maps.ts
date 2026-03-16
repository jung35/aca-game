import type { MapDef, TileType } from "./types";

const W: TileType = 1; // solid wall
const B: TileType = 2; // destructible block
const _: TileType = 0; // floor
const S: TileType = 3; // spawn point (acts as floor)

// 21 cols × 17 rows
// Spawn points are marked with S (TileType = 3) directly in the grid.
// They act as floor tiles at runtime; players are randomly assigned to them.

export const MAPS: MapDef[] = [
  {
    id: "classic",
    name: "Classic",
    emoji: "🏙️",
    desc: "Original style — 21×17, up to 8 players",
    floorColor: "#c8a468",   // warm tan wood
    wallColor: "#5a3e28",    // dark brown
    blockColor: "#a0704a",   // medium brown crate
    accentColor: "#e8c98a",
    grid: [
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
      [W, S, _, B, B, B, B, B, B, _, S, _, B, B, B, B, B, B, _, S, W],
      [W, _, W, B, W, B, W, B, W, B, _, B, W, B, W, B, W, B, W, _, W],
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      [W, _, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, _, W],
      [W, S, _, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, _, S, W],
      [W, _, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, _, W],
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      [W, _, W, B, W, B, W, B, W, B, _, B, W, B, W, B, W, B, W, _, W],
      [W, S, _, B, B, B, B, B, B, _, S, _, B, B, B, B, B, B, _, S, W],
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    ] as TileType[][],
  },
  {
    id: "island",
    name: "Island",
    emoji: "🏝️",
    desc: "Open centre, dense edges — 8 players",
    floorColor: "#e8c56e",   // golden sandy
    wallColor: "#7b5e3a",    // dark sand/wood
    blockColor: "#b8905a",   // sandy crate
    accentColor: "#fff4c2",
    grid: [
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
      [W, S, _, _, B, B, B, B, B, B, S, B, B, B, B, B, B, _, _, S, W],
      [W, _, W, B, W, _, W, _, W, _, W, _, W, _, W, _, W, B, W, _, W],
      [W, _, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, _, W],
      [W, B, W, _, W, B, W, B, W, B, W, B, W, B, W, B, W, _, W, B, W],
      [W, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, W],
      [W, B, W, _, W, B, W, B, W, B, W, B, W, B, W, B, W, _, W, B, W],
      [W, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, W],
      [W, S, W, _, W, _, W, _, W, _, W, _, W, _, W, _, W, _, W, S, W],
      [W, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, W],
      [W, B, W, _, W, B, W, B, W, B, W, B, W, B, W, B, W, _, W, B, W],
      [W, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, W],
      [W, B, W, _, W, B, W, B, W, B, W, B, W, B, W, B, W, _, W, B, W],
      [W, _, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, _, W],
      [W, _, W, B, W, _, W, _, W, _, W, _, W, _, W, _, W, B, W, _, W],
      [W, S, _, _, B, B, B, B, B, B, S, B, B, B, B, B, B, _, _, S, W],
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    ] as TileType[][],
  },
  {
    id: "maze",
    name: "Maze",
    emoji: "🌀",
    desc: "Tight corridors — 8 players",
    floorColor: "#8ab4c8",   // slate blue
    wallColor: "#2c4a6e",    // dark navy
    blockColor: "#5a82a8",   // medium blue crate
    accentColor: "#c8e0f0",
    grid: [
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
      [W, S, _, B, _, B, _, B, _, B, S, B, _, B, _, B, _, B, _, S, W],
      [W, _, W, W, W, B, W, B, W, W, W, W, W, B, W, B, W, W, W, _, W],
      [W, B, W, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, W, B, W],
      [W, _, W, _, W, W, _, W, W, _, W, _, W, W, _, W, W, _, W, _, W],
      [W, B, _, _, W, _, _, _, W, _, _, _, W, _, _, _, W, _, _, B, W],
      [W, _, W, _, W, W, _, W, W, _, W, _, W, W, _, W, W, _, W, _, W],
      [W, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, W],
      [W, S, W, W, W, B, W, B, W, W, W, W, W, B, W, B, W, W, W, S, W],
      [W, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, W],
      [W, _, W, _, W, W, _, W, W, _, W, _, W, W, _, W, W, _, W, _, W],
      [W, B, _, _, W, _, _, _, W, _, _, _, W, _, _, _, W, _, _, B, W],
      [W, _, W, _, W, W, _, W, W, _, W, _, W, W, _, W, W, _, W, _, W],
      [W, B, W, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, W, B, W],
      [W, _, W, W, W, B, W, B, W, W, W, W, W, B, W, B, W, W, W, _, W],
      [W, S, _, B, _, B, _, B, _, B, S, B, _, B, _, B, _, B, _, S, W],
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    ] as TileType[][],
  },
  {
    id: "chaos",
    name: "Chaos",
    emoji: "💥",
    desc: "Destroy everything! — 8 players",
    floorColor: "#c87848",   // reddish-brown wood
    wallColor: "#5a2010",    // dark red-brown
    blockColor: "#a05030",   // red-brown crate
    accentColor: "#f0b090",
    grid: [
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
      [W, S, _, B, B, B, B, B, B, B, S, B, B, B, B, B, B, B, _, S, W],
      [W, _, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, _, W],
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      [W, S, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, S, W],
      [W, B, B, B, B, B, B, B, B, B, _, _, _, B, B, B, B, B, B, B, W],
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      [W, S, _, B, B, B, B, B, B, B, S, B, B, B, B, B, B, B, _, S, W],
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    ] as TileType[][],
  },
];
