/**
 * Central control for the order-refetch intervals that the cursor sync replaces.
 *
 * These polls exist because the socket layer could not be trusted: there was no way for a
 * client to ask "what did I miss?", so it refetched everything on a timer. With sync in place
 * they are redundant — but they are retired gradually, not deleted, because a 60s poll still
 * catches a hole in the sync layer while a deleted poll does not.
 *
 * Rollout: leave at the legacy value → drop to SAFETY_NET_MS → set 0 once the server's
 * `[Sync]`/`[SyncGap]` logs show clients are recovering everything through sync.
 *
 * A value of 0 disables that poll entirely. Env overrides let you change this per environment
 * without a code change, and revert without a redeploy.
 */

/** Slow backstop: still catches a sync hole, but ~6x less traffic than the 10s poll. */
export const SAFETY_NET_MS = 60000;

const readEnvMs = (key, fallback) => {
  const raw = import.meta.env?.[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/**
 * Restaurant order list. Was 10s.
 * Covered by: `new_order` via sync + live socket.
 */
export const RESTAURANT_ORDERS_POLL_MS = readEnvMs('VITE_RESTAURANT_ORDERS_POLL_MS', SAFETY_NET_MS);

/**
 * Restaurant dining bookings. Was 8s.
 * Covered by: `new_dining_booking` live socket (not yet in the outbox), so this keeps a
 * safety net until that event is migrated to publish().
 */
export const RESTAURANT_BOOKINGS_POLL_MS = readEnvMs('VITE_RESTAURANT_BOOKINGS_POLL_MS', SAFETY_NET_MS);

/**
 * Rider "is this trip still mine" presence check. Was 15s.
 * Covered by: `order_reassigned_elsewhere` / `order_claimed` + sync on visibility change.
 */
export const DELIVERY_TRIP_POLL_MS = readEnvMs('VITE_DELIVERY_TRIP_POLL_MS', SAFETY_NET_MS);

/**
 * Payment capture during delivery handover. Was 5s.
 * Deliberately left fast: this one is a user-blocking flow at the doorstep and is NOT yet
 * covered by a socket event — the Razorpay webhook → `payment_captured` emit does not exist.
 * Do not zero this until that lands.
 */
export const PAYMENT_STATUS_POLL_MS = readEnvMs('VITE_PAYMENT_STATUS_POLL_MS', 5000);

/**
 * Guard for `setInterval` callers so a 0/disabled value is honoured consistently.
 * @param {number} ms
 * @returns {boolean}
 */
export const pollEnabled = (ms) => Number.isFinite(ms) && ms > 0;
