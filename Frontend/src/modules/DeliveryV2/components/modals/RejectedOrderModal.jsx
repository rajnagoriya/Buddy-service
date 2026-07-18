import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, RefreshCw, ChevronDown, Package, Clock
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';

/**
 * RejectedOrderModal - Shown to the delivery partner when a restaurant rejects an order.
 * Allows the partner to "Resend" the order up to 3 times (per pickup on multi-restaurant).
 */
export const RejectedOrderModal = ({ 
  order, 
  onResent, 
  onMinimize 
}) => {
  const [isResending, setIsResending] = useState(false);

  if (!order) return null;

  const cancelledPickups = (order.pickups || []).filter(
    (p) =>
      !p.permanentlyDropped &&
      String(p.status || '') === 'cancelled',
  );
  const targetPickup = cancelledPickups[0] || null;
  const isMulti = Boolean(order.isMultiRestaurant) || (order.pickups || []).length > 1;

  const rejectionCount = isMulti && targetPickup
    ? Number(targetPickup.rejectionAttempts) || 0
    : Number(order.restaurantRejectionCount) || 0;

  const restaurantName =
    targetPickup?.restaurantName ||
    order.restaurantName ||
    order.restaurantId?.restaurantName ||
    'Restaurant';

  const canResend = rejectionCount < 3 && !targetPickup?.permanentlyDropped;

  const handleResend = async () => {
    if (!canResend) {
      toast.error('Maximum resend attempts reached for this restaurant');
      return;
    }
    setIsResending(true);
    try {
      const orderId = order.orderId || order._id;
      const restaurantId = targetPickup?.restaurantId
        ? String(targetPickup.restaurantId)
        : undefined;
      const res = await deliveryAPI.resendOrderToRestaurant(orderId, restaurantId);
      if (res?.data?.success) {
        toast.success('Order resent to restaurant successfully');
        if (onResent) onResent(res.data.data.order || res.data.data);
      } else {
        throw new Error(res?.data?.message || 'Failed to resend order');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to resend order');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[400] px-4 pointer-events-none pb-8">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="w-full max-w-md mx-auto bg-white rounded-[2.5rem] shadow-[0_-20px_80px_rgba(239,68,68,0.25)] p-6 sm:p-8 pointer-events-auto border border-red-50 border-t-4 border-t-red-500"
      >
        <div className="w-full flex justify-center pb-4 pt-0 -mt-2">
          <button onClick={onMinimize} className="p-1 hover:bg-gray-100 active:scale-95 transition-all rounded-full">
             <ChevronDown className="w-6 h-6 text-gray-300 stroke-[3]" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center mb-8">
           <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center text-red-500 mb-6 shadow-sm border border-red-100">
              <AlertTriangle className="w-10 h-10 animate-bounce" />
           </div>
           <h3 className="text-gray-900 text-2xl font-black uppercase tracking-tight">Order Rejected</h3>
           <p className="text-gray-500 text-sm font-bold mt-2 px-4 leading-relaxed">
             {restaurantName} has rejected this order. <br/>
             <span className="text-red-500">Attempt {rejectionCount} of 3</span>
           </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
           <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col items-center">
              <Clock className="w-5 h-5 text-gray-400 mb-2" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Wait Time</span>
              <span className="text-sm font-bold text-gray-900 mt-1">Retry Now</span>
           </div>
           <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col items-center">
              <Package className="w-5 h-5 text-gray-400 mb-2" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</span>
              <span className="text-sm font-bold text-red-600 mt-1">Rejected</span>
           </div>
        </div>

        <button
          onClick={handleResend}
          disabled={isResending || !canResend}
          className={`w-full h-16 rounded-3xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 ${
            isResending || !canResend ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-red-500 text-white shadow-red-500/20'
          }`}
        >
          {isResending ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Resending...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              <span>Resend to Restaurant</span>
            </>
          )}
        </button>

        <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-6">
          {isMulti
            ? 'After 3 attempts this restaurant is dropped; order continues with the rest'
            : 'System automatically cancels after 3 rejections'}
        </p>
      </motion.div>
    </div>
  );
};

export default RejectedOrderModal;
