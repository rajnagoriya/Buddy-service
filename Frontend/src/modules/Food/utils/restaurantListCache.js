import { restaurantAPI } from "@food/api"

const LIST_CACHE_TTL_MS = 5 * 60 * 1000

/** @type {Map<string, { ts: number, response: unknown }>} */
const listCache = new Map()
/** @type {Map<string, Promise<unknown>>} */
const listInFlight = new Map()

function stableStringify(value) {
  if (value === null || value === undefined) return String(value)
  if (typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`
}

export function normalizeRestaurantListParams(params = {}) {
  const scopeHome = String(params.scope || "").toLowerCase() === "home";
  const maxLimit = scopeHome ? 15 : 100;
  const defaultLimit = scopeHome ? 12 : 20;

  const normalized = {
    page: 1,
    limit: defaultLimit,
    ...params,
  }
  delete normalized._ts

  if (normalized.page != null) {
    normalized.page = Math.max(1, parseInt(normalized.page, 10) || 1)
  }
  if (normalized.limit != null) {
    normalized.limit = Math.min(
      Math.max(parseInt(normalized.limit, 10) || defaultLimit, 1),
      maxLimit,
    )
  }

  if (normalized.lat != null && Number.isFinite(Number(normalized.lat))) {
    normalized.lat = Math.round(Number(normalized.lat) * 1000) / 1000
  }
  if (normalized.lng != null && Number.isFinite(Number(normalized.lng))) {
    normalized.lng = Math.round(Number(normalized.lng) * 1000) / 1000
  }

  return normalized
}

function buildCacheKey(params) {
  return `restaurants:${stableStringify(normalizeRestaurantListParams(params))}`
}

/**
 * Session cache for the public restaurant list.
 * Collapses duplicate calls across Home, Category, Under-250, etc.
 */
export async function fetchRestaurantsCached(params = {}, config = {}) {
  if (config?.noCache || config?.force) {
    return restaurantAPI.getRestaurants(
      normalizeRestaurantListParams(params),
      config,
    )
  }

  const key = buildCacheKey(params)
  const now = Date.now()
  const hit = listCache.get(key)
  if (hit && now - hit.ts < LIST_CACHE_TTL_MS) {
    return hit.response
  }

  if (listInFlight.has(key)) {
    return listInFlight.get(key)
  }

  const request = restaurantAPI
    .getRestaurants(normalizeRestaurantListParams(params), config)
    .then((response) => {
      listCache.set(key, { ts: Date.now(), response })
      return response
    })
    .finally(() => {
      listInFlight.delete(key)
    })

  listInFlight.set(key, request)
  return request
}

export function clearRestaurantListCache() {
  listCache.clear()
  listInFlight.clear()
}
