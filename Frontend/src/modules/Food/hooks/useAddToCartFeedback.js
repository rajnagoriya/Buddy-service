import { toast } from "sonner"
import { useCart } from "@food/context/CartContext"
import { useRestaurantChainRadiusModal } from "@food/context/RestaurantChainRadiusModalContext"
import { getFirstRestaurantFromCart } from "@food/utils/restaurantRadius"

export function useAddToCartFeedback() {
  const { cart } = useCart()
  const { openRestaurantChainRadiusModal } = useRestaurantChainRadiusModal()

  return (
    result,
    fallbackMessage = "Cannot add this item to cart.",
    selectedRestaurantName = "",
  ) => {
    if (!result || result.ok !== false) return true

    if (result.code === "MAX_RESTAURANTS_EXCEEDED") {
      openRestaurantChainRadiusModal({
        type: "MAX_RESTAURANTS",
        title: "Maximum 2 Restaurants",
        message: result.error || "You can only select from two restro",
        selectedRestaurantName: selectedRestaurantName || "Selected restaurant",
      })
      return false
    }

    if (result.code === "RESTAURANT_CHAIN_RADIUS") {
      const anchorRestaurant = getFirstRestaurantFromCart(cart)
      openRestaurantChainRadiusModal({
        type: "RESTAURANT_CHAIN_RADIUS",
        title: "Outside delivery radius",
        message: result.error || "This restaurant is outside the allowed road distance of the first restaurant in your cart.",
        lastRestaurantName: anchorRestaurant?.name || "First restaurant in cart",
        selectedRestaurantName: selectedRestaurantName || "Selected restaurant",
        distanceKm: result.distanceKm,
      })
      return false
    }

    if (result.code === "MULTI_ORDER_DISABLED") {
      openRestaurantChainRadiusModal({
        type: "GENERIC",
        title: "Multi-Restaurant Orders Disabled",
        message: result.error || "Multi-restaurant orders are currently disabled.",
        selectedRestaurantName: selectedRestaurantName || "",
      })
      return false
    }

    toast.error(result.error || fallbackMessage)
    return false
  }
}
