export const isRestaurantBanned = (restaurant) => {
  if (!restaurant) return false
  if (restaurant?.bannedAt) return true
  const status = String(restaurant?.status || "").trim().toLowerCase()
  if (status === "banned") return true
  if (
    status === "rejected" &&
    String(restaurant?.rejectionReason || "").trim() === "Disabled by admin"
  ) {
    return true
  }
  if (
    status === "rejected" &&
    restaurant?.isActive === false &&
    String(restaurant?.onboardingStatus || "").toUpperCase() === "APPROVED"
  ) {
    return true
  }
  return false
}
