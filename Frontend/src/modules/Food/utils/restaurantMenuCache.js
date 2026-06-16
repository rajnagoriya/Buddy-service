import { restaurantAPI } from "@food/api"
import { getMenuFromResponse } from "@food/utils/menuItems"

const MENU_CACHE_TTL_MS = 5 * 60 * 1000

/** @type {Map<string, { ts: number, menu: object | null }>} */
const menuCache = new Map()
/** @type {Map<string, Promise<object | null>>} */
const menuInFlight = new Map()

export function getRestaurantMenuLookupIds(restaurant) {
  const candidates = [
    restaurant?.restaurantId,
    restaurant?.id,
    restaurant?.mongoId,
    restaurant?._id,
    restaurant?.slug,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)

  return [...new Set(candidates)]
}

export function getPrimaryRestaurantMenuLookupId(restaurant) {
  return getRestaurantMenuLookupIds(restaurant)[0] || null
}

function readCachedMenu(id) {
  const key = String(id || "").trim()
  if (!key) return undefined

  const hit = menuCache.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.ts > MENU_CACHE_TTL_MS) {
    menuCache.delete(key)
    return undefined
  }
  return hit.menu
}

function writeCachedMenu(id, menu, aliasIds = []) {
  const entry = { ts: Date.now(), menu }
  const keys = new Set(
    [id, ...aliasIds]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean),
  )

  keys.forEach((key) => {
    menuCache.set(key, entry)
  })
}

/**
 * Fetch a restaurant menu once per session (deduped + TTL).
 * Pass `force: true` only when menu data must be refreshed immediately.
 */
export async function fetchRestaurantMenuCached(lookupId, { force = false, aliasIds = [] } = {}) {
  const id = String(lookupId || "").trim()
  if (!id) return null

  if (!force) {
    const cached = readCachedMenu(id)
    if (cached !== undefined) return cached
    if (menuInFlight.has(id)) return menuInFlight.get(id)
  }

  const request = (async () => {
    try {
      const response = await restaurantAPI.getMenuByRestaurantId(id)
      const menu = getMenuFromResponse(response)
      const hasSections = Array.isArray(menu?.sections) && menu.sections.length > 0
      const resolvedMenu = response?.data?.success && hasSections ? menu : null
      writeCachedMenu(id, resolvedMenu, aliasIds)
      return resolvedMenu
    } catch (error) {
      if (error?.response?.status === 404) {
        writeCachedMenu(id, null, aliasIds)
        return null
      }
      throw error
    } finally {
      menuInFlight.delete(id)
    }
  })()

  menuInFlight.set(id, request)
  return request
}

/**
 * Try canonical restaurant ids in order; stops at the first menu with sections.
 */
export async function fetchRestaurantMenuForRestaurant(restaurant, { force = false } = {}) {
  const lookupIds = getRestaurantMenuLookupIds(restaurant)
  if (lookupIds.length === 0) return null

  const aliasIds = lookupIds.slice(1)

  for (const lookupId of lookupIds) {
    const cached = !force ? readCachedMenu(lookupId) : undefined
    if (cached !== undefined) {
      if (cached) return cached
      continue
    }

    const menu = await fetchRestaurantMenuCached(lookupId, { force, aliasIds })
    if (menu?.sections?.length > 0) return menu
  }

  return null
}

export function clearRestaurantMenuCache() {
  menuCache.clear()
  menuInFlight.clear()
}
