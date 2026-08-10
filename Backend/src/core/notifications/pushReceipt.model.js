import mongoose from 'mongoose';

/**
 * Per-attempt record of a push notification.
 *
 * Push failures used to be caught and discarded — `notifyOwnerSafely` returned null and
 * `notifyRestaurantNewOrder` wrapped its whole body in a bare `catch {}`. An FCM 5xx, a quota
 * rejection or an expired credential lost the notification permanently with no record it was
 * ever attempted, which is exactly why the wrong-device token bug (FCM-02) went unnoticed for
 * so long.
 *
 * This is the reconciliation table: attempts vs. deliveries, per owner and per platform.
 */
const pushReceiptSchema = new mongoose.Schema(
  {
    ownerType: {
      type: String,
      enum: ['USER', 'RESTAURANT', 'DELIVERY_PARTNER', 'ADMIN'],
      required: true,
    },
    ownerId: { type: String, required: true },
    /** Event/notification kind, e.g. 'new_order' — taken from payload.data.type. */
    type: { type: String, default: 'unknown' },
    orderId: { type: String, default: null },
    title: { type: String, default: '' },
    /** How the send finished. 'queued' rows are updated in place by the worker. */
    status: {
      type: String,
      enum: ['queued', 'sent', 'partial', 'failed'],
      required: true,
      index: true,
    },
    tokensTargeted: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    /** Number of BullMQ attempts consumed; >1 means a retry happened. */
    attempt: { type: Number, default: 1 },
    /** Distinct FCM error codes seen, for triage without storing full token strings. */
    errorCodes: { type: [String], default: undefined },
    error: { type: String, default: null },
  },
  { collection: 'food_push_receipts', timestamps: true },
);

// Triage path: "what happened to this owner's notifications recently?"
pushReceiptSchema.index({ ownerType: 1, ownerId: 1, createdAt: -1 });
// Receipts are operational telemetry, not history — 30 days is ample for reconciliation.
pushReceiptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const PushReceipt = mongoose.model('PushReceipt', pushReceiptSchema);
