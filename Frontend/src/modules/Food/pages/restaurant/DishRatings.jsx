import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import { PanelSurface } from "@food/components/restaurant/panel/panelUi"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"

export default function DishRatings() {
  return (
    <RestaurantSubPageShell
      title="Dish ratings"
      subtitle="Ratings appear when customers review dishes"
      backTo={`${RESTAURANT_BASE}/explore`}
    >
      <PanelSurface className="py-16 text-center">
        <p className="text-sm text-gray-600">You haven&apos;t received any dish ratings yet.</p>
      </PanelSurface>
    </RestaurantSubPageShell>
  )
}
