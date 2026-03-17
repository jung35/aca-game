import type { GameState, Player, Direction } from "../types";
import { isWalkable, directionDelta } from "../physics/helpers";
import { isSafe, canEscapeAfterBomb, findEscapeAfterBomb } from "./safety";
import type { AIGoal } from "./types";

// ── helpers Direction ────

const ALL_DIRS: Direction[] = ["up", "down", "left", "right"];

function opposite(dir: Direction): Direction {
  return dir === "up" ? "down" : dir === "down" ? "up" : dir === "left" ? "right" : "left";
}

// ── BFS ─────────────────────────────

/**
 * Generic BFS from the player's current cell.
 * Returns the first-step Direction toward the nearest cell satisfying isGoal.
 *
 * @param safeOnly  When true the BFS only expands through safe cells.
 * @param lastDir   De-prioritises the reverse direction to avoid ping-pong.
 */
function bfsFirstStep(
  state: GameState,
  player: Player,
  isGoal: (r: number, c: number) => boolean,
  lastDir: Direction | null,
  safeOnly = true,
): Direction | null {
  const { row, col } = player;
  if (isGoal(row, col)) return null;

  const visited = new Set<string>();
  visited.add(`${row},${col}`);

  const orderedDirs = lastDir
    ? [...ALL_DIRS.filter(d => d !== opposite(lastDir)), opposite(lastDir)]
    : ALL_DIRS;

  const queue: Array<[number, number, Direction]> = [];

  for (const dir of orderedDirs) {
    const [dr, dc] = directionDelta(dir);
    const nr = row + dr;
    const nc = col + dc;
    if (!isWalkable(state, nr, nc, player)) continue;
    if (safeOnly && !isSafe(state, nr, nc)) continue;
    const k = `${nr},${nc}`;
    if (visited.has(k)) continue;
    visited.add(k);
    if (isGoal(nr, nc)) return dir;
    queue.push([nr, nc, dir]);
  }

  while (queue.length > 0) {
    const [cr, cc, firstDir] = queue.shift()!;
    for (const dir of ALL_DIRS) {
      const [dr, dc] = directionDelta(dir);
      const nr = cr + dr;
      const nc = cc + dc;
      if (!isWalkable(state, nr, nc, player)) continue;
      if (safeOnly && !isSafe(state, nr, nc)) continue;
      const k = `${nr},${nc}`;
      if (visited.has(k)) continue;
      visited.add(k);
      if (isGoal(nr, nc)) return firstDir;
      queue.push([nr, nc, firstDir]);
    }
  }

  return null;
}

/**
 * Calls canEscapeAfterBomb with the player virtually standing at (row,col).
 * This lets goal predicates ask "if I were at this BFS cell, could I escape?"
 */
function canEscapeFrom(
  state: GameState,
  player: Player,
  row: number,
  col: number,
): boolean {
  const realRow = player.row;
  const realCol = player.col;
  (player as { row: number }).row = row;
  (player as { col: number }).col = col;
  const result = canEscapeAfterBomb(state, player, row, col);
  (player as { row: number }).row = realRow;
  (player as { col: number }).col = realCol;
  return result;
}

/** Pick any safe walkable neighbour, deprioritising reversal.
 *  If the AI is currently on a safe cell, ONLY returns safe neighbours —
 *  never steps into a blast zone voluntarily.
 */
function anyWalkable(
  state: GameState,
  player: Player,
  lastDir: Direction | null,
): Direction | null {
  const orderedDirs = lastDir
    ? [...ALL_DIRS.filter(d => d !== opposite(lastDir)), opposite(lastDir)]
    : ALL_DIRS;

  const currentlySafe = isSafe(state, player.row, player.col);
  const safe: Direction[] = [];
  const unsafe: Direction[] = [];

  for (const dir of orderedDirs) {
    const [dr, dc] = directionDelta(dir);
    const nr = player.row + dr;
    const nc = player.col + dc;
    if (!isWalkable(state, nr, nc, player)) continue;
    if (isSafe(state, nr, nc)) safe.push(dir);
    else unsafe.push(dir);
  }

  // Standing in a safe cell → only ever move to another safe cell
  if (currentlySafe) return safe[Math.floor(Math.random() * safe.length)] ?? null;

  // Already in danger → prefer safe but accept unsafe as last resort
  const pool = safe.length ? safe : unsafe;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

/**
 * BFS toward the nearest cell adjacent to a destructible block, ignoring
 * escape confirmation. Used for roaming when the AI has nothing better to do.
 * Always uses safeOnly=true — never routes through blast zones while roaming.
 * Returns null (→ "wait") if no reachable block-adjacent safe cell exists.
 */
function roamTowardBlock(
  state: GameState,
  player: Player,
  lastDir: Direction | null,
): Direction | null {
  // Goal: a safe cell that has at least one destructible neighbour
  const hasAdjacentBlock = (r: number, c: number): boolean => {
    if (!isSafe(state, r, c)) return false;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
      if (state.grid[r + dr]?.[c + dc] === 2) return true;
    }
    return false;
  };

  // safeOnly=true: never route through blast zones while roaming
  return bfsFirstStep(state, player, hasAdjacentBlock, lastDir, true);
}

// ── helpers Goal ───────────────

/** True when the AI has enough upgrades to aggressively hunt enemies. */
function isPoweredUp(player: Player): boolean {
  return player.balloonRange >= 3 || player.maxBalloons >= 2;
}

/** BFS toward the nearest visible floor powerup. */
function seekItem(
  state: GameState,
  player: Player,
  lastDir: Direction | null,
): Direction | null {
  if (state.powerUps.length === 0) return null;
  const itemSet = new Set(state.powerUps.map(p => `${p.row},${p.col}`));
  // Only target items that are currently in a safe cell — don't walk into blasts to grab items
  return bfsFirstStep(
    state, player,
    (r, c) => itemSet.has(`${r},${c}`) && isSafe(state, r, c),
    lastDir,
    true,
  );
}

/**
 * BFS toward a trapped teammate so the AI can walk into their cell to rescue them.
 * Only used when the AI is on a team (team > 0).
 */
function seekTrappedTeammate(
  state: GameState,
  player: Player,
  lastDir: Direction | null,
): Direction | null {
  if (player.team === 0) return null;
  const trapped = state.players.filter(
    p => p.alive && p.trappedInBalloon && p.team === player.team && p.id !== player.id,
  );
  if (trapped.length === 0) return null;
  const targetSet = new Set(trapped.map(p => `${p.row},${p.col}`));
  // safeOnly=true: don't walk into a blast zone to rescue a teammate
  return bfsFirstStep(state, player, (r, c) => targetSet.has(`${r},${c}`), lastDir, true);
}


function seekEnemy(
  state: GameState,
  player: Player,
  lastDir: Direction | null,
): Direction | null {
  const enemies = state.players.filter(
    p => p.alive && p.id !== player.id && p.team !== player.team,
  );
  if (enemies.length === 0) return null;

  return bfsFirstStep(
    state, player,
    (r, c) => {
      let hitsEnemy = false;
      for (const enemy of enemies) {
        if (enemy.row === r) {
          const dist = Math.abs(enemy.col - c);
          if (dist > player.balloonRange) continue;
          let blocked = false;
          const minC = Math.min(c, enemy.col) + 1;
          const maxC = Math.max(c, enemy.col);
          for (let sc = minC; sc < maxC; sc++) {
            if (state.grid[r][sc] === 1) { blocked = true; break; }
          }
          if (!blocked) { hitsEnemy = true; break; }
        }
        if (enemy.col === c) {
          const dist = Math.abs(enemy.row - r);
          if (dist > player.balloonRange) continue;
          let blocked = false;
          const minR = Math.min(r, enemy.row) + 1;
          const maxR = Math.max(r, enemy.row);
          for (let sr = minR; sr < maxR; sr++) {
            if (state.grid[sr][c] === 1) { blocked = true; break; }
          }
          if (!blocked) { hitsEnemy = true; break; }
        }
      }
      if (!hitsEnemy) return false;
      return canEscapeFrom(state, player, r, c);
    },
    lastDir,
    true,
  );
}

/**
 * BFS toward a cell from which bombing hits a destructible block within range
 * AND escape from that cell is confirmed.
 * Prefers blocks with a known item drop (blockPowerUps).
 */
function seekBlock(
  state: GameState,
  player: Player,
  lastDir: Direction | null,
): Direction | null {
  const valuableBlocks = new Set<string>();
  for (const [key, kind] of state.blockPowerUps) {
    if (kind !== null) valuableBlocks.add(key);
  }

  const isValidBombSpot = (r: number, c: number, requireValuable: boolean): boolean => {
    // Don't target a cell that's already in an active blast zone
    if (!isSafe(state, r, c)) return false;
    let hitsBlock = false;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
      for (let step = 1; step <= player.balloonRange; step++) {
        const nr = r + dr * step;
        const nc = c + dc * step;
        const tile = state.grid[nr]?.[nc];
        if (tile === 1) break;
        if (tile === 2) {
          if (!requireValuable || valuableBlocks.has(`${nr},${nc}`)) {
            hitsBlock = true;
          }
          break;
        }
      }
      if (hitsBlock) break;
    }
    if (!hitsBlock) return false;
    return canEscapeFrom(state, player, r, c);
  };

  if (valuableBlocks.size > 0) {
    const dir = bfsFirstStep(
      state, player,
      (r, c) => isValidBombSpot(r, c, true),
      lastDir,
      true,
    );
    if (dir) return dir;
  }

  return bfsFirstStep(
    state, player,
    (r, c) => isValidBombSpot(r, c, false),
    lastDir,
    true,
  );
}

// ── "Already at goal" checks ────────────────────────────────────────

/**
 * If the AI's current cell is a valid bomb spot (at least one blast arm
 * hits a block, and escape is confirmed), returns the first-step Direction
 * the AI should run to escape after placing the bomb.
 * Returns null if not a valid bomb spot or no escape exists.
 */
function bombAndEscapeDir(state: GameState, player: Player): Direction | null {
  const { row, col } = player;

  // Check at least one arm reaches a destructible block
  let hitsBlock = false;
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
    for (let step = 1; step <= player.balloonRange; step++) {
      const nr = row + dr * step;
      const nc = col + dc * step;
      const tile = state.grid[nr]?.[nc];
      if (tile === 1) break;
      if (tile === 2) { hitsBlock = true; break; }
    }
    if (hitsBlock) break;
  }
  if (!hitsBlock) return null;

  // Build the threatened + destroyedBlocks sets for the hypothetical bomb
  // (same logic as findEscapeAfterBomb so we agree on what's walkable)
  const threatened = new Set<string>();
  const destroyedBlocks = new Set<string>();

  const addThreats = (br: number, bc: number, range: number): void => {
    threatened.add(`${br},${bc}`);
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
      for (let step = 1; step <= range; step++) {
        const nr = br + dr * step;
        const nc = bc + dc * step;
        const tile = state.grid[nr]?.[nc];
        if (tile === 1) break;
        threatened.add(`${nr},${nc}`);
        if (tile === 2) { destroyedBlocks.add(`${nr},${nc}`); break; }
      }
    }
  };

  for (const b of state.balloons) addThreats(b.row, b.col, b.range);
  addThreats(row, col, player.balloonRange);

  // Confirm escape is actually reachable
  if (!findEscapeAfterBomb(state, player, row, col)) return null;

  // BFS one step — pick the first-step direction toward any safe cell,
  // using the same walkability rules as findEscapeAfterBomb (destroyed blocks are passable)
  // Also exclude cells threatened by existing balloons so we don't route back into blasts.
  const visited = new Set<string>([`${row},${col}`]);
  const queue: Array<[number, number, Direction]> = [];

  const orderedDirs: Direction[] = ["up", "down", "left", "right"];
  for (const dir of orderedDirs) {
    const [dr, dc] = directionDelta(dir);
    const nr = row + dr;
    const nc = col + dc;
    const tile = state.grid[nr]?.[nc];
    if (tile === 1) continue;                                         // solid wall
    if (tile === 2 && !destroyedBlocks.has(`${nr},${nc}`)) continue; // intact block
    if (state.balloons.some(b => b.row === nr && b.col === nc)) continue; // existing balloon
    const k = `${nr},${nc}`;
    if (visited.has(k)) continue;
    visited.add(k);
    if (!threatened.has(k)) return dir; // safe on first step — done
    queue.push([nr, nc, dir]);
  }

  while (queue.length > 0) {
    const [cr, cc, firstDir] = queue.shift()!;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
      const nr = cr + dr;
      const nc = cc + dc;
      const tile = state.grid[nr]?.[nc];
      if (tile === 1) continue;
      if (tile === 2 && !destroyedBlocks.has(`${nr},${nc}`)) continue;
      if (state.balloons.some(b => b.row === nr && b.col === nc)) continue;
      // `threatened` covers existing balloons + new bomb; goal is any cell outside it
      const k = `${nr},${nc}`;
      if (visited.has(k)) continue;
      visited.add(k);
      if (!threatened.has(k)) return firstDir;
      queue.push([nr, nc, firstDir]);
    }
  }

  return null;
}

/**
 * If the AI's current cell lines up an enemy within bomb range (no wall
 * between) and escape is confirmed, returns the escape direction.
 * Returns null otherwise.
 */
function huntAndEscapeDir(state: GameState, player: Player): Direction | null {
  const { row, col } = player;
  const enemies = state.players.filter(
    p => p.alive && p.id !== player.id && p.team !== player.team,
  );

  let hitsEnemy = false;
  outer:
  for (const enemy of enemies) {
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
      for (let step = 1; step <= player.balloonRange; step++) {
        const nr = row + dr * step;
        const nc = col + dc * step;
        const tile = state.grid[nr]?.[nc];
        if (tile === 1 || tile === 2) break;          // wall or block — arm stops
        if (nr === enemy.row && nc === enemy.col) { hitsEnemy = true; break outer; }
      }
    }
  }
  if (!hitsEnemy) return null;

  if (!findEscapeAfterBomb(state, player, row, col)) return null;

  // Build threatened + destroyedBlocks using the same logic as findEscapeAfterBomb
  const threatened = new Set<string>();
  const destroyedBlocks = new Set<string>();

  const addThreats = (br: number, bc: number, range: number): void => {
    threatened.add(`${br},${bc}`);
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
      for (let step = 1; step <= range; step++) {
        const nr = br + dr * step;
        const nc = bc + dc * step;
        const tile = state.grid[nr]?.[nc];
        if (tile === 1) break;
        threatened.add(`${nr},${nc}`);
        if (tile === 2) { destroyedBlocks.add(`${nr},${nc}`); break; }
      }
    }
  };

  for (const b of state.balloons) addThreats(b.row, b.col, b.range);
  addThreats(row, col, player.balloonRange);

  // BFS toward the nearest safe cell, walking through destroyed blocks
  const visited = new Set<string>([`${row},${col}`]);
  const queue: Array<[number, number, Direction]> = [];

  for (const dir of ALL_DIRS) {
    const [dr, dc] = directionDelta(dir);
    const nr = row + dr;
    const nc = col + dc;
    const tile = state.grid[nr]?.[nc];
    if (tile === 1) continue;
    if (tile === 2 && !destroyedBlocks.has(`${nr},${nc}`)) continue;
    if (state.balloons.some(b => b.row === nr && b.col === nc)) continue;
    const k = `${nr},${nc}`;
    if (visited.has(k)) continue;
    visited.add(k);
    if (!threatened.has(k)) return dir;
    queue.push([nr, nc, dir]);
  }

  while (queue.length > 0) {
    const [cr, cc, firstDir] = queue.shift()!;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as [number,number][]) {
      const nr = cr + dr;
      const nc = cc + dc;
      const tile = state.grid[nr]?.[nc];
      if (tile === 1) continue;
      if (tile === 2 && !destroyedBlocks.has(`${nr},${nc}`)) continue;
      if (state.balloons.some(b => b.row === nr && b.col === nc)) continue;
      const k = `${nr},${nc}`;
      if (visited.has(k)) continue;
      visited.add(k);
      if (!threatened.has(k)) return firstDir;
      queue.push([nr, nc, firstDir]);
    }
  }

  return null;
}

//Public  API ────────────────────────────────────//

export interface MoveDecision {
  dir: Direction | null;
  goal: AIGoal;
  /** True if the AI should place a balloon this tick. */
  placeBomb: boolean;
}

/**
 * Decide what the AI should do this tick.
 *
 * Priority order:
 *  1. ESCAPE  — current cell is in blast danger → run to safety, no bomb.
 *  2. RESCUE  — a teammate is trapped → walk to their cell to free them.
 *     HUNT    — powered up → BFS to a cell that lines up an enemy with a
 *               confirmed escape; place bomb when already at such a cell.
 *  3. ITEM    — a floor powerup is visible → go collect it, no bomb.
 *  4. DIG     — BFS to a cell that hits a block with a confirmed escape;
 *               place bomb when already at such a cell.
 *  5. ROAM    — explore freely, no bomb.
 *  6. WAIT    — fully boxed in with no safe move; stand still until a bomb detonates.
 *
 * The key invariant: placeBomb is only true when canEscapeAfterBomb has
 * already been verified for the player's CURRENT position.
 */
export function chooseAction(
  state: GameState,
  player: Player,
  lastDir: Direction | null = null,
): MoveDecision {

  // ── 1. Escape ───────────────────────────────────────────────
  if (!isSafe(state, player.row, player.col)) {
    // safeOnly=true: only expand through safe cells so we never route back through the blast
    const escapeDir = bfsFirstStep(state, player, (r, c) => isSafe(state, r, c), lastDir, true)
      ?? anyWalkable(state, player, lastDir);
    // No walkable neighbour at all — stand still and wait for the bomb to detonate
    if (escapeDir === null) {
      return { dir: null, goal: "wait", placeBomb: false };
    }
    return { dir: escapeDir, goal: "escape", placeBomb: false };
  }

  // ── 2. Rescue trapped teammate / Hunt enemy (equal priority) ─────────────
  // Rescue: walk into the trapped teammate's cell to free them.
  const rescueDir = seekTrappedTeammate(state, player, lastDir);
  if (rescueDir !== null) {
    return { dir: rescueDir, goal: "rescue", placeBomb: false };
  }

  if (isPoweredUp(player)) {
    // Already at a valid kill spot? Place bomb and run toward escape cell.
    const huntEscape = huntAndEscapeDir(state, player);
    if (huntEscape !== null) {
      return { dir: huntEscape, goal: "hunt", placeBomb: true };
    }
    const enemyDir = seekEnemy(state, player, lastDir);
    if (enemyDir !== null) {
      return { dir: enemyDir, goal: "hunt", placeBomb: false };
    }
  }

  // ── 3. Collect floor items ──────────
  const itemDir = seekItem(state, player, lastDir);
  if (itemDir !== null) {
    return { dir: itemDir, goal: "item", placeBomb: false };
  }

  // ── 4. Dig blocks ─────────────────────────────────────────────
  // Already at a valid bomb spot? Place bomb and run toward escape cell.
  const digEscape = bombAndEscapeDir(state, player);
  if (digEscape !== null) {
    return { dir: digEscape, goal: "dig", placeBomb: true };
  }
  const blockDir = seekBlock(state, player, lastDir);
  if (blockDir !== null) {
    return { dir: blockDir, goal: "dig", placeBomb: false };
  }

  // ── 5. Roam ────────────
  const roamDir = roamTowardBlock(state, player, lastDir);
  if (roamDir !== null) {
    return { dir: roamDir, goal: "roam", placeBomb: false };
  }

  // ── 6. Wait — no safe path anywhere, stand still ────────────
  return { dir: null, goal: "wait", placeBomb: false };
}

// Alias so any stale imports of the old name still compile
export { chooseAction as chooseDirection };
