import { Navigate } from "react-router-dom"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"

/** @deprecated Use /outlet-timings — merged hours & status page */
export default function RestaurantStatus() {
  return <Navigate to={`${RESTAURANT_BASE}/outlet-timings`} replace />
}
