import { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { orderAPI } from "@food/api";

const CookingAnimation = memo(() => (
  <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl bg-orange-50 border border-orange-100 overflow-visible shadow-[0_4px_15px_rgba(235,89,14,0.15)] shrink-0">
    <div className="absolute -top-2 sm:-top-3 flex gap-1">
      <motion.div animate={{ opacity: [0, 0.8, 0], y: [0, -6, -10], scale: [0.8, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0, ease: "easeOut" }} className="w-1 h-2 sm:w-1.5 sm:h-3 bg-orange-400/60 rounded-full blur-[1px]" />
      <motion.div animate={{ opacity: [0, 0.8, 0], y: [0, -8, -12], scale: [0.8, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.5, ease: "easeOut" }} className="w-1 h-2 sm:w-1.5 sm:h-3 bg-orange-400/60 rounded-full blur-[1px]" />
      <motion.div animate={{ opacity: [0, 0.8, 0], y: [0, -6, -10], scale: [0.8, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 1, ease: "easeOut" }} className="w-1 h-2 sm:w-1.5 sm:h-3 bg-orange-400/60 rounded-full blur-[1px]" />
    </div>
    <motion.div animate={{ rotate: [-2, 2, -2] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }} className="relative z-10 mt-0.5 sm:mt-1">
      <svg className="w-5 h-5 sm:w-[26px] sm:h-[26px] text-[#16A34A] drop-shadow-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Cooker Body */}
        <path d="M6 10h12v6a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-6z" />
        {/* Lid Rim */}
        <rect x="5" y="8" width="14" height="2" rx="1" />
        {/* Pressure Whistle (Top) */}
        <path d="M12 8V5" />
        <path d="M11 5h2v2h-2z" fill="currentColor" />
        {/* Main Handle (Right) */}
        <path d="M19 9l3-1v2l-3 1" fill="currentColor" strokeWidth="1" />
        {/* Sub Handle (Left) */}
        <path d="M5 10H3v2h2" />
      </svg>
    </motion.div>
    {/* Flame below */}
    <motion.div animate={{ opacity: [0.4, 0.8, 0.4], scaleX: [0.8, 1.2, 0.8] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-0 w-full flex justify-center z-0">
      <div className="w-3 h-[3px] sm:w-4 sm:h-1 bg-[#16A34A] blur-[2px] rounded-full" />
    </motion.div>
  </div>
));

const DeliveryAnimation = memo(() => (
  <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl bg-green-50 border border-green-100 overflow-visible shadow-[0_4px_15px_rgba(35,54,26,0.1)] shrink-0">
    {/* Animated road line */}
    <div className="absolute bottom-1.5 sm:bottom-2 left-0 right-0 h-[2px] overflow-hidden">
      <motion.div 
        animate={{ x: [-20, 40] }} 
        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        className="w-10 h-full bg-green-200/50 rounded-full"
      />
    </div>
    
    <motion.div 
      animate={{ y: [0, -2, 0] }} 
      transition={{ duration: 0.4, repeat: Infinity, ease: "easeInOut" }} 
      className="relative z-10"
    >
      <div className="relative">
        {/* Scooter Body (Simple SVG) */}
        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-[#16A34A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
          <path d="M15 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
          <path d="M5 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12" />
          <path d="M16 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-1" />
          <path d="M10 6v12" />
        </svg>
        
        {/* Avatar - Floating above scooter */}
        <div className="absolute -top-3.5 -right-0.5 sm:-top-4 sm:-right-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-white shadow-sm overflow-hidden bg-white">
          <img 
            src="/delivery_boy_avatar.png" 
            alt="Delivery Boy" 
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </motion.div>
  </div>
));

const getOrderKey = (order) =>
  order?.orderMongoId ||
  order?.id ||
  order?._id ||
  order?.orderId ||
  null;

const normalizeOrderToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

const getOrderStatus = (order) =>
  normalizeOrderToken(
    order?.orderStatus || order?.status || order?.deliveryState?.status || order?.deliveryStatus || "",
  );

const getOrderPhase = (order) =>
  normalizeOrderToken(order?.deliveryState?.currentPhase || order?.currentPhase || "");

const ACTIVE_PHASES = new Set([
  "created",
  "confirmed",
  "preparing",
  "accepted",
  "ready",
  "ready_for_pickup",
  "reached_pickup",
  "picked_up",
  "out_for_delivery",
  "en_route_to_delivery",
  "at_pickup",
  "at_drop",
]);

/** Orders that should show the live tracking strip (any in-flight order, not terminal). */
const TERMINAL_STATUSES = new Set([
  "delivered",
  "cancelled",
  "canceled",
  "completed",
  "failed",
  "cancelled_by_user",
  "canceled_by_user",
  "cancelled_by_restaurant",
  "canceled_by_restaurant",
  "cancelled_by_admin",
  "canceled_by_admin",
]);

const isActiveOrder = (order) => {
  if (!order) return false;
  const status = getOrderStatus(order);
  const phase = getOrderPhase(order);
  if (TERMINAL_STATUSES.has(status)) return false;
  if (phase === "completed" || phase === "delivered") return false;

  // Don't show live tracker for scheduled orders.
  if (order.scheduledAt || order.isScheduled) {
    return false;
  }

  // Some refresh payloads provide live phase but sparse status; keep tracking visible.
  if (!status && phase) return ACTIVE_PHASES.has(phase);
  if (!status) return false;
  return true;
};

const getTimeRemaining = (order) => {
  if (!order) return null;

  const status = getOrderStatus(order);
  if (TERMINAL_STATUSES.has(status)) return null;

  const createdAt = new Date(
    order.createdAt || order.created_at || order.orderDate || Date.now(),
  );
  if (Number.isNaN(createdAt.getTime())) return null;

  const elapsedMinutes = Math.floor((Date.now() - createdAt.getTime()) / 60000);
  const maxETA =
    order.eta?.max ??
    order.eta?.min ??
    order.estimatedDeliveryTime ??
    order.estimated_delivery_time ??
    null;

  if (maxETA == null || maxETA === "") return null;

  const remainingMinutes = Math.max(0, Number(maxETA) - elapsedMinutes);
  return remainingMinutes > 0 ? remainingMinutes : null;
};

const getOrderRestaurantName = (order) => {
  if (!order) return "";
  const populated = order.restaurantId;
  if (populated && typeof populated === "object") {
    const name = populated.restaurantName || populated.name || "";
    if (String(name).trim()) return String(name).trim();
  }
  const direct =
    order.restaurantName ||
    order.restaurant ||
    order.pickups?.[0]?.restaurantName ||
    "";
  return String(direct).trim();
};

function ordersFingerprint(orders) {
  if (!Array.isArray(orders) || orders.length === 0) return "";
  return orders
    .map((o) => `${getOrderKey(o)}:${getOrderStatus(o)}`)
    .join("|");
}

function isUserAuthenticated() {
  if (typeof window === "undefined") return false;
  return Boolean(
    localStorage.getItem("user_accessToken") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("user_authenticated") === "true",
  );
}

const ACTIVE_ORDER_POLL_MS = 30000;

function OrderTrackingCardInner({ hasBottomNav = true }) {
  const navigate = useNavigate();
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [apiOrders, setApiOrders] = useState([]);
  const [hasFetchedApi, setHasFetchedApi] = useState(false);
  const [activeOrderOverride, setActiveOrderOverride] = useState(null);
  const [pendingPlacedTick, setPendingPlacedTick] = useState(0);
  const lastRefreshRef = useRef(0);
  const lastApiFingerprintRef = useRef("");
  const activeOrderKeyRef = useRef("");
  const activeOrderSnapshotRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const pendingPlacedOrderRef = useRef(null);
  const [invalidOrderIds, setInvalidOrderIds] = useState(new Set());

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const syncPolling = useCallback(
    (ordersList) => {
      const hasActive = Array.isArray(ordersList) && ordersList.some(isActiveOrder);
      if (!hasActive) {
        stopPolling();
        return;
      }
      if (pollIntervalRef.current) return;
      pollIntervalRef.current = setInterval(() => {
        fetchOrdersRef.current?.();
      }, ACTIVE_ORDER_POLL_MS);
    },
    [stopPolling],
  );

  const fetchOrdersRef = useRef(null);

  const fetchOrders = useCallback(async (options = {}) => {
    if (!isUserAuthenticated()) {
      if (lastApiFingerprintRef.current !== "") {
        lastApiFingerprintRef.current = "";
        setApiOrders([]);
      }
      setHasFetchedApi(true);
      stopPolling();
      return [];
    }

    try {
      const response = await orderAPI.getOrders(
        { limit: 10, page: 1 },
        { force: options.force === true },
      );
      let nextOrders = [];

      if (response?.data?.success && response?.data?.data?.orders) {
        nextOrders = response.data.data.orders;
      } else if (response?.data?.orders) {
        nextOrders = response.data.orders;
      } else if (response?.data?.data?.data && Array.isArray(response.data.data.data)) {
        nextOrders = response.data.data.data;
      } else if (response?.data?.data?.docs && Array.isArray(response.data.data.docs)) {
        nextOrders = response.data.data.docs;
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
        nextOrders = response.data.data;
      }

      const list = Array.isArray(nextOrders) ? nextOrders : [];
      const fp = ordersFingerprint(list);
      if (fp !== lastApiFingerprintRef.current) {
        lastApiFingerprintRef.current = fp;
        setApiOrders(list);
      }
      syncPolling(list);
      return list;
    } catch (error) {
      if (error?.response?.status === 401) {
        localStorage.removeItem("user_accessToken");
        localStorage.removeItem("accessToken");
        stopPolling();
      }
      if (lastApiFingerprintRef.current !== "") {
        lastApiFingerprintRef.current = "";
        setApiOrders([]);
      }
      stopPolling();
      return [];
    } finally {
      setHasFetchedApi(true);
    }
  }, [stopPolling, syncPolling]);

  fetchOrdersRef.current = fetchOrders;

  useEffect(() => {
    if (!isUserAuthenticated()) {
      setHasFetchedApi(true);
      return undefined;
    }

    fetchOrders();

    const handleAuthChange = () => {
      if (isUserAuthenticated()) {
        fetchOrders({ force: true });
      } else {
        pendingPlacedOrderRef.current = null;
        setPendingPlacedTick((v) => v + 1);
        setApiOrders([]);
        setHasFetchedApi(true);
        stopPolling();
      }
    };

    window.addEventListener("userAuthChanged", handleAuthChange);

    return () => {
      stopPolling();
      window.removeEventListener("userAuthChanged", handleAuthChange);
    };
  }, [fetchOrders, stopPolling]);

  useEffect(() => {
    const pending = pendingPlacedOrderRef.current;
    if (!pending) return;
    const pendingKey = String(getOrderKey(pending) || "");
    if (!pendingKey) return;
    if (apiOrders.some((order) => String(getOrderKey(order) || "") === pendingKey)) {
      pendingPlacedOrderRef.current = null;
      setPendingPlacedTick((v) => v + 1);
    }
  }, [apiOrders]);

  const candidateOrders = useMemo(() => {
    const list = Array.isArray(apiOrders) ? [...apiOrders] : [];
    const pending = pendingPlacedOrderRef.current;
    if (pending) {
      const pendingKey = String(getOrderKey(pending) || "");
      if (pendingKey && !list.some((order) => String(getOrderKey(order) || "") === pendingKey)) {
        list.unshift(pending);
      }
    }
    return list.filter((order) => {
      const key = getOrderKey(order);
      return key && !invalidOrderIds.has(String(key));
    });
  }, [apiOrders, invalidOrderIds, pendingPlacedTick]);

  const activeOrder = useMemo(() => {
    const candidate = candidateOrders.find((order) => isActiveOrder(order)) || null;
    if (!candidate) return null;
    const overrideKey = getOrderKey(activeOrderOverride);
    const candidateKey = getOrderKey(candidate);
    if (overrideKey && candidateKey && overrideKey === candidateKey) return activeOrderOverride;
    return candidate;
  }, [candidateOrders, activeOrderOverride]);

  useEffect(() => {
    const key = String(getOrderKey(activeOrder) || "");
    activeOrderKeyRef.current = key;
    activeOrderSnapshotRef.current = activeOrder;
  }, [activeOrder]);

  useEffect(() => {
    const handleOrderStatusNotification = async (event) => {
      const detail = event?.detail || {};
      const incomingKey = String(detail?.orderMongoId || detail?.orderId || "").trim();
      const currentKey = activeOrderKeyRef.current;
      if (!incomingKey || !currentKey) return;
      if (incomingKey !== currentKey) return;

      const snap = activeOrderSnapshotRef.current;

      setActiveOrderOverride((prev) => ({
        ...(prev || snap || {}),
        orderStatus: detail?.orderStatus || prev?.orderStatus || snap?.orderStatus,
        deliveryState: detail?.deliveryState
          ? { ...(prev?.deliveryState || snap?.deliveryState || {}), ...detail.deliveryState }
          : prev?.deliveryState || snap?.deliveryState,
        status: detail?.status || prev?.status || snap?.status,
      }));

      const now = Date.now();
      if (now - lastRefreshRef.current < 1500) return;
      lastRefreshRef.current = now;

      try {
        const response = await orderAPI.getOrderDetails(incomingKey);
        const fresh = response?.data?.data?.order || response?.data?.order || response?.data?.data || null;
        if (fresh) setActiveOrderOverride(fresh);
      } catch (error) {
        if (error?.response?.status === 404 || error?.response?.status === 400) {
          setInvalidOrderIds((prev) => {
            const next = new Set(prev);
            next.add(incomingKey);
            return next;
          });
        }
      }
    };

    const handleOrderPlaced = (event) => {
      const detail = event?.detail || {};
      const placedOrder = detail?.order || null;
      if (placedOrder) {
        pendingPlacedOrderRef.current = placedOrder;
        setPendingPlacedTick((v) => v + 1);
      }
      fetchOrders({ force: true });
    };

    window.addEventListener("orderStatusNotification", handleOrderStatusNotification);
    window.addEventListener("order-placed", handleOrderPlaced);

    return () => {
      window.removeEventListener("orderStatusNotification", handleOrderStatusNotification);
      window.removeEventListener("order-placed", handleOrderPlaced);
    };
  }, [fetchOrders]);

  useEffect(() => {
    syncPolling(candidateOrders);
  }, [candidateOrders, syncPolling]);

  useEffect(() => {
    if (!activeOrder) {
      setTimeRemaining((prev) => (prev !== null ? null : prev));
      return;
    }

    const tick = () => {
      const next = getTimeRemaining(activeOrder);
      setTimeRemaining((prev) => (prev === next ? prev : next));
    };

    tick();
    const interval = setInterval(tick, 60000);

    return () => clearInterval(interval);
  }, [activeOrder]);

  // Proactive verification for active orders not found in recent API list
  useEffect(() => {
    const key = getOrderKey(activeOrder);
    if (!key || invalidOrderIds.has(key)) return;

    // If order is present in the recent server-provided list, we consider it valid without extra check
    const isRecentlyConfirmed = apiOrders.some((o) => getOrderKey(o) === key);
    if (isRecentlyConfirmed) return;

    const verifyOrderExists = async () => {
      try {
        await orderAPI.getOrderDetails(key);
      } catch (error) {
        if (error?.response?.status === 404 || error?.response?.status === 400) {
          setInvalidOrderIds((prev) => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });
        }
      }
    };

    verifyOrderExists();
  }, [activeOrder, apiOrders, invalidOrderIds]);

  const [dismissedKey, setDismissedKey] = useState(null);

  if (isUserAuthenticated() && !hasFetchedApi) {
    return null;
  }

  if (!activeOrder) {
    return null;
  }

  const currentOrderKey = getOrderKey(activeOrder);
  if (!currentOrderKey || dismissedKey === currentOrderKey) {
    return null;
  }

  const orderStatus = getOrderStatus(activeOrder) || "preparing";
  const orderPhase = getOrderPhase(activeOrder);
  if (TERMINAL_STATUSES.has(orderStatus) || orderPhase === "cancelled" || orderPhase === "canceled") {
    return null;
  }

  const restaurantName = getOrderRestaurantName(activeOrder);
  if (!restaurantName) {
    return null;
  }
  const statusText = (() => {
    const s = String(orderStatus);
    const p = String(orderPhase);

    if (s === "confirmed") return "Order confirmed";
    if (s === "preparing" || s === "created" || s === "pending") return "Preparing your order";
    if (s === "ready_for_pickup") return "Ready for pickup";

    if (s === "reached_pickup" || p === "at_pickup") return "Delivery partner reached restaurant";
    if (s === "picked_up" || p === "en_route_to_delivery") return "On the way";
    if (s === "reached_drop" || p === "at_drop") return "Arrived near you";

    if (s === "delivered" || p === "delivered" || p === "completed") return "Delivered";
    return "Preparing your order";
  })();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={`fixed ${hasBottomNav ? "bottom-20" : "bottom-6"} left-4 right-4 md:left-auto md:right-6 z-[9999] pointer-events-none`}
      >
        <div className="max-w-7xl md:max-w-none mx-auto md:mx-0 pointer-events-auto w-full md:w-[400px]">
          <div 
            onClick={() =>
              navigate(
                `/food/user/orders/${activeOrder.orderMongoId || activeOrder.id || activeOrder._id || activeOrder.orderId}`,
              )
            }
            className="bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden cursor-pointer group"
          >
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 md:p-4">
              {(() => {
                const s = String(orderStatus);
                const p = String(orderPhase);
                const isOnTheWay = s === "picked_up" || s === "out_for_delivery" || s === "en_route_to_delivery" || p === "picked_up" || p === "en_route_to_delivery" || s === "reached_drop" || p === "at_drop";
                
                return isOnTheWay ? <DeliveryAnimation /> : <CookingAnimation />;
              })()}

              <div className="flex-1 min-w-0 pr-2">
                <p className="text-gray-900 dark:text-white font-bold text-xs sm:text-sm md:text-lg truncate tracking-tight">{restaurantName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-gray-500 dark:text-zinc-400 font-medium text-[10px] sm:text-xs md:text-sm truncate">{statusText}</p>
                  <ChevronRight className="w-3 h-3 text-[#16A34A] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#16A34A] to-[#15803D] dark:from-[#15803D] dark:to-[#166534] shadow-md shadow-emerald-500/10 rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 md:px-5 md:py-3 shrink-0 flex flex-col items-center justify-center border border-emerald-200/20">
                <p className="text-emerald-50 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider opacity-90 leading-tight mb-0.5 whitespace-nowrap">
                  arriving in
                </p>
                <p className="text-white text-xs sm:text-sm md:text-base font-black leading-tight drop-shadow-sm">
                  {timeRemaining !== null
                    ? `${Math.max(1, timeRemaining)} min`
                    : "--"}
                </p>
              </div>

              <motion.button
                onClick={(e) => { e.stopPropagation(); setDismissedKey(currentOrderKey); }}
                className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

const OrderTrackingCard = memo(OrderTrackingCardInner);
export default OrderTrackingCard;

