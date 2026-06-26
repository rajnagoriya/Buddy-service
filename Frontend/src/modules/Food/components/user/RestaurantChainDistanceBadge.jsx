import {
  getChainDistanceBadge,
} from "@food/utils/restaurantRadius"

function getRestaurantCoords(restaurant) {
  const loc = restaurant?.location
  if (loc) {
    const lat = loc.latitude ?? loc.coordinates?.[1]
    const lng = loc.longitude ?? loc.coordinates?.[0]
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      return { latitude: Number(lat), longitude: Number(lng) }
    }
  }

  const lat = restaurant?.latitude
  const lng = restaurant?.longitude
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return { latitude: Number(lat), longitude: Number(lng) }
  }

  return { latitude: null, longitude: null }
}

export default function RestaurantChainDistanceBadge({
  lastCartRestaurant,
  restaurant,
  className = "",
}) {
  if (!lastCartRestaurant || !restaurant) return null

  const coords = getRestaurantCoords(restaurant)
  const badge = getChainDistanceBadge(lastCartRestaurant, {
    restaurantId: restaurant.id || restaurant.mongoId || restaurant.restaurantId,
    ...coords,
  })

  if (!badge) return null

  const [distanceText, statusText] = badge.label.split(" • ")

  return (
    <div
      className={`pointer-events-none absolute z-[15] max-w-[calc(100%-3.5rem)] sm:max-w-[11.5rem] rounded-md px-1.5 py-1 sm:px-2 sm:py-1.5 text-left shadow-md border backdrop-blur-sm ${
        badge.withinRadius
          ? "bg-emerald-600/95 text-white border-emerald-400/70"
          : "bg-rose-600/95 text-white border-rose-400/70"
      } bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 ${className}`}
    >
      <p className="text-[9px] sm:text-[10px] font-bold leading-tight [overflow-wrap:anywhere]">
        {distanceText}
      </p>
      {statusText ? (
        <p className="text-[8px] sm:text-[9px] font-medium leading-tight opacity-95 mt-0.5 [overflow-wrap:anywhere]">
          {statusText}
        </p>
      ) : null}
    </div>
  )
}
