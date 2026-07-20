import { Minus, Plus } from "lucide-react"
import VegIndicator from "@food/components/user/restaurant-details/VegIndicator"

const FOOD_IMAGE_FALLBACK = "https://picsum.photos/seed/cart-food/200/200"

const formatCartAmount = (value) => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return "0.00"
  return amount.toFixed(2)
}

function groupItemsByRestaurant(items = [], restaurantGroups = []) {
  const packagingById = new Map(
    (restaurantGroups || []).map((g) => [String(g.restaurantId), Number(g.packagingFee) || 0]),
  )
  const imageById = new Map(
    (restaurantGroups || []).map((g) => [String(g.restaurantId), g.restaurantImage || ""]),
  )

  const groups = []
  const seen = new Map()

  for (const item of items) {
    const rid = String(item.restaurantId || item.restaurant || "unknown")
    let group = seen.get(rid)
    if (!group) {
      group = {
        restaurantId: rid,
        restaurantName: item.restaurant || "Restaurant",
        restaurantImage: imageById.get(rid) || item.restaurantImage || "",
        packagingFee: packagingById.has(rid) ? packagingById.get(rid) : null,
        items: [],
        subtotal: 0,
      }
      seen.set(rid, group)
      groups.push(group)
    }
    const line = (Number(item.price) || 0) * (Number(item.quantity) || 1)
    group.items.push(item)
    group.subtotal += line
  }

  return groups.map((g) => ({
    ...g,
    subtotal: Number(g.subtotal.toFixed(2)),
  }))
}

function CartItemRow({ item, rupeeSymbol, onUpdateQuantity }) {
  const isVeg = item.isVeg === true || item.foodType === "Veg"
  const lineTotal = formatCartAmount((item.price || 0) * (item.quantity || 1))

  return (
    <div className="flex gap-3 p-3">
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
}

export default function CartItemsCard({
  items,
  rupeeSymbol,
  onUpdateQuantity,
  onAddMore,
  restaurantGroups = [],
}) {
  const groups = groupItemsByRestaurant(items, restaurantGroups)
  const isMulti = groups.length > 1

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div
          key={group.restaurantId}
          className="rounded-2xl border border-gray-100 bg-white shadow-xs overflow-hidden dark:border-gray-800 dark:bg-[#141414]"
        >
          <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a1a1a] flex items-center gap-2.5">
            {group.restaurantImage ? (
              <img
                src={group.restaurantImage}
                alt=""
                className="h-8 w-8 rounded-lg object-cover border border-gray-100 dark:border-gray-700"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-500">
                {(group.restaurantName || "R").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {group.restaurantName}
              </h2>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {group.items.length} item{group.items.length === 1 ? "" : "s"}
                {!isMulti ? ` in cart` : ""}
              </p>
            </div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {group.items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                rupeeSymbol={rupeeSymbol}
                onUpdateQuantity={onUpdateQuantity}
              />
            ))}
          </div>

          {(isMulti || group.packagingFee != null) && (
            <div className="px-3.5 py-2.5 border-t border-dashed border-gray-200 dark:border-gray-700 space-y-1.5 bg-gray-50/40 dark:bg-[#121212]">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {rupeeSymbol}{formatCartAmount(group.subtotal)}
                </span>
              </div>
              {group.packagingFee != null && group.packagingFee > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Packaging</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {rupeeSymbol}{formatCartAmount(group.packagingFee)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={onAddMore}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-[#16A34A] rounded-2xl border border-gray-100 bg-white shadow-xs dark:border-gray-800 dark:bg-[#141414] hover:bg-green-50/50 dark:hover:bg-green-950/10 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        {isMulti
          ? "Add items from more restaurants"
          : "Add more items"}
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
