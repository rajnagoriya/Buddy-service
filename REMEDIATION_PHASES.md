# Buddy Food — Driver-First Order Flow: Remediation Phases

Living tracker for fixing the gaps found in the three-flow audit. Each phase is
independently shippable and must end with a green build + its manual test
checklist before the next phase starts.

**Locked design decisions**
- **Flow 3 → full dual-leg rebuild** (real two-driver delivery: `legs[]`, item/stop split, second OTP, two-marker tracking). Phase 1 ships an interim safety layer first; Phase 6 is the real rebuild.
- **Restaurant rejection → immediate drop + refund.** Remove the misleading 3-strike messaging and the unused resend endpoint (Phase 3).
- **Start with Phase 1 now.**

Status legend: ⬜ todo · 🟦 in progress · ✅ done

---

## Phase 1 — Stop the bleeding (money & stuck-orders) · S ✅
Interim safety for the current earnings-share model, before the Phase 6 rebuild.

- ✅ **F-3B** Atomic shared-driver join — `acceptSharedOrderDelivery` now uses a conditional `findOneAndUpdate` on `dispatch.sharedPartnerId:null` (+ `deliveryPartnerId != joiner`); distinguishes already-taken / self / idempotent-retry. `order.service.js`.
- ✅ **F-3A** Share-timeout solo-complete — added `dispatch.shareOpenedAt` (schema) + `SHARE_TIMEOUT_MS` (helpers, 5 min); set on both auto-share (accept) and manual `shareOrderDelivery`; `completeDelivery` lets the primary finish solo with the full earning restored + admin alert once the window elapses.
- ✅ **F-3C** Admin reassign no longer silently drops the shared partner — captures/​notifies the dropped shared partner and re-opens the share slot (restarting the timeout clock) for bulk orders. `assignDeliveryPartnerAdmin`.
- ✅ Settlement double-fire: confirmed blocked by `isStatusAdvance(from,'delivered')` re-entry guard (can't re-deliver → can't re-settle).

*Files:* `order.model.js`, `order.helpers.js`, `order-delivery.service.js`, `order.service.js`.
*Test:* place a ≥20-item order, accept as driver, let share timeout elapse → primary can complete; two drivers race the shared slot → exactly one joins; admin reassigns primary on a shared order → shared partner notified, order not stuck.

## Phase 2 — Driver-first operational holes · S–M ✅
- ✅ **F-1A** Restaurant no-response escalation in `recoverStuckOrders`: Tier 1 (> `RESTAURANT_ACK_RESEND_MS`, 2m) re-notifies restaurant(s) + admin once (throttled by `dispatch.restaurantAckResendAt`); Tier 2 (> `RESTAURANT_ACK_TIMEOUT_MS`, 5m) auto-rejects → refund → releases the driver.
- ✅ **F-1B** Server-side geofence `assertRiderAtTarget` on reached-pickup (restaurant/active-pickup) and reached-drop (customer). Fail-OPEN on missing/stale (>10m) rider location; `*_GEOFENCE_METERS` = 1000m, tunable.
- ✅ **F-1C** Pickup ready-state guard: single-restaurant pickup requires `orderStatus === 'ready_for_pickup'`; multi requires the current pickup `status === 'ready'` — closes the `isStatusAdvance` gap that let `confirmed→picked_up` slip through.
- ✅ **F-3D** `shareOrderDelivery` now re-checks `isShareRequired` server-side (item count ≥ threshold), closing the UI-only abuse gate.

*Note:* Tier-2 auto-cancel for a multi-restaurant no-response only pushes the cancellation to the primary restaurant (others never engaged); refine in Phase 3 if needed.

## Phase 3 — Flow 2 reject/resend correctness · S–M
- ⬜ **F-2A** Make handler + constants + messages agree on **immediate drop + refund**; remove 3-strike copy and the dead resend endpoint; fix single-restaurant reject messaging.
- ⬜ Post-pickup restaurant-B rejection flow (return / partial-delivery).

## Phase 4 — State-machine & real-time integrity · M
- ⬜ Replace rank-only `isStatusAdvance` with an explicit adjacency transition table (block stage-skips at the guard).
- ⬜ Add `event_id` + `seq` to every order event; client dedup; seq-aware `/sync`; include shared/second driver in `/sync`.
- ⬜ Turn the log-only BullMQ `order.processor` into a real outbox.

## Phase 5 — Flow 2 orchestration · M
- ⬜ Combined ETA from per-kitchen prep times.
- ⬜ Pickup sequencing (distance/ready-time) + multi-stop list UI.
- ⬜ Waiting-state ("1 of 2 ready") + customer progress.

## Phase 6 — Flow 3 true dual-leg (the big one) · L
- ⬜ Data model: per-driver `legs[]` (assigned/arrived/picked/delivering/delivered), item→driver split map, second OTP.
- ⬜ Per-leg endpoints + "parent DELIVERED only when both legs done" guard.
- ⬜ Item/stop split (stop-level for multi-restaurant, item-level within one restaurant).
- ⬜ Customer two-driver tracking (two markers / two rows).
- ⬜ Admin force-assign second driver.
- ⬜ Restaurant labeled handover (pack two sets, hand correct bag).

## Phase 7 — Cleanup & hardening · M
- ⬜ Dedicated FCM ring channel / full-screen intent for driver offers.
- ⬜ Remove dead COD code paths (or formally gate them).
- ⬜ Consolidate the parallel QC (`quick_orders`) legacy path.

---

### Progress log
- **Phase 1 — done & committed** on branch `phase1-two-driver-safety` (`b02d667`). Files: `order.model.js` (`dispatch.shareOpenedAt`), `order.helpers.js` (`SHARE_TIMEOUT_MS`), `order-delivery.service.js` (auto-share timestamp + solo-complete fallback), `order.service.js` (atomic shared join, manual-share timestamp, admin-reassign shared handling). `main` restored to `c6cdb87`.
- **Phase 2 — done** on branch `phase2-driver-first-holes` (stacked on Phase 1). Files: `order.model.js` (`dispatch.restaurantAckResendAt`), `order.helpers.js` (ack + geofence constants), `order-delivery.service.js` (`assertRiderAtTarget` geofence + pickup ready-state guard), `order.service.js` (F-1A escalation in `recoverStuckOrders` + F-3D share eligibility). All pass `node --check`. Runtime/device test still pending (no automated test harness).
