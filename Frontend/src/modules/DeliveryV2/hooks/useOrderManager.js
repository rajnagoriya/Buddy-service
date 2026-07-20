import { useRef } from 'react';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';

/**
 * useOrderManager - Professional hook for real-world trip lifecycle actions.
 * Connects directly to the backend API services.
 */
export const useOrderManager = () => {
  const { 
    activeOrder, tripStatus, updateTripStatus, clearActiveOrder, setActiveOrder, riderLocation 
  } = useDeliveryStore();

  const resolveOrderId = (orderLike = activeOrder) =>
    orderLike?._id || orderLike?.id || orderLike?.orderId || orderLike?.order_id;

  const acceptOrderInFlight = useRef(false);

  const acceptOrder = async (order) => {
    // Client-side guard: prevent duplicate API calls if already processing
    if (acceptOrderInFlight.current) {
      toast.info('Already processing this order...');
      return;
    }
    const orderId = resolveOrderId(order);
    if (!orderId) {
      toast.error('Invalid order data');
      return;
    }

    acceptOrderInFlight.current = true;
    try {
      const isShared = order.isShared || order.dispatch?.isShared;
      const response = isShared 
        ? await deliveryAPI.acceptSharedOrder(orderId)
        : await deliveryAPI.acceptOrder(orderId);
      
      if (response?.data?.success) {
        const fullOrder = response.data.data?.order || order;
        
        // Robustly determine locations from multiple possible formats (Populated API vs Socket)
        // Robustly determine locations from multiple possible formats
        const getLoc = (ref, keysLat, keysLng) => {
          if (!ref) return null;
          if (ref.location) {
            if (Array.isArray(ref.location.coordinates) && ref.location.coordinates.length >= 2) {
              return { lat: ref.location.coordinates[1], lng: ref.location.coordinates[0] };
            }
            return { lat: ref.location.latitude || ref.location.lat, lng: ref.location.longitude || ref.location.lng };
          }
          for (const k of keysLat) { if (ref[k] != null) return { lat: ref[k], lng: ref[keysLng[keysLat.indexOf(k)]] }; }
          return null;
        };

        // For multi-restaurant, find the next pending pickup location
        let resLoc = null;
        if (fullOrder.isMultiRestaurant && Array.isArray(fullOrder.pickups)) {
          const nextPickup = fullOrder.pickups.find(
            (p) =>
              !p.permanentlyDropped &&
              !['picked_up', 'cancelled'].includes(String(p.status || '')),
          );
          if (nextPickup) {
            resLoc = getLoc(nextPickup, ['latitude', 'lat'], ['longitude', 'lng']);
          }
        }

        // Fallback to main restaurantId or top-level keys
        if (!resLoc) {
          resLoc = getLoc(fullOrder.restaurantId, ['latitude', 'lat'], ['longitude', 'lng']) || 
                   getLoc(fullOrder, ['restaurant_lat', 'restaurantLat', 'latitude'], ['restaurant_lng', 'restaurantLng', 'longitude']);
        }
                       
        const cusLoc = getLoc(fullOrder.deliveryAddress, ['latitude', 'lat'], ['longitude', 'lng']) || 
                       getLoc(fullOrder, ['customer_lat', 'customerLat', 'latitude'], ['customer_lng', 'customerLng', 'longitude']);

        setActiveOrder({
          ...fullOrder,
          orderId: orderId,
          restaurantLocation: resLoc,
          customerLocation: cusLoc
        });

        updateTripStatus('PICKING_UP');
        // toast.success('Order Accepted! Opening Map...');
      } else {
        toast.error(response?.data?.message || 'Order already taken or unavailable');
        throw new Error('Accept failed');
      }
    } catch (error) {
      console.error('Accept Order Error:', error);
      const msg = error?.response?.data?.error || error?.response?.data?.message || 'Network error. Please try again.';
      // If the backend says already accepted by another — show friendly message
      if (error?.response?.status === 403 || msg.toLowerCase().includes('already accepted')) {
        toast.error('This order was just taken by another delivery partner.', { duration: 4000 });
      } else {
        toast.error(msg);
      }
      throw error;
    } finally {
      acceptOrderInFlight.current = false;
    }
  };


  /**
   * Mark "Reached Pickup" (Arrival at restaurant)
   */
  const reachPickup = async () => {
    const orderId = resolveOrderId();
    if (!orderId) {
      toast.error('Order id not found. Please refresh current trip.');
      throw new Error('Missing order id');
    }
    try {
      const response = await deliveryAPI.confirmReachedPickup(orderId);
      if (response?.data?.success) {
        const updatedOrder = response.data.data?.order;
        if (updatedOrder) {
          setActiveOrder({
            ...(activeOrder || {}),
            ...updatedOrder,
            restaurantLocation: activeOrder?.restaurantLocation,
            customerLocation: activeOrder?.customerLocation,
          });
        }
        updateTripStatus('REACHED_PICKUP');
      } else {
        throw new Error('Confirm pickup failed');
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || 'Failed to update status');
      throw error;
    }
  };

  /**
   * Mark "Picked Up" (Confirm order ID & start delivery)
   */
  const pickUpOrder = async (billImageUrl) => {
    const orderId = resolveOrderId();
    if (!orderId) {
      toast.error('Order id not found. Please refresh current trip.');
      throw new Error('Missing order id');
    }
    try {
      // confirmOrderId(orderId, confirmedOrderId, location, data)
      const response = await deliveryAPI.confirmOrderId(
        orderId, 
        activeOrder.displayOrderId || orderId, 
        riderLocation || {},
        { billImageUrl }
      );
      
      if (response?.data?.success) {
        const updatedOrder = response.data.data?.order;
        if (updatedOrder) {
          const getLoc = (ref, keysLat, keysLng) => {
            if (!ref) return null;
            if (ref.location) {
              if (Array.isArray(ref.location.coordinates) && ref.location.coordinates.length >= 2) {
                return { lat: ref.location.coordinates[1], lng: ref.location.coordinates[0] };
              }
              return { lat: ref.location.latitude || ref.location.lat, lng: ref.location.longitude || ref.location.lng };
            }
            for (const k of keysLat) { if (ref[k] != null) return { lat: ref[k], lng: ref[keysLng[keysLat.indexOf(k)]] }; }
            return null;
          };

          let nextRestaurantLocation = activeOrder?.restaurantLocation || null;
          if (updatedOrder.isMultiRestaurant && Array.isArray(updatedOrder.pickups)) {
            const nextPickup = updatedOrder.pickups.find(
              (p) => !p.permanentlyDropped && !['picked_up', 'ready_for_handover', 'cancelled'].includes(String(p.status || '')),
            );
            if (nextPickup) {
              nextRestaurantLocation = getLoc(nextPickup, ['latitude', 'lat'], ['longitude', 'lng'])
                || getLoc(nextPickup.location, ['latitude', 'lat'], ['longitude', 'lng'])
                || nextRestaurantLocation;
            }
          }

          // Sync local order state (includes updated pickups array + next stop coords)
          setActiveOrder({
            ...activeOrder,
            ...updatedOrder,
            restaurantLocation: nextRestaurantLocation,
            customerLocation: activeOrder?.customerLocation,
          });

          // If order is still not fully 'picked_up', it means there are more pickups
          const isFullyPicked = updatedOrder.orderStatus === 'picked_up' || updatedOrder.status === 'picked_up';
          
          if (isFullyPicked) {
            updateTripStatus('PICKED_UP');
            toast.success('All items collected! Heading to Drop-off');
          } else {
            // Revert to PICKING_UP to target the NEXT restaurant in the pickups array
            updateTripStatus('PICKING_UP');
            toast.info('Pickup confirmed. Capture bill at the next restaurant.');
          }
        } else {
          updateTripStatus('PICKED_UP');
        }
      } else {
        throw new Error('Confirm order ID failed');
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || 'Error confirming pickup');
      throw error;
    }
  };

  /**
   * Mark "Reached Drop" (Arrival at customer)
   */
  const reachDrop = async () => {
    const orderId = resolveOrderId();
    if (!orderId) {
      toast.error('Order id not found. Please refresh current trip.');
      throw new Error('Missing order id');
    }
    try {
      const response = await deliveryAPI.confirmReachedDrop(orderId);
      if (response?.data?.success) {
        updateTripStatus('REACHED_DROP');
        // toast.info('Arrived at Customer Location');
      } else {
        throw new Error('Confirm drop failed');
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.response?.data?.message || 'Failed to notify arrival');
      throw error;
    }
  };

  /**
   * Finalize Delivery with OTP Check
   */
  const completeDelivery = async (otp, paymentMethodOverride = null) => {
    const orderId = resolveOrderId();
    if (!orderId) {
      toast.error('Order id not found. Please refresh current trip.');
      throw new Error('Missing order id');
    }
    try {
      let finalOrder = activeOrder;
      
      // 1. Verify OTP ONLY if not already verified in the system
      const isAlreadyVerified = activeOrder?.deliveryVerification?.dropOtp?.verified;
      
      if (!isAlreadyVerified) {
        if (!otp) {
          toast.error('Handover code is required');
          throw new Error('Missing OTP');
        }
        const verifyRes = await deliveryAPI.verifyDropOtp(orderId, otp);
        if (verifyRes?.data?.success) {
          finalOrder = verifyRes.data?.data?.order || activeOrder;
        } else {
          toast.error('Invalid OTP. Please check with customer.');
          throw new Error('Invalid OTP');
        }
      }
      
      // 2. Mark as complete
      try {
        const completeRes = await deliveryAPI.completeDelivery(orderId, { 
          otp: otp || 'VERIFIED', // Pass 'VERIFIED' fallback if already verified 
          rating: 5,
          paymentMethod: paymentMethodOverride 
        });
        if (completeRes.data?.success && completeRes.data?.data?.order) {
          finalOrder = completeRes.data.data.order;
        }
      } catch (completeErr) {
        console.warn('Complete call failed, but proceeding since OTP is verified.', completeErr);
      }
      
      if (finalOrder) setActiveOrder(finalOrder);
      updateTripStatus('COMPLETED');
    } catch (error) {
      console.error('Completion Error:', error);
      toast.error(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          'Verification failed',
      );
      throw error;
    }
  };

  const resetTrip = () => {
    clearActiveOrder();
  };

  return {
    acceptOrder,
    reachPickup,
    pickUpOrder,
    reachDrop,
    completeDelivery,
    resetTrip,
  };
};
