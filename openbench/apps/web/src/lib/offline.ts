"use client";

/**
 * Offline event journal for the bench client.
 *
 * Each operator action is enqueued in IndexedDB with an idempotency key. When
 * the network is healthy the queue is flushed against the API's /api/sync/events
 * endpoint. Failed events stay in the queue and are surfaced to the user.
 */

import { openDB, type IDBPDatabase } from "idb";
import { sync } from "@/lib/api";

export type QueuedEvent = {
  id: string;            // local idempotency key
  run_id: string;
  event_type: string;
  step_id?: string | null;
  payload?: Record<string, unknown>;
  local_seq: number;
  client_timestamp: string;
  status: "pending" | "synced" | "error";
  attempts: number;
  last_error?: string;
};

const DB_NAME = "openbench-bench";
const DB_VERSION = 1;
const STORE = "events";

let _db: IDBPDatabase | null = null;
async function getDb() {
  if (typeof window === "undefined") throw new Error("indexeddb only available client-side");
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("by_run", "run_id");
        s.createIndex("by_status", "status");
      }
    },
  });
  return _db;
}

export async function enqueueEvent(
  ev: Omit<QueuedEvent, "id" | "local_seq" | "client_timestamp" | "status" | "attempts"> & {
    id?: string;
  }
): Promise<QueuedEvent> {
  const db = await getDb();
  const tx = db.transaction(STORE, "readwrite");
  const allKeys = await tx.store.getAllKeys();
  const id = ev.id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const queued: QueuedEvent = {
    id,
    run_id: ev.run_id,
    event_type: ev.event_type,
    step_id: ev.step_id ?? null,
    payload: ev.payload || {},
    local_seq: allKeys.length + 1,
    client_timestamp: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  await tx.store.put(queued);
  await tx.done;
  return queued;
}

export async function listPending(): Promise<QueuedEvent[]> {
  const db = await getDb();
  const tx = db.transaction(STORE, "readonly");
  // Read all and filter client-side: this avoids relying on the by_status
  // index which a previously-cached IndexedDB store may not have, and lets
  // us include both "pending" and "error" rows for retry. Order by local_seq
  // so the server sees events in the order the operator created them.
  const all = await tx.store.getAll();
  await tx.done;
  return (all as QueuedEvent[])
    .filter((event) => event.status === "pending" || event.status === "error")
    .sort((a, b) => a.local_seq - b.local_seq);
}

export async function listAllForRun(runId: string): Promise<QueuedEvent[]> {
  const db = await getDb();
  const tx = db.transaction(STORE, "readonly");
  const idx = tx.store.index("by_run");
  const all = await idx.getAll(runId);
  await tx.done;
  return all as QueuedEvent[];
}

export async function markEventStatus(id: string, status: QueuedEvent["status"], error?: string) {
  const db = await getDb();
  const tx = db.transaction(STORE, "readwrite");
  const cur = (await tx.store.get(id)) as QueuedEvent | undefined;
  if (cur) {
    cur.status = status;
    if (error) cur.last_error = error;
    cur.attempts = (cur.attempts || 0) + 1;
    await tx.store.put(cur);
  }
  await tx.done;
}

export async function flush(deviceId?: string): Promise<{ accepted: number; rejected: number }> {
  const pending = await listPending();
  if (pending.length === 0) return { accepted: 0, rejected: 0 };
  const events = pending.map((p) => ({
    run_id: p.run_id,
    event_type: p.event_type,
    step_id: p.step_id ?? undefined,
    payload: p.payload || {},
    idempotency_key: p.id,
    local_seq: p.local_seq,
    client_timestamp: p.client_timestamp,
  }));
  try {
    const res = await sync.push(events, deviceId);
    for (const item of res.items) {
      const status =
        item.status === "accepted" || item.status === "duplicate" ? "synced" : "error";
      await markEventStatus(item.idempotency_key, status, item.error);
    }
    return { accepted: res.accepted, rejected: res.rejected };
  } catch (e) {
    const msg = (e as Error).message || String(e);
    for (const p of pending) await markEventStatus(p.id, "error", msg);
    return { accepted: 0, rejected: pending.length };
  }
}

export function startSyncLoop(deviceId?: string, intervalMs = 8000): () => void {
  if (typeof window === "undefined") return () => undefined;
  let timer: any = null;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      if (navigator.onLine) await flush(deviceId);
    } finally {
      running = false;
    }
  };
  timer = setInterval(tick, intervalMs);
  window.addEventListener("online", tick);
  return () => {
    clearInterval(timer);
    window.removeEventListener("online", tick);
  };
}
