import { useNavigate, useLocation } from "react-router-dom"
import { useMemo, useState, useEffect } from "react"
import { BOTTOM_NAV_TABS, findActiveNavItem } from "@food/utils/restaurantNavConfig"
import { useRestaurantNotifications } from "@food/hooks/useRestaurantNotifications"

export default function BottomNavOrders() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const isKeyboardOpen = window.visualViewport.height < window.innerHeight * 0.85
        setIsKeyboardVisible(isKeyboardOpen)
      }
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize)
      handleResize()
      return () => window.visualViewport.removeEventListener("resize", handleResize)
    }

    const handleWindowResize = () => {
      setIsKeyboardVisible(window.innerHeight < 550)
    }
    window.addEventListener("resize", handleWindowResize)
    return () => window.removeEventListener("resize", handleWindowResize)
  }, [])

  const { newOrder } = useRestaurantNotifications()

  const tabs = useMemo(() => BOTTOM_NAV_TABS, [])
  const activeTab = useMemo(() => findActiveNavItem(tabs, pathname)?.id || "home", [tabs, pathname])

  if (pathname.includes("/create-offers") || isKeyboardVisible) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-60 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
      <nav className="mx-auto flex max-w-md items-center justify-around rounded-[22px] border border-[var(--rt-border)] bg-white px-2 py-2 shadow-[0_10px_40px_rgba(15,23,42,0.12)]">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const showBadge = tab.id === "orders" && newOrder

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => tab.route !== pathname && navigate(tab.route)}
              aria-current={isActive ? "page" : undefined}
              className={`
                relative flex min-w-[68px] flex-col items-center gap-1 rounded-2xl px-3 py-2 transition
                ${isActive ? "bg-[var(--rt-primary-soft)] text-[var(--rt-primary-strong)]" : "text-gray-500"}
              `}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[11px] font-semibold">{tab.label}</span>
              {showBadge ? (
                <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-red-500" />
              ) : null}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
