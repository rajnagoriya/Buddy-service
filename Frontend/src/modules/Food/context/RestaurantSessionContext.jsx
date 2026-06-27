import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { restaurantAPI } from "@food/api"
import { isModuleAuthenticated } from "@food/utils/auth"
import {
  extractOnboardingPayload,
  extractRestaurantPayload,
} from "@food/utils/restaurantPayload"
import { invalidateRestaurantSessionCache } from "@food/utils/restaurantSessionCache"

const RestaurantSessionContext = createContext(null)

let sessionLoadPromise = null

export function invalidateRestaurantSession() {
  sessionLoadPromise = null
  invalidateRestaurantSessionCache()
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("restaurantSessionInvalidated"))
  }
}

async function loadSessionOnce() {
  if (!isModuleAuthenticated("restaurant")) {
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
    if (!isModuleAuthenticated("restaurant")) {
      setRestaurant(null)
      setOnboarding(null)
      setError(null)
      setLoading(false)
      return
    }

    if (force) {
      invalidateRestaurantSession()
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
      loadSession({ force: true }).catch(() => {})
    }

    window.addEventListener("restaurantAuthChanged", onAuthChange)
    window.addEventListener("restaurantSessionInvalidated", onSessionInvalidated)
    window.addEventListener("storage", (e) => {
      if (e.key === "restaurant_accessToken" || e.key === null) {
        onAuthChange()
      }
    })

    return () => {
      cancelled = true
      window.removeEventListener("restaurantAuthChanged", onAuthChange)
      window.removeEventListener("restaurantSessionInvalidated", onSessionInvalidated)
    }
  }, [loadSession])

  const refreshRestaurant = useCallback(async () => {
    invalidateRestaurantSession()
    const res = await restaurantAPI.getCurrentRestaurant()
    const next = extractRestaurantPayload(res)
    setRestaurant(next)
    return next
  }, [])

  const refreshOnboarding = useCallback(async () => {
    invalidateRestaurantSession()
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
