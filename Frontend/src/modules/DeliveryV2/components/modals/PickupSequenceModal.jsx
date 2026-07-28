import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, MapPin, Store } from 'lucide-react';
import { toast } from 'sonner';
import { deliveryAPI } from '@food/api';

const idOf = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value);
};

/**
 * After accepting a multi-restaurant order, driver taps which restaurant to visit first.
 * Remaining stops keep suggested order after the chosen first stop.
 */
export const PickupSequenceModal = ({ order, onDone, onSkip }) => {
  const remainingPickups = useMemo(() => {
    const list = Array.isArray(order?.pickups) ? order.pickups : [];
    return list
      .filter(
        (p) =>
          !p.permanentlyDropped &&
          String(p.status || '').toLowerCase() !== 'cancelled' &&
          String(p.status || '').toLowerCase() !== 'picked_up',
      )
      .slice()
      .sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0));
  }, [order?.pickups]);

  const [firstId, setFirstId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFirstId(idOf(remainingPickups[0]?.restaurantId) || '');
  }, [remainingPickups]);

  if (remainingPickups.length < 2) {
    return null;
  }

  const buildOrderedIds = () => {
    const selected = firstId || idOf(remainingPickups[0]?.restaurantId);
    const first = remainingPickups.find((p) => idOf(p.restaurantId) === selected);
    const rest = remainingPickups.filter((p) => idOf(p.restaurantId) !== selected);
    return [first, ...rest].filter(Boolean).map((p) => idOf(p.restaurantId)).filter(Boolean);
  };

  const handleConfirm = async () => {
    const orderId = order?._id || order?.id || order?.orderId || order?.order_id;
    if (!orderId) {
      toast.error('Invalid order');
      return;
    }
    const restaurantIds = buildOrderedIds();
    if (restaurantIds.length < 2) {
      toast.error('Select which restaurant to visit first');
      return;
    }
    setSaving(true);
    try {
      const response = await deliveryAPI.setPickupSequence(orderId, restaurantIds);
      const updated = response?.data?.data?.order || response?.data?.order || null;
      const firstName =
        remainingPickups.find((p) => idOf(p.restaurantId) === restaurantIds[0])?.restaurantName ||
        'first restaurant';
      toast.success(`Going to ${firstName} first`);
      onDone?.(updated || order);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save pickup sequence';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      className="bg-white rounded-t-[2rem] shadow-[0_-20px_80px_rgba(0,0,0,0.35)] border border-gray-100 p-5 pb-8"
    >
      <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
      <h3 className="text-lg font-bold text-gray-900 text-center">Where first?</h3>
      <p className="text-sm text-gray-500 text-center mt-1 mb-4">
        Tap the restaurant you want to pick up from first. Finish that stop, then continue to the next.
      </p>

      <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
        {remainingPickups.map((pickup, index) => {
          const rid = idOf(pickup.restaurantId);
          const selected = rid === firstId;
          const address =
            pickup.location?.address ||
            pickup.location?.formattedAddress ||
            pickup.restaurantAddress ||
            '';
          const ready = String(pickup.status || '').toLowerCase() === 'ready';
          return (
            <button
              key={rid || index}
              type="button"
              onClick={() => setFirstId(rid)}
              className={`w-full text-left flex items-start gap-3 rounded-2xl border-2 px-3.5 py-3.5 transition-all ${
                selected
                  ? 'border-green-500 bg-green-50 shadow-sm'
                  : 'border-gray-100 bg-gray-50 hover:border-gray-200'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  selected ? 'bg-green-500 text-white' : 'bg-orange-100 text-orange-700'
                }`}
              >
                {selected ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Store className={`w-3.5 h-3.5 shrink-0 ${selected ? 'text-green-600' : 'text-gray-400'}`} />
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {pickup.restaurantName || `Restaurant ${index + 1}`}
                  </p>
                </div>
                {address ? (
                  <p className="text-[11px] text-gray-500 mt-1 flex items-start gap-1">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{address}</span>
                  </p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {selected ? (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      Go here first
                    </span>
                  ) : null}
                  {ready ? (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      Food ready
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {String(pickup.status || 'pending').replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => onSkip?.()}
          disabled={saving}
          className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-700 disabled:opacity-50"
        >
          Keep suggested
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving || !firstId}
          className="flex-[1.4] py-3 rounded-2xl bg-[#16A34A] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          {saving ? 'Saving…' : 'Start this pickup'}
        </button>
      </div>
    </motion.div>
  );
};
