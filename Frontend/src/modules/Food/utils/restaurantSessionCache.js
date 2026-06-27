export const restaurantSessionCache = {
  current: null,
  currentInFlight: null,
  onboarding: null,
  onboardingInFlight: null,
}

export function invalidateRestaurantSessionCache() {
  restaurantSessionCache.current = null
  restaurantSessionCache.currentInFlight = null
  restaurantSessionCache.onboarding = null
  restaurantSessionCache.onboardingInFlight = null
}
