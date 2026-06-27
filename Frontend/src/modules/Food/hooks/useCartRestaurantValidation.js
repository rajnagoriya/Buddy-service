import { useCallback, useRef, useState } from 'react';
import { userAPI } from '@food/api';

export const CART_RESTAURANT_VALIDATION_TTL_MS = 7 * 60 * 1000;

const buildRestaurantMetaFromCart = (cartItems, existingMeta = []) => {
  const metaById = new Map(
    (Array.isArray(existingMeta) ? existingMeta : []).map((entry) => [
      String(entry.restaurantId),
      entry,
    ]),
  );
  const uniqueIds = new Set();

  (Array.isArray(cartItems) ? cartItems : []).forEach((item) => {
    const restaurantId = String(item?.restaurantId || '').trim();
    if (!restaurantId || uniqueIds.has(restaurantId)) return;
    uniqueIds.add(restaurantId);
    if (!metaById.has(restaurantId)) {
      metaById.set(restaurantId, {
        restaurantId,
        lastKnownStatus: 'open',
        lastValidatedAt: null,
      });
    }
  });

  return [...metaById.values()].filter((entry) => uniqueIds.has(String(entry.restaurantId)));
};

const isValidationFresh = (metaEntry, ttlMs = CART_RESTAURANT_VALIDATION_TTL_MS) => {
  if (!metaEntry?.lastValidatedAt) return false;
  const validatedAt = new Date(metaEntry.lastValidatedAt).getTime();
  if (Number.isNaN(validatedAt)) return false;
  return Date.now() - validatedAt < ttlMs;
};

export function useCartRestaurantValidation({
  cart,
  restaurantMeta,
  setRestaurantMeta,
  removeItemsByRestaurantIds,
}) {
  const [closedRestaurants, setClosedRestaurants] = useState([]);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const validateInFlightRef = useRef(null);

  const syncMetaWithCart = useCallback(
    (items, meta) => buildRestaurantMetaFromCart(items, meta),
    [],
  );

  const applyValidationResult = useCallback(
    (changed = [], validatedAt) => {
      if (!Array.isArray(changed) || changed.length === 0) {
        setClosedRestaurants([]);
        setShowAvailabilityModal(false);
        if (validatedAt) {
          setRestaurantMeta((prev) => {
            const next = syncMetaWithCart(cart, prev).map((entry) => ({
              ...entry,
              lastValidatedAt: validatedAt,
            }));
            return next;
          });
        }
        return { hasClosed: false, closed: [] };
      }

      const closed = changed.filter((entry) => entry.status === 'closed');
      setRestaurantMeta((prev) => {
        const nextMap = new Map(
          syncMetaWithCart(cart, prev).map((entry) => [String(entry.restaurantId), { ...entry }]),
        );

        changed.forEach((entry) => {
          const id = String(entry.restaurantId);
          const existing = nextMap.get(id) || { restaurantId: id, lastKnownStatus: 'open' };
          nextMap.set(id, {
            ...existing,
            restaurantId: id,
            lastKnownStatus: entry.status === 'closed' ? 'closed' : 'open',
            lastValidatedAt: validatedAt || new Date().toISOString(),
          });
        });

        return [...nextMap.values()];
      });

      if (closed.length > 0) {
        setClosedRestaurants(closed);
        setShowAvailabilityModal(true);
        return { hasClosed: true, closed };
      }

      setClosedRestaurants([]);
      setShowAvailabilityModal(false);
      return { hasClosed: false, closed: [] };
    },
    [cart, setRestaurantMeta, syncMetaWithCart],
  );

  const validateRestaurants = useCallback(
    async ({ force = false } = {}) => {
      const meta = syncMetaWithCart(cart, restaurantMeta);
      const restaurantIds = [...new Set(meta.map((entry) => String(entry.restaurantId)).filter(Boolean))];

      if (restaurantIds.length === 0) {
        setClosedRestaurants([]);
        setShowAvailabilityModal(false);
        return { hasClosed: false, closed: [] };
      }

      if (!force) {
        const allFresh = restaurantIds.every((id) => {
          const entry = meta.find((m) => String(m.restaurantId) === id);
          return isValidationFresh(entry);
        });
        if (allFresh) {
          const cachedClosed = meta
            .filter((entry) => entry.lastKnownStatus === 'closed')
            .map((entry) => ({
              restaurantId: entry.restaurantId,
              restaurantName:
                cart.find((item) => String(item.restaurantId) === String(entry.restaurantId))
                  ?.restaurant || 'Restaurant',
              status: 'closed',
            }));
          if (cachedClosed.length > 0) {
            setClosedRestaurants(cachedClosed);
            setShowAvailabilityModal(true);
            return { hasClosed: true, closed: cachedClosed };
          }
          return { hasClosed: false, closed: [] };
        }
      }

      if (validateInFlightRef.current) {
        return validateInFlightRef.current;
      }

      const request = (async () => {
        setIsValidating(true);
        try {
          const res = await userAPI.validateCartRestaurants({
            restaurants: meta.map((entry) => ({
              restaurantId: entry.restaurantId,
              lastKnownStatus: entry.lastKnownStatus || 'open',
              lastValidatedAt: entry.lastValidatedAt || null,
            })),
            force,
          });
          const payload = res?.data?.data || {};
          return applyValidationResult(payload.changed || [], payload.validatedAt);
        } finally {
          setIsValidating(false);
          validateInFlightRef.current = null;
        }
      })();

      validateInFlightRef.current = request;
      return request;
    },
    [applyValidationResult, cart, restaurantMeta, syncMetaWithCart],
  );

  const handleRemoveClosedRestaurantItems = useCallback(() => {
    const ids = closedRestaurants.map((entry) => String(entry.restaurantId));
    removeItemsByRestaurantIds(ids);
    setClosedRestaurants([]);
    setShowAvailabilityModal(false);
  }, [closedRestaurants, removeItemsByRestaurantIds]);

  const handleContinueReviewingCart = useCallback(() => {
    setShowAvailabilityModal(false);
  }, []);

  return {
    closedRestaurants,
    showAvailabilityModal,
    isValidating,
    validateRestaurants,
    handleRemoveClosedRestaurantItems,
    handleContinueReviewingCart,
    syncMetaWithCart,
  };
}

export { buildRestaurantMetaFromCart, isValidationFresh };
