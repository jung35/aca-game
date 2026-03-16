/**
 * netcode/RoomPeer.ts – Main multiplayer peer class.
 *
 * Delegates room creation/joining to host.ts / guest.ts and owns the shared
 * connection map, ping loop, and send helpers.
 *
 * Flow:
 *   Host   → createRoom()  → share room code
 *   Guests → joinRoom(code)
 *   Host   → runs physics, fans out state snapshots ~20 Hz
 *   Guests → send inputs; receive authoritative state
 */

import Peer, { type DataConnection } from "peerjs";
import type { NetRole, NetStatus, NetMessage, NetCallbacks, StateSyncPayload } from "./types";
import { createRoom } from "./host";
import { joinRoom } from "./guest";

export class RoomPeer {
  role: NetRole = "none";
  status: NetStatus = "idle";
  roomCode = "";

  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
  /** Map from player slot index (1-7) → PeerJS peer ID. Host only. */
  private playerIndexToConn = new Map<number, string>();
  private callbacks: NetCallbacks;
  private pingTimer = 0;
  private pingSentAt = 0;
  private _latency = 0;
  private _seq = 0;

  get guestCount(): number {
    return this.connections.size;
  }
  get latency(): number {
    return this._latency;
  }
  /** Returns the set of active player slot indices (host only). */
  get activePlayerIndices(): Set<number> {
    return new Set(this.playerIndexToConn.keys());
  }

  constructor(callbacks: NetCallbacks) {
    this.callbacks = callbacks;
  }

  // ── Host ──────────────────────────────────────────────────────────────────

  createRoom(): Promise<string> {
    this.role = "host";
    const ctx = this._makeContext();
    const { peer, promise, roomCode } = createRoom(ctx);
    this.peer = peer;
    this.roomCode = roomCode;
    return promise;
  }

  // ── Guest ─────────────────────────────────────────────────────────────────

  async joinRoom(code: string): Promise<number> {
    this.role = "guest";
    this.roomCode = code.trim().toUpperCase();
    const ctx = this._makeContext();
    const { peer, promise } = joinRoom(code, ctx);
    this.peer = peer;
    return promise;
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  broadcast(msg: NetMessage): void {
    for (const conn of this.connections.values()) this._sendTo(conn, msg);
  }

  sendToHost(msg: NetMessage): void {
    const conn = this.connections.values().next().value as DataConnection | undefined;
    if (conn) this._sendTo(conn, msg);
  }

  sendStateSync(payload: StateSyncPayload): void {
    payload.seq = this._seq++;
    this.broadcast({ type: "state_sync", payload });
  }

  /** Host: send a message to a specific player slot (1-7). */
  sendToPlayer(playerIndex: number, msg: NetMessage): void {
    const peerId = this.playerIndexToConn.get(playerIndex);
    if (!peerId) return;
    const conn = this.connections.get(peerId);
    if (conn) this._sendTo(conn, msg);
  }

  disconnect(): void {
    for (const c of this.connections.values()) c.close();
    this.connections.clear();
    this.peer?.destroy();
    this.peer = null;
    this.role = "none";
    this._setStatus("idle");
  }

  tick(dt: number): void {
    if (this.status !== "connected") return;
    this.pingTimer -= dt;
    if (this.pingTimer <= 0) {
      this.pingTimer = 2;
      this.pingSentAt = performance.now();
      this.broadcast({ type: "ping", t: this.pingSentAt });
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _makeContext() {
    return {
      connections: this.connections,
      playerIndexToConn: this.playerIndexToConn,
      callbacks: this.callbacks,
      setStatus: (s: NetStatus) => this._setStatus(s),
      sendTo: (conn: DataConnection, msg: NetMessage) => this._sendTo(conn, msg),
      bindConn: (conn: DataConnection) => this._bindConn(conn),
    };
  }

  private _sendTo(conn: DataConnection, msg: NetMessage): void {
    if (conn.open) conn.send(msg);
  }

  private _bindConn(conn: DataConnection): void {
    conn.on("data", (raw) => {
      const msg = raw as NetMessage;
      if (msg.type === "ping") {
        this._sendTo(conn, { type: "pong", t: msg.t });
        return;
      }
      if (msg.type === "pong") {
        this._latency = Math.round((performance.now() - this.pingSentAt) / 2);
        return;
      }
      this.callbacks.onMessage(msg, conn.peer);
    });
  }

  private _setStatus(s: NetStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.callbacks.onStatusChange(s);
  }
}
