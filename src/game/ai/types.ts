import type { Direction } from "../types";

/**
 * The high-level goal the AI is currently pursuing.
 *
 * "escape"  – flee from a bomb blast.
 * "rescue"  – walk to a trapped teammate to free them.
 * "item"    – walk to a visible floor powerup.
 * "hunt"    – get adjacent to an enemy and bomb them.
 * "dig"     – bomb a destructible block (to open paths / reach items).
 * "roam"    – no specific goal; explore freely.
 * "wait"    – no safe move exists; stand still until a nearby bomb explodes.
 */
export type AIGoal = "escape" | "rescue" | "item" | "hunt" | "dig" | "roam" | "wait";

export interface AIData {
  thinkTimer: number;
  currentDir: Direction | null;
  /** Direction we arrived from — used to de-prioritise reversals. */
  lastDir: Direction | null;
  /** Current high-level goal. */
  goal: AIGoal;
  /** BFS path we're currently following (sequence of grid cells). */
  path: Array<[number, number]>;
  /** Grid cell the AI occupied on the last think tick — triggers a re-think on cell change. */
  lastRow: number;
  lastCol: number;
}
