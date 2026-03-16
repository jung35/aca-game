/**
 * netcode/host.ts – Host-side room creation and guest connection management.
 */

import Peer, { type DataConnection } from "peerjs";
import type { NetMessage, NetCallbacks, NetStatus } from "./types";
import { ID_PREFIX, makeRoomCode } from "./utils";

export interface HostContext {
  connections: Map<string, DataConnection>;
  playerIndexToConn: Map<number, string>;
  callbacks: NetCallbacks;
  setStatus: (s: NetStatus) => void;
  sendTo: (conn: DataConnection, msg: NetMessage) => void;
  bindConn: (conn: DataConnection) => void;
}

/**
 * Creates a PeerJS room and begins listening for guest connections.
 * Resolves with the room code once the peer is open.
 */
export function createRoom(ctx: HostContext): {
  peer: Peer;
  promise: Promise<string>;
  roomCode: string;
} {
  const roomCode = makeRoomCode();
  let resolveFn!: (code: string) => void;
  let rejectFn!: (err: unknown) => void;
  const promise = new Promise<string>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });

  const peer = new Peer(ID_PREFIX + roomCode);

  peer.on("open", () => {
    ctx.setStatus("connecting");
    resolveFn(roomCode);
  });

  peer.on("error", (err) => {
    const msg = String(err);
    if (msg.includes("is taken") || msg.includes("unavailable")) {
      peer.destroy();
      rejectFn(new Error("Room code taken, please try again."));
    } else {
      ctx.callbacks.onError(msg);
      rejectFn(err);
    }
  });

  peer.on("connection", (conn) => {
    conn.on("open", () => {
      if (ctx.connections.size >= 7) {
        conn.close();
        return;
      }
      ctx.connections.set(conn.peer, conn);
      const guestIndex = ctx.connections.size; // 1-based slot
      ctx.playerIndexToConn.set(guestIndex, conn.peer);
      ctx.sendTo(conn, { type: "start", mapId: "", seed: 0, playerIndex: guestIndex });
      ctx.bindConn(conn);
      ctx.setStatus("connected");
      ctx.callbacks.onGuestJoined(ctx.connections.size, guestIndex);
    });

    conn.on("close", () => {
      // Remove from playerIndexToConn
      for (const [idx, pid] of ctx.playerIndexToConn) {
        if (pid === conn.peer) { ctx.playerIndexToConn.delete(idx); break; }
      }
      ctx.connections.delete(conn.peer);
      if (ctx.connections.size === 0) ctx.setStatus("connecting");
      ctx.callbacks.onDisconnected();
    });

    conn.on("error", () => {
      for (const [idx, pid] of ctx.playerIndexToConn) {
        if (pid === conn.peer) { ctx.playerIndexToConn.delete(idx); break; }
      }
      ctx.connections.delete(conn.peer);
      ctx.callbacks.onDisconnected();
    });
  });

  return { peer, promise, roomCode };
}
