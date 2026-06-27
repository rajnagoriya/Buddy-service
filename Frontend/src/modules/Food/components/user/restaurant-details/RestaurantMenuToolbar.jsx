import { SlidersHorizontal } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { RD } from "./restaurantDetailsTheme"

export default function RestaurantMenuToolbar({
  fulfillmentMode,
  isRestaurantOffline,
  onFulfillmentChange,
  onFilterOpen,
  activeFilterCount,
  filters,
  onVegToggle,
  onNonVegToggle,
  menuCategories,
  selectedMenuCategory,
  onCategorySelect,
}) {
  return (
    <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-gray-100 dark:bg-[#0a0a0a]/90 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-3 py-2 space-y-2">
        {/* Fulfillment pills */}
        <div className="flex justify-center">
          <div className="inline-flex items-center rounded-2xl bg-gray-100 dark:bg-gray-800/80 p-1 gap-0.5">
            {["delivery", "pickup", "schedule"].map((mode) => {
              const isDisabled = isRestaurantOffline && mode !== "schedule"
              const label = mode === "pickup" ? "Pick-up" : mode.charAt(0).toUpperCase() + mode.slice(1)
              const isActive = fulfillmentMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && onFulfillmentChange(mode)}
                  className={`px-4 sm:px-5 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                    isActive
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  } ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Filters row */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            className={`flex items-center gap-2 px-4 h-10 rounded-2xl relative ${RD.btnOutline}`}
            onClick={onFilterOpen}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="text-sm font-bold">Filters</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-[#16A34A] text-white text-[10px] flex items-center justify-center font-black border-2 border-white dark:border-[#0a0a0a]">
                {activeFilterCount}
              </span>
            )}
          </Button>

          <div className="flex rounded-2xl bg-gray-100 dark:bg-gray-800 p-1 border border-gray-200/80 dark:border-gray-700">
            <button
              type="button"
              onClick={onVegToggle}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all ${
                filters.vegNonVeg === "veg"
                  ? "bg-white text-green-600 shadow-sm dark:bg-gray-700"
                  : "text-gray-400"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${filters.vegNonVeg === "veg" ? "bg-green-500" : "bg-gray-300"}`} />
              Veg
            </button>
            <button
              type="button"
              onClick={onNonVegToggle}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all ${
                filters.vegNonVeg === "non-veg"
                  ? "bg-white text-red-600 shadow-sm dark:bg-gray-700"
                  : "text-gray-400"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${filters.vegNonVeg === "non-veg" ? "bg-red-500" : "bg-gray-300"}`} />
              Non-Veg
            </button>
          </div>
        </div>

        {/* Category chips */}
        {menuCategories.length > 0 && (
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
            <div className="flex items-center gap-2 w-max">
              <button
                type="button"
                onClick={() => onCategorySelect("all")}
                className={`h-9 px-4 rounded-full text-xs font-bold transition-all border ${
                  selectedMenuCategory === "all" ? RD.pillActive : RD.pillIdle
                }`}
              >
                All
              </button>
              {menuCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onCategorySelect(category.id)}
                  className={`h-9 px-3 flex items-center gap-2 rounded-full text-xs font-bold transition-all border ${
                    selectedMenuCategory === category.id ? RD.pillActive : RD.pillIdle
                  }`}
                >
                  {category.image && (
                    <img
                      src={category.image}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                      }}
                    />
                  )}
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
