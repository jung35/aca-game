# Crazy Arcade 💣

A browser-based top-down balloon battle game inspired by Bomberman / Crazy Arcade, built with **Vite + TypeScript** — no frameworks, pure canvas rendering.

## Features

- 🗺️ **4 maps** — Classic, Island, Maze, Chaos
- 🤖 **3 AI opponents** with rule-based pathfinding
- 💣 **Water balloons** with chain explosions and water-trap mechanic
- ⚡ **Power-ups** — Range, Extra balloon, Speed, Kick
- 📱 **Mobile controls** — on-screen D-pad
- 🐛 **Debug overlay** — hitboxes and grid toggle

## Tech Stack

| Tool                     | Purpose              |
| ------------------------ | -------------------- |
| [Vite](https://vite.dev) | Dev server + bundler |
| TypeScript               | Type-safe game logic |
| Canvas 2D API            | Rendering (3 layers) |
| Web Fonts                | Fredoka One + Nunito |

## Getting Started

```bash
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

## Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
  game/
    types.ts       – Shared interfaces
    constants.ts   – Tuning values
    maps.ts        – Map definitions
    gameState.ts   – State factories
    physics.ts     – Game logic (movement, explosions, power-ups)
    renderer.ts    – Canvas drawing
    ai.ts          – AI behaviour
  main.ts          – Entry point & game loop
  style.css        – Arcade UI theme
index.html         – HTML shell with canvas layers
```

## Controls

| Action        | Keyboard          | Mobile    |
| ------------- | ----------------- | --------- |
| Move          | Arrow Keys / WASD | D-pad     |
| Place Balloon | Space / X         | 💣 button |
