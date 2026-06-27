import { ArrowLeft, ChevronRight, Clock, MapPin, Share2 } from "lucide-react"
import { Button } from "@food/components/ui/button"

export default function CartPageHeader({
  restaurantName,
  deliveryTime,
  addressLabel,
  onBack,
  onShare,
  onAddressClick,
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur-xl dark:border-gray-800 dark:bg-[#0a0a0a]/95">
      <div className="mx-auto max-w-5xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-11 w-11 shrink-0 rounded-2xl border border-gray-200 dark:border-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-black uppercase tracking-wider text-[#16A34A] bg-[#16A34A08] dark:bg-[#16A34A12] border border-[#16A34A]/20 px-1.5 py-0.5 rounded-md">
                  Checkout
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold flex items-center gap-1 shrink-0">
                  <Clock className="h-3.5 w-3.5 text-[#16A34A]" /> {deliveryTime || "25–35 mins"}
                </span>
              </div>
              
              <h1 className="text-base font-black text-gray-900 dark:text-white truncate mt-1">
                {restaurantName}
              </h1>

              <p
                onClick={onAddressClick}
                className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 truncate flex items-center gap-1 cursor-pointer hover:text-[#16A34A] transition-colors"
              >
                <MapPin className="h-3 w-3 text-[#16A34A]" />
                Deliver to: <span className="underline decoration-dashed decoration-gray-400 font-bold">{addressLabel}</span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onShare}
            className="h-11 w-11 shrink-0 rounded-2xl border border-gray-200 dark:border-gray-700"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function CartSavingsBanner({ amount, rupeeSymbol }) {
  if (!amount || amount <= 0) return null
  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 border-b border-green-100 dark:border-green-900/30">
      <div className="mx-auto max-w-2xl px-4 py-2.5">
        <p className="text-sm font-bold text-[#16A34A]">
          You saved {rupeeSymbol}{amount} on this order
        </p>
      </div>
    </div>
  )
}
