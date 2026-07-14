import { MapPin, Clock, Star, Utensils } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { ArrowLeft, Search, MoreVertical, X } from "lucide-react"
import {
  formatRestaurantRating,
  hasDisplayableRestaurantRating,
} from "@food/utils/restaurantDisplay"

export function RestaurantHero({ restaurant }) {
  const coverImage =
    restaurant?.image || (restaurant?.coverImages?.length > 0 ? restaurant.coverImages[0] : null)

  return (
    <div className="relative w-full h-[38vh] min-h-[240px] max-h-[420px] overflow-hidden bg-gray-900">
      {coverImage ? (
        <img src={coverImage} alt={restaurant?.name} className="w-full h-full object-cover scale-105" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950">
          <Utensils className="h-12 w-12 text-gray-600" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
    </div>
  )
}

export function RestaurantTopBar({
  showSearch,
  searchQuery,
  onBack,
  onSearchOpen,
  onSearchChange,
  onSearchBlur,
  onMenuOptions,
}) {
  return (
    <div className="absolute top-0 left-0 right-0 z-30 px-4 sm:px-6 pt-4 safe-area-top">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="icon"
          className="rounded-2xl h-11 w-11 border-white/20 bg-black/30 backdrop-blur-md hover:bg-black/50 text-white shadow-lg"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2 flex-1 justify-end max-w-md">
          {!showSearch ? (
            <Button
              variant="outline"
              className="rounded-2xl h-11 px-4 border-white/20 bg-black/30 backdrop-blur-md hover:bg-black/50 text-white shadow-lg gap-2"
              onClick={onSearchOpen}
            >
              <Search className="h-4 w-4" />
              <span className="text-sm font-semibold hidden sm:inline">Search menu</span>
            </Button>
          ) : (
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <input
                type="text"
                placeholder="Search dishes..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onBlur={onSearchBlur}
                className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-white/20 bg-black/40 backdrop-blur-md text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#16A34A]/50"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          <Button
            variant="outline"
            size="icon"
            className="rounded-2xl h-11 w-11 border-white/20 bg-black/30 backdrop-blur-md hover:bg-black/50 text-white shadow-lg flex-shrink-0"
            onClick={onMenuOptions}
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function RestaurantInfoCard({
  restaurant,
  isRestaurantOffline,
  onOutletsClick,
}) {
  return (
    <div className="relative z-10 -mt-10 mx-4 sm:mx-6 max-w-7xl lg:mx-auto">
      <div className="rounded-[24px] border border-gray-100 bg-white p-4 sm:p-5 shadow-[0_8px_40px_rgba(0,0,0,0.08)] dark:border-gray-800 dark:bg-[#141414]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight truncate">
              {restaurant?.name || "Restaurant"}
            </h1>
            <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400 line-clamp-1">
              {restaurant?.topCategory || restaurant?.cuisine || "Multi-cuisine"} · {restaurant?.distance || "—"}
            </p>
          </div>
          {hasDisplayableRestaurantRating(restaurant) && (
          <div className="flex flex-col items-center gap-0.5 flex-shrink-0 rounded-2xl bg-[#F0FDF4] dark:bg-green-950/40 px-3 py-2 border border-green-100 dark:border-green-900/40">
            <div className="flex items-center gap-1 text-[#16A34A] font-extrabold text-sm">
              <Star className="h-3.5 w-3.5 fill-[#16A34A]" />
              {formatRestaurantRating(restaurant)}
            </div>
            {Number(restaurant?.totalRatings || restaurant?.reviews) > 0 && (
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
              {Number(restaurant?.totalRatings || restaurant?.reviews).toLocaleString()}+
            </span>
            )}
          </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
            <Clock className="h-3.5 w-3.5 text-[#16A34A]" />
            {restaurant?.deliveryTime || "25–30 mins"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
              isRestaurantOffline
                ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                : "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${isRestaurantOffline ? "bg-red-500" : "bg-green-500 animate-pulse"}`}
            />
            {isRestaurantOffline ? "Closed" : "Open now"}
          </span>
          <button
            type="button"
            onClick={onOutletsClick}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#16A34A] hover:underline"
          >
            <MapPin className="h-3.5 w-3.5" />
            View outlets
          </button>
        </div>
      </div>
    </div>
  )
}

export function RestaurantOfflineBanner() {
  return (
    <div className="bg-amber-500 text-white text-center py-2.5 text-xs font-bold tracking-wide">
      Restaurant is closed — schedule an order for later
    </div>
  )
}

export function RestaurantOfferStrip({ headline, subline, indicatorCount, activeIndicator, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-4 sm:mx-6 max-w-7xl lg:mx-auto mt-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#16A34A] to-[#15803D] p-4 text-left shadow-lg shadow-green-600/20 hover:shadow-xl transition-shadow w-auto"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 text-lg">
        🎉
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-white truncate">{headline}</p>
        <p className="text-xs font-medium text-white/80 truncate">{subline}</p>
      </div>
      {indicatorCount > 1 && (
        <div className="flex gap-1 flex-shrink-0">
          {Array.from({ length: indicatorCount }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-all ${
                i === activeIndicator ? "bg-white w-4" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </button>
  )
}
