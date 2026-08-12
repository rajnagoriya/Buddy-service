/**
 * Normalize restaurant dietary preference to veg | non_veg | mixed.
 */
export function resolveDietaryTypeKey(restaurant) {
  if (!restaurant || typeof restaurant !== "object") return null

  const raw = String(
    restaurant.dietaryType ||
      restaurant.onboarding?.step1?.dietaryType ||
      restaurant.onboarding?.step2?.dietaryType ||
      "",
  )
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")

  if (raw === "veg" || raw === "pure_veg") return "veg"
  if (raw === "mixed") return "mixed"
  if (raw === "non_veg" || raw === "nonveg") return "non_veg"

  if (restaurant.pureVegRestaurant === true) return "veg"
  if (restaurant.pureVegRestaurant === false) return "non_veg"
  return null
}

/** Display label: Pure Veg | Non-Veg | Mixed */
export function formatDietaryTypeLabel(restaurant, empty = null) {
  const key = resolveDietaryTypeKey(restaurant)
  if (key === "veg") return "Pure Veg"
  if (key === "mixed") return "Mixed"
  if (key === "non_veg") return "Non-Veg"
  return empty
}

export function dietaryTypeBadgeClass(restaurant) {
  const key = resolveDietaryTypeKey(restaurant)
  if (key === "veg") return "bg-emerald-100 text-emerald-700"
  if (key === "mixed") return "bg-amber-100 text-amber-700"
  if (key === "non_veg") return "bg-orange-100 text-orange-700"
  return "bg-slate-100 text-slate-600"
}

/** Item foodType values allowed for this restaurant: Veg and/or Non-Veg */
export function getAllowedItemFoodTypes(restaurant) {
  const key = resolveDietaryTypeKey(restaurant)
  if (key === "veg") return ["Veg"]
  // mixed, non_veg, or unknown — allow both (non-veg outlets can still serve veg items)
  return ["Veg", "Non-Veg"]
}

/** Category foodTypeScope values allowed for this restaurant */
export function getAllowedFoodTypeScopes(restaurant) {
  const key = resolveDietaryTypeKey(restaurant)
  if (key === "veg") return ["Veg"]
  return ["Veg", "Non-Veg", "Both"]
}

/** Whether inventory/list can filter by Non-veg */
export function allowsNonVegFood(restaurant) {
  return getAllowedItemFoodTypes(restaurant).includes("Non-Veg")
}
