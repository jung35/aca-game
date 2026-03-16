/**
 * netcode/utils.ts – Shared constants and helper functions.
 */

export const ID_PREFIX = "crazarc-";

/** Generates a random 6-character room code (unambiguous charset). */
export function makeRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
