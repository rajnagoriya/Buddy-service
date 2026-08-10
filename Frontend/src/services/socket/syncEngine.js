/**
 * Cursor-based event recovery — the client half of the sync protocol.
 *
 * The socket is treated as an optimisation, not the source of truth. Correctness lives in the
 * cursor: whatever the live channel drops (backgrounded webview, tunnel, killed app, server
 * restart) is recovered on the next sync, so the periodic order refetches become unnecessary.
 *
 * Rules this enforces:
 *   - lastCursor is persisted to localStorage, NOT React state — it must survive a reload.
 *   - Events are applied strictly in cursor order.
 *   - Dedupe by eventId against a bounded LRU: the same event legitimately arrives twice (once
 *     live, once via sync) and every handler must be safe to run once.
 *   - Sync on connect, reconnect, tab-visible, and on any live event whose __cursor jumps ahead
 *     of what we have applied (gap detection).
 */

const CURSOR_KEY_PREFIX = 'sync_cursor_';
const SEEN_EVENT_LIMIT = 500;
/** Stop paging after this many rounds so a corrupt cursor cannot spin forever. */
const MAX_PAGES_PER_SYNC = 20;

/** @param {string} module */
const cursorKey = (module) => `${CURSOR_KEY_PREFIX}${module}`;

export function readCursor(module) {
  try {
    const raw = localStorage.getItem(cursorKey(module));
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function writeCursor(module, cursor) {
  try {
    const n = Number(cursor);
    if (!Number.isFinite(n) || n <= 0) return;
    // Never move the cursor backwards — an out-of-order response must not cause a replay storm.
    if (n <= readCursor(module)) return;
    localStorage.setItem(cursorKey(module), String(n));
  } catch {
    // Private mode / quota: sync still works, it just replays more on next connect.
  }
}

export function resetCursor(module) {
  try {
    localStorage.removeItem(cursorKey(module));
  } catch {
    // ignore
  }
}

/**
 * Create a sync engine bound to a socket.
 *
 * @param {object} params
 * @param {import('socket.io-client').Socket} params.socket
 * @param {string} params.module - 'delivery' | 'restaurant' | 'user'
 * @param {(type: string, payload: object, meta: {cursor:number, eventId:string, replayed:boolean}) => void} params.onEvent
 * @param {(...a:any[])=>void} [params.log]
 * @param {(...a:any[])=>void} [params.warn]
 * @returns {{ sync: (reason?: string) => Promise<void>, noteLiveEvent: (payload:object) => boolean, destroy: () => void }}
 */
export function createSyncEngine({ socket, module, onEvent, log = () => {}, warn = () => {} }) {
  const seenEventIds = new Set();
  let syncing = false;
  let pendingReason = null;
  let destroyed = false;

  const remember = (eventId) => {
    if (!eventId) return false;
    if (seenEventIds.has(eventId)) return true;
    seenEventIds.add(eventId);
    // Bounded LRU: Set preserves insertion order, so the oldest is first.
    if (seenEventIds.size > SEEN_EVENT_LIMIT) {
      seenEventIds.delete(seenEventIds.values().next().value);
    }
    return false;
  };

  const requestBatch = (since) =>
    new Promise((resolve) => {
      let settled = false;
      const done = (payload) => {
        if (settled) return;
        settled = true;
        resolve(payload || { events: [], nextCursor: since, hasMore: false });
      };
      // Server replies via ack; it falls back to a `sync_batch` emit for older clients.
      const timer = setTimeout(() => done(null), 10000);
      socket.emit('sync', { since }, (payload) => {
        clearTimeout(timer);
        done(payload);
      });
    });

  /**
   * Pull everything addressed to this client since our cursor and apply it in order.
   * Serialised: a second call while one is running is collapsed into a single follow-up.
   */
  const sync = async (reason = 'manual') => {
    if (destroyed || !socket?.connected) return;
    if (syncing) {
      pendingReason = reason;
      return;
    }

    syncing = true;
    try {
      let pages = 0;
      let applied = 0;

      for (;;) {
        const since = readCursor(module);
        const batch = await requestBatch(since);
        const events = Array.isArray(batch?.events) ? batch.events : [];

        for (const evt of events) {
          if (remember(evt.eventId)) continue; // already applied live
          try {
            onEvent(evt.type, evt.payload || {}, {
              cursor: evt.cursor,
              eventId: evt.eventId,
              replayed: true,
            });
            applied += 1;
          } catch (err) {
            warn(`Sync handler for '${evt.type}' threw: ${err?.message || err}`);
          }
          writeCursor(module, evt.cursor);
        }

        writeCursor(module, batch?.nextCursor);
        pages += 1;

        // Stop when the server says there is no more, when a page made no progress (guards a
        // stuck cursor), or at the page cap.
        if (!batch?.hasMore || events.length === 0) break;
        if (pages >= MAX_PAGES_PER_SYNC) {
          warn(`Sync stopped at ${pages} pages; will continue on the next trigger.`);
          break;
        }
      }

      const finalCursor = readCursor(module);
      if (applied > 0) {
        log(`Sync (${reason}) recovered ${applied} missed event(s); cursor now ${finalCursor}`);
        socket.emit('sync_ack', { cursor: finalCursor });
      }
    } finally {
      syncing = false;
      if (pendingReason && !destroyed) {
        const next = pendingReason;
        pendingReason = null;
        void sync(next);
      }
    }
  };

  /**
   * Record a live event and detect a gap.
   *
   * Returns true when this event was already applied (caller should skip it). A live event
   * whose cursor jumps more than one past ours means we missed something in between, so a sync
   * is triggered to fill the hole.
   */
  const noteLiveEvent = (payload = {}) => {
    const cursor = Number(payload?.__cursor);
    const eventId = payload?.__eventId;

    if (eventId && remember(eventId)) return true; // duplicate

    if (Number.isFinite(cursor) && cursor > 0) {
      const known = readCursor(module);
      if (known > 0 && cursor > known + 1) {
        log(`Gap detected: live cursor ${cursor} vs applied ${known} — syncing`);
        void sync('gap');
      }
      writeCursor(module, cursor);
    }
    return false;
  };

  const onConnect = () => { void sync('connect'); };
  const onReconnect = () => { void sync('reconnect'); };
  const onVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void sync('visible');
    }
  };

  socket.on('connect', onConnect);
  socket.on('reconnect', onReconnect);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisible);
  }

  // Fallback for a server that emits instead of acking.
  const onBatch = (batch) => {
    const events = Array.isArray(batch?.events) ? batch.events : [];
    for (const evt of events) {
      if (remember(evt.eventId)) continue;
      try {
        onEvent(evt.type, evt.payload || {}, {
          cursor: evt.cursor,
          eventId: evt.eventId,
          replayed: true,
        });
      } catch (err) {
        warn(`Sync handler for '${evt.type}' threw: ${err?.message || err}`);
      }
      writeCursor(module, evt.cursor);
    }
  };
  socket.on('sync_batch', onBatch);

  const destroy = () => {
    destroyed = true;
    socket.off('connect', onConnect);
    socket.off('reconnect', onReconnect);
    socket.off('sync_batch', onBatch);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisible);
    }
    seenEventIds.clear();
  };

  return { sync, noteLiveEvent, destroy };
}

export default createSyncEngine;
