// physics/index.ts — public API barrel for the physics module
export {
  cellToPixel,
  pixelToCell,
  isSolidTile,
  isWalkable,
  directionDelta,
} from "./helpers";
export { setPlayerVelocity, updateMovement } from "./movement";
export { placeBalloon, explodeBalloon } from "./balloons";
export { checkPowerUpPickup } from "./powerups";
export { updateGame } from "./update";
