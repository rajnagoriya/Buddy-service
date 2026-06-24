import { useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, ChevronDown, MapPin, ShoppingCart } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { useCart } from "@food/context/CartContext"
import { useProfile } from "@food/context/ProfileContext"
import { useLocation as useFoodLocation } from "@food/hooks/useLocation"
import { useLocationSelector } from "./UserLayout"
import UnifiedHeader from "@/shared/components/UnifiedHeader"
import VegModePopups from "./VegModePopups"

function normalizeFoodPath(pathname) {
  const path = pathname.startsWith("/food")
    ? pathname.substring(5) || "/"
    : pathname
  return path.length > 1 ? path.replace(/\/+$/, "") : path
}

const ROUTE_THEMES = {
  home: {
    shell: "border-0 bg-transparent",
    card: "rounded-2xl border border-white/20 bg-white/12 px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.18)] backdrop-blur-xl",
    iconBtn: "h-10 w-10 rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20",
    label: "text-[10px] font-bold uppercase tracking-[0.2em] text-green-300/90",
    title: "text-sm font-extrabold text-white",
    sub: "text-[11px] font-semibold text-white/60",
    chevron: "text-white/70",
    cartBadge: "ring-white/30",
    showBack: false,
    titleText: "Deliver to",
  },
  dining: {
    shell: "border-b border-gray-100 bg-white/95 backdrop-blur-xl dark:border-gray-800 dark:bg-[#0a0a0a]/95",
    card: "flex-1 rounded-xl sm:rounded-2xl border border-gray-200 bg-gray-50 px-2 py-1.5 sm:px-3 sm:py-2 shadow-sm dark:border-gray-700 dark:bg-[#141414]",
    iconBtn: "h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white",
    label: "text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] text-green-700 dark:text-green-400",
    title: "text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white",
    sub: "hidden sm:block text-[11px] font-semibold text-gray-500 dark:text-gray-400",
    chevron: "text-green-600 dark:text-green-400",
    cartBadge: "ring-white dark:ring-[#0a0a0a]",
    showBack: true,
    titleText: "Dining",
  },
  under250: {
    shell: "border-b border-orange-100 bg-orange-50/95 backdrop-blur-xl dark:border-orange-900/30 dark:bg-[#1a1208]/95",
    card: "flex-1 rounded-xl sm:rounded-2xl border border-orange-200/80 bg-white px-2 py-1.5 sm:px-3 sm:py-2 shadow-sm dark:border-orange-900/40 dark:bg-[#2a1a0c]",
    iconBtn: "h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-orange-200/80 bg-white text-orange-700 shadow-sm dark:border-orange-900/40 dark:bg-[#3a2410] dark:text-orange-200",
    label: "text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-400",
    title: "text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white",
    sub: "hidden sm:block text-[11px] font-semibold text-orange-600/70 dark:text-orange-300/70",
    chevron: "text-orange-500 dark:text-orange-400",
    cartBadge: "ring-white dark:ring-[#1a1208]",
    showBack: true,
    titleText: "Under ₹250",
  },
  profile: {
    shell: "border-b border-gray-100 bg-white/95 backdrop-blur-xl dark:border-gray-800 dark:bg-[#0a0a0a]/95",
    card: "flex-1 rounded-xl sm:rounded-2xl border border-gray-200 bg-gray-50 px-2 py-1.5 sm:px-3 sm:py-2 shadow-sm dark:border-gray-700 dark:bg-[#141414]",
    iconBtn: "h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-white",
    label: "text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] text-green-700 dark:text-green-400",
    title: "text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white",
    sub: "hidden sm:block text-[11px] font-semibold text-gray-500 dark:text-gray-400",
    chevron: "text-gray-500 dark:text-gray-400",
    cartBadge: "ring-white dark:ring-[#0a0a0a]",
    showBack: true,
    titleText: "Profile",
  },
}

function resolveThemeKey(route) {
  if (route === "/" || route === "/user" || route === "") return "home"
  if (route === "/dining" || route === "/user/dining") return "dining"
  if (route === "/under-250" || route === "/user/under-250") return "under250"
  if (route === "/profile" || route === "/user/profile") return "profile"
  return "profile"
}

export default function FoodUserHeader({ variant, className = "" }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { getCartCount } = useCart()
  const cartCount = getCartCount()
  const { openLocationSelector } = useLocationSelector()
  const { location, loading } = useFoodLocation()
  const { vegMode, setVegMode } = useProfile()
  const [showVegModePopup, setShowVegModePopup] = useState(false)
  const [showSwitchOffPopup, setShowSwitchOffPopup] = useState(false)
  const [pendingVegValue, setPendingVegValue] = useState(null)

  const route = useMemo(() => normalizeFoodPath(pathname), [pathname])
  const themeKey = variant || resolveThemeKey(route)
  const theme = ROUTE_THEMES[themeKey] || ROUTE_THEMES.profile

  const areaLabel = location?.area || location?.city || "Set location"
  const cityLabel = location?.city && location.city !== "Current Location" ? location.city : ""

  const locationCardClass =
    themeKey === "home"
      ? "flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2.5 text-left transition active:scale-[0.99]"
      : `${theme.card} flex min-w-0 items-center gap-1.5 sm:gap-2.5 text-left transition active:scale-[0.99]`

  const locationCard = (
    <button
      type="button"
      disabled={loading}
      onClick={openLocationSelector}
      className={locationCardClass}
    >
      <div className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl ${themeKey === "home" ? "bg-white/15" : "bg-green-50 dark:bg-green-950/40"}`}>
        <MapPin className={`h-4 w-4 ${themeKey === "home" ? "text-amber-300" : "text-green-600 dark:text-green-400"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={theme.label}>{theme.titleText}</p>
        <div className="flex min-w-0 items-center gap-1">
          <span className={`truncate ${theme.title}`}>{loading ? "Loading..." : areaLabel}</span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${theme.chevron}`} />
        </div>
        {cityLabel ? <p className={`truncate ${theme.sub}`}>{cityLabel}</p> : null}
      </div>
    </button>
  )

  const cartButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => navigate("/food/user/cart")}
      className={`relative shrink-0 ${theme.iconBtn}`}
      aria-label="Open cart"
      title="Cart"
    >
      <ShoppingCart className="h-5 w-5" />
      {cartCount > 0 && (
        <span className={`absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-600 px-1 text-[10px] font-black text-white ring-2 ${theme.cartBadge}`}>
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </Button>
  )

  const tone = themeKey === "home" ? "dark" : "light"
  const handleVegModeChange = (nextValue) => {
    if (nextValue === true && vegMode !== true) {
      setPendingVegValue(true)
      setShowVegModePopup(true)
      return
    }
    if (nextValue === false && vegMode === true) {
      setPendingVegValue(false)
      setShowSwitchOffPopup(true)
      return
    }
    setVegMode(nextValue)
  }

  const actionCluster = (
    <div className="shrink-0">
      <UnifiedHeader
        activeTab="food"
        setActiveTab={() => {}}
        location={location}
        savedAddressText=""
        handleLocationClick={() => {}}
        handleSearchFocus={() => {}}
        vegMode={vegMode}
        handleVegModeChange={handleVegModeChange}
        embedded
        tone={tone}
        hideLocation
        hideSearch
        hideServiceGrid
        theme={{ section: "bg-transparent" }}
      />
    </div>
  )

  return (
    <header className={`${theme.shell} ${className}`}>
      <div className="pt-[env(safe-area-inset-top)]">
        <div
          className={`mx-auto flex max-w-7xl items-center px-3 py-2.5 ${
            themeKey === "home" ? theme.card : "gap-1.5 sm:gap-2"
          }`}
        >
          {theme.showBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className={`shrink-0 ${theme.iconBtn}`}
              aria-label="Go back"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : null}

          {themeKey === "home" ? (
            <>
              {locationCard}
              {actionCluster}
              {cartButton}
            </>
          ) : (
            <>
              {locationCard}
              {actionCluster}
              {cartButton}
            </>
          )}
        </div>
      </div>

      <VegModePopups
        showVegModePopup={showVegModePopup}
        showSwitchOffPopup={showSwitchOffPopup}
        onCloseVegPopup={() => {
          setShowVegModePopup(false)
          if (pendingVegValue === true) {
            setVegMode(true)
          }
          setPendingVegValue(null)
        }}
        onCloseSwitchOffPopup={() => {
          setShowSwitchOffPopup(false)
          setPendingVegValue(null)
        }}
        onConfirmSwitchOff={() => {
          setVegMode(false)
          setShowSwitchOffPopup(false)
          setPendingVegValue(null)
        }}
      />
    </header>
  )
}
