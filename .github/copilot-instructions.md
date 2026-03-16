<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Crazy Arcade – Copilot Instructions

This is a **Vite + TypeScript** single-page game project. No frameworks (no React, Vue, etc.) — pure canvas rendering with DOM for UI.

## Project Structure

```
src/
  main.ts          – Entry point: DOM wiring, game loop, input, P2P lobby
  style.css        – All CSS (dark blue arcade theme)
  game/
    types.ts       – All shared interfaces & type aliases
    constants.ts   – Tuning numbers (grid size, speeds, timers, colors)
    maps.ts        – Map definitions (TileType grids)
    gameState.ts   – Factory functions for GameState & Player (createGameState, createPlayer)
    ai/
      index.ts     – AI entry point (initAI, updateAI)
      movement.ts  – chooseDirection using BFS walkability
      safety.ts    – isSafe, shouldPlaceBalloon (explosion threat detection)
      types.ts     – AIData interface
    physics/
      index.ts     – Re-exports: updateGame, setPlayerVelocity, placeBalloon
      movement.ts  – AABB sliding collision (updateMovement, setPlayerVelocity)
      balloons.ts  – Balloon placement, fuse countdown, explosion spread
      powerups.ts  – Power-up pickup logic
      update.ts    – Top-level updateGame: calls movement, balloons, powerups, win check
      helpers.ts   – isSolidTile, hasBalloon (AABB-based), isWalkable, directionDelta
    renderer/
      index.ts     – Re-exports: initRenderer, resizeRenderer, drawBackground, drawSprites, drawDebug
      background.ts– Tile grid, explosions, power-ups on bg-canvas
      sprites.ts   – Players, balloons, walk animation on sprite-canvas
      debug.ts     – Hitbox and grid overlay on debug-canvas
      preview.ts   – Lobby character preview (drawPreviewCharacter)
      utils.ts     – Shared canvas helpers (roundRect, etc.)
    netcode/
      index.ts     – Re-exports RoomPeer + all types
      RoomPeer.ts  – Main P2P class: createRoom, joinRoom, broadcast, sendToHost, sendToPlayer
      host.ts      – Host-side PeerJS room creation & guest connection management
      guest.ts     – Guest-side PeerJS join flow
      types.ts     – NetMessage, StateSyncPayload, LobbySlot, NetCallbacks
      utils.ts     – ID_PREFIX, makeRoomCode
index.html         – Single HTML: lobby panel, slots grid, canvas layers, game topbar
```

## Key Conventions

- **Grid coordinates**: `row` (Y, 0-top) and `col` (X, 0-left) for logic; pixel `px`/`py` for rendering.
- **Tile types**: `0` = floor, `1` = solid wall, `2` = destructible block, `3` = spawn point (converted to `0` at runtime; positions are shuffled per game).
- **Balloon collision**: `hasBalloon()` uses pixel AABB overlap (requires `px`/`py` on the player arg), not logical cell equality. This allows players to leave their own balloon before it becomes solid.
- **Rendering**: three stacked `<canvas>` layers — `bg-canvas` (tiles + explosions), `sprite-canvas` (players + balloons), `debug-canvas` (hitboxes, grid).
- **State is mutable**: `GameState` is a plain object mutated in-place each frame.
- **No external runtime dependencies** — only Vite, TypeScript, and PeerJS.

## Networking (P2P)

- **Host-authoritative**: host runs all physics (`updateGame`), broadcasts `state_sync` snapshots at ~20 Hz. Guests only send `input` messages.
- **`RoomPeer`** wraps PeerJS. Key methods: `createRoom()`, `joinRoom(code)`, `broadcast(msg)`, `sendToHost(msg)`, `sendToPlayer(playerIndex, msg)`, `sendStateSync(payload)`.
- **Guest flow**: join → receive `start` (with `playerConfigs[]`) → call `startGame` → send inputs only, apply received `state_sync` snapshots.
- **`hello` message**: guest → host on connect; carries `name`, `outfit`, `skinTone`. Host stores in `guestConfigs: Map<number, {outfit, skinTone}>`.
- **`lobby_state` message**: host → all guests whenever slots/teams/map change; carries full `LobbySlot[]` and `mapId`. Guests apply it to update the lobby UI.
- **`start` message**: carries `mapId`, `seed`, `playerIndex`, and `playerConfigs[]` so all clients build an identical `GameState`.
- **`map_change` / `kick`**: host → specific guest or all guests. Guests ignore map grid interactions (locked).
- **`isOnline` flag** in `main.ts`: when `true`, `getDirForPlayer()` always uses Arrow/WASD regardless of `localPlayerIndex`.

## Lobby System (main.ts)

- **Auto-host**: `initHostRoom()` is called on page load; creates a PeerJS room immediately so the host can share the room code.
- **Slots grid** (`#slots-grid`): 8 slots with kinds `host | human | ai | empty`. Host left-clicks empty → AI, clicks AI → remove AI. Host right-clicks any non-empty slot → cycles team (0→1→2→3→4→0).
- **Teams**: stored in `slotTeams: Map<number, number>` (host-authoritative). Broadcast via `lobby_state`. The char-picker UI has no team picker — host assigns teams via right-click.
- **`#char-picker`** border/bg/glow tints to the player's assigned team color (updated by `updateCharPickerTeamBg()`).
- **`guestConfigs`**: host accumulates `{outfit, skinTone}` per guest from `hello` messages, then merges all into `playerConfigs[]` for the `start` broadcast.

## Style Guide

- Use `type` imports (`import type { ... }`) for pure TypeScript types.
- Keep physics logic in `physics/`, rendering in `renderer/`, AI in `ai/`, networking in `netcode/`.
- All magic numbers go in `constants.ts`.
- Each subdirectory has a barrel `index.ts` that re-exports its public API.
