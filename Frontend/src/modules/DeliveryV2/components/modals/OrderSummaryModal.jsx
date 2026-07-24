import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, Wallet, Star } from 'lucide-react';

/**
 * Post-delivery success screen.
 * Salary partners: "Order completed" only (no payout amount).
 * Per-order partners: show actual rider earning (never customer deliveryFee).
 */
export const OrderSummaryModal = ({ order, onDone, riderProfile }) => {
  const isSalaryPartner =
    order?.earningDisplayMode === 'salary' ||
    order?.employmentType === 'salary' ||
    order?.settlementBreakdown?.driver?.employmentType === 'salary' ||
    riderProfile?.employmentType === 'salary';

  const earnings = (() => {
    if (isSalaryPartner) return 0;
    const candidates = [
      order?.earnings,
      order?.riderEarning,
      order?.deliveryBoyFee,
      order?.pricing?.deliveryFeeBreakdown?.riderFee,
      order?.pricing?.deliveryFeeBreakdown?.deliveryBoyFee,
      order?.settlementBreakdown?.driver?.payout,
    ];
    for (const value of candidates) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  })();

  return (
    <div className="fixed inset-0 z-[1000] bg-green-500 overflow-y-auto">
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm"
        >
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-2xl animate-bounce">
            <CheckCircle className="w-14 h-14 sm:w-16 sm:h-16 text-green-500" />
          </div>

          <h1 className="text-white text-4xl sm:text-5xl font-bold mb-2 tracking-tight">
            {isSalaryPartner ? 'Order Completed' : 'Well Done!'}
          </h1>
          <p className="text-white/90 text-base sm:text-lg mb-8 sm:mb-12">
            Trip completed successfully.
          </p>

          <div className="bg-white rounded-3xl p-5 sm:p-8 mb-8 sm:mb-12 shadow-2xl text-gray-900 border border-white/20">
            {isSalaryPartner ? (
              <>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                    Delivery Done
                  </p>
                  <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
                </div>
                <p className="text-gray-950 text-2xl sm:text-3xl font-bold mb-2 tracking-tight">
                  Order completed
                </p>
                <p className="text-sm text-gray-500 font-medium">
                  You are on salary — no per-order payout for this trip.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                    Earnings Added
                  </p>
                  <Star className="w-4 h-4 text-orange-400 fill-orange-400" />
                </div>

                <p className="text-gray-950 text-5xl sm:text-6xl font-bold mb-5 sm:mb-6 tracking-tighter">
                  ₹{Number(earnings).toFixed(2)}
                </p>

                <div className="flex items-center justify-center gap-3 py-3 bg-green-50 rounded-2xl text-green-700 text-sm font-bold border border-green-100">
                  <Wallet className="w-5 h-5" />
                  <span>Transferred to Wallet</span>
                </div>
              </>
            )}
          </div>

          <button
            onClick={onDone}
            className="w-full h-14 sm:h-16 bg-white text-green-600 font-bold text-lg sm:text-xl rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-50 active:scale-95 transition-all shadow-xl shadow-black/10"
          >
            Go Back Home <ArrowRight className="w-6 h-6" />
          </button>

          <p className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-8 sm:mt-12 opacity-80">
            Order Reference: {order?.orderId || order?.displayOrderId || 'FOD-1234'}
          </p>
        </motion.div>
      </div>
    </div>
  );
};
