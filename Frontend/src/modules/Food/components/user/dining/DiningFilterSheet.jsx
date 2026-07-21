import { MapPin, Star, ArrowDownUp, UtensilsCrossed } from "lucide-react"

const SORT_OPTIONS = [
  { id: null, label: "Relevance" },
  { id: "rating-high", label: "Rating: High to Low" },
  { id: "distance", label: "Nearest first" },
]

const RATING_OPTIONS = [
  { id: "rating-35-plus", label: "3.5+" },
  { id: "rating-4-plus", label: "4.0+" },
  { id: "rating-45-plus", label: "4.5+" },
]

const DISTANCE_OPTIONS = [
  { id: "distance-under-1km", label: "Under 1 km" },
  { id: "distance-under-2km", label: "Under 2 km" },
  { id: "distance-under-5km", label: "Under 5 km" },
]

const CUISINES = ["Continental", "Italian", "Asian", "Indian", "Chinese", "American", "Seafood", "Cafe"]

const TABS = [
  { id: "sort", label: "Sort", icon: ArrowDownUp },
  { id: "rating", label: "Rating", icon: Star },
  { id: "distance", label: "Distance", icon: MapPin },
  { id: "cuisine", label: "Cuisine", icon: UtensilsCrossed },
]

function OptionButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
        active
          ? "border-green-600 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          : "border-gray-200 text-gray-700 hover:border-green-600/50 dark:border-gray-700 dark:text-gray-300"
      }`}
    >
      {children}
    </button>
  )
}

export default function DiningFilterSheet({
  open,
  onClose,
  activeFilterTab,
  onFilterTabChange,
  sortBy,
  onSortChange,
  activeFilters,
  onToggleFilter,
  selectedCuisine,
  onCuisineChange,
  resultCount,
  onClear,
}) {
  if (!open) return null

  const hasActive = activeFilters.size > 0 || sortBy || selectedCuisine

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Close filters"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div className="absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-white md:left-1/2 md:right-auto md:max-h-[90vh] md:w-full md:max-w-2xl md:-translate-x-1/2 md:rounded-3xl dark:bg-[#1a1a1a]">
        <div className="flex items-center justify-between border-b px-5 py-4 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Filters</h2>
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-semibold text-green-700 dark:text-green-400"
          >
            Clear all
          </button>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex w-24 shrink-0 flex-col border-r bg-gray-50 dark:border-gray-800 dark:bg-[#0a0a0a]">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeFilterTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onFilterTabChange(tab.id)}
                  className={`relative flex flex-col items-center gap-1 px-2 py-4 text-center transition-colors ${
                    isActive
                      ? "bg-white text-green-700 dark:bg-[#1a1a1a] dark:text-green-400"
                      : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  {isActive && (
                    <span className="absolute bottom-0 left-0 top-0 w-1 rounded-r bg-green-600" />
                  )}
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {activeFilterTab === "sort" && (
              <div className="flex flex-col gap-2.5">
                <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-white">Sort by</h3>
                {SORT_OPTIONS.map((option) => (
                  <OptionButton
                    key={option.id || "relevance"}
                    active={sortBy === option.id}
                    onClick={() => onSortChange(option.id)}
                  >
                    {option.label}
                  </OptionButton>
                ))}
              </div>
            )}

            {activeFilterTab === "rating" && (
              <div className="grid grid-cols-2 gap-2.5">
                <h3 className="col-span-2 mb-1 text-base font-semibold text-gray-900 dark:text-white">
                  Restaurant rating
                </h3>
                {RATING_OPTIONS.map((option) => (
                  <OptionButton
                    key={option.id}
                    active={activeFilters.has(option.id)}
                    onClick={() => onToggleFilter(option.id)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Star className="h-4 w-4" />
                      Rated {option.label}
                    </span>
                  </OptionButton>
                ))}
              </div>
            )}

            {activeFilterTab === "distance" && (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <h3 className="col-span-full mb-1 text-base font-semibold text-gray-900 dark:text-white">
                  Distance
                </h3>
                {DISTANCE_OPTIONS.map((option) => (
                  <OptionButton
                    key={option.id}
                    active={activeFilters.has(option.id)}
                    onClick={() => onToggleFilter(option.id)}
                  >
                    {option.label}
                  </OptionButton>
                ))}
              </div>
            )}

            {activeFilterTab === "cuisine" && (
              <div className="grid grid-cols-2 gap-2.5">
                <h3 className="col-span-2 mb-1 text-base font-semibold text-gray-900 dark:text-white">
                  Cuisine
                </h3>
                {CUISINES.map((cuisine) => (
                  <OptionButton
                    key={cuisine}
                    active={selectedCuisine === cuisine}
                    onClick={() => onCuisineChange(selectedCuisine === cuisine ? null : cuisine)}
                  >
                    {cuisine}
                  </OptionButton>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t px-5 py-4 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 text-center text-sm font-semibold text-gray-600 dark:text-gray-300"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
              hasActive
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {hasActive ? `Show ${resultCount} places` : "Show results"}
          </button>
        </div>
      </div>
    </div>
  )
}
