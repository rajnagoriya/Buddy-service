import { MapPin, SlidersHorizontal, Star } from "lucide-react"
import { Button } from "@food/components/ui/button"

const SHORT_FILTERS = [
  { id: "rating-4-plus", label: "4.0+", icon: Star },
  { id: "distance-under-2km", label: "Within 2 km", icon: MapPin },
  { id: "distance-under-5km", label: "Within 5 km", icon: MapPin },
]

export default function DiningFiltersBar({ loading, activeFilters, onToggleFilter, onOpenFilters }) {
  if (loading) {
    return (
      <div className="flex gap-2 overflow-hidden px-4 py-1.5">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-8 w-20 shrink-0 animate-pulse rounded-full bg-white/40 dark:bg-gray-800"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 py-1.5 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Button
        variant="outline"
        onClick={onOpenFilters}
        className="h-8 shrink-0 rounded-full border-gray-200/80 bg-white px-3 font-bold text-gray-800 shadow-sm hover:border-green-600 hover:text-green-700 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-gray-200"
      >
        <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
        <span className="text-xs">Filters</span>
      </Button>
      {SHORT_FILTERS.map((filter) => {
        const Icon = filter.icon
        const isActive = activeFilters.has(filter.id)
        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onToggleFilter(filter.id)}
            className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-bold transition active:scale-95 ${
              isActive
                ? "border-green-600 bg-green-600 text-white"
                : "border-gray-200/80 bg-white text-gray-700 shadow-sm hover:border-green-600/40 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-gray-300"
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {filter.label}
          </button>
        )
      })}
    </div>
  )
}
