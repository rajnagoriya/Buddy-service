import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { restaurantAPI } from "@food/api"
import { hasModuleSession, isModuleAuthenticated } from "@food/utils/auth"
import {
  extractOnboardingPayload,
  extractRestaurantPayload,
} from "@food/utils/restaurantPayload"
import { invalidateRestaurantSessionCache } from "@food/utils/restaurantSessionCache"

const RestaurantSessionContext = createContext(null)

let sessionLoadPromise = null

/**
 * Drop the cached session WITHOUT announcing it.
 *
 * Split out from invalidateRestaurantSession because the provider below both listens for
 * `restaurantSessionInvalidated` and (via loadSession force) used to dispatch it — and
 * dispatchEvent is synchronous, so the handler re-entered itself until the stack blew:
 *
 *   onSessionInvalidated → loadSession({force}) → invalidateRestaurantSession()
 *     → dispatchEvent → onSessionInvalidated → …
 *
 * Anything already inside the provider must use this; only callers that need to notify the
 * provider should use invalidateRestaurantSession().
 */
function resetRestaurantSessionCaches() {
  sessionLoadPromise = null
  invalidateRestaurantSessionCache()
}

export function invalidateRestaurantSession() {
  resetRestaurantSessionCaches()
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("restaurantSessionInvalidated"))
  }
}

async function loadSessionOnce() {
  if (!isModuleAuthenticated("restaurant") && !hasModuleSession("restaurant")) {
    return { restaurant: null, onboarding: null }
  }
  if (!sessionLoadPromise) {
    sessionLoadPromise = Promise.all([
      restaurantAPI.getCurrentRestaurant(),
      restaurantAPI.getOnboardingProgress(),
    ])
      .then(([restaurantRes, onboardingRes]) => ({
        restaurant: extractRestaurantPayload(restaurantRes),
        onboarding: extractOnboardingPayload(onboardingRes),
      }))
      .catch((err) => {
        sessionLoadPromise = null
        throw err
      })
  }
  return sessionLoadPromise
}

export function RestaurantSessionProvider({ children }) {
  const [restaurant, setRestaurant] = useState(null)
  const [onboarding, setOnboarding] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadSession = useCallback(async ({ force = false } = {}) => {
    if (!isModuleAuthenticated("restaurant") && !hasModuleSession("restaurant")) {
      setRestaurant(null)
      setOnboarding(null)
      setError(null)
      setLoading(false)
      return
    }

    // Cache-only reset: this runs INSIDE the provider, so dispatching the invalidation event
    // here would re-enter our own listener synchronously and recurse forever.
    if (force) {
      resetRestaurantSessionCaches()
    }

    setLoading(true)
    try {
      const data = await loadSessionOnce()
      setRestaurant(data.restaurant)
      setOnboarding(data.onboarding)
      setError(null)
    } catch (err) {
      const status = err?.response?.status
      if (status === 401 || status === 403) {
        setRestaurant(null)
        setOnboarding(null)
      }
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        await loadSession()
      } catch {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    run()

    const onAuthChange = () => {
      loadSession({ force: true }).catch(() => {})
    }
    const onSessionInvalidated = () => {
      // No `force`: whoever dispatched this already cleared the caches, so forcing would only
      // clear them a second time — and, before the split above, re-dispatch this same event.
      loadSession().catch(() => {})
    }

    window.addEventListener("restaurantAuthChanged", onAuthChange)
    window.addEventListener("restaurantSessionInvalidated", onSessionInvalidated)
    const onStorage = (e) => {
      if (e.key === "restaurant_accessToken" || e.key === "restaurant_refreshToken" || e.key === null) {
        onAuthChange()
      }
    }
    window.addEventListener("storage", onStorage)

    return () => {
      cancelled = true
      window.removeEventListener("restaurantAuthChanged", onAuthChange)
      window.removeEventListener("restaurantSessionInvalidated", onSessionInvalidated)
      window.removeEventListener("storage", onStorage)
    }
  }, [loadSession])

  // These fetch and setState themselves, so they only need the caches cleared — dispatching
  // the invalidation event would make the provider run a second, redundant full session load
  // (two extra API calls) on top of the single fetch below.
  const refreshRestaurant = useCallback(async () => {
    resetRestaurantSessionCaches()
    const res = await restaurantAPI.getCurrentRestaurant()
    const next = extractRestaurantPayload(res)
    setRestaurant(next)
    return next
  }, [])

  const refreshOnboarding = useCallback(async () => {
    resetRestaurantSessionCaches()
    const res = await restaurantAPI.getOnboardingProgress()
    const next = extractOnboardingPayload(res)
    setOnboarding(next)
    return next
  }, [])

  const updateRestaurant = useCallback((patch) => {
    setRestaurant((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const value = useMemo(
    () => ({
      restaurant,
      onboarding,
      loading,
      error,
      refreshRestaurant,
      refreshOnboarding,
      refreshSession: () => loadSession({ force: true }),
      updateRestaurant,
    }),
    [
      restaurant,
      onboarding,
      loading,
      error,
      refreshRestaurant,
      refreshOnboarding,
      loadSession,
      updateRestaurant,
    ],
  )

  return (
    <RestaurantSessionContext.Provider value={value}>
      {children}
    </RestaurantSessionContext.Provider>
  )
}

export function useRestaurantSession() {
  const context = useContext(RestaurantSessionContext)
  if (!context) {
    return {
      restaurant: null,
      onboarding: null,
      loading: false,
      error: null,
      refreshRestaurant: async () => null,
      refreshOnboarding: async () => null,
      refreshSession: async () => {},
      updateRestaurant: () => {},
    }
  }
  return context
}
