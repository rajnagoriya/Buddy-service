import { Link, useLocation } from "react-router-dom"
import { Tag, User, Truck, UtensilsCrossed } from "lucide-react"
import useLandingSettings from "@food/hooks/useLandingSettings"

export default function BottomNavigation() {
  const location = useLocation()
  const pathname = location.pathname
  const { under250PriceLimit } = useLandingSettings()

  // Check active routes - support both /user/* and /* paths
  const isDining = pathname === "/food/dining" || pathname.startsWith("/food/user/dining")
  const isUnder250 = pathname === "/food/under-250" || pathname.startsWith("/food/user/under-250")
  const isProfile = pathname.startsWith("/food/profile") || pathname.startsWith("/food/user/profile")
  const isDelivery =
    !isDining &&
    !isUnder250 &&
    !isProfile &&
    (pathname === "/" ||
      pathname === "/food" ||
      pathname === "/food/" ||
      pathname === "/food/user" ||
      pathname === "/food/user/" ||
      (pathname.startsWith("/food/user") &&
        !pathname.includes("/dining") &&
        !pathname.includes("/under-250") &&
        !pathname.includes("/profile")))

  return (
    <div
      className="md:hidden fixed bottom-6 left-4 right-4 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-xl rounded-full shadow-[0_15px_45px_rgba(26,37,23,0.15)] border border-gray-200/50 dark:border-gray-800 z-50 p-1.5"
    >
      <div className="flex items-center justify-between h-auto">
        {/* Delivery Tab */}
        <Link
          to="/"
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-full transition-all duration-300 relative ${isDelivery
              ? "bg-secondary text-primary shadow-sm"
              : "text-muted-foreground hover:bg-muted/60"
            }`}
        >
          <Truck className={`h-4.5 w-4.5 ${isDelivery ? "text-primary" : "text-muted-foreground"}`} strokeWidth={isDelivery ? 2.5 : 2} />
          <span className={`text-[10px] sm:text-xs font-semibold ${isDelivery ? "text-primary" : "text-muted-foreground"}`}>
            Delivery
          </span>
        </Link>

        {/* Dining Tab */}
        <Link
          to="/food/user/dining"
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-full transition-all duration-300 relative ${isDining
              ? "bg-secondary text-primary shadow-sm"
              : "text-muted-foreground hover:bg-muted/60"
            }`}
        >
          <UtensilsCrossed className={`h-4.5 w-4.5 ${isDining ? "text-primary" : "text-muted-foreground"}`} strokeWidth={isDining ? 2.5 : 2} />
          <span className={`text-[10px] sm:text-xs font-semibold ${isDining ? "text-primary" : "text-muted-foreground"}`}>
            Dining
          </span>
        </Link>

        {/* Under 250 Tab */}
        <Link
          to="/food/user/under-250"
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-full transition-all duration-300 relative ${isUnder250
              ? "bg-secondary text-primary shadow-sm"
              : "text-muted-foreground hover:bg-muted/60"
            }`}
        >
          <Tag className={`h-4.5 w-4.5 ${isUnder250 ? "text-primary" : "text-muted-foreground"}`} strokeWidth={isUnder250 ? 2.5 : 2} />
          <span className={`text-[10px] sm:text-xs font-semibold ${isUnder250 ? "text-primary" : "text-muted-foreground"}`}>
            ₹{under250PriceLimit}
          </span>
        </Link>

        {/* Profile Tab */}
        <Link
          to="/food/user/profile?service=food"
          className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-full transition-all duration-300 relative ${isProfile
              ? "bg-secondary text-primary shadow-sm"
              : "text-muted-foreground hover:bg-muted/60"
            }`}
        >
          <User className={`h-4.5 w-4.5 ${isProfile ? "text-primary" : "text-muted-foreground"}`} strokeWidth={isProfile ? 2.5 : 2} />
          <span className={`text-[10px] sm:text-xs font-semibold ${isProfile ? "text-primary" : "text-muted-foreground"}`}>
            Profile
          </span>
        </Link>
      </div>
    </div>
  )
}

