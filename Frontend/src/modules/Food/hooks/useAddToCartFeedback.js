import { toast } from "sonner"
import { useCart } from "@food/context/CartContext"
import { useRestaurantChainRadiusModal } from "@food/context/RestaurantChainRadiusModalContext"
import { getLastRestaurantFromCart } from "@food/utils/restaurantRadius"

export function useAddToCartFeedback() {
  const { cart } = useCart()
  const { openRestaurantChainRadiusModal } = useRestaurantChainRadiusModal()

  return (
    result,
    fallbackMessage = "Cannot add this item to cart.",
    selectedRestaurantName = "",
  ) => {
    if (!result || result.ok !== false) return true

    if (result.code === "RESTAURANT_CHAIN_RADIUS") {
      const lastRestaurant = getLastRestaurantFromCart(cart)
      openRestaurantChainRadiusModal({
        lastRestaurantName: lastRestaurant?.name || "Restaurant in cart",
        selectedRestaurantName: selectedRestaurantName || "Selected restaurant",
        distanceKm: result.distanceKm,
      })
      return false
    }

    toast.error(result.error || fallbackMessage)
    return false
  }
}
