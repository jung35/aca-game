/**
 * netcode/index.ts – Public barrel. Re-exports everything main.ts needs.
 *
 * Existing import paths in main.ts are unchanged:
 *   import { RoomPeer } from "./game/netcode";
 *   import type { NetMessage, StateSyncPayload } from "./game/netcode";
 */

export { RoomPeer } from "./RoomPeer";
export type {
  NetRole,
  NetStatus,
  NetMessage,
  StateSyncPayload,
  NetCallbacks,
  LobbySlot,
} from "./types";
