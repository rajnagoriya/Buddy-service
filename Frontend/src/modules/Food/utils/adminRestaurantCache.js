import { adminAPI } from "@food/api"

const LIST_CACHE_TTL_MS = 5 * 60 * 1000
const DETAIL_CACHE_TTL_MS = 10 * 60 * 1000

/** @type {Map<string, { ts: number, response: unknown }>} */
const listCache = new Map()
/** @type {Map<string, Promise<unknown>>} */
const listInFlight = new Map()

/** @type {Map<string, { ts: number, data: unknown }>} */
const detailCache = new Map()
/** @type {Map<string, Promise<unknown>>} */
const detailInFlight = new Map()

let cachedZones = null
let zonesInFlight = null

function stableStringify(value) {
  if (value === null || value === undefined) return String(value)
  if (typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`
}

function buildListCacheKey(params = {}) {
  return `admin-restaurants:${stableStringify(params)}`
}

export function hasFullRestaurantDetails(data) {
  if (!data || typeof data !== "object") return false
  return Boolean(
    data.onboarding ||
      data.ownerEmail ||
      (Array.isArray(data.cuisines) && data.cuisines.length) ||
      data.panNumber ||
      data.gstNumber ||
      data.fssaiNumber ||
      data.accountNumber,
  )
}

export function parseApprovedRestaurantsResponse(response) {
  const body = response?.data
  const data = body?.data
  const rawList = Array.isArray(data?.restaurants)
    ? data.restaurants
    : Array.isArray(data)
      ? data
      : Array.isArray(body?.restaurants)
        ? body.restaurants
        : []

  return {
    restaurants: rawList,
    total: Number(data?.total) || rawList.length,
    page: Number(data?.page) || 1,
    limit: Number(data?.limit) || rawList.length,
    activeCount: Number(data?.activeCount) || 0,
    inactiveCount: Number(data?.inactiveCount) || 0,
  }
}

export async function fetchApprovedRestaurantsCached(params = {}, { force = false } = {}) {
  const key = buildListCacheKey(params)
  const now = Date.now()

  if (!force) {
    const hit = listCache.get(key)
    if (hit && now - hit.ts < LIST_CACHE_TTL_MS) {
      return hit.response
    }
    if (listInFlight.has(key)) {
      return listInFlight.get(key)
    }
  }

  const request = adminAPI
    .getApprovedRestaurants(params)
    .then((response) => {
      listCache.set(key, { ts: Date.now(), response })
      const parsed = parseApprovedRestaurantsResponse(response)
      for (const restaurant of parsed.restaurants) {
        const id = restaurant?._id || restaurant?.id
        if (id && hasFullRestaurantDetails(restaurant)) {
          detailCache.set(String(id), { ts: Date.now(), data: restaurant })
        }
      }
      return response
    })
    .finally(() => {
      listInFlight.delete(key)
    })

  listInFlight.set(key, request)
  return request
}

export function getCachedRestaurantDetail(id) {
  if (!id) return null
  const hit = detailCache.get(String(id))
  if (!hit) return null
  if (Date.now() - hit.ts > DETAIL_CACHE_TTL_MS) {
    detailCache.delete(String(id))
    return null
  }
  return hit.data
}

export function prefetchRestaurantDetail(id) {
  if (!id || getCachedRestaurantDetail(id)) return
  fetchRestaurantDetailCached(id).catch(() => {})
}

export async function fetchRestaurantDetailCached(id, { force = false } = {}) {
  if (!id) return null
  const key = String(id)
  const now = Date.now()

  if (!force) {
    const hit = detailCache.get(key)
    if (hit && now - hit.ts < DETAIL_CACHE_TTL_MS) {
      return hit.data
    }
    if (detailInFlight.has(key)) {
      return detailInFlight.get(key)
    }
  }

  const request = adminAPI
    .getRestaurantById(id)
    .then((response) => {
      const data = response?.data?.data
      if (data && (data.restaurantName || data._id)) {
        detailCache.set(key, { ts: Date.now(), data })
        return data
      }
      return null
    })
    .finally(() => {
      detailInFlight.delete(key)
    })

  detailInFlight.set(key, request)
  return request
}

export async function getZonesCached() {
  if (cachedZones) return cachedZones
  if (zonesInFlight) return zonesInFlight

  zonesInFlight = adminAPI
    .getZones({ limit: 1000 })
    .then((res) => {
      const list =
        res?.data?.data?.zones ||
        res?.data?.data?.data?.zones ||
        res?.data?.data ||
        []
      cachedZones = Array.isArray(list) ? list : []
      return cachedZones
    })
    .catch(() => {
      cachedZones = []
      return cachedZones
    })
    .finally(() => {
      zonesInFlight = null
    })

  return zonesInFlight
}

export function invalidateApprovedRestaurantsCache() {
  listCache.clear()
  listInFlight.clear()
}

export function invalidateRestaurantDetailCache(id) {
  if (id) {
    detailCache.delete(String(id))
    detailInFlight.delete(String(id))
    return
  }
  detailCache.clear()
  detailInFlight.clear()
}

// Caching layer for pending restaurant requests
let cachedPendingRequests = null
let pendingRequestsInFlight = null
let pendingRequestsTimestamp = 0
const PENDING_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes cache

export async function fetchPendingRestaurantsCached({ force = false } = {}) {
  const now = Date.now()
  if (!force && cachedPendingRequests && (now - pendingRequestsTimestamp < PENDING_CACHE_TTL_MS)) {
    return cachedPendingRequests
  }
  if (pendingRequestsInFlight) {
    return pendingRequestsInFlight
  }

  pendingRequestsInFlight = adminAPI.getPendingRestaurants()
    .then((response) => {
      cachedPendingRequests = response
      pendingRequestsTimestamp = Date.now()
      return response
    })
    .finally(() => {
      pendingRequestsInFlight = null
    })

  return pendingRequestsInFlight
}

export function invalidatePendingRequestsCache() {
  cachedPendingRequests = null
  pendingRequestsTimestamp = 0
}

