import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@food/api/config';
import { createRealtimeSocket } from '@/services/socket/createRealtimeSocket';
import { createSyncEngine } from '@/services/socket/syncEngine';
import { restaurantAPI } from '@food/api';
const alertSound = '/zomato_sms.mp3';
import { dispatchNotificationInboxRefresh } from '@food/hooks/useNotificationInbox';
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
// Errors stay visible: a silenced debugError is how an unrecoverable auth failure would look
// identical to a healthy socket. debugLog/debugWarn remain no-ops to keep the console quiet.
const debugError = (...args) => { console.error('[RestaurantSocket]', ...args); }

const resolveAudioSource = (source) => {
  return source;
}

const supportsBrowserNotifications = () =>
  typeof window !== 'undefined' && typeof Notification !== 'undefined';

const buildRestaurantOrderNotification = (orderData = {}) => {
  const orderId = orderData.orderId || orderData.orderMongoId || 'New';
  const itemCount = Array.isArray(orderData.items) ? orderData.items.length : 0;
  const total = Number(
    orderData.restaurantPayout ??
      orderData.restaurantEarnings?.payout ??
      orderData.pricing?.total ??
      orderData.total ??
      0,
  );

  return {
    title: `New order #${orderId}`,
    body: itemCount > 0
      ? `${itemCount} item${itemCount === 1 ? '' : 's'} - ₹${total.toFixed(2)}`
      : 'A new order is waiting for review',
    tag: `restaurant-order-${orderId}`,
    data: {
      orderId,
      targetUrl: `/restaurant/orders/${orderData.orderMongoId || orderData.orderId || ''}`,
    },
  };
}

const triggerWebViewNativeNotification = async (orderData = {}) => {
  if (typeof window === 'undefined') return false;

  const bridgePayload = {
    title: 'New restaurant order',
    body: `Order #${orderData?.orderId || orderData?.orderMongoId || orderData?.id || ''}`.trim(),
    orderId: orderData?.orderId || orderData?.order_id || '',
    orderMongoId: orderData?.orderMongoId || orderData?.order_mongo_id || '',
    targetUrl: `/restaurant/orders/${orderData?.orderMongoId || orderData?.orderId || ''}`,
  };

  try {
    if (
      window.flutter_inappwebview &&
      typeof window.flutter_inappwebview.callHandler === 'function'
    ) {
      const handlerNames = [
        'playNotificationSound',
        'triggerNotificationFeedback',
        'onPushNotification',
      ];

      for (const handlerName of handlerNames) {
        try {
          await window.flutter_inappwebview.callHandler(handlerName, bridgePayload);
          return true;
        } catch {
          // Try next handler name.
        }
      }
    }
  } catch {
    // Ignore bridge failures and fall back to browser/web audio.
  }

  return false;
}


/**
 * Hook for restaurant to receive real-time order notifications with sound
 * @returns {object} - { newOrder, playSound, isConnected }
 */
export const useRestaurantNotifications = () => {
  const socketRef = useRef(null);
  const [newOrder, setNewOrder] = useState(null);
  const [newReservation, setNewReservation] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const audioRef = useRef(null);
  const activeOrderRef = useRef(null);
  const alertLoopTimerRef = useRef(null);
  const alertLoopStartedAtRef = useRef(0);
  const userInteractedRef = useRef(false); // Track user interaction for autoplay policy
  const audioUnlockAttemptedRef = useRef(false);
  const [restaurantId, setRestaurantId] = useState(null);
  // Latest-value ref so the stable connection effect can read the id without depending on it.
  const restaurantIdRef = useRef(null);
  const joinedRestaurantRoomRef = useRef(null);
  const syncRef = useRef(null);
  const applyNewOrderRef = useRef(null);
  const lastConnectErrorLogRef = useRef(0);
  const lastAlertAtByOrderRef = useRef(new Map());
  const lastBrowserNotificationAtByOrderRef = useRef(new Map());
  const CONNECT_ERROR_LOG_THROTTLE_MS = 10000;
  const ALERT_LOOP_INTERVAL_MS = 4500;
  const ALERT_LOOP_MAX_MS = 120000;
  const ALERT_DEDUPE_MS = 15000;
  const BROWSER_NOTIFICATION_DEDUPE_MS = 20000;
  const NOTIFICATION_PERMISSION_ASKED_KEY = 'restaurant_notification_permission_asked';

  const getOrderAlertKey = (orderData = {}) => (
    String(
      orderData?.orderMongoId ||
      orderData?.order_mongo_id ||
      orderData?.orderId ||
      orderData?.order_id ||
      orderData?._id ||
      orderData?.id ||
      ''
    ).trim()
  );

  const shouldProcessOrderAlert = (orderData = {}) => {
    const key = getOrderAlertKey(orderData);
    if (!key) return true;
    const now = Date.now();
    const last = lastAlertAtByOrderRef.current.get(key) || 0;
    if (now - last < ALERT_DEDUPE_MS) return false;
    lastAlertAtByOrderRef.current.set(key, now);
    return true;
  };

  const shouldShowBrowserNotification = (orderData = {}) => {
    const key = getOrderAlertKey(orderData);
    if (!key) return true;
    const now = Date.now();
    const last = lastBrowserNotificationAtByOrderRef.current.get(key) || 0;
    if (now - last < BROWSER_NOTIFICATION_DEDUPE_MS) return false;
    lastBrowserNotificationAtByOrderRef.current.set(key, now);
    return true;
  };

  const showBackgroundOrderNotification = async (orderData) => {
    if (!shouldShowBrowserNotification(orderData)) {
      return;
    }

    if (!supportsBrowserNotifications() || Notification.permission !== 'granted') {
      return;
    }

    const notificationOptions = buildRestaurantOrderNotification(orderData);

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.showNotification(notificationOptions.title, {
            body: notificationOptions.body,
            tag: notificationOptions.tag,
            renotify: true,
            requireInteraction: true,
            silent: false,
            vibrate: [200, 100, 200, 100, 300],
            icon: '/favicon.ico',
            data: notificationOptions.data,
          });
          return;
        }
      }

      new Notification(notificationOptions.title, {
        body: notificationOptions.body,
        tag: notificationOptions.tag,
        requireInteraction: true,
        silent: false,
        icon: '/favicon.ico',
        data: notificationOptions.data,
      });
    } catch (error) {
      debugWarn('Error showing background restaurant notification:', error);
    }
  };

  const stopAlertLoop = () => {
    if (alertLoopTimerRef.current) {
      clearInterval(alertLoopTimerRef.current);
      alertLoopTimerRef.current = null;
    }
    alertLoopStartedAtRef.current = 0;
  };

  const startAlertLoop = () => {
    stopAlertLoop();
    alertLoopStartedAtRef.current = Date.now();

    alertLoopTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - alertLoopStartedAtRef.current;
      if (elapsed >= ALERT_LOOP_MAX_MS || !activeOrderRef.current) {
        stopAlertLoop();
        return;
      }

      // Only re-alert if the tab is hidden. 
      // If the user has the tab open, they are seeing the orders.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        playNotificationSound(activeOrderRef.current);
      }
    }, ALERT_LOOP_INTERVAL_MS);
  };

  const handleIncomingOrderAlert = (orderData, source = 'unknown') => {
    const isSocket = source === 'socket';
    
    // For scheduled orders, don't alert at all if they are far away (more than 15 mins)
    if (orderData?.scheduledAt) {
      const scheduledTime = new Date(orderData.scheduledAt).getTime();
      const now = Date.now();
      const isDueSoon = scheduledTime <= now + 15 * 60000;
      
      // If not due soon, ignore this order for sound/alerts
      if (!isDueSoon) {
        return;
      }
    }

    const deduped = !shouldProcessOrderAlert(orderData);
    
    // If it's a poll and it was already alerted recently, skip.
    // If it's a socket event, we always process it (e.g., manual 'Resend' triggers).
    if (deduped && !isSocket) {
      return;
    }

    activeOrderRef.current = orderData || { id: Date.now() };

    // Play sound immediately if:
    // 1. It's a real-time socket event (we want to know even if on the page)
    // 2. OR the tab is hidden (so the poll successfully alerts the user)
    const isTabHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (isSocket || isTabHidden) {
      playNotificationSound(orderData);
    }

    startAlertLoop();

    if (isTabHidden) {
      showBackgroundOrderNotification(orderData);
    }
  };

  const handleIncomingReservationAlert = (bookingData) => {
    // Basic alert logic for reservations
    playNotificationSound(bookingData);
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
       // Optional: show background notification for reservation
    }
  };

  restaurantIdRef.current = restaurantId;

  /**
   * Join this restaurant's room. Reads the id from a ref so it stays callable from the stable
   * connection effect. `join-restaurant` is idempotent server-side and validated against the
   * JWT, so a repeat emit is harmless.
   */
  const joinRestaurantRoomIfPossible = useCallback(() => {
    const id = restaurantIdRef.current;
    if (!socketRef.current?.connected || !id) return false;
    if (joinedRestaurantRoomRef.current === id) return true;

    debugLog('Joining restaurant room', { restaurantId: id, socketId: socketRef.current?.id });
    socketRef.current.emit('join-restaurant', id);
    joinedRestaurantRoomRef.current = id;
    return true;
  }, []);

  // Get restaurant ID from API
  useEffect(() => {
    const fetchRestaurantId = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant();
        if (response.data?.success && response.data.data?.restaurant) {
          const restaurant = response.data.data.restaurant;
          const id = restaurant._id?.toString() || restaurant.restaurantId;
          setRestaurantId(id);
        }
      } catch (error) {
        debugError('Error fetching restaurant:', error);
      }
    };
    fetchRestaurantId();
  }, []);

  useEffect(() => {
    if (!supportsBrowserNotifications()) return;

    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(NOTIFICATION_PERMISSION_ASKED_KEY) === 'true') return;

    const requestPermissionOnce = async () => {
      localStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
      try {
        await Notification.requestPermission();
      } catch (error) {
        debugWarn('Failed to request restaurant notification permission:', error);
      }
    };

    const askOnInteraction = () => {
      requestPermissionOnce();
      window.removeEventListener('pointerdown', askOnInteraction);
      window.removeEventListener('keydown', askOnInteraction);
    };

    window.addEventListener('pointerdown', askOnInteraction, { once: true, passive: true });
    window.addEventListener('keydown', askOnInteraction, { once: true });

    return () => {
      window.removeEventListener('pointerdown', askOnInteraction);
      window.removeEventListener('keydown', askOnInteraction);
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      
      if (document.visibilityState === 'visible') {
        // Stop any repeating alert loops once the user "sees" the page
        stopAlertLoop();
      } else if (document.visibilityState === 'hidden' && activeOrderRef.current) {
        // Trigger one-shot alert when tab is hidden to ensure user didn't miss it
        playNotificationSound(activeOrderRef.current);
        showBackgroundOrderNotification(activeOrderRef.current);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Socket connection effect.
  //
  // deps [] on purpose: the connection must not wait on (or be rebuilt by) restaurantId, which
  // resolves asynchronously from getCurrentRestaurant(). Previously the socket refused to
  // connect at all until that call returned, so every event in that window was lost. The server
  // decodes identity from the JWT and auto-joins the restaurant room; the explicit join is
  // handled by the room effect below once the id lands.
  useEffect(() => {
    const created = createRealtimeSocket({
      apiBaseUrl: API_BASE_URL,
      module: 'restaurant',
      log: debugLog,
      warn: debugWarn,
      onAuthFatal: () => {
        debugError('Restaurant socket auth could not be recovered - re-login required.');
        setIsConnected(false);
      },
    });

    if (!created) {
      setIsConnected(false);
      return undefined;
    }

    const { socket, destroy } = created;
    socketRef.current = socket;

    // Cursor sync. This is the restaurant's first real recovery path: previously it never
    // called resync, and the server had no RESTAURANT branch even if it had — which is exactly
    // why the 10s order refetch existed.
    const syncEngine = createSyncEngine({
      socket,
      module: 'restaurant',
      log: debugLog,
      warn: debugWarn,
      onEvent: (type, payload, meta) => {
        if (type === 'new_order') {
          applyNewOrderRef.current?.(payload, { replayed: meta.replayed });
        }
      },
    });
    syncRef.current = syncEngine;

    socketRef.current.on('connect', () => {
      debugLog('Restaurant socket connected', {
        socketId: socketRef.current?.id,
        restaurantId: restaurantIdRef.current,
        transport: socketRef.current?.io?.engine?.transport?.name || 'unknown',
      });
      setIsConnected(true);
      joinedRestaurantRoomRef.current = null;
      joinRestaurantRoomIfPossible();
    });

    // Listen for room join confirmation
    socketRef.current.on('restaurant-room-joined', (data) => {
      debugLog('? Restaurant room joined successfully:', data);
      debugLog('? Room:', data?.room);
      debugLog('? Restaurant ID in room:', data?.restaurantId);
    });

    // Listen for connection errors (throttle logs to avoid console spam on reconnect loops)
    socketRef.current.on('connect_error', (error) => {
      const now = Date.now();
      const shouldLog = now - lastConnectErrorLogRef.current >= CONNECT_ERROR_LOG_THROTTLE_MS;
      if (shouldLog) {
        lastConnectErrorLogRef.current = now;
        const isTransportError = error.type === 'TransportError' || error.message?.includes('xhr poll error');
        debugWarn(
          'Restaurant Socket:',
          isTransportError
            ? `Cannot reach backend at ${API_BASE_URL}. Ensure the backend is running (e.g. npm run dev in backend).`
            : error.message
        );
        if (!isTransportError) {
          debugWarn('Details:', { type: error.type, apiBaseUrl: API_BASE_URL });
        }
      }
      if (error.message?.includes('CORS') || error.message?.includes('Not allowed')) {
        debugWarn('?? Add frontend URL to CORS_ORIGIN in backend .env');
      }
      setIsConnected(false);
    });

    // Listen for disconnection
    socketRef.current.on('disconnect', (reason) => {
      debugLog('? Restaurant Socket disconnected:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        // Server disconnected the socket, reconnect manually
        socketRef.current.connect();
      }
    });

    // Listen for reconnection attempts
    socketRef.current.on('reconnect_attempt', (attemptNumber) => {
      debugLog(`?? Reconnection attempt ${attemptNumber}...`);
    });

    // Listen for successful reconnection
    socketRef.current.on('reconnect', (attemptNumber) => {
      debugLog(`Reconnected after ${attemptNumber} attempts`);
      setIsConnected(true);
      joinedRestaurantRoomRef.current = null;
      joinRestaurantRoomIfPossible();
    });

    /**
     * Apply a new order. Shared by the live socket event and by sync replay so a restaurant
     * that was disconnected lands in the same state as one that was connected. Idempotent —
     * the same order legitimately arrives both ways.
     */
    const applyNewOrder = (orderData, { replayed = false } = {}) => {
      const normalizedOrder = {
        ...orderData,
        orderMongoId: orderData?.orderMongoId || orderData?._id || orderData?.order_mongo_id,
        orderId: orderData?.orderId || orderData?.order_id || orderData?._id,
      };

      // Filter scheduled orders here as well to prevent "red dot" from showing up too early
      if (normalizedOrder.scheduledAt) {
        const scheduledTime = new Date(normalizedOrder.scheduledAt).getTime();
        const now = Date.now();
        if (scheduledTime > now + 15 * 60000) {
          debugLog('Ignoring far-away scheduled order:', normalizedOrder.orderId);
          return;
        }
      }

      debugLog(replayed ? 'Order recovered via sync:' : 'New order received:', normalizedOrder);
      setNewOrder(normalizedOrder);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('restaurant:new_order', { detail: normalizedOrder }),
        );
      }

      handleIncomingOrderAlert(normalizedOrder, 'socket');
    };
    applyNewOrderRef.current = applyNewOrder;

    // Listen for new order notifications
    socketRef.current.on('new_order', (orderData) => {
      if (syncRef.current?.noteLiveEvent(orderData)) return; // already applied via sync
      applyNewOrder(orderData);
    });
    
    // Listen for new dining booking notifications
    socketRef.current.on('new_dining_booking', (bookingData) => {
      debugLog('?? New dining booking received:', bookingData);
      setNewReservation(bookingData);
      handleIncomingReservationAlert(bookingData);
    });

    // Listen for sound notification event
    socketRef.current.on('play_notification_sound', (data) => {
      debugLog('?? Sound notification:', data);
      const normalizedData = {
        orderId: data?.orderId || data?.order_id,
        orderMongoId: data?.orderMongoId || data?.order_mongo_id,
        ...data
      };
      // handleIncomingOrderAlert manages sound (socket source always rings) and background notifications
      handleIncomingOrderAlert(normalizedData, 'socket');
    });

    // Listen for order status updates
    socketRef.current.on('order_status_update', (data) => {
      debugLog('?? Order status update:', data);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('restaurantOrderStatusUpdate', {
            detail: data || {},
          }),
        );
      }
    });

    socketRef.current.on('admin_notification', (payload) => {
      debugLog('?? Admin broadcast received:', payload);
      dispatchNotificationInboxRefresh();
    });

    // Load notification sound
    audioRef.current = new Audio(resolveAudioSource(alertSound));
    audioRef.current.preload = 'auto';
    audioRef.current.volume = 1;

    return () => {
      stopAlertLoop();
      joinedRestaurantRoomRef.current = null;
      syncEngine.destroy();
      syncRef.current = null;
      destroy();
      socketRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Room effect: joins on the already-open socket once restaurantId resolves. Kept separate
  // from the connection effect so a late id can never gate or rebuild the connection.
  useEffect(() => {
    if (!restaurantId) {
      debugLog('Waiting for restaurantId before joining the restaurant room...');
      return;
    }
    joinRestaurantRoomIfPossible();
  }, [restaurantId, joinRestaurantRoomIfPossible]);

  // Track user interaction for autoplay policy
  useEffect(() => {
    const handleUserInteraction = async () => {
      userInteractedRef.current = true;

      if (!audioRef.current) {
        audioRef.current = new Audio(resolveAudioSource(alertSound));
        audioRef.current.preload = 'auto';
        audioRef.current.volume = 1;
      }

      if (!audioUnlockAttemptedRef.current && audioRef.current) {
        audioUnlockAttemptedRef.current = true;
        try {
          audioRef.current.muted = true;
          await audioRef.current.play();
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch (error) {
          audioUnlockAttemptedRef.current = false;
          if (!error.message?.includes('user didn\'t interact') && !error.name?.includes('NotAllowedError')) {
            debugWarn('Error unlocking notification sound:', error);
          }
        } finally {
          // Ensure audio never remains muted after unlock attempts.
          if (audioRef.current) {
            audioRef.current.muted = false;
          }
        }
      }

      // Remove listeners after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('pointerdown', handleUserInteraction);
    };
    
    // Listen for user interaction
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    window.addEventListener('pointerdown', handleUserInteraction, { once: true, passive: true });
    
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('pointerdown', handleUserInteraction);
    };
  }, []);

  const playNotificationSound = async (orderData = {}) => {
    try {
      const usedNativeBridge = await triggerWebViewNativeNotification(orderData);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([200, 100, 200, 100, 300]);
      }
      if (usedNativeBridge) {
        return;
      }

      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.volume = 1;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(error => {
          // Don't log autoplay policy errors as they're expected
          if (!error.message?.includes('user didn\'t interact') && !error.name?.includes('NotAllowedError')) {
            debugWarn('Error playing notification sound:', error);
            // Fallback: try one-shot audio instance (more reliable in background tabs on some browsers)
            try {
              const fallbackAudio = new Audio(resolveAudioSource(alertSound, `restaurant-alert-${Date.now()}`));
              fallbackAudio.volume = 1;
              fallbackAudio.play().catch(() => {});
            } catch (fallbackError) {
              debugWarn('Fallback audio playback failed:', fallbackError);
            }
          }
        });
      }
    } catch (error) {
      // Don't log autoplay policy errors
      if (!error.message?.includes('user didn\'t interact') && !error.name?.includes('NotAllowedError')) {
        debugWarn('Error playing sound:', error);
      }
    }
  };

  const clearNewOrder = () => {
    stopAlertLoop();
    activeOrderRef.current = null;
    setNewOrder(null);
  };

  return {
    newOrder,
    newReservation,
    clearNewOrder,
    clearNewReservation: () => {
      setNewReservation(null);
    },
    isConnected,
    playNotificationSound
  };
};



