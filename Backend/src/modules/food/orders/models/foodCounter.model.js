import mongoose from 'mongoose';

/**
 * Atomic named counters.
 *
 * Backs the global order-event cursor. Mongo rather than Redis on purpose: REDIS_ENABLED is
 * currently false in this deployment, and the cursor must be correct regardless of whether the
 * cache layer is up. `findOneAndUpdate($inc)` is atomic across processes, which is all we need.
 *
 * If Redis becomes a hard dependency later, swap the allocator in `nextGlobalCursor()` — the
 * only requirement is that values are strictly increasing, not that they are gapless.
 */
const foodCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 },
  },
  { collection: 'food_counters', versionKey: false },
);

export const FoodCounter = mongoose.model('FoodCounter', foodCounterSchema);

export const ORDER_EVENT_CURSOR = 'orderEventCursor';

/**
 * Allocate the next global cursor value.
 * @param {string} [name]
 * @returns {Promise<number>}
 */
export async function nextGlobalCursor(name = ORDER_EVENT_CURSOR) {
  const doc = await FoodCounter.findOneAndUpdate(
    { _id: name },
    { $inc: { value: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true, lean: true },
  );
  return Number(doc?.value ?? 0);
}
