import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { useProximityCheck } from '@/modules/DeliveryV2/hooks/useProximityCheck';
import { useOrderManager } from '@/modules/DeliveryV2/hooks/useOrderManager';
import { useDeliveryNotifications } from '@food/hooks/useDeliveryNotifications';
import { writeOrderTracking } from '@food/realtimeTracking';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import '@/modules/DeliveryV2/deliveryTheme.css';

// Components
import LiveMap from '@/modules/DeliveryV2/components/map/LiveMap';
import { NewOrderModal } from '@/modules/DeliveryV2/components/modals/NewOrderModal';
import { PickupActionModal } from '@/modules/DeliveryV2/components/modals/PickupActionModal';
import { DeliveryVerificationModal } from '@/modules/DeliveryV2/components/modals/DeliveryVerificationModal';
import { OrderSummaryModal } from '@/modules/DeliveryV2/components/modals/OrderSummaryModal';
import ActionSlider from '@/modules/DeliveryV2/components/ui/ActionSlider';

// Sub Pages
import PocketV2 from '@/modules/DeliveryV2/pages/PocketV2';
import HistoryV2 from '@/modules/DeliveryV2/pages/HistoryV2';
import ProfileV2 from '@/modules/DeliveryV2/pages/ProfileV2';

// Icons
import { 
  Bell, HelpCircle, AlertTriangle, 
  Wallet, History, User as UserIcon, LayoutGrid,
  Plus, Minus, Navigation2, Target, Play, CheckCircle2, Clock, ChevronDown,
  Contact, Package
} from 'lucide-react';

import { getHaversineDistance, calculateETA, calculateHeading } from '@/modules/DeliveryV2/utils/geo';
import { useCompanyName } from "@food/hooks/useCompanyName";
import { useNavigate } from 'react-router-dom';
import useNotificationInbox from "@food/hooks/useNotificationInbox";

/** Minimal bottom-sheet popup (Restored from legacy FeedNavbar) */
function BottomPopup({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[600] flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full bg-white rounded-t-3xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
             <AlertTriangle className="w-4 h-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

/**
 * DeliveryHomeV2 - Premium 1:1 Match with Original App UI.
 * Featuring logical tab switching for Feed, Pocket, History, and Profile.
 */
export default function DeliveryHomeV2({ tab = 'feed' }) {
  const navigate = useNavigate();
  const { isOnline, toggleOnline, riderLocation, activeOrder, tripStatus, setRiderLocation, setActiveOrder, updateTripStatus, clearActiveOrder } = useDeliveryStore();
  const { isWithinRange, distanceToTarget, durationToTarget } = useProximityCheck();
  const { acceptOrder, reachPickup, pickUpOrder, reachDrop, completeDelivery, resetTrip } = useOrderManager();
  const { newOrder, clearNewOrder, sharedOrder, clearSharedOrder, orderStatusUpdate, clearOrderStatusUpdate, claimedOrderId, clearClaimedOrderId, adminNotification, clearAdminNotification, isConnected: isSocketConnected, emitLocation, socket } = useDeliveryNotifications();
  const companyName = useCompanyName();
  const { items: broadcastItems, unreadCount: notificationUnreadCount, markAsRead: markBroadcastAsRead, dismissAll: dismissAllBroadcast } = useNotificationInbox("delivery", { limit: 20 });

  const [incomingOrder, setIncomingOrder] = useState(null);
  const [cashLimitNotice, setCashLimitNotice] = useState(null);
  const [currentTab, setCurrentTab] = useState(tab);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Track URL changes (Prop changes) to update sub-page content
  useEffect(() => {
    setCurrentTab(tab);
  }, [tab]);

  const [showVerification, setShowVerification] = useState(false);
  const [showEmergencyPopup, setShowEmergencyPopup] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [riderProfile, setRiderProfile] = useState(null);
  const [emergencyNumbers, setEmergencyNumbers] = useState({
    medicalEmergency: "",
    accidentHelpline: "",
    contactPolice: "",
    insurance: "",
  });
  
  const [isModalMinimized, setIsModalMinimized] = useState(false);
  const [eta, setEta] = useState(null);
  const lastLocationSentAt = useRef(0);
  const lastCoordRef = useRef(null);
  const rollingSpeedRef = useRef([]);
  const lastAutoArrivalRef = useRef({ PICKING_UP: false, PICKED_UP: false });
  const activeOrderIdRef = useRef(null);
  const clearLiveTripUiRef = useRef(null);
  const extractCurrentTripRef = useRef(null);
  const applyServerTripRef = useRef(null);
  const hasMountedTripSyncRef = useRef(false);

  useEffect(() => {
    activeOrderIdRef.current = activeOrder
      ? String(activeOrder._id || activeOrder.orderId || activeOrder.orderMongoId || '')
      : null;
  }, [activeOrder]);

  const clearLiveTripUi = useCallback((toastMsg) => {
    resetTrip();
    setShowVerification(false);
    setIsModalMinimized(false);
    setIncomingOrder(null);
    clearNewOrder?.();
    clearSharedOrder?.();
    if (toastMsg) toast.error(toastMsg);
  }, [resetTrip, clearNewOrder, clearSharedOrder]);

  const extractCurrentTrip = useCallback((response) => {
    const data = response?.data?.data;
    // Prefer explicit activeOrder key (null means no trip — do not fall back to wrapper object)
    const candidate = data && Object.prototype.hasOwnProperty.call(data, 'activeOrder')
      ? data.activeOrder
      : data;
    if (!candidate) return null;
    if (!(candidate._id || candidate.orderId || candidate.order_id)) return null;
    const status = String(
      candidate.orderStatus || candidate.status || candidate.deliveryStatus || '',
    ).toLowerCase();
    if (status.startsWith('cancelled') || status === 'deleted') return null;
    return candidate;
  }, []);

  useEffect(() => {
    clearLiveTripUiRef.current = clearLiveTripUi;
  }, [clearLiveTripUi]);

  useEffect(() => {
    extractCurrentTripRef.current = extractCurrentTrip;
  }, [extractCurrentTrip]);

  const [zoom, setZoom] = useState(16);
  const [isSimMode, setIsSimMode] = useState(false);
  const [simPath, setSimPath] = useState([]);
  const [simIndex, setSimIndex] = useState(0);
  const [simProgress, setSimProgress] = useState(0); // 0 to 1 between points
  const [activePolyline, setActivePolyline] = useState(null);
  const mapRef = useRef(null);
  const simInitializedRef = useRef(false);
  const [riderAddress, setRiderAddress] = useState("Determining location...");

  // Reverse Geocoding Effect
  useEffect(() => {
    if (!isOnline || !riderLocation || !window.google?.maps?.Geocoder) return;

    const geocoder = new window.google.maps.Geocoder();
    const latlng = {
      lat: parseFloat(riderLocation.lat || riderLocation.latitude),
      lng: parseFloat(riderLocation.lng || riderLocation.longitude),
    };

    const throttleId = setTimeout(() => {
      geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === "OK" && results[0]) {
          // Use a shorter version of the address for the UI
          const address = results[0].formatted_address.split(',').slice(0, 2).join(',');
          setRiderAddress(address);
        }
      });
    }, 2000); // Throttle geocoding to every 2 seconds

    return () => clearTimeout(throttleId);
  }, [isOnline, riderLocation]);

  const isLoggingOut = useRef(false);
  const handleLogout = useCallback(() => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;
    
    // 1. Clear tokens and state
    localStorage.removeItem('delivery_accessToken');
    localStorage.removeItem('delivery_refreshToken');
    localStorage.removeItem('delivery_authenticated');
    localStorage.removeItem('delivery_user');
    
    // 2. Alert user and redirect
    toast.error("Session Expired", { description: "Please log in again." });
    navigate("/driver/login", { replace: true });

    // Optional: Full refresh after delay ONLY if we're not already on login
    setTimeout(() => {
       if (!window.location.pathname.includes('/login')) {
          window.location.reload();
       }
    }, 1500);
  }, [navigate]);

  useEffect(() => {
    const onAuthFailure = (e) => {
      if (e.detail?.module === 'delivery') {
        handleLogout();
      }
    };
    window.addEventListener('authRefreshFailed', onAuthFailure);
    return () => window.removeEventListener('authRefreshFailed', onAuthFailure);
  }, [handleLogout]);

  // 0. Auto-Simulation Effect (High-Precision Smooth Glide)
  const lastSimUpdateSentAt = useRef(0);
  useEffect(() => {
    let interval;
    if (isSimMode && simPath.length > 1 && simIndex < simPath.length - 1) {
      console.log('[SimAuto] Glide Active √');
      
      interval = setInterval(() => {
        setSimProgress(prev => {
          const nextProgress = prev + 0.08; // 8% movement per tick
          
          if (nextProgress >= 1) {
            setSimIndex(idx => idx + 1);
            return 0; // Move to next segment
          }

          const currentPoint = simPath[simIndex];
          const nextPoint = simPath[simIndex + 1];

          if (currentPoint && nextPoint) {
            // Linear Interpolation (LERP)
            const lat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * nextProgress;
            const lng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * nextProgress;
            const heading = calculateHeading(currentPoint.lat, currentPoint.lng, nextPoint.lat, nextPoint.lng);

            setRiderLocation({ lat, lng, heading });

            if (mapRef.current) {
              mapRef.current.panTo({ lat, lng });
            }

            // Sync with backend every 2.5 seconds during simulation so customer sees it
            const now = Date.now();
            if (now - lastSimUpdateSentAt.current >= 2000) { // Reduced to 2s to match backend throttle
              lastSimUpdateSentAt.current = now;
              const payload = { 
                lat, 
                lng, 
                heading, 
                orderId: activeOrder?.orderId || activeOrder?._id,
                status: 'on_the_way',
                polyline: activePolyline // Include polyline in every stream update for resilience
              };
              // A. HTTP Backup
              deliveryAPI.updateLocation(lat, lng, true, { heading }).catch(() => {});
              
              // B. SOCKET LIVE (SILKY SMOOTH)
              if (payload.orderId) emitLocation(payload);

              // C. FIREBASE REALTIME DB (Persistent Route for Customer Map)
              if (payload.orderId) {
                writeOrderTracking(payload.orderId, { 
                  lat, 
                  lng, 
                  heading, 
                  polyline: activePolyline,
                  status: tripStatus,
                  eta: eta // Publish live ETA to Firebase
                }).catch(() => {});
              }
            }
          }
          return nextProgress;
        });
      }, 50); // 20 FPS movement
    }
    return () => clearInterval(interval);
  }, [isSimMode, simPath, simIndex, activeOrder, emitLocation, activePolyline, eta, tripStatus]);

  // Fetch Emergency numbers and Profile (Restored logic)
  useEffect(() => {
    (async () => {
      try {
        const [emergencyRes, profileRes] = await Promise.all([
          deliveryAPI.getEmergencyHelp(),
          deliveryAPI.getProfile()
        ]);
        if (emergencyRes?.data?.success && emergencyRes.data.data) {
          setEmergencyNumbers(emergencyRes.data.data);
        }
        if (profileRes?.data?.success && profileRes.data.data?.profile) {
          const profile = profileRes.data.data.profile;
          setRiderProfile(profile);
          setProfileImage(profile.profileImage?.url || profile.documents?.photo || null);
        }
      } catch (err) { console.warn('Navbar Data Fetch Error:', err); }
    })();
  }, []);

  const emergencyOptions = [
    { title: "Medical Emergency", subtitle: "Call an ambulance", icon: <AlertTriangle className="text-red-600" />, phone: emergencyNumbers.medicalEmergency },
    { title: "Accident Helpline", subtitle: "Report an accident", icon: <AlertTriangle className="text-orange-600" />, phone: emergencyNumbers.accidentHelpline },
    { title: "Contact Police", subtitle: "Nearest police support", icon: <AlertTriangle className="text-blue-600" />, phone: emergencyNumbers.contactPolice },
    { title: "Insurance", subtitle: "Policy & claim help", icon: <AlertTriangle className="text-green-600" />, phone: emergencyNumbers.insurance },
  ];

  // Reset simulation when trip phase/order/mode changes.
  // Do not reset on each route refresh, otherwise marker appears frozen.
  useEffect(() => {
    if (isSimMode) {
      console.log('[SimAuto] Resetting simulation playhead...');
      setSimIndex(0);
      setSimProgress(0);
      simInitializedRef.current = false;
    } else {
      simInitializedRef.current = false;
    }
  }, [tripStatus, isSimMode, activeOrder?._id]);

  // Ensure simulation starts from the first route point once route is ready.
  useEffect(() => {
    if (!isSimMode || simInitializedRef.current || simPath.length < 2) return;
    const start = simPath[0];
    if (
      start &&
      Number.isFinite(Number(start.lat)) &&
      Number.isFinite(Number(start.lng))
    ) {
      setRiderLocation({ lat: Number(start.lat), lng: Number(start.lng), heading: 0 });
      simInitializedRef.current = true;
    }
  }, [isSimMode, simPath, setRiderLocation]);

  // Fallback path for simulation when Directions API doesn't return a usable path.
  useEffect(() => {
    if (!isSimMode || simPath.length > 1 || !activeOrder) return;

    const parsePoint = (raw) => {
      if (!raw) return null;
      const lat = Number(raw.lat ?? raw.latitude);
      const lng = Number(raw.lng ?? raw.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    };

    const rider = useDeliveryStore.getState().riderLocation;
    const riderPoint = parsePoint(rider);
    const targetPoint =
      tripStatus === 'PICKED_UP' || tripStatus === 'REACHED_DROP'
        ? parsePoint(activeOrder.customerLocation)
        : parsePoint(activeOrder.restaurantLocation);

    if (!riderPoint || !targetPoint) return;

    const distance = getHaversineDistance(
      riderPoint.lat,
      riderPoint.lng,
      targetPoint.lat,
      targetPoint.lng,
    );
    if (!Number.isFinite(distance) || distance < 10) return;

    const steps = 60;
    const fallbackPath = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      return {
        lat: riderPoint.lat + (targetPoint.lat - riderPoint.lat) * t,
        lng: riderPoint.lng + (targetPoint.lng - riderPoint.lng) * t,
      };
    });

    setSimPath(fallbackPath);
  }, [isSimMode, simPath, activeOrder, tripStatus]);

  // Auto-restore modal when status or content changes

  // Auto-restore modal when status or content changes
  useEffect(() => {
    setIsModalMinimized(false);
  }, [tripStatus, showVerification, incomingOrder]);

  // 1. Trip sync — mount once + slow watchdog via refs (avoids /orders/current render loops)
  const applyServerTrip = useCallback((serverData) => {
    if (!serverData) {
      clearLiveTripUiRef.current?.();
      return;
    }

    const getLoc = (ref, keysLat, keysLng) => {
      if (!ref) return null;
      if (ref.location) {
        if (Array.isArray(ref.location.coordinates) && ref.location.coordinates.length >= 2) {
          return {
            lat: ref.location.coordinates[1],
            lng: ref.location.coordinates[0]
          };
        }
        return {
          lat: ref.location.latitude || ref.location.lat,
          lng: ref.location.longitude || ref.location.lng
        };
      }
      for (const k of keysLat) { if (ref[k] != null) return { lat: ref[k], lng: ref[keysLng[keysLat.indexOf(k)]] }; }
      return null;
    };

    const resLoc = (serverData.isMultiRestaurant && Array.isArray(serverData.pickups))
      ? getLoc(serverData.pickups.find(p => !['picked_up', 'cancelled'].includes(p.status)), ['latitude', 'lat'], ['longitude', 'lng'])
      : null;

    const finalResLoc = resLoc ||
      getLoc(serverData.restaurantId, ['latitude', 'lat'], ['longitude', 'lng']) ||
      getLoc(serverData, ['restaurant_lat', 'restaurantLat', 'latitude'], ['restaurant_lng', 'restaurantLng', 'longitude']);

    const cusLoc = getLoc(serverData.deliveryAddress, ['latitude', 'lat'], ['longitude', 'lng']) ||
      getLoc(serverData, ['customer_lat', 'customerLat', 'latitude'], ['customer_lng', 'customerLng', 'longitude']);

    const syncedOrder = {
      ...serverData,
      _id: serverData._id,
      orderId: serverData.orderId || serverData.order_id || serverData._id,
      restaurantLocation: finalResLoc,
      customerLocation: cusLoc
    };

    setActiveOrder(syncedOrder);

    const backendStatus = String(
      serverData.deliveryStatus || serverData.orderState?.status || serverData.orderStatus || serverData.status || ''
    ).toLowerCase();
    const currentPhase = serverData.deliveryState?.currentPhase;
    const { tripStatus: existingTripStatus } = useDeliveryStore.getState();

    let nextTripStatus = null;
    if (['delivered', 'completed'].includes(backendStatus)) {
      nextTripStatus = 'COMPLETED';
    } else if (currentPhase === 'at_drop' || ['reached_drop'].includes(backendStatus)) {
      nextTripStatus = 'REACHED_DROP';
    } else if (['picked_up', 'delivering'].includes(backendStatus)) {
      nextTripStatus = 'PICKED_UP';
    } else if (currentPhase === 'at_pickup' || ['reached_pickup'].includes(backendStatus)) {
      nextTripStatus = 'REACHED_PICKUP';
    } else if (['confirmed', 'preparing', 'ready_for_pickup', 'accepted', 'created'].includes(backendStatus)) {
      nextTripStatus = 'PICKING_UP';
    }

    if (nextTripStatus && nextTripStatus !== existingTripStatus) {
      updateTripStatus(nextTripStatus);
    }
  }, [setActiveOrder, updateTripStatus]);

  useEffect(() => {
    applyServerTripRef.current = applyServerTrip;
  }, [applyServerTrip]);

  // Mount-only initial sync — empty deps prevent callback-identity loops
  useEffect(() => {
    if (hasMountedTripSyncRef.current) return undefined;
    hasMountedTripSyncRef.current = true;
    let cancelled = false;
    const syncWithServer = async () => {
      try {
        const response = await deliveryAPI.getCurrentDelivery();
        if (cancelled) return;
        const trip = extractCurrentTripRef.current?.(response) ?? null;
        applyServerTripRef.current?.(trip);
      } catch (err) {
        console.error('Order Sync Failed:', err);
        if (!cancelled) clearLiveTripUiRef.current?.();
      }
    };
    syncWithServer();
    return () => { cancelled = true; };
  }, []);

  // Slow presence check while a trip is open (clear-only; does not re-apply trip state)
  useEffect(() => {
    const orderKey = activeOrder?._id || activeOrder?.orderId;
    if (!orderKey) return undefined;

    const localIds = new Set(
      [activeOrder._id, activeOrder.orderId, activeOrder.orderMongoId, activeOrder.order_id]
        .filter(Boolean)
        .map((id) => String(id)),
    );

    let cancelled = false;
    const verifyStillActive = async () => {
      try {
        const response = await deliveryAPI.getCurrentDelivery();
        if (cancelled) return;
        const serverData = extractCurrentTripRef.current?.(response) ?? null;
        if (!serverData) {
          clearLiveTripUiRef.current?.('This order is no longer active');
          return;
        }
        const serverIds = [serverData._id, serverData.orderId, serverData.order_id, serverData.orderMongoId]
          .filter(Boolean)
          .map((id) => String(id));
        const stillOurs = serverIds.some((id) => localIds.has(id));
        if (!stillOurs) {
          clearLiveTripUiRef.current?.('This order is no longer assigned to you');
        }
      } catch {
        // Ignore transient network errors
      }
    };

    const poller = window.setInterval(verifyStillActive, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(poller);
    };
  }, [activeOrder?._id, activeOrder?.orderId]);

  // Re-check only when the app tab becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!activeOrderIdRef.current) return;
      deliveryAPI.getCurrentDelivery()
        .then((response) => {
          const serverData = extractCurrentTripRef.current?.(response) ?? null;
          if (!serverData) clearLiveTripUiRef.current?.('This order is no longer active');
        })
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // 1.5 Professional Unified ETA Calculation Hook
  useEffect(() => {
    // If we have distance, calculate ETA. Fallback to 8m/s (28km/h) avg if GPS speed is unknown.
    if (distanceToTarget != null && distanceToTarget !== Infinity) {
      const avgSpeed = rollingSpeedRef.current.length > 0 
        ? rollingSpeedRef.current.reduce((a, b) => a + b, 0) / rollingSpeedRef.current.length 
        : 8;
      
      setEta(calculateETA(distanceToTarget, avgSpeed));
    } else {
      setEta(null);
    }
  }, [distanceToTarget]);

  // 2. Online/Offline Status Sync (Low Frequency)
  useEffect(() => {
    deliveryAPI.updateOnlineStatus(isOnline).catch(() => {});
  }, [isOnline]);

  // 3. Location logic (Smart Frequency Tracking)
  useEffect(() => {
    if (!isOnline) {
      return;
    }
    
    const watchId = navigator.geolocation.watchPosition((pos) => {
      // CRITICAL: In Simulation Mode, we disable actual GPS to prevent overwriting our test position
      if (isSimMode) return;
      
      const { latitude: lat, longitude: lng, heading, speed } = pos.coords;
      const now = Date.now();
      
      const currentRiderPos = { lat, lng, heading: heading || 0 };
      setRiderLocation(currentRiderPos);
      
      // Calculate Rolling Average Speed for Smart ETA
      if (speed && speed > 0) {
        rollingSpeedRef.current = [...rollingSpeedRef.current.slice(-4), speed]; // keep last 5 points
      }

      const avgSpeed = rollingSpeedRef.current.length > 0 
        ? rollingSpeedRef.current.reduce((a, b) => a + b, 0) / rollingSpeedRef.current.length 
        : speed || 0;

      // Phase 11: Geo-fencing Auto-arrival (within 100m) - Disabled in DEV so UI steps can be tested manually
      if (!isSimMode && !import.meta.env.DEV && distanceToTarget && distanceToTarget <= 100 && !lastAutoArrivalRef.current[tripStatus]) {
        if (tripStatus === 'PICKING_UP') {
          lastAutoArrivalRef.current[tripStatus] = true;
          reachPickup().catch(() => { lastAutoArrivalRef.current[tripStatus] = false; });
        } else if (tripStatus === 'PICKED_UP') {
          lastAutoArrivalRef.current[tripStatus] = true;
          reachDrop().catch(() => { lastAutoArrivalRef.current[tripStatus] = false; });
        }
      }

      if (distanceToTarget > 200) {
        lastAutoArrivalRef.current[tripStatus] = false;
      }

      // Check threshold for Sync (distance-based or 7s time-based)
      const distMoved = lastCoordRef.current 
        ? getHaversineDistance(lat, lng, lastCoordRef.current.lat, lastCoordRef.current.lng) 
        : 1000;

      if (distMoved >= 25 || (now - lastLocationSentAt.current >= 7000)) {
        lastLocationSentAt.current = now;
        lastCoordRef.current = { lat, lng };
        
        const payload = { 
          lat, 
          lng, 
          heading: heading || 0,
          speed: speed || 0,
          accuracy: pos.coords.accuracy,
          orderId: activeOrder?.orderId || activeOrder?._id,
          status: 'on_the_way',
          polyline: activePolyline
        };

        deliveryAPI.updateLocation(lat, lng, true, { 
          heading: heading || 0,
          speed: speed || 0,
          accuracy: pos.coords.accuracy 
        }).catch(() => {});

        if (payload.orderId) emitLocation(payload);

        if (payload.orderId) {
          writeOrderTracking(payload.orderId, {
            lat,
            lng,
            heading: heading || 0,
            polyline: activePolyline,
            status: tripStatus,
            eta: eta
          }).catch(() => {});
        }
      }
    }, () => {
      // IF GPS FAILS/DENIED: Use Indore as a fallback for testing
      console.warn('GPS Denied - Falling back to Indore for testing');
      const fallbackPos = { lat: 22.7196, lng: 75.8577, heading: 0 };
      if (!riderLocation) {
        setRiderLocation(fallbackPos);
      }
      toast.error('GPS Blocked!', { description: 'Showing test location in Indore.' });
    }, { 
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 10000
    });
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, setRiderLocation, isSimMode]);

  // 3.5. Background Ping / Heartbeat
  // If watchPosition stops firing (e.g. app in background or device stationary),
  // this ensures we ping the backend periodically. This keeps the token fresh (via 401 interceptor)
  // and keeps the Delivery Partner "online" in the backend.
  useEffect(() => {
    if (!isOnline) return;
    
    const pingInterval = setInterval(() => {
      const now = Date.now();
      // If no natural GPS update happened in the last 15 seconds, force a ping
      if (now - lastLocationSentAt.current >= 15000 && lastCoordRef.current) {
        lastLocationSentAt.current = now;
        deliveryAPI.updateLocation(
          lastCoordRef.current.lat, 
          lastCoordRef.current.lng, 
          true, 
          { heading: 0, speed: 0, accuracy: null }
        ).catch(() => {});
      }
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(pingInterval);
  }, [isOnline]);

  useEffect(() => { if (newOrder) setIncomingOrder(newOrder); }, [newOrder]);

  useEffect(() => {
    if (activeOrder && incomingOrder) {
      setIncomingOrder(null);
    }
  }, [activeOrder, incomingOrder]);

  // When another delivery partner claims the incoming order (via socket 'order_claimed'),
  // dismiss the NewOrderModal and inform this delivery boy.
  useEffect(() => {
    if (!claimedOrderId) return;
    const incomingId = incomingOrder?.orderId || incomingOrder?._id || incomingOrder?.orderMongoId;
    if (incomingId && String(incomingId) === String(claimedOrderId)) {
      toast.info('Order was taken by another delivery partner.', { duration: 4000 });
      setIncomingOrder(null);
      clearNewOrder();
    }
    clearClaimedOrderId();
  }, [claimedOrderId]);

  // Handle Shared Orders (splitting orders)
  useEffect(() => {
    if (sharedOrder && !activeOrder) {
      setIncomingOrder(sharedOrder);
    }
  }, [sharedOrder, activeOrder]);

  useEffect(() => {
    if (!isOnline) return;
    if (currentTab !== 'feed') return;
    if (activeOrder) return;

    let cancelled = false;

    const hydrateAvailableOrder = async () => {
      try {
        const currentResponse = await deliveryAPI.getCurrentDelivery();
        if (cancelled) return;

        const data = currentResponse?.data?.data;
        const currentPayload =
          data?.activeOrder && (data.activeOrder._id || data.activeOrder.orderId || data.activeOrder.order_id)
            ? data.activeOrder
            : null;

        if (currentPayload) {
          applyServerTripRef.current?.(currentPayload);
          return;
        }

        const availableResponse = await deliveryAPI.getOrders({ limit: 20, page: 1 });
        const availablePayload =
          availableResponse?.data?.data ||
          availableResponse?.data ||
          {};
        const availableOrders = Array.isArray(availablePayload?.docs)
          ? availablePayload.docs
          : Array.isArray(availablePayload?.items)
            ? availablePayload.items
            : Array.isArray(availablePayload)
              ? availablePayload
              : [];

        const nextCashLimitNotice =
          availablePayload?.cashLimit?.blocked ? availablePayload.cashLimit : null;
        if (!cancelled) setCashLimitNotice(nextCashLimitNotice);

        const nextIncomingOrder = availableOrders.find((order) => {
          const dispatchStatus = String(order?.dispatch?.status || '').toLowerCase();
          const orderStatus = String(order?.orderStatus || order?.status || '').toLowerCase();
          return (
            ['unassigned', 'assigned'].includes(dispatchStatus) &&
            ['confirmed', 'preparing', 'ready_for_pickup'].includes(orderStatus)
          );
        });

        if (!cancelled && nextIncomingOrder) {
          setCashLimitNotice(null);
          setIncomingOrder((prev) => {
            const prevId = prev?.orderId || prev?._id || prev?.orderMongoId;
            const nextId =
              nextIncomingOrder?.orderId ||
              nextIncomingOrder?._id ||
              nextIncomingOrder?.orderMongoId;
            return prevId === nextId && prev ? prev : nextIncomingOrder;
          });
        }
      } catch (error) {
        console.warn('[DeliveryHomeV2] Available order fallback sync failed:', error?.message || error);
      }
    };

    void hydrateAvailableOrder();
    const poller = window.setInterval(() => {
      if (!document.hidden) {
        void hydrateAvailableOrder();
      }
    }, isSocketConnected ? 12000 : 8000);

    if (socket) {
      socket.on('order_earnings_split', (data) => {
        const { totalEarnings, primaryShare, sharedShare, deliveryPartnerId: pId, sharedPartnerId: sId } = data;
        const isPrimary = (profile?._id || profile?.id) === (pId?._id || pId);
        const myShare = isPrimary ? primaryShare : sharedShare;
        
        toast.success(`Order Split! Total: ₹${totalEarnings}`, {
          description: `Your share of ₹${myShare} has been added to your wallet.`,
          duration: 8000,
        });
      });
    }

    return () => {
      cancelled = true;
      window.clearInterval(poller);
      if (socket) socket.off('order_earnings_split');
    };
  }, [activeOrder?._id, activeOrder?.orderId, currentTab, isOnline, isSocketConnected, socket]);

  useEffect(() => {
    if (orderStatusUpdate) {
      const updateStatus = String(
        orderStatusUpdate.orderStatus || orderStatusUpdate.status || '',
      ).toLowerCase();
      const updateIds = [
        orderStatusUpdate.orderId,
        orderStatusUpdate.orderMongoId,
        orderStatusUpdate._id,
        orderStatusUpdate.order_id,
      ]
        .filter(Boolean)
        .map((id) => String(id));

      const { activeOrder: currentActive } = useDeliveryStore.getState();
      const matchesActiveOrder = Boolean(
        currentActive &&
          [
            currentActive._id,
            currentActive.orderId,
            currentActive.orderMongoId,
            currentActive.order_id,
          ]
            .filter(Boolean)
            .map((id) => String(id))
            .some((id) => updateIds.includes(id)),
      );

      const isCancelledUpdate =
        updateStatus === 'cancelled' ||
        updateStatus.startsWith('cancelled_') ||
        updateStatus === 'deleted' ||
        String(orderStatusUpdate.failureReason || '').toLowerCase().includes('cancel') ||
        String(orderStatusUpdate.cancelledBy || '').toLowerCase() === 'admin';

      if (isCancelledUpdate && currentActive && (matchesActiveOrder || updateIds.length === 0)) {
        clearLiveTripUi(orderStatusUpdate.message || 'Order cancelled');
        clearOrderStatusUpdate();
        return;
      }

      const isPartialRestaurantDrop =
        String(orderStatusUpdate.failureReason || '').toLowerCase() ===
          'restaurant_partially_dropped' ||
        String(orderStatusUpdate.type || '').toLowerCase() ===
          'order_partial_restaurant_dropped';

      if (isPartialRestaurantDrop && matchesActiveOrder && currentActive) {
        toast.warning(
          orderStatusUpdate.message ||
            'A restaurant was removed. Continue with remaining pickups.',
        );
        deliveryAPI
          .getCurrentDelivery()
          .then((response) => {
            const trip = extractCurrentTripRef.current?.(response) ?? null;
            if (trip) {
              applyServerTripRef.current?.(trip);
              return;
            }
            const latest = useDeliveryStore.getState().activeOrder;
            if (!latest) return;
            setActiveOrder({
              ...latest,
              orderStatus: orderStatusUpdate.orderStatus || latest.orderStatus,
              status: orderStatusUpdate.status || latest.status,
              pickups: orderStatusUpdate.pickups || latest.pickups,
              pricing: orderStatusUpdate.pricing || latest.pricing,
              items: orderStatusUpdate.items || latest.items,
            });
          })
          .catch(() => {
            const latest = useDeliveryStore.getState().activeOrder;
            if (!latest) return;
            setActiveOrder({
              ...latest,
              orderStatus: orderStatusUpdate.orderStatus || latest.orderStatus,
              pickups: orderStatusUpdate.pickups || latest.pickups,
              pricing: orderStatusUpdate.pricing || latest.pricing,
            });
          });
        clearOrderStatusUpdate();
        return;
      }

      // Live status / pickup updates: refetch full trip so pickups + dispatch stay fresh
      if (matchesActiveOrder) {
        deliveryAPI.getCurrentDelivery()
          .then((response) => {
            const trip = extractCurrentTripRef.current?.(response) ?? null;
            if (trip) {
              applyServerTripRef.current?.(trip);
              return;
            }
            // Fallback soft-merge if current endpoint briefly returns null
            const latest = useDeliveryStore.getState().activeOrder;
            if (!latest) return;
            setActiveOrder({
              ...latest,
              orderStatus: orderStatusUpdate.orderStatus || latest.orderStatus,
              status: orderStatusUpdate.status || latest.status,
              dispatch: orderStatusUpdate.dispatch
                ? { ...(latest.dispatch || {}), ...orderStatusUpdate.dispatch }
                : latest.dispatch,
              pickups: orderStatusUpdate.pickups || latest.pickups,
              deliveryState: orderStatusUpdate.deliveryState || latest.deliveryState,
              restaurantRejectionCount:
                orderStatusUpdate.restaurantRejectionCount ?? latest.restaurantRejectionCount,
            });
          })
          .catch(() => {
            const latest = useDeliveryStore.getState().activeOrder;
            if (!latest) return;
            setActiveOrder({
              ...latest,
              orderStatus: orderStatusUpdate.orderStatus || latest.orderStatus,
              pickups: orderStatusUpdate.pickups || latest.pickups,
              dispatch: orderStatusUpdate.dispatch
                ? { ...(latest.dispatch || {}), ...orderStatusUpdate.dispatch }
                : latest.dispatch,
            });
          });
      }

      clearOrderStatusUpdate();
    }
  }, [orderStatusUpdate, clearOrderStatusUpdate, setActiveOrder, clearLiveTripUi]);

  // Handle Real-time Admin Notifications
  useEffect(() => {
    if (adminNotification) {
      toast.info(adminNotification.title || "New Notification", {
        description: adminNotification.message || adminNotification.body || "",
        duration: 8000,
        action: {
          label: "View",
          onClick: () => setShowNotifications(true)
        }
      });
      clearAdminNotification();
    }
  }, [adminNotification, clearAdminNotification]);


  const handleCenterMap = () => {
    if (mapRef.current && useDeliveryStore.getState().riderLocation) {
      const loc = useDeliveryStore.getState().riderLocation;
      mapRef.current.panTo({ 
        lat: parseFloat(loc.lat || loc.latitude), 
        lng: parseFloat(loc.lng || loc.longitude) 
      });
    }
  };

  const handleMapClick = (lat, lng) => {
    if (activeOrder || incomingOrder || showVerification) {
  }
  };

  return (
    <div className="delivery-v2-theme relative h-screen w-full text-[#0F172A] overflow-hidden flex flex-col">
      {/* ─── 1. TOP HEADER (Premium Deep Tech) ─── */}
      {currentTab !== 'history' && (
      <div className="absolute top-0 inset-x-0 header-blend shadow-lg z-[200] safe-top pb-1">
        <div className="flex items-center justify-between px-3 py-1.5">
          <div className="flex items-center gap-2">
             <div 
                onClick={() => navigate('/driver/profile')}
                className="w-10 h-10 rounded-full border border-gray-100 p-0.5 shadow-sm overflow-hidden bg-gray-50 cursor-pointer active:scale-95 transition-all"
             >
                <img src={profileImage || "https://ui-avatars.com/api/?name=Driver&background=f3f4f6&color=111827"} alt="Profile" className="w-full h-full object-cover rounded-full" />
             </div>
                <button 
                onClick={async () => {
                  const nextState = !isOnline;
                  toggleOnline(); // Store action
                  if (nextState) {
                     // Try to get location and sync immediately so we are visible for dispatch right away
                     navigator.geolocation.getCurrentPosition((pos) => {
                         deliveryAPI.updateLocation(pos.coords.latitude, pos.coords.longitude, true).catch(() => {});
                     }, (err) => console.warn('Online sync position failed:', err), { enableHighAccuracy: true });
                  } else {
                     deliveryAPI.updateOnlineStatus(false).catch(() => {});
                  }
                }}
                className={`delivery-online-toggle relative w-[80px] h-7 rounded-full p-1 transition-all duration-500 flex items-center ${isOnline ? 'is-online bg-blue-600 shadow-lg shadow-blue-500/20' : 'is-offline bg-gray-200 shadow-sm'}`}
              >
                <div className={`flex items-center justify-between w-full px-1.5 text-[8px] font-black uppercase tracking-widest ${isOnline ? 'text-white' : 'text-gray-500'}`}>
                  <span>{isOnline ? 'Online' : ''}</span>
                  <span>{!isOnline ? 'Offline' : ''}</span>
                </div>
                <div className={`absolute left-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-500 flex items-center justify-center ${isOnline ? 'translate-x-[48px]' : 'translate-x-0'}`}>
                  {isOnline && <div className="w-2 h-2 bg-[#16A34A] rounded-full animate-pulse" />}
                </div>
              </button>

              {/* DEV SIMULATION TOGGLE */}
              {import.meta.env.DEV && (
                 <button 
                   onClick={() => setIsSimMode(!isSimMode)}
                   className={`px-3 h-8 rounded-lg text-[9px] font-black border transition-all ${isSimMode ? 'bg-orange-500 border-orange-400 text-white animate-pulse' : 'bg-gray-100 border-gray-200 text-gray-400'}`}
                 >
                   SIM
                 </button>
              )}
           </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setShowEmergencyPopup(true)} className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-red-500 border border-red-100 active:scale-95 transition-all shadow-sm"><AlertTriangle className="w-4 h-4" /></button>
             <button onClick={() => navigate('/food/delivery/help/id-card')} className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 border border-blue-100 active:scale-95 transition-all shadow-sm"><Contact className="w-4 h-4" /></button>
             <button onClick={() => setShowNotifications(true)} className="relative w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-[#0F172A] border border-gray-100 active:scale-95 transition-all shadow-sm">
                <Bell className="w-4 h-4" />
                {notificationUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-black text-white border-2 border-white shadow-lg animate-in zoom-in duration-300">
                    {notificationUnreadCount > 9 ? '9+' : notificationUnreadCount}
                  </span>
                )}
             </button>
          </div>
        </div>

        {/* ─── LIVE STATUS / PROGRESS BADGE (MATCHED PRO) ─── */}
        <AnimatePresence>
          {currentTab === 'feed' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="px-3 md:px-4 mt-0.5"
            >
              {activeOrder ? (
                <div className="grid grid-cols-2 gap-2 w-full">
                  {/* LEFT: DISTANCE (Vibrant Green Card) */}
                  <div className="bg-[#16A34A] rounded-2xl p-3 shadow-xl shadow-green-600/20 border border-white/20 flex items-center justify-between overflow-hidden relative">
                    <div className="flex flex-col z-10">
                      <span className="text-[8px] text-white/60 font-black uppercase tracking-[0.15em] mb-0.5">Distance</span>
                      <div className="flex items-end gap-1">
                        <span className="text-xl font-black text-white leading-none tracking-tighter">
                          {distanceToTarget && distanceToTarget !== Infinity ? (distanceToTarget / 1000).toFixed(1) : '--'}
                        </span>
                        <span className="text-[10px] text-white/60 font-black mb-0.5 uppercase tracking-widest">KM</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 bg-[#0F172A] rounded-lg flex items-center justify-center z-10 shadow-lg">
                      <Navigation2 className="w-4 h-4 text-[#16A34A] rotate-45" />
                    </div>
                  </div>

                  {/* RIGHT: TIME (Clean Surface Card) */}
                  <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center justify-between overflow-hidden relative">
                    <div className="flex flex-col z-10">
                      <span className="text-[8px] text-gray-400 font-black uppercase tracking-[0.15em] mb-0.5">Arrival</span>
                      <div className="flex items-end gap-1">
                        <span className="text-xl font-black text-[#0F172A] leading-none tracking-tighter">
                          {durationToTarget && durationToTarget !== Infinity ? Math.round(durationToTarget / 60) : '--'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-black mb-0.5 uppercase tracking-widest">MIN</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 bg-[#16A34A] rounded-lg flex items-center justify-center z-10 shadow-lg">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              ) : isOnline ? (
                <div className="bg-white rounded-2xl p-3 flex items-center border border-white/20 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#16A34A]/10 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[#0F172A] font-black text-[10px] uppercase tracking-widest leading-none mb-1">System Online</h3>
                      <p className="text-gray-500 text-[9px] font-bold uppercase tracking-tight truncate">
                        {riderAddress || 'Waiting for order requests'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!activeOrder && cashLimitNotice?.blocked && (
                <div className="mt-2 rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-200">
                    Cash Limit Alert
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-amber-100">
                    {cashLimitNotice?.message || 'Please deposit your amount to get orders.'}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* ─── 2. MAIN CONTENT ─── */}
      <div className={`flex-1 relative overflow-y-auto ${currentTab === 'history' ? 'pt-0' : (currentTab === 'feed' ? 'pt-[105px]' : 'pt-[56px]')} no-scrollbar`}>
         {currentTab === 'feed' ? (
           <div className="absolute inset-0 top-[-105px] bg-white">
             {isOnline && (
               <div className="absolute inset-0">
                 <LiveMap 
                   onMapLoad={(m) => mapRef.current = m}
                   onMapClick={handleMapClick}
                   onPathReceived={setSimPath}
                   onPolylineReceived={(poly) => {
                     setActivePolyline(poly);
                     const orderId = activeOrder?.orderId || activeOrder?._id;
                     if (orderId && poly) {
                       writeOrderTracking(orderId, { polyline: poly, status: tripStatus, eta: eta }).catch(() => {});
                     }
                   }}
                   zoom={zoom}
                 />
               </div>
             )}

             {!isOnline && (
               <div className="absolute inset-0 z-0 overflow-hidden bg-[#F8FAFC] pointer-events-none">
                 {/* Fake CSS Map Pattern for Offline State (Saves API Quota) */}
                 <div className="absolute w-[200%] h-[200%] -top-[50%] -left-[50%] rotate-[15deg] opacity-[0.35]" style={{ backgroundImage: 'linear-gradient(#94A3B8 2px, transparent 2px), linear-gradient(90deg, #94A3B8 2px, transparent 2px)', backgroundSize: '80px 80px' }} />
                 <div className="absolute w-[200%] h-[200%] -top-[50%] -left-[50%] -rotate-[20deg] opacity-[0.25]" style={{ backgroundImage: 'linear-gradient(#64748B 3px, transparent 3px)', backgroundSize: '200px 200px' }} />
                 <div className="absolute w-[200%] h-[200%] -top-[50%] -left-[50%] rotate-[45deg] opacity-[0.2]" style={{ backgroundImage: 'linear-gradient(#94A3B8 1px, transparent 1px), linear-gradient(90deg, #94A3B8 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                 <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-white opacity-30 pointer-events-none" />
               </div>
             )}

             {isOnline ? (
               <>
                 {/* SIMULATION INDICATOR */}
                 {isSimMode && (
                   <div className="absolute top-[160px] left-4 right-4 z-[100] bg-black/80 backdrop-blur-md rounded-xl p-3 border border-white/20 flex items-center justify-between shadow-2xl">
                      <div className="flex items-center gap-3">
                         <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center animate-pulse">
                            <Play className="w-3 h-3 text-white fill-current" />
                         </div>
                         <div className="flex flex-col">
                            <span className="text-orange-500 text-[9px] font-bold uppercase tracking-widest">Auto Navigation Active</span>
                            <span className="text-white text-[10px] font-medium">Following actual road path...</span>
                         </div>
                      </div>
                      <button onClick={() => setIsSimMode(false)} className="bg-white/10 text-white/50 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-white/10">Stop</button>
                   </div>
                 )}

                 <div className="absolute right-3 bottom-24 md:bottom-28 flex flex-col gap-3 z-[120]">
                    <div className="flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                       <button onClick={() => setZoom(z => Math.min(22, z + 1))} className="p-2.5 hover:bg-gray-50 border-b border-gray-100 text-gray-900 active:scale-90 transition-all" aria-label="Zoom in"><Plus className="w-5 h-5 stroke-[2.75]" /></button>
                       <button onClick={() => setZoom(z => Math.max(8, z - 1))} className="p-2.5 hover:bg-gray-50 text-gray-900 active:scale-90 transition-all" aria-label="Zoom out"><Minus className="w-5 h-5 stroke-[2.75]" /></button>
                    </div>
                    <button 
                      onClick={() => {
                        if (activeOrder?.orderStatus === 'created') {
                          toast.info('Wait for restaurant to accept order before moving.');
                          return;
                        }
                        const nextSimState = !isSimMode;
                        setIsSimMode(nextSimState);

                        if (nextSimState) {
                          toast.warning('Simulation Mode Active');

                          const parsePoint = (raw) => {
                            if (!raw) return null;
                            const lat = Number(raw.lat ?? raw.latitude);
                            const lng = Number(raw.lng ?? raw.longitude);
                            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                            return { lat, lng };
                          };

                          const target =
                            tripStatus === 'PICKED_UP' || tripStatus === 'REACHED_DROP'
                              ? parsePoint(activeOrder?.customerLocation)
                              : parsePoint(activeOrder?.restaurantLocation);

                          const currentRider = useDeliveryStore.getState().riderLocation;
                          const riderPoint = parsePoint(currentRider) || (target
                            ? { lat: target.lat + 0.001, lng: target.lng + 0.001 }
                            : null);

                          if (riderPoint) {
                            setRiderLocation({ lat: riderPoint.lat, lng: riderPoint.lng, heading: 0 });
                          }

                          if (riderPoint && target && (!simPath || simPath.length < 2)) {
                            const steps = 60;
                            const fallbackPath = Array.from({ length: steps + 1 }, (_, i) => {
                              const t = i / steps;
                              return {
                                lat: riderPoint.lat + (target.lat - riderPoint.lat) * t,
                                lng: riderPoint.lng + (target.lng - riderPoint.lng) * t,
                              };
                            });
                            setSimPath(fallbackPath);
                          }
                        }
                      }}
                      className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center border border-gray-100 transition-all ${isSimMode ? 'bg-orange-500 text-white' : 'bg-white text-[#16A34A]'}`}
                    >
                      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${isSimMode ? 'border-white' : 'border-[#16A34A]'}`}>
                        <Play className={`w-3 h-3 fill-current ml-0.5 ${isSimMode ? 'animate-pulse' : ''}`} />
                      </div>
                    </button>
                    <button 
                       onClick={() => {
                         if (activeOrder?.orderStatus === 'created') {
                           toast.info('Wait for restaurant to accept order before navigating.');
                           return;
                         }
                         mapRef.current?.setOptions({ gestureHandling: 'greedy' });
                       }} 
                       className="w-12 h-12 bg-white rounded-full shadow-2xl flex items-center justify-center text-blue-600 border border-gray-100 active:scale-90 transition-all"
                    >
                      <div className="w-7 h-7 rounded-full border-2 border-blue-600 flex items-center justify-center"><Navigation2 className="w-3 h-3" /></div>
                    </button>
                    <button 
                      onClick={handleCenterMap}
                      className="w-12 h-12 bg-white rounded-full shadow-2xl flex items-center justify-center text-gray-900 border border-gray-100 group active:scale-90 transition-all"
                    >
                      <Target className="w-6 h-6" />
                    </button>
                 </div>
               </>
             ) : (
               <div className="absolute inset-0 z-[150] bg-white/20 flex flex-col items-center justify-center pt-24 pb-4 px-6 text-center">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="w-60 h-60 mb-8 rounded-[1.5rem] bg-white p-1 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.15)] border-2 border-white overflow-hidden relative"
                  >
                     <div className="w-full h-full rounded-[1.25rem] overflow-hidden bg-[#F1F5F9]">
                       <img 
                         src="/delivery_boy_welcome.png" 
                         alt="Welcome" 
                         className="w-full h-full object-cover scale-105" 
                       />
                     </div>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h2 className="text-[22px] font-black text-[#111827] mb-2 tracking-tight">WELCOME, PARTNER!</h2>
                    <p className="text-[#475569] text-[13px] font-medium max-w-[260px] leading-relaxed mx-auto">
                      Go Online to Accept Local Orders and Maximise Your Earnings.
                    </p>
                  </motion.div>
                  
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    onClick={() => {
                      toggleOnline();
                      navigator.geolocation.getCurrentPosition((pos) => {
                         deliveryAPI.updateLocation(pos.coords.latitude, pos.coords.longitude, true).catch(() => {});
                      }, (err) => console.warn('Online sync position failed:', err), { enableHighAccuracy: true });
                    }}
                    className="mt-7 px-10 py-3.5 bg-gradient-to-b from-[#16A34A] to-[#0F766E] hover:from-[#15803D] hover:to-[#0F766E] text-white rounded-full font-bold text-[13px] uppercase tracking-wide shadow-[0_8px_20px_-6px_rgba(22,163,74,0.6)] active:scale-95 transition-all"
                  >
                    GO ONLINE NOW
                  </motion.button>

                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-8 text-[11px] text-[#475569] max-w-[260px] leading-relaxed"
                  >
                     <span className="font-bold text-[#111827]">QUICK TIP:</span> Complete 5 more orders to unlock the ₹100 evening bonus!
                  </motion.p>
               </div>
             )}
           </div>
         ) : currentTab === 'pocket' ? (
           <PocketV2 />
         ) : currentTab === 'history' ? (
           <HistoryV2 />
         ) : (
           <ProfileV2 />
         )}

         {/* OVERLAYS (Persistent if active) */}
      </div>

      {/* OVERLAYS (Persistent if active) - Outside flex container to avoid clipping and z-index issues */}
      {(currentTab === 'feed' || activeOrder) && (
        <AnimatePresence>
          {!isModalMinimized && (
            <motion.div
              key="modal-container"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 top-0 bottom-[80px] z-[1000] pointer-events-none flex items-end"
            >
              <div className="w-full pointer-events-auto relative">
                {incomingOrder && (
                  <NewOrderModal 
                    order={incomingOrder} 
                    riderProfile={riderProfile}
                    isSharedAcceptance={Boolean(sharedOrder)}
                    onAccept={async (o) => {
                      try {
                        // Use the robust hook which handles both shared and standard orders
                        await acceptOrder(o);
                        
                        // Successfully accepted/joined
                        const isShared = o.isShared || o.dispatch?.isShared;
                        toast.success(isShared ? 'Joined Delivery Slot!' : 'Order Accepted!');
                        
                        setIncomingOrder(null);
                        clearNewOrder();
                        clearSharedOrder();
                      } catch (err) {
                        console.error('Acceptance failed in UI:', err);
                        const msg = String(err?.response?.data?.message || err?.response?.data?.error || err?.message || '');
                        const isTaken = msg.toLowerCase().includes('already accepted') || 
                                        msg.toLowerCase().includes('another partner') ||
                                        msg.toLowerCase().includes('no longer available') ||
                                        (err?.response?.status === 403) || (err?.response?.status === 404);
                                        
                        if (isTaken) {
                          setIncomingOrder(null);
                          clearNewOrder();
                          clearSharedOrder();
                        }
                        // Note: useOrderManager already shows the error toast
                      }
                    }}
                    onReject={() => { 
                      setIncomingOrder(null); 
                      clearNewOrder(); 
                      clearSharedOrder();
                    }}
                    onMinimize={() => setIsModalMinimized(true)}
                  />
                )}
                {activeOrder && (tripStatus === 'PICKING_UP' || tripStatus === 'REACHED_PICKUP') && (
                  <PickupActionModal 
                    order={activeOrder} 
                    status={tripStatus} 
                    isWithinRange={isWithinRange} 
                    distanceToTarget={distanceToTarget}
                    eta={eta}
                    onReachedPickup={reachPickup} 
                    onPickedUp={(billImageUrl) => pickUpOrder(billImageUrl)} 
                    onMinimize={() => setIsModalMinimized(true)}
                  />
                )}
                {activeOrder && (tripStatus === 'PICKED_UP' || tripStatus === 'REACHED_DROP') && (
                  <div className="absolute inset-x-0 z-[120] px-4" style={{ bottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
                    {tripStatus === 'PICKED_UP' ? (
                      <div className="bg-white rounded-[2rem] p-6 shadow-[0_-20px_80px_rgba(0,0,0,0.4)] border border-gray-100 flex flex-col items-center">
                        {/* Handle / Minimize */}
                        <div className="w-full flex justify-center pb-2 pt-0 -mt-2">
                          <button onClick={() => setIsModalMinimized(true)} className="p-1 hover:bg-gray-100 active:scale-95 transition-all rounded-full flex flex-col items-center">
                             <ChevronDown className="w-5 h-5 text-gray-400 stroke-[3]" />
                          </button>
                        </div>
                        <div className="flex justify-between w-full items-center mb-6 px-1 text-left">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                               <img 
                                 src={activeOrder?.user?.logo || activeOrder?.user?.profileImage || 'https://cdn-icons-png.flaticon.com/512/1275/1275302.png'} 
                                 className="w-full h-full object-cover" 
                                 alt="User"
                               />
                            </div>
                            <div>
                               <h3 className="text-[#1A2517] text-lg font-black uppercase">Handover Drop</h3>
                               <p className={`text-[9px] font-black uppercase tracking-[0.2em] mt-0.5 ${isWithinRange ? 'text-[#ACC8A2]' : 'text-orange-500'}`}>
                                 {isWithinRange ? 'Ready - Swipe to Arrive √' : `${(distanceToTarget / 1000).toFixed(1)} km • ${eta || '--'} min Arrival`}
                               </p>
                            </div>
                          </div>
                        </div>

                        {/* Customer Instructions Panel */}
                        {activeOrder?.note && (
                          <div className="w-full bg-[#ACC8A2]/10 border border-[#ACC8A2]/20 rounded-2xl p-4 mb-6 flex gap-3 items-start shadow-sm mx-1">
                             <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-[#ACC8A2] shadow-sm shrink-0 border border-[#ACC8A2]/10">
                                <Package className="w-4 h-4" />
                             </div>
                             <div className="flex-1">
                                <p className="text-[9px] font-black text-[#1A2517] uppercase tracking-[0.2em] mb-1 opacity-80">Drop Message</p>
                                <p className="text-xs font-bold text-[#1A2517] leading-relaxed capitalize">"{activeOrder.note}"</p>
                             </div>
                          </div>
                        )}
                        <ActionSlider label="Slide to Arrive" successLabel="Arrived ✓" disabled={!isWithinRange} onConfirm={reachDrop} color="bg-[#ACC8A2]" />
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowVerification(true)} 
                        className="w-full text-[#ACC8A2] rounded-2xl py-4 px-4 font-black text-xs tracking-[0.2em] transform transition-all active:scale-95 flex items-center justify-center gap-2.5 border border-white/10"
                        style={{
                          background: '#1A2517',
                          boxShadow: '0 14px 34px rgba(26, 37, 23, 0.3)',
                        }}
                      >
                        <CheckCircle2 className="w-5 h-5" /> VERIFY & COMPLETE
                      </button>
                    )}
                  </div>
                )}
                {showVerification && activeOrder && tripStatus !== 'COMPLETED' && (
                  <DeliveryVerificationModal 
                    order={activeOrder} 
                    onComplete={async (otp, paymentOverride) => {
                      const res = await completeDelivery(otp, paymentOverride);
                      setShowVerification(false);
                      return res;
                    }}
                    onClose={() => setShowVerification(false)}
                  />
                )}
                {tripStatus === 'COMPLETED' && activeOrder && <OrderSummaryModal order={activeOrder} onDone={resetTrip} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ─── MODALS RESTORED FROM OLD UI ─── */}
      <BottomPopup isOpen={showEmergencyPopup} title="Emergency Help" onClose={() => setShowEmergencyPopup(false)}>
         <div className="grid gap-3 py-2">
           {emergencyOptions.map((opt, i) => (
             <button 
               key={i} 
               onClick={() => {
                 const num = opt.phone?.replace(/\D/g, '');
                 if (num) window.location.href = `tel:${num}`;
                 else toast.error('Number not configured');
               }}
               className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 active:scale-95 transition-all text-left"
             >
               <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-lg">{opt.icon}</div>
               <div>
                 <h4 className="text-sm font-bold text-gray-900">{opt.title}</h4>
                 <p className="text-[10px] text-gray-500 font-medium">{opt.subtitle}</p>
               </div>
             </button>
           ))}
         </div>
      </BottomPopup>

      <BottomPopup 
        isOpen={showNotifications} 
        title="Notifications" 
        onClose={() => {
           setShowNotifications(false);
        }}
      >
         <div className="flex flex-col gap-3 -mt-2 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
            {broadcastItems && broadcastItems.length > 0 ? (
               <>
                  <div className="flex justify-end mb-1">
                     <button 
                        onClick={() => {
                           dismissAllBroadcast();
                           toast.success("All notifications cleared");
                        }}
                        className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-50 px-3 py-1 rounded-full"
                     >
                        Clear All
                     </button>
                  </div>
                  <div className="grid gap-2">
                     {broadcastItems.map((item) => (
                        <div 
                           key={item.id} 
                           onClick={() => {
                              markBroadcastAsRead(item.id);
                              if (item.link) {
                                 const path = item.link.startsWith('/') ? item.link : `/${item.link}`;
                                 navigate(path);
                                 setShowNotifications(false);
                              }
                           }}
                           className={`p-3 rounded-2xl border transition-all active:scale-[0.98] cursor-pointer ${item.read ? 'bg-gray-50 border-gray-100' : 'bg-orange-50 border-orange-100 shadow-sm shadow-orange-500/5'}`}
                        >
                           <div className="flex gap-3 items-start">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.read ? 'bg-gray-200 text-gray-500' : 'bg-[#EB590E] text-white shadow-lg'}`}>
                                 <Bell className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                 <div className="flex justify-between items-start gap-2">
                                    <h4 className={`text-xs font-bold truncate ${item.read ? 'text-gray-600' : 'text-gray-950'}`}>
                                       {item.title}
                                    </h4>
                                    <span className="text-[8px] font-black uppercase text-gray-400 shrink-0 whitespace-nowrap pt-0.5">
                                       {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                 </div>
                                 <p className={`text-[11px] leading-relaxed mt-0.5 break-words ${item.read ? 'text-gray-500 line-clamp-2' : 'text-gray-700'}`}>
                                    {item.message}
                                 </p>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               </>
            ) : (
               <div className="py-16 flex flex-col items-center justify-center text-center px-10">
                  <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-gray-100/50">
                     <Bell className="w-6 h-6 text-gray-300" />
                  </div>
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest leading-none mb-1">No Notifications</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight leading-relaxed">System notifications will appear here.</p>
               </div>
            )}
         </div>
         <div className="mt-6 mb-1">
            <button 
               onClick={() => {
                  setShowNotifications(false);
                  navigate('/food/delivery/notifications');
               }}
               className="w-full py-3.5 rounded-2xl bg-[#16A34A] text-[#0F172A] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-green-600/20 active:scale-95 transition-all"
            >
               View Notification History
            </button>
         </div>
      </BottomPopup>

      {/* Floating Minimize/Restore Toggle - Above navbar */}
      {isModalMinimized && (activeOrder || incomingOrder || showVerification) && (
        <motion.div 
           initial={{ y: 100, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           className="fixed bottom-[90px] inset-x-6 z-[300]"
        >
           <button 
             onClick={() => setIsModalMinimized(false)}
             className="w-full bg-white text-[#0F172A] rounded-2xl py-3 flex items-center justify-between px-5 shadow-2xl border border-gray-100"
           >
              <div className="flex flex-col items-start gap-0">
                 <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Order Action Pending</span>
                 <span className="text-[11px] font-bold uppercase tracking-wider">Tap to open delivery panel</span>
              </div>
              <div className="bg-[#16A34A] p-1.5 rounded-lg text-white shadow-lg shadow-green-600/20">
                 <Plus className="w-4 h-4" />
              </div>
           </button>
        </motion.div>
      )}

      {/* ─── 3. BOTTOM NAV (Premium Floating Pill Dock) ─── */}
       <div className="fixed bottom-4 inset-x-6 z-[500] flex justify-center">
        <div className="bg-white/95 rounded-full px-1.5 py-1.5 flex items-center gap-0.5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.2)] border border-gray-100 backdrop-blur-lg">
           {[
             { id: 'feed', label: 'Delivery', icon: LayoutGrid, path: '/food/delivery/feed' },
             { id: 'pocket', label: 'Pocket', icon: Wallet, path: '/food/delivery/pocket' },
             { id: 'history', label: 'History', icon: History, path: '/food/delivery/history' },
             { id: 'profile', label: 'Profile', icon: UserIcon, path: '/food/delivery/profile' },
           ].map((item) => {
             const isActive = currentTab === item.id;
             const Icon = item.icon;
             
             return (
               <button 
                 key={item.id}
                 onClick={() => navigate(item.path)} 
                 className={`relative flex items-center gap-2.5 px-5 py-3 rounded-full transition-all duration-500 overflow-hidden ${isActive ? 'bg-[#16A34A] shadow-sm' : 'bg-transparent'}`}
               >
                 <div className={`transition-all duration-300 ${isActive ? 'text-[#0F172A] scale-110' : 'text-gray-400'}`}>
                   <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
                 </div>
                 {isActive && (
                   <motion.span 
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     className="text-[11px] font-black uppercase tracking-widest text-[#0F172A] whitespace-nowrap"
                   >
                     {item.label}
                   </motion.span>
                 )}
               </button>
             );
           })}
        </div>
      </div>
    </div>
  );
}

