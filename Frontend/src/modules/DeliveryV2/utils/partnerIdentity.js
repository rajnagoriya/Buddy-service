/**
 * Shared helpers for dual-driver identity.
 * Keeps co-driver contact + per-leg OTP checks from collapsing onto the second rider.
 */

export function toPartnerId(ref) {
  if (ref == null || ref === '') return '';
  if (typeof ref === 'object') {
    const nested = ref._id || ref.id || ref.partnerId;
    if (nested != null && typeof nested === 'object') {
      return String(nested._id || nested.id || nested || '');
    }
    return String(nested || '');
  }
  return String(ref);
}

export function getCurrentRiderId() {
  try {
    const stored = localStorage.getItem('delivery_user');
    if (stored) {
      const user = JSON.parse(stored);
      const id = user?._id || user?.id || user?.partnerId || user?.userId;
      if (id) return String(id);
    }
  } catch { /* ignore */ }
  try {
    const token = localStorage.getItem('delivery_accessToken');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    const id = payload?.partnerId || payload?.userId || payload?.id || payload?.sub;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

export function asPartner(ref) {
  if (!ref) return null;
  if (typeof ref === 'object') return ref;
  return { _id: ref };
}

/**
 * Resolve the *other* delivery partner on a dual-driver order.
 * Driver 1 → driver 2 contact; driver 2 → driver 1 contact.
 * Never defaults both sides to the secondary rider.
 */
export function resolveCoDriver(order, riderId = getCurrentRiderId()) {
  const primary = asPartner(order?.dispatch?.deliveryPartnerId);
  const secondary = asPartner(order?.dispatch?.sharedPartnerId);
  const primaryId = toPartnerId(primary);
  const secondaryId = toPartnerId(secondary);
  if (!primaryId || !secondaryId) return null;

  const me = toPartnerId(riderId);
  if (me && me === primaryId) return secondary;
  if (me && me === secondaryId) return primary;

  // Fallback: match against leg.partnerId when dispatch compare fails.
  if (me && Array.isArray(order?.legs)) {
    const myLeg = order.legs.find((leg) => toPartnerId(leg?.partnerId) === me);
    if (myLeg) {
      const role = String(myLeg.role || '');
      if (role === 'primary') return secondary;
      if (role === 'secondary' || role === 'shared') return primary;
    }
  }

  return null;
}

export function getMyLeg(order, riderId = getCurrentRiderId()) {
  const me = toPartnerId(riderId);
  if (!me || !Array.isArray(order?.legs)) return null;
  return order.legs.find((leg) => toPartnerId(leg?.partnerId) === me) || null;
}

export function getOtherLeg(order, riderId = getCurrentRiderId()) {
  const me = toPartnerId(riderId);
  if (!me || !Array.isArray(order?.legs)) return null;
  return order.legs.find((leg) => toPartnerId(leg?.partnerId) !== me) || null;
}

export function isDualLegOrder(order) {
  return Boolean(order?.isDualLeg) && Array.isArray(order?.legs) && order.legs.length > 1;
}

/**
 * Map this driver's own leg (not the parent order phase) to a trip status.
 * Prevents driver 1's Arrived from flipping driver 2's UI.
 */
export function tripStatusFromMyLeg(order, riderId = getCurrentRiderId()) {
  if (!isDualLegOrder(order)) return null;
  const myLeg = getMyLeg(order, riderId);
  if (!myLeg) return null;
  const status = String(myLeg.status || '');
  if (status === 'delivered') return 'COMPLETED';
  if (status === 'at_drop') return 'REACHED_DROP';
  if (status === 'picked_up') {
    // Item-split / shared restaurant: don't leave pickup UI until partner also slides pickup
    // (parent orderStatus stays ready_for_pickup until both legs are collected).
    const other = getOtherLeg(order, riderId);
    const otherPending =
      other && !['picked_up', 'at_drop', 'delivered'].includes(String(other.status || ''));
    const parentStillPickup =
      !['picked_up', 'reached_drop', 'delivered'].includes(String(order?.orderStatus || ''));
    if (otherPending && parentStillPickup) {
      return 'REACHED_PICKUP';
    }
    return 'PICKED_UP';
  }
  if (status === 'at_pickup') return 'REACHED_PICKUP';
  return 'PICKING_UP';
}

/**
 * Contextual waiting copy when this driver's progress depends on the partner.
 * Returns messages for BOTH sides when one has slid pickup and the other has not.
 */
export function getPartnerWaitMessage(order, riderId = getCurrentRiderId()) {
  if (Boolean(order?.dispatch?.isShared) && !order?.dispatch?.sharedPartnerId) {
    return {
      title: 'Waiting for second driver',
      body: 'Searching for another driver to accept this order. You can keep going with your part.',
    };
  }

  if (!isDualLegOrder(order) && !order?.dispatch?.sharedPartnerId) return null;

  const myLeg = getMyLeg(order, riderId);
  const otherLeg = getOtherLeg(order, riderId);
  const myStatus = String(myLeg?.status || '');
  const otherStatus = String(otherLeg?.status || '');

  if (myStatus === 'delivered' && otherStatus && otherStatus !== 'delivered') {
    return {
      title: 'Waiting for second driver',
      body: 'Your delivery is done. Waiting for your partner to complete their delivery.',
    };
  }

  const iPicked = ['picked_up', 'at_drop', 'delivered'].includes(myStatus);
  const theyPicked = ['picked_up', 'at_drop', 'delivered'].includes(otherStatus);
  const parentStillPickup =
    !['picked_up', 'reached_drop', 'delivered'].includes(String(order?.orderStatus || ''));

  // I already slid pickup — partner has not.
  if (iPicked && otherStatus && !theyPicked && parentStillPickup) {
    return {
      title: 'Waiting for other driver',
      body: 'Waiting for the other driver to accept / slide pickup.',
      role: 'waiting_on_partner',
    };
  }

  // Partner already slid pickup — I still need to.
  if (!iPicked && otherStatus && theyPicked && parentStillPickup) {
    return {
      title: 'Other driver reached pickup',
      body: 'The other driver has reached pickup. If you are also ready, please slide to pick up.',
      role: 'need_my_pickup',
    };
  }

  if (
    myStatus === 'at_pickup' &&
    otherStatus &&
    ['assigned', 'en_route_to_pickup'].includes(otherStatus)
  ) {
    return {
      title: 'Waiting for other driver',
      body: 'You have reached the restaurant. Waiting for the other driver to arrive and slide pickup.',
      role: 'waiting_on_partner',
    };
  }

  if (
    otherStatus === 'at_pickup' &&
    myStatus &&
    ['assigned', 'en_route_to_pickup'].includes(myStatus)
  ) {
    return {
      title: 'Other driver reached pickup',
      body: 'The other driver has reached pickup. If you are also ready, please arrive and slide.',
      role: 'need_my_arrival',
    };
  }

  return null;
}

/**
 * Resolve this driver's earning for wallet/summary UI.
 */
export function resolveMyEarning(order, riderId = getCurrentRiderId(), isSalary = false) {
  if (isSalary) return 0;
  const me = toPartnerId(riderId);
  const sharedId = toPartnerId(order?.dispatch?.sharedPartnerId);
  if (me && sharedId && me === sharedId) {
    return Number(order?.sharedRiderEarning || 0) || 0;
  }
  return Number(order?.riderEarning || order?.earnings || 0) || 0;
}
