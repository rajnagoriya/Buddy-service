import { Menu, Search } from "lucide-react"
import { useRestaurantSession } from "@food/context/RestaurantSessionContext"

export default function RestaurantPanelHeader({
  title,
  subtitle,
  showSearch = false,
  onMenuClick,
  className = "",
}) {
  const { restaurant } = useRestaurantSession()

  const restaurantName =
    restaurant?.restaurantName ||
    restaurant?.name ||
    restaurant?.businessName ||
    "Your restaurant"

  return (
    <header
      className={`sticky top-0 z-40 border-b border-[var(--rt-border)] bg-white/95 backdrop-blur-md ${className}`}
    >
      <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex rounded-xl border border-[var(--rt-border)] p-2.5 hover:bg-gray-50 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-gray-700" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-gray-900 lg:text-lg">
            {title || restaurantName}
          </p>
          {subtitle ? (
            <p className="truncate text-xs text-gray-500 lg:text-sm">{subtitle}</p>
          ) : null}
        </div>

        {showSearch ? (
          <div className="hidden max-w-sm flex-1 items-center gap-2 rounded-2xl border border-[var(--rt-border)] bg-[var(--rt-surface-muted)] px-3 py-2 md:flex">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search orders, menu..."
              className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
            />
          </div>
        ) : null}
      </div>
    </header>
  )
}
