/**
 * netcode.ts – Room-code WebRTC multiplayer for Crazy Arcade.
 *
 * Uses PeerJS (free public broker) — players share a 6-char room code.
 * No SDP copy-pasting. No server required.
 *
 * Flow:
 *   Host   → createRoom()  → share code
 *   Guests → joinRoom(code)
 *   Host   → runs physics, fans out state snapshots ~20 Hz
 *   Guests → send inputs; receive authoritative state
 */

import Peer, { type DataConnection } from "peerjs";

// ─── Public types ─────────────────────────────────────────────────────────────

export type NetRole = "host" | "guest" | "none";
export type NetStatus = "idle" | "connecting" | "connected" | "disconnected";

export type NetMessage =
  | { type: "input"; playerId: number; action: "move"; dir: string }
  | { type: "input"; playerId: number; action: "balloon" }
  | { type: "state_sync"; payload: StateSyncPayload }
  | { type: "start"; mapId: string; seed: number; playerIndex: number }
  | { type: "ping"; t: number }
  | { type: "pong"; t: number }
  | { type: "chat"; text: string };

export interface StateSyncPayload {
  seq: number;
  players: Array<{
    id: number;
    row: number;
    col: number;
    px: number;
    py: number;
    vx: number;
    vy: number;
    alive: boolean;
    score: number;
    invincible: boolean;
    moveDir: string | null;
    maxBalloons: number;
    balloonRange: number;
    speed: number;
  }>;
  balloons: Array<{
    id: number;
    row: number;
    col: number;
    ownerId: number;
    timer: number;
    range: number;
    trapped: boolean;
  }>;
  explosions: Array<{ row: number; col: number; timer: number }>;
  powerUps: Array<{ id: number; row: number; col: number; kind: string }>;
  grid: number[][];
  gameOver: boolean;
  winner: number | null;
  elapsed: number;
}

export interface NetCallbacks {
  /** Host: called whenever a guest connects. */
  onGuestJoined: (guestCount: number) => void;
  /** Guest: called once the host sends the slot-assignment handshake. */
  onConnectedToHost: (playerIndex: number) => void;
  onDisconnected: () => void;
  onMessage: (msg: NetMessage, fromId?: string) => void;
  onStatusChange: (s: NetStatus) => void;
  onError: (msg: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const ID_PREFIX = "crazarc-";

// ─── RoomPeer ────────────────────────────────────────────────────────────────

export class RoomPeer {
  role: NetRole = "none";
  status: NetStatus = "idle";
  roomCode = "";

  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
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

  constructor(callbacks: NetCallbacks) {
    this.callbacks = callbacks;
  }

  // ── Host ──────────────────────────────────────────────────────────────────

  createRoom(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.role = "host";
      this.roomCode = makeRoomCode();
      this.peer = new Peer(ID_PREFIX + this.roomCode);

      this.peer.on("open", () => {
        this._setStatus("connecting");
        resolve(this.roomCode);
      });

      this.peer.on("error", (err) => {
        const msg = String(err);
        if (msg.includes("is taken") || msg.includes("unavailable")) {
          this.peer?.destroy();
          reject(new Error("Room code taken, please try again."));
        } else {
          this.callbacks.onError(msg);
          reject(err);
        }
      });

      this.peer.on("connection", (conn) => {
        conn.on("open", () => {
          if (this.connections.size >= 7) {
            conn.close();
            return;
          }
          this.connections.set(conn.peer, conn);
          const guestIndex = this.connections.size; // 1-based
          this._sendTo(conn, {
            type: "start",
            mapId: "",
            seed: 0,
            playerIndex: guestIndex,
          });
          this._bindConn(conn);
          this._setStatus("connected");
          this.callbacks.onGuestJoined(this.connections.size);
        });
        conn.on("close", () => {
          this.connections.delete(conn.peer);
          if (this.connections.size === 0) this._setStatus("connecting");
          this.callbacks.onDisconnected();
        });
        conn.on("error", () => {
          this.connections.delete(conn.peer);
          this.callbacks.onDisconnected();
        });
      });
    });
  }

  // ── Guest ─────────────────────────────────────────────────────────────────

  joinRoom(code: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.role = "guest";
      this.roomCode = code.trim().toUpperCase();
      const hostId = ID_PREFIX + this.roomCode;

      this.peer = new Peer();
      const timeout = setTimeout(
        () => reject(new Error("Connection timed out.")),
        15000,
      );

      this.peer.on("open", () => {
        const p = this.peer;
        if (!p) return;
        const conn = p.connect(hostId, { reliable: false });

        conn.on("open", () => {
          this.connections.set(hostId, conn);
          this._setStatus("connecting");

          // Wait for host's slot-assignment handshake before binding normal messages
          const onData = (raw: unknown) => {
            const msg = raw as NetMessage;
            if (msg.type === "start") {
              clearTimeout(timeout);
              conn.off("data", onData);
              this._setStatus("connected");
              this.callbacks.onConnectedToHost(msg.playerIndex);
              this._bindConn(conn);
              resolve(msg.playerIndex);
            }
          };
          conn.on("data", onData);
        });

        conn.on("close", () => {
          clearTimeout(timeout);
          this.connections.delete(hostId);
          this._setStatus("disconnected");
          this.callbacks.onDisconnected();
        });

        conn.on("error", (err) => {
          clearTimeout(timeout);
          this._setStatus("disconnected");
          this.callbacks.onError(String(err));
          reject(err);
        });
      });

      this.peer.on("error", (err) => {
        clearTimeout(timeout);
        const msg = String(err);
        const friendly = msg.includes("peer-unavailable")
          ? "Room not found. Check the code and try again."
          : msg;
        this.callbacks.onError(friendly);
        reject(new Error(friendly));
      });
    });
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  broadcast(msg: NetMessage): void {
    for (const conn of this.connections.values()) this._sendTo(conn, msg);
  }

  sendToHost(msg: NetMessage): void {
    const conn = this.connections.values().next().value as
      | DataConnection
      | undefined;
    if (conn) this._sendTo(conn, msg);
  }

  sendStateSync(payload: StateSyncPayload): void {
    payload.seq = this._seq++;
    this.broadcast({ type: "state_sync", payload });
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
