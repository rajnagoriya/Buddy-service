import { Minus, Plus } from "lucide-react"
import VegIndicator from "@food/components/user/restaurant-details/VegIndicator"

const FOOD_IMAGE_FALLBACK = "https://picsum.photos/seed/cart-food/200/200"

export default function CartItemsCard({ items, rupeeSymbol, onUpdateQuantity, onAddMore }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-xs overflow-hidden dark:border-gray-800 dark:bg-[#141414]">
      <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a1a1a]">
        <h2 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Your items ({items.length})
        </h2>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {items.map((item) => {
          const isVeg = item.isVeg === true || item.foodType === "Veg"
          const lineTotal = ((item.price || 0) * (item.quantity || 1)).toFixed(0)

          return (
            <div key={item.id} className="flex gap-3 p-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = FOOD_IMAGE_FALLBACK
                    }}
                  />
                ) : null}
                <div className="absolute top-0.5 left-0.5">
                  <VegIndicator isVeg={isVeg} size="sm" />
                </div>
              </div>

              <div className="min-w-0 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-snug line-clamp-1">
                    {item.name}
                  </h3>
                  {item.variantName && (
                    <p className="mt-0.5 inline-flex rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.2 text-[10px] font-semibold text-gray-500">
                      {item.variantName}
                    </p>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                    {rupeeSymbol}{lineTotal}
                  </span>
                  <div className="flex items-center bg-[#16A34A] rounded-lg overflow-hidden shadow-xs">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                      className="px-2 py-1 text-white hover:bg-[#15803D] transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-1.5 text-xs font-bold text-white tabular-nums min-w-[1rem] text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                      className="px-2 py-1 text-white hover:bg-[#15803D] transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onAddMore}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-[#16A34A] border-t border-gray-100 dark:border-gray-800 hover:bg-green-50/50 dark:hover:bg-green-950/10 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add more items
      </button>
    </div>
  )
}

export function CartSection({ children, className = "" }) {
  return (
    <div className={`rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#141414] ${className}`}>
      {children}
    </div>
  )
}
