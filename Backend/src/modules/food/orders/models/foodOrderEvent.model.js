import mongoose from 'mongoose';
import { config } from '../../../../config/env.js';
import { logger } from '../../../../utils/logger.js';

/**
 * Durable order-event outbox.
 *
 * Every order lifecycle milestone (accept, restaurant status, reached pickup, pickup,
 * reached drop, OTP verify, delivered, cancel, …) is appended here with a per-order monotonic
 * `seq` and a unique `eventId`. This gives clients a reliable recovery path: on reconnect,
 * `/sync` returns the latest `seq` plus the recent event tail so a client can detect gaps and
 * replay any milestone it missed while offline — without polling.
 */
const foodOrderEventSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodOrder',
      required: true,
      index: true,
    },
    /** Per-order monotonically increasing sequence number (allocated via FoodOrder.eventSeq). */
    seq: { type: Number, required: true },
    /** Globally unique id for client-side dedup. */
    eventId: { type: String, required: true },
    /** Event/action name, e.g. 'delivery_accepted', 'picked_up', 'delivery_completed'. */
    type: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    at: { type: Date, default: Date.now },
    /**
     * Global monotonic cursor — the sort key and range key for the sync read path.
     *
     * Top-level rather than per-recipient: all recipients of one event share a cursor, and
     * Mongo cannot sort meaningfully on a field inside an array. `{ cursor: { $gt: since } }`
     * with a sort is only correct against a scalar.
     */
    cursor: { type: Number, index: true, sparse: true },
    /**
     * Who this event was addressed to.
     *
     * `seq` above is per-order, which cannot answer the question a reconnecting client
     * actually has: "what was sent to *me* while I was away?" A rider who was offered an order
     * while offline has no active order at all, so an order-scoped replay returns nothing.
     * Keying by recipient makes the offer recoverable.
     *
     * Optional: rows written before SYNC_CURSOR_ENABLED simply have no recipients and are
     * ignored by the sync read path.
     */
    recipients: {
      type: [
        {
          kind: {
            type: String,
            enum: ['USER', 'RESTAURANT', 'DELIVERY_PARTNER'],
            required: true,
          },
          id: { type: mongoose.Schema.Types.ObjectId, required: true },
          _id: false,
        },
      ],
      default: undefined,
    },
  },
  { collection: 'food_order_events', timestamps: true },
);

// One row per (order, seq); also the natural read path for replay.
foodOrderEventSchema.index({ orderId: 1, seq: 1 }, { unique: true });

// The sync read path: "events addressed to me, after my cursor", in cursor order.
foodOrderEventSchema.index({ 'recipients.kind': 1, 'recipients.id': 1, cursor: 1 });

// This collection is a recovery buffer, not order history — but expiry is opt-in because
// enabling it deletes existing rows older than the window.
if (Number.isFinite(config.syncEventTtlDays) && config.syncEventTtlDays > 0) {
  const seconds = Math.round(config.syncEventTtlDays * 24 * 60 * 60);
  foodOrderEventSchema.index({ at: 1 }, { expireAfterSeconds: seconds });
  logger.info(`Order event outbox TTL enabled: ${config.syncEventTtlDays} day(s)`);
}

export const FoodOrderEvent = mongoose.model('FoodOrderEvent', foodOrderEventSchema);
