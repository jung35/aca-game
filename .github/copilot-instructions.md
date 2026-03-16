<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Crazy Arcade – Copilot Instructions

This is a **Vite + TypeScript** single-page game project. No frameworks (no React, Vue, etc.) — pure canvas rendering with DOM for UI.

## Project Structure

```
src/
  game/
    types.ts       – All shared interfaces & type aliases
    constants.ts   – Tuning numbers (grid size, speeds, timers)
    maps.ts        – Map definitions (TileType grids + colours)
    gameState.ts   – Factory functions for GameState & Player
    physics.ts     – Movement, balloon placement, explosions, power-up pickup
    renderer.ts    – Canvas drawing (bg layer, sprite layer, debug layer)
    ai.ts          – Simple rule-based AI with think-timer
  main.ts          – Entry point: DOM wiring, game loop, input
  style.css        – All CSS (dark blue arcade theme)
index.html         – Single HTML with canvas elements and control buttons
```

## Key Conventions

- **Grid coordinates**: `row` (Y, 0-top) and `col` (X, 0-left) for logic; pixel `px`/`py` for rendering.
- **Tile types**: `0` = floor, `1` = solid wall, `2` = destructible block.
- **Rendering**: three stacked `<canvas>` layers — `bg-canvas` (tiles + explosions), `sprite-canvas` (players + balloons), `debug-canvas` (hitboxes, grid).
- **State is mutable**: `GameState` is a plain object mutated in-place each frame.
- **No external runtime dependencies** — only Vite and TypeScript as dev deps.

## Style Guide

- Use `type` imports (`import type { ... }`) for pure TypeScript types.
- Keep physics logic in `physics.ts`, rendering in `renderer.ts`.
- All magic numbers go in `constants.ts`.
