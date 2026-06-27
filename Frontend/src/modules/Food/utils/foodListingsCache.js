import { adminAPI, restaurantAPI } from "@food/api"

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes cache TTL

const cacheStore = {
  restaurantCategories: null,
  adminCategories: new Map(),
  adminFoods: null,
  adminRestaurantsActive: null,
  adminRestaurantsInactive: null,
  adminAddons: new Map(),
}

const cacheTimestamps = {
  restaurantCategories: 0,
  adminFoods: 0,
  adminRestaurantsActive: 0,
  adminRestaurantsInactive: 0,
}

// 1. Restaurant Categories Caching
export async function getRestaurantCategoriesCached({ force = false } = {}) {
  const now = Date.now()
  if (!force && cacheStore.restaurantCategories && (now - cacheTimestamps.restaurantCategories < CACHE_TTL_MS)) {
    return cacheStore.restaurantCategories
  }
  const response = await restaurantAPI.getAllCategories()
  cacheStore.restaurantCategories = response
  cacheTimestamps.restaurantCategories = now
  return response
}

export function invalidateRestaurantCategoriesCache() {
  cacheStore.restaurantCategories = null
  cacheTimestamps.restaurantCategories = 0
}

// 2. Admin Categories Caching
export async function getAdminCategoriesCached(params = {}, { force = false } = {}) {
  const now = Date.now()
  const key = JSON.stringify(params)
  if (!force) {
    const hit = cacheStore.adminCategories.get(key)
    if (hit && (now - hit.ts < CACHE_TTL_MS)) {
      return hit.response
    }
  }
  const response = await adminAPI.getCategories(params)
  cacheStore.adminCategories.set(key, { ts: now, response })
  return response
}

export function invalidateAdminCategoriesCache() {
  cacheStore.adminCategories.clear()
}

// 3. Admin Foods Caching
export async function getAdminFoodsCached({ force = false } = {}) {
  const now = Date.now()
  if (!force && cacheStore.adminFoods && (now - cacheTimestamps.adminFoods < CACHE_TTL_MS)) {
    return cacheStore.adminFoods
  }
  const response = await adminAPI.getFoods({ limit: 1000 })
  cacheStore.adminFoods = response
  cacheTimestamps.adminFoods = now
  return response
}

export function invalidateAdminFoodsCache() {
  cacheStore.adminFoods = null
  cacheTimestamps.adminFoods = 0
}

// 4. Admin Restaurants (for Food Filter dropdown)
export async function getAdminRestaurantsActiveCached({ force = false } = {}) {
  const now = Date.now()
  if (!force && cacheStore.adminRestaurantsActive && (now - cacheTimestamps.adminRestaurantsActive < CACHE_TTL_MS)) {
    return cacheStore.adminRestaurantsActive
  }
  const response = await adminAPI.getRestaurants({ limit: 1000 })
  cacheStore.adminRestaurantsActive = response
  cacheTimestamps.adminRestaurantsActive = now
  return response
}

export async function getAdminRestaurantsInactiveCached({ force = false } = {}) {
  const now = Date.now()
  if (!force && cacheStore.adminRestaurantsInactive && (now - cacheTimestamps.adminRestaurantsInactive < CACHE_TTL_MS)) {
    return cacheStore.adminRestaurantsInactive
  }
  const response = await adminAPI.getRestaurants({ limit: 1000, status: "inactive" })
  cacheStore.adminRestaurantsInactive = response
  cacheTimestamps.adminRestaurantsInactive = now
  return response
}

export function invalidateAdminRestaurantsCache() {
  cacheStore.adminRestaurantsActive = null
  cacheStore.adminRestaurantsInactive = null
  cacheTimestamps.adminRestaurantsActive = 0
  cacheTimestamps.adminRestaurantsInactive = 0
}

// 5. Admin Addons Caching
export async function getAdminAddonsCached(params = {}, { force = false } = {}) {
  const now = Date.now()
  const key = JSON.stringify(params)
  if (!force) {
    const hit = cacheStore.adminAddons.get(key)
    if (hit && (now - hit.ts < CACHE_TTL_MS)) {
      return hit.response
    }
  }
  const response = await adminAPI.getRestaurantAddons(params)
  cacheStore.adminAddons.set(key, { ts: now, response })
  return response
}

export function invalidateAdminAddonsCache() {
  cacheStore.adminAddons.clear()
}
