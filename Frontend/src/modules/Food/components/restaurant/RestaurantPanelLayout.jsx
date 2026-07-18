import { useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import RestaurantSidebar from "./RestaurantSidebar"
import RestaurantPanelHeader from "./panel/RestaurantPanelHeader"

export default function RestaurantPanelLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const hideMobilePanelHeader =
    location.pathname.includes("/orders/all") ||
    location.pathname.includes("/orders/live")

  return (
    <div className="rt-panel-bg min-h-screen">
      <RestaurantSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="lg:ml-[270px]">
        {!hideMobilePanelHeader ? (
          <RestaurantPanelHeader
            onMenuClick={() => setSidebarOpen(true)}
            className="lg:hidden"
          />
        ) : null}

        <main key={location.pathname} className="min-h-screen">
          <Outlet context={{ openSidebar: () => setSidebarOpen(true) }} />
        </main>
      </div>
    </div>
  )
}
