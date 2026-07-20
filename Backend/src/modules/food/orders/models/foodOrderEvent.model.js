import mongoose from 'mongoose';

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
  },
  { collection: 'food_order_events', timestamps: true },
);

// One row per (order, seq); also the natural read path for replay.
foodOrderEventSchema.index({ orderId: 1, seq: 1 }, { unique: true });

export const FoodOrderEvent = mongoose.model('FoodOrderEvent', foodOrderEventSchema);
