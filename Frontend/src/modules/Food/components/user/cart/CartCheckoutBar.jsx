import { Banknote, ChevronRight, Loader2, Wallet, Zap } from "lucide-react"

export default function CartCheckoutBar({
  rupeeSymbol,
  total,
  selectedPaymentMethod,
  selectedPaymentLabel,
  walletBalance,
  isPlacingOrder,
  hasSavedAddress,
  disabled,
  onOpenPayment,
  onPlaceOrder,
}) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-100 bg-white/95 backdrop-blur-xl dark:border-gray-800 dark:bg-[#0a0a0a]/95 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto max-w-2xl px-4 py-3 space-y-3">
        <button
          type="button"
          onClick={onOpenPayment}
          className="w-full flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-left transition hover:bg-gray-100 dark:border-gray-700 dark:bg-[#141414] dark:hover:bg-[#1a1a1a]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 dark:bg-green-950/30">
              {selectedPaymentMethod === "wallet" ? (
                <Wallet className="h-5 w-5 text-[#16A34A]" />
              ) : selectedPaymentMethod === "razorpay" ? (
                <Zap className="h-5 w-5 text-[#16A34A]" />
              ) : (
                <Banknote className="h-5 w-5 text-[#16A34A]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pay with</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-extrabold text-gray-900 dark:text-white truncate">{selectedPaymentLabel}</p>
                {selectedPaymentMethod === "wallet" && (
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded">
                    {rupeeSymbol}{walletBalance.toFixed(0)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className="flex items-center gap-0.5 text-xs font-bold text-[#16A34A] shrink-0">
            Change <ChevronRight className="h-4 w-4" />
          </span>
        </button>

        <button
          type="button"
          onClick={onPlaceOrder}
          disabled={disabled || isPlacingOrder}
          className="w-full flex items-center justify-between rounded-2xl bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 h-14 font-bold shadow-lg shadow-green-600/25 transition-all active:scale-[0.99]"
        >
          <div className="text-left">
            <p className="text-lg font-black leading-none">{rupeeSymbol}{total.toFixed(2)}</p>
            <p className="text-[10px] font-semibold text-white/80 mt-0.5 uppercase tracking-wide">Total</p>
          </div>
          <span className="flex items-center gap-1.5 text-base">
            {isPlacingOrder ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Placing order...
              </>
            ) : !hasSavedAddress ? (
              "Select address"
            ) : (
              "Place order"
            )}
            {!isPlacingOrder && <ChevronRight className="h-5 w-5" />}
          </span>
        </button>
      </div>
    </div>
  )
}
