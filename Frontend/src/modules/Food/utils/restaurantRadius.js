import { calculateDistance } from "@food/utils/common"

export const CHAIN_RESTAURANT_RADIUS_KM = 5

export const CHAIN_RADIUS_VALIDATION_MESSAGE =
  "This restaurant is outside the allowed 5 KM road distance of the last selected restaurant. To place a single order, please select a nearby restaurant."

export function extractLatLngFromItem(item) {
  if (!item || typeof item !== "object") return null

  const lat = Number(item.latitude ?? item.lat)
  const lng = Number(item.longitude ?? item.lng)

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng }
  }

  const coords = item?.location?.coordinates
  if (Array.isArray(coords) && coords.length >= 2) {
    const coordLng = Number(coords[0])
    const coordLat = Number(coords[1])
    if (Number.isFinite(coordLat) && Number.isFinite(coordLng)) {
      return { lat: coordLat, lng: coordLng }
    }
  }

  return null
}

/** Restaurant of the most recently added cart line (chain reference). */
export function getLastRestaurantFromCart(cartItems) {
  const items = Array.isArray(cartItems) ? cartItems : []
  if (items.length === 0) return null

  const last = items[items.length - 1]
  const restaurantId = String(last?.restaurantId || "").trim()
  if (!restaurantId) return null

  const coords = extractLatLngFromItem(last)

  return {
    restaurantId,
    name: last?.restaurant || "",
    lat: coords?.lat,
    lng: coords?.lng,
    latitude: coords?.lat,
    longitude: coords?.lng,
  }
}

export function getRestaurantIdsInCartOrder(cartItems) {
  const items = Array.isArray(cartItems) ? cartItems : []
  const ordered = []
  const seen = new Set()

  for (const item of items) {
    const id = String(item?.restaurantId || "").trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ordered.push(id)
  }

  return ordered
}

export function validateChainRestaurantRadius(
  fromRestaurant,
  toRestaurant,
  maxKm = CHAIN_RESTAURANT_RADIUS_KM,
) {
  const fromCoords = extractLatLngFromItem(fromRestaurant)
  const toCoords = extractLatLngFromItem(toRestaurant)

  if (!fromCoords || !toCoords) {
    return { valid: true, distanceKm: null, skipped: true }
  }

  const distanceKm = calculateDistance(
    fromCoords.lat,
    fromCoords.lng,
    toCoords.lat,
    toCoords.lng,
  )

  if (!Number.isFinite(distanceKm)) {
    return { valid: true, distanceKm: null, skipped: true }
  }

  return {
    valid: distanceKm <= maxKm,
    distanceKm,
    skipped: false,
  }
}

export function getChainDistanceBadge(lastRestaurant, targetRestaurant) {
  if (!lastRestaurant) return null

  const check = validateChainRestaurantRadius(lastRestaurant, targetRestaurant)
  if (check.skipped || !Number.isFinite(check.distanceKm)) return null

  return {
    distanceKm: check.distanceKm,
    withinRadius: check.valid,
    label: `${check.distanceKm.toFixed(1)} KM Away • ${check.valid ? "Within Radius" : "Outside Radius"}`,
  }
}
