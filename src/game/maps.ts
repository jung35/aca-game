import type { MapDef, TileType } from "./types";

const W: TileType = 1; // solid wall
const B: TileType = 2; // destructible block
const _: TileType = 0; // floor

// 21 cols × 17 rows
// 8 safe spawn corners/edges (marked with _):
//   P1 (1,1)  P2 (1,19)  P3 (15,1)  P4 (15,19)
//   P5 (1,10) P6 (8,1)   P7 (8,19)  P8 (15,10)
// Each spawn has a 2-cell clear radius so players can always escape.

export const MAPS: MapDef[] = [
  {
    id: "classic",
    name: "Classic",
    emoji: "🏙️",
    desc: "Original style — 21×17, up to 8 players",
    floorColor: "#388e3c",
    wallColor: "#1b5e20",
    blockColor: "#8d6e63",
    accentColor: "#a5d6a7",
    grid: [
      // row 0
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
      // row 1  – P1(1,1) P5(1,10) P2(1,19)
      [W, _, _, B, B, B, B, B, B, B, _, B, B, B, B, B, B, B, _, _, W],
      // row 2
      [W, _, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, _, W],
      // row 3
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      // row 4
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      // row 5
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      // row 6
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      // row 7
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      // row 8  – P6(8,1) P7(8,19)
      [W, _, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, _, W],
      // row 9
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      // row 10
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      // row 11
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      // row 12
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      // row 13
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      // row 14
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      // row 15  – P3(15,1) P8(15,10) P4(15,19)
      [W, _, _, B, B, B, B, B, B, B, _, B, B, B, B, B, B, B, _, _, W],
      // row 16
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    ] as TileType[][],
  },
  {
    id: "island",
    name: "Island",
    emoji: "🏝️",
    desc: "Open centre, dense edges — 8 players",
    floorColor: "#f9a825",
    wallColor: "#5d4037",
    blockColor: "#a1887f",
    accentColor: "#fff9c4",
    grid: [
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
      [W, _, _, _, B, B, B, B, B, B, _, B, B, B, B, B, B, _, _, _, W],
      [W, _, W, B, W, _, W, _, W, _, W, _, W, _, W, _, W, B, W, _, W],
      [W, _, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, _, W],
      [W, B, W, _, W, B, W, B, W, B, W, B, W, B, W, B, W, _, W, B, W],
      [W, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, W],
      [W, B, W, _, W, B, W, B, W, B, W, B, W, B, W, B, W, _, W, B, W],
      [W, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, W],
      [W, _, W, _, W, _, W, _, W, _, W, _, W, _, W, _, W, _, W, _, W],
      [W, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, W],
      [W, B, W, _, W, B, W, B, W, B, W, B, W, B, W, B, W, _, W, B, W],
      [W, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, W],
      [W, B, W, _, W, B, W, B, W, B, W, B, W, B, W, B, W, _, W, B, W],
      [W, _, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, _, W],
      [W, _, W, B, W, _, W, _, W, _, W, _, W, _, W, _, W, B, W, _, W],
      [W, _, _, _, B, B, B, B, B, B, _, B, B, B, B, B, B, _, _, _, W],
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    ] as TileType[][],
  },
  {
    id: "maze",
    name: "Maze",
    emoji: "🌀",
    desc: "Tight corridors — 8 players",
    floorColor: "#4a148c",
    wallColor: "#1a0033",
    blockColor: "#7b1fa2",
    accentColor: "#ce93d8",
    grid: [
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
      [W, _, _, B, _, B, _, B, _, B, _, B, _, B, _, B, _, B, _, _, W],
      [W, _, W, W, W, B, W, B, W, W, W, W, W, B, W, B, W, W, W, _, W],
      [W, B, W, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, W, B, W],
      [W, _, W, _, W, W, _, W, W, _, W, _, W, W, _, W, W, _, W, _, W],
      [W, B, _, _, W, _, _, _, W, _, _, _, W, _, _, _, W, _, _, B, W],
      [W, _, W, _, W, W, _, W, W, _, W, _, W, W, _, W, W, _, W, _, W],
      [W, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, W],
      [W, _, W, W, W, B, W, B, W, W, W, W, W, B, W, B, W, W, W, _, W],
      [W, B, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, B, W],
      [W, _, W, _, W, W, _, W, W, _, W, _, W, W, _, W, W, _, W, _, W],
      [W, B, _, _, W, _, _, _, W, _, _, _, W, _, _, _, W, _, _, B, W],
      [W, _, W, _, W, W, _, W, W, _, W, _, W, W, _, W, W, _, W, _, W],
      [W, B, W, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, W, B, W],
      [W, _, W, W, W, B, W, B, W, W, W, W, W, B, W, B, W, W, W, _, W],
      [W, _, _, B, _, B, _, B, _, B, _, B, _, B, _, B, _, B, _, _, W],
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    ] as TileType[][],
  },
  {
    id: "chaos",
    name: "Chaos",
    emoji: "💥",
    desc: "Destroy everything! — 8 players",
    floorColor: "#b71c1c",
    wallColor: "#4e0000",
    blockColor: "#e53935",
    accentColor: "#ff8a80",
    grid: [
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
      [W, _, _, B, B, B, B, B, B, B, _, B, B, B, B, B, B, B, _, _, W],
      [W, _, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, _, W],
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      [W, _, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, _, W],
      [W, B, B, B, B, B, B, B, B, B, _, _, _, B, B, B, B, B, B, B, W],
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      [W, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, W],
      [W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W, B, W],
      [W, _, _, B, B, B, B, B, B, B, _, B, B, B, B, B, B, B, _, _, W],
      [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    ] as TileType[][],
  },
];
