import { onValue, ref, set, update } from 'firebase/database';
import { firebaseRealtimeDb, ensureFirebaseInitialized } from '@food/firebase';

function sanitizeRealtimeKey(value) {
  return String(value || '').trim().replace(/[.#$/[\]]/g, '_');
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getDeliveryLocationPath(deliveryId) {
  return `delivery_boys/${sanitizeRealtimeKey(deliveryId)}`;
}

function getRestaurantLocationPath(restaurantId) {
  return `restaurant/${sanitizeRealtimeKey(restaurantId)}/location`;
}

function getOrderTrackingPath(orderId) {
  return `active_orders/${sanitizeRealtimeKey(orderId)}`;
}

export function subscribeOrderTracking(orderId, onChange, onError) {
  if (!orderId || typeof onChange !== 'function') return () => {};
  // Keep auth disabled on tracking pages to avoid identitytoolkit
  // getProjectConfig calls that can fail for API-key-restricted setups.
  ensureFirebaseInitialized({ enableAuth: false, enableRealtimeDb: true });
  const path = getOrderTrackingPath(orderId);
  const unsub = onValue(
    ref(firebaseRealtimeDb, path),
    (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      onChange(data, path);
    },
    (error) => {
      if (typeof onError === 'function') onError(error, path);
    },
  );
  return unsub;
}

export function subscribeDeliveryLocation(deliveryId, onChange, onError) {
  if (!deliveryId || typeof onChange !== 'function') return () => {};
  ensureFirebaseInitialized({ enableAuth: false, enableRealtimeDb: true });
  const path = getDeliveryLocationPath(deliveryId);
  const unsub = onValue(
    ref(firebaseRealtimeDb, path),
    (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      onChange(data, path);
    },
    (error) => {
      if (typeof onError === 'function') onError(error, path);
    },
  );
  return unsub;
}

export function subscribeAllDeliveryLocations(onChange, onError) {
  if (typeof onChange !== 'function') return () => {};
  ensureFirebaseInitialized({ enableAuth: false, enableRealtimeDb: true });
  const path = 'delivery';
  const unsub = onValue(
    ref(firebaseRealtimeDb, path),
    (snapshot) => {
      onChange(snapshot.val() || {}, path);
    },
    (error) => {
      if (typeof onError === 'function') onError(error, path);
    },
  );
  return unsub;
}

export function subscribeRestaurantLocation(restaurantId, onChange, onError) {
  if (!restaurantId || typeof onChange !== 'function') return () => {};
  ensureFirebaseInitialized({ enableAuth: false, enableRealtimeDb: true });
  const path = getRestaurantLocationPath(restaurantId);
  const unsub = onValue(
    ref(firebaseRealtimeDb, path),
    (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      onChange(data, path);
    },
    (error) => {
      if (typeof onError === 'function') onError(error, path);
    },
  );
  return unsub;
}

export async function writeDeliveryLocation({
  deliveryId,
  lat,
  lng,
  heading = 0,
  speed = 0,
  isOnline = true,
  activeOrderId = null,
  accuracy = null,
  timestamp = Date.now(),
}) {
  if (!deliveryId) return false;
  ensureFirebaseInitialized({ enableAuth: false, enableRealtimeDb: true });
  const payload = {
    lat: toFiniteNumber(lat),
    lng: toFiniteNumber(lng),
    heading: toFiniteNumber(heading) || 0,
    speed: toFiniteNumber(speed) || 0,
    accuracy: toFiniteNumber(accuracy),
    timestamp: toFiniteNumber(timestamp) || Date.now(),
    last_updated: Date.now(),
    isOnline: Boolean(isOnline),
    activeOrderId: activeOrderId ? String(activeOrderId) : null,
  };
  await set(ref(firebaseRealtimeDb, getDeliveryLocationPath(deliveryId)), payload);
  return true;
}

/**
 * Write order tracking data to Firebase at active_orders/{orderId}.
 * When deliveryPartnerId is present, also write under riders/{partnerId}
 * so dual-driver orders can show both locations without clobbering.
 */
export async function writeOrderTracking(orderId, payload = {}) {
  if (!orderId) return false;
  ensureFirebaseInitialized({ enableAuth: false, enableRealtimeDb: true });
  const toWrite = {
    ...payload,
    lat: toFiniteNumber(payload.lat),
    lng: toFiniteNumber(payload.lng),
    heading: toFiniteNumber(payload.heading ?? payload.bearing) || 0,
    last_updated: Date.now(),
  };
  if (payload.timestamp != null) {
    toWrite.timestamp = toFiniteNumber(payload.timestamp) || Date.now();
  }
  // Don't nest the full riders map into the root update payload.
  delete toWrite.riders;
  delete toWrite.deliveryPartnerId;

  const orderPath = getOrderTrackingPath(orderId);
  await update(ref(firebaseRealtimeDb, orderPath), toWrite);

  const partnerId = sanitizeRealtimeKey(payload.deliveryPartnerId);
  if (partnerId) {
    await update(ref(firebaseRealtimeDb, `${orderPath}/riders/${partnerId}`), toWrite);
  }
  return true;
}
