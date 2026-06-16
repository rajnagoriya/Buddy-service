import { MapPin, SlidersHorizontal, Star, Timer } from "lucide-react";
import { Button } from "@food/components/ui/button";

const FILTERS = [
  { id: "delivery-under-30", label: "Under 30 min", icon: Timer },
  { id: "delivery-under-45", label: "Under 45 min", icon: Timer },
  { id: "distance-under-1km", label: "Under 1 km", icon: MapPin },
  { id: "distance-under-2km", label: "Under 2 km", icon: MapPin },
  { id: "rating-35-plus", label: "3.5+", icon: Star },
  { id: "rating-4-plus", label: "4.0+", icon: Star },
  { id: "rating-45-plus", label: "4.5+", icon: Star },
];

export default function DiningFiltersBar({ loading, activeFilters, onToggleFilter, onOpenFilters }) {
  if (loading) {
    return (
      <div className="flex gap-2 overflow-hidden px-4 py-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 py-1 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Button
        variant="outline"
        onClick={onOpenFilters}
        className="h-9 shrink-0 rounded-full border-gray-200 bg-white px-3.5 font-bold dark:border-gray-700 dark:bg-[#1a1a1a]"
      >
        <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
        <span className="text-xs">Filters</span>
      </Button>
      {FILTERS.map((filter) => {
        const Icon = filter.icon;
        const isActive = activeFilters.has(filter.id);
        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onToggleFilter(filter.id)}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition active:scale-95 ${
              isActive
                ? "border-[#2c1810] bg-[#2c1810] text-white dark:border-amber-500 dark:bg-amber-600"
                : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-gray-300"
            }`}
          >
            {Icon && <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : ""}`} />}
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
