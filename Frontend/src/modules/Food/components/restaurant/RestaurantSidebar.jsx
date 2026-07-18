import { useNavigate, useLocation } from "react-router-dom"
import { LogOut, Store, X } from "lucide-react"
import { SIDEBAR_SECTIONS, findActiveNavItem } from "@food/utils/restaurantNavConfig"
import { useRestaurantSession } from "@food/context/RestaurantSessionContext"
import useRestaurantLogout from "@food/hooks/useRestaurantLogout"

const allSidebarItems = SIDEBAR_SECTIONS.flatMap((section) => section.items)

export default function RestaurantSidebar({ isOpen = false, onClose }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { logout } = useRestaurantLogout()
  const activeItem = findActiveNavItem(allSidebarItems, pathname)
  const { restaurant } = useRestaurantSession()

  const restaurantName =
    restaurant?.restaurantName || restaurant?.name || "Partner panel"
  const ownerName =
    restaurant?.ownerName || restaurant?.contactPerson || restaurant?.owner?.name || "Restaurant owner"

  const handleNavigate = (route) => {
    if (route !== pathname) navigate(route)
    onClose?.()
  }

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[60] bg-gray-900/40 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-label="Close navigation"
        />
      ) : null}

      <aside
        className={`
          fixed inset-y-0 left-0 z-[70] flex w-[270px] flex-col border-r border-[var(--rt-border)] bg-white
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--rt-primary-soft)] text-[var(--rt-primary-strong)]">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900">{restaurantName}</p>
              <p className="text-xs text-gray-500">Restaurant panel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-gray-100 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {SIDEBAR_SECTIONS.map((section) => (
            <div key={section.key}>
              {section.label ? (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {section.label}
                </p>
              ) : null}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = activeItem?.id === item.id

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleNavigate(item.route)}
                        className={`
                          flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition
                          ${isActive ? "rt-nav-active" : "rt-nav-idle"}
                        `}
                      >
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                            isActive ? "bg-white shadow-sm" : "bg-[var(--rt-surface-muted)]"
                          }`}
                        >
                          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                        </span>
                        <span>{item.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--rt-border)] p-4">
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-[var(--rt-surface-muted)] px-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--rt-primary-strong)] text-sm font-bold text-white">
              {ownerName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{ownerName}</p>
              <p className="text-xs text-gray-500">Owner</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--rt-border)] px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}
