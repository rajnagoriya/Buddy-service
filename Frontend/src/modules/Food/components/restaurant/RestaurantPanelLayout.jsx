import { useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import RestaurantSidebar from "./RestaurantSidebar"
import RestaurantNavbar from "./RestaurantNavbar"

export default function RestaurantPanelLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="rt-panel-bg min-h-screen">
      <RestaurantSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="lg:ml-[270px]">
        {/* Same header as live orders: restaurant name, location, status, actions */}
        <div className="sticky top-0 z-50 bg-white lg:hidden">
          <RestaurantNavbar
            showNotifications
            onMenuClick={() => setSidebarOpen(true)}
          />
        </div>

        <main key={location.pathname} className="min-h-screen">
          <Outlet
            context={{
              openSidebar: () => setSidebarOpen(true),
              closeSidebar: () => setSidebarOpen(false),
            }}
          />
        </main>
      </div>
    </div>
  )
}
