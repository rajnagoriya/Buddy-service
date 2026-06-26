import { createContext, useCallback, useContext, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import { MapPin, Navigation } from "lucide-react"

const defaultDetails = {
  lastRestaurantName: "",
  selectedRestaurantName: "",
  distanceKm: null,
}

const RestaurantChainRadiusModalContext = createContext({
  openRestaurantChainRadiusModal: () => {},
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
      lastRestaurantName: payload.lastRestaurantName || "",
      selectedRestaurantName: payload.selectedRestaurantName || "",
      distanceKm: payload.distanceKm ?? null,
    })
    setOpen(true)
  }, [])

  const handleViewNearby = useCallback(() => {
    setOpen(false)
    navigate("/")
  }, [navigate])

  const formattedDistance =
    details.distanceKm != null && Number.isFinite(Number(details.distanceKm))
      ? `${Number(details.distanceKm).toFixed(1)} KM`
      : null

  return (
    <RestaurantChainRadiusModalContext.Provider value={{ openRestaurantChainRadiusModal }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="!left-1/2 !top-1/2 !bottom-auto !inset-x-auto !-translate-x-1/2 !-translate-y-1/2 w-[90%] max-w-[min(90vw,28rem)] sm:max-w-[30rem] gap-0 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-[#141414] p-0 shadow-xl max-h-[min(90vh,32rem)] overflow-hidden !data-[state=open]:slide-in-from-bottom-0 !data-[state=closed]:slide-out-to-bottom-0"
        >
          <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
                <MapPin className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
                Outside delivery radius
              </DialogTitle>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                This restaurant is outside the allowed 5 KM radius required for a combined order.
              </p>
            </DialogHeader>
          </div>

          <div className="px-5 py-4 space-y-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-[#1a1a1a]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Restaurant in cart
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                {details.lastRestaurantName || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-[#1a1a1a]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Selected restaurant
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                {details.selectedRestaurantName || "—"}
              </p>
            </div>
            {formattedDistance && (
              <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50/70 px-3 py-2.5 dark:border-red-900/40 dark:bg-red-950/20">
                <Navigation className="h-4 w-4 shrink-0 text-red-600" />
                <p className="text-sm font-bold text-red-700 dark:text-red-300">
                  Distance: {formattedDistance}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white sm:w-auto"
              onClick={handleViewNearby}
            >
              View nearby restaurants
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </RestaurantChainRadiusModalContext.Provider>
  )
}
