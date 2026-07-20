import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Info } from "lucide-react"
import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import { PanelSurface } from "@food/components/restaurant/panel/panelUi"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"

export default function ManageOutlets() {
  const navigate = useNavigate()
  const [showToast, setShowToast] = useState(false)

  const options = [
    { label: "Hours & status", route: `${RESTAURANT_BASE}/outlet-timings` },
    { label: "Contacts", route: `${RESTAURANT_BASE}/phone` },
    { label: "FSSAI Food License", route: `${RESTAURANT_BASE}/fssai` },
    { label: "Bank account details", route: `${RESTAURANT_BASE}/update-bank-details` },
    { label: "Profile picture", route: `${RESTAURANT_BASE}/outlet-info` },
    { label: "Name, address, location", route: `${RESTAURANT_BASE}/outlet-info` },
    { label: "Ratings, reviews", route: `${RESTAURANT_BASE}/ratings-reviews` },
    { label: "Delivery area changes", action: "toast" },
  ]

  const handleOptionClick = (option) => {
    if (option.action === "toast") {
      setShowToast(true)
      setTimeout(() => setShowToast(false), 5000)
      return
    }
    if (option.route) navigate(option.route)
  }

  return (
    <RestaurantSubPageShell
      title="Manage outlets"
      subtitle="Update outlet profile and compliance"
      backTo={`${RESTAURANT_BASE}/explore`}
    >
      <PanelSurface className="overflow-hidden p-0">
        <div className="border-b border-[var(--rt-border)] bg-[var(--rt-surface-muted)] px-4 py-3">
          <p className="text-sm font-bold text-gray-900">Select an option</p>
        </div>
        <div className="divide-y divide-[var(--rt-border)]">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => handleOptionClick(option)}
              className="flex w-full items-center justify-between px-4 py-4 text-left transition hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-900">{option.label}</span>
              <Info className="h-4 w-4 text-gray-400" />
            </button>
          ))}
        </div>
      </PanelSurface>

      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl bg-gray-900 px-4 py-3 text-center text-sm text-white shadow-lg"
          >
            Contact support to request delivery area changes.
          </motion.div>
        )}
      </AnimatePresence>
    </RestaurantSubPageShell>
  )
}
