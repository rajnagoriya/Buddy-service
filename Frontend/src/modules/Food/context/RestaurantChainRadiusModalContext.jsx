import { createContext, useCallback, useContext, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import { MapPin, Navigation, Store } from "lucide-react"

const defaultDetails = {
  type: "RESTAURANT_CHAIN_RADIUS", // "RESTAURANT_CHAIN_RADIUS" | "MAX_RESTAURANTS" | "GENERIC"
  title: "",
  message: "",
  lastRestaurantName: "",
  selectedRestaurantName: "",
  distanceKm: null,
}

const RestaurantChainRadiusModalContext = createContext({
  openRestaurantChainRadiusModal: () => {},
  openRestaurantLimitModal: () => {},
  openCustomPopupModal: () => {},
})

export function useRestaurantChainRadiusModal() {
  return useContext(RestaurantChainRadiusModalContext)
}

export function RestaurantChainRadiusModalProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState(defaultDetails)
  const navigate = useNavigate()

  const openRestaurantChainRadiusModal = useCallback((payload = {}) => {
    setDetails({
      type: payload.type || (payload.message && !payload.lastRestaurantName ? "MAX_RESTAURANTS" : "RESTAURANT_CHAIN_RADIUS"),
      title: payload.title || "",
      message: payload.message || "",
      lastRestaurantName: payload.lastRestaurantName || "",
      selectedRestaurantName: payload.selectedRestaurantName || "",
      distanceKm: payload.distanceKm ?? null,
    })
    setOpen(true)
  }, [])

  const openRestaurantLimitModal = useCallback((message = "You can only select from two restro") => {
    setDetails({
      type: "MAX_RESTAURANTS",
      title: "Maximum 2 Restaurants",
      message: typeof message === "string" ? message : "You can only select from two restro",
      lastRestaurantName: "",
      selectedRestaurantName: "",
      distanceKm: null,
    })
    setOpen(true)
  }, [])

  const openCustomPopupModal = useCallback((payload = {}) => {
    setDetails({
      type: payload.type || "GENERIC",
      title: payload.title || "Notice",
      message: payload.message || "",
      lastRestaurantName: payload.lastRestaurantName || "",
      selectedRestaurantName: payload.selectedRestaurantName || "",
      distanceKm: payload.distanceKm ?? null,
    })
    setOpen(true)
  }, [])

  const handlePrimaryAction = useCallback(() => {
    setOpen(false)
    if (details.type === "MAX_RESTAURANTS") {
      navigate("/cart")
    } else {
      navigate("/")
    }
  }, [details.type, navigate])

  const formattedDistance =
    details.distanceKm != null && Number.isFinite(Number(details.distanceKm))
      ? `${Number(details.distanceKm).toFixed(1)} KM`
      : null

  const isMaxRestaurants = details.type === "MAX_RESTAURANTS"

  return (
    <RestaurantChainRadiusModalContext.Provider
      value={{
        openRestaurantChainRadiusModal,
        openRestaurantLimitModal,
        openCustomPopupModal,
      }}
    >
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <DialogPortal>
            <DialogOverlay className="z-[9998] fixed inset-0 bg-black/50 backdrop-blur-xs" />
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-auto"
              onClick={() => setOpen(false)}
            >
              <div
                className="relative w-full max-w-[min(90vw,24rem)] sm:max-w-[26rem] gap-0 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#141414] p-0 shadow-2xl max-h-[90vh] overflow-hidden text-center animate-in zoom-in-95 fade-in-0 duration-200 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 pt-6 pb-4 flex flex-col items-center justify-center text-center">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full mb-3 ${
                      isMaxRestaurants
                        ? "bg-amber-100/80 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                        : "bg-red-100/80 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                    }`}
                  >
                    {isMaxRestaurants ? (
                      <Store className="h-6 w-6" />
                    ) : (
                      <MapPin className="h-6 w-6" />
                    )}
                  </div>
                  <div className="space-y-1.5 text-center flex flex-col items-center">
                    <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white text-center">
                      {details.title || (isMaxRestaurants ? "Maximum 2 Restaurants" : "Outside delivery radius")}
                    </DialogTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed text-center">
                      {details.message ||
                        (isMaxRestaurants
                          ? "You can only select from two restro"
                          : "This restaurant is outside the allowed road distance of the first restaurant in your cart. Both additional restaurants must be near that first restaurant.")}
                    </p>
                  </div>
                </div>

                {!isMaxRestaurants && (details.lastRestaurantName || details.selectedRestaurantName || formattedDistance) && (
                  <div className="px-6 py-3 space-y-2 text-left">
                    {details.lastRestaurantName && (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-[#1a1a1a]">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          First restaurant in cart
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                          {details.lastRestaurantName}
                        </p>
                      </div>
                    )}
                    {details.selectedRestaurantName && (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-[#1a1a1a]">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          Selected restaurant
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                          {details.selectedRestaurantName}
                        </p>
                      </div>
                    )}
                    {formattedDistance && (
                      <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50/70 px-3 py-2.5 dark:border-red-900/40 dark:bg-red-950/20">
                        <Navigation className="h-4 w-4 shrink-0 text-red-600" />
                        <p className="text-sm font-bold text-red-700 dark:text-red-300">
                          Distance: {formattedDistance}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {isMaxRestaurants && details.selectedRestaurantName && (
                  <div className="px-6 py-3 text-left">
                    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                        Selected restaurant
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                        {details.selectedRestaurantName}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 border-t border-gray-100 px-6 py-4 dark:border-gray-800 justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:flex-1"
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    className="w-full sm:flex-1 bg-[#16A34A] hover:bg-[#15803D] text-white font-medium"
                    onClick={handlePrimaryAction}
                  >
                    {isMaxRestaurants ? "View Cart" : "View nearby restaurants"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogPortal>
        )}
      </Dialog>
    </RestaurantChainRadiusModalContext.Provider>
  )
}
