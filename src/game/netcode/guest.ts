/**
 * netcode/guest.ts – Guest-side room joining and host handshake.
 */

import Peer, { type DataConnection } from "peerjs";
import type { NetMessage, NetCallbacks, NetStatus } from "./types";
import { ID_PREFIX } from "./utils";

export interface GuestContext {
  connections: Map<string, DataConnection>;
  callbacks: NetCallbacks;
  setStatus: (s: NetStatus) => void;
  sendTo: (conn: DataConnection, msg: NetMessage) => void;
  bindConn: (conn: DataConnection) => void;
}

/**
 * Connects to an existing host room by code.
 * Resolves with the assigned player index once the host handshake completes.
 */
export function joinRoom(
  code: string,
  ctx: GuestContext,
): { peer: Peer; promise: Promise<number> } {
  const roomCode = code.trim().toUpperCase();
  const hostId = ID_PREFIX + roomCode;

  let resolveFn!: (index: number) => void;
  let rejectFn!: (err: unknown) => void;
  const promise = new Promise<number>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });

  const peer = new Peer();
  const timeout = setTimeout(
    () => rejectFn(new Error("Connection timed out.")),
    15000,
  );

  peer.on("open", () => {
    const conn = peer.connect(hostId, { reliable: true });

    conn.on("open", () => {
      ctx.connections.set(hostId, conn);
      ctx.setStatus("connecting");

      // Wait for host's slot-assignment handshake before binding normal messages
      const onHandshake = (raw: unknown) => {
        const msg = raw as NetMessage;
        if (msg.type === "start") {
          clearTimeout(timeout);
          conn.off("data", onHandshake);
          ctx.setStatus("connected");
          ctx.callbacks.onConnectedToHost(msg.playerIndex);
          ctx.bindConn(conn);
          resolveFn(msg.playerIndex);
        }
      };
      conn.on("data", onHandshake);
    });

    conn.on("close", () => {
      clearTimeout(timeout);
      ctx.connections.delete(hostId);
      ctx.setStatus("disconnected");
      ctx.callbacks.onDisconnected();
    });

    conn.on("error", (err) => {
      clearTimeout(timeout);
      ctx.setStatus("disconnected");
      ctx.callbacks.onError(String(err));
      rejectFn(err);
    });
  });

  peer.on("error", (err) => {
    clearTimeout(timeout);
    const msg = String(err);
    const friendly = msg.includes("peer-unavailable")
      ? "Room not found. Check the code and try again."
      : msg;
    ctx.callbacks.onError(friendly);
    rejectFn(new Error(friendly));
  });

  return { peer, promise };
}
