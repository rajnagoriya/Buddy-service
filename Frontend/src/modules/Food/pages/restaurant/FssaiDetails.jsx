import { useNavigate } from "react-router-dom"
import { Download } from "lucide-react"
import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import { PanelSurface } from "@food/components/restaurant/panel/panelUi"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"

export default function FssaiDetails() {
  const navigate = useNavigate()

  return (
    <RestaurantSubPageShell
      title="FSSAI details"
      subtitle="No live restaurant license data available"
      backTo={`${RESTAURANT_BASE}/explore`}
    >
      <PanelSurface className="mb-4 flex items-start gap-3 border-amber-200 bg-[#ffe9b3] p-4">
        <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-xs font-semibold text-white">
          i
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">FSSAI details are not available</p>
          <p className="mt-1 text-xs text-gray-700">
            Upload or sync your license information to manage compliance here.
          </p>
        </div>
      </PanelSurface>

      <PanelSurface className="mb-6 space-y-3 p-4">
        <div>
          <p className="mb-1 text-xs text-gray-500">FSSAI registration number</p>
          <p className="text-sm font-semibold text-gray-900">Not available</p>
        </div>

        <div className="border-t border-dashed border-gray-200" />

        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs text-gray-500">Document</p>
            <p className="text-sm font-semibold text-gray-900">No document uploaded</p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 hover:bg-gray-50"
          >
            <Download className="h-4 w-4 text-gray-800" />
          </button>
        </div>

        <div className="border-t border-dashed border-gray-200" />

        <div>
          <p className="mb-1 text-xs text-gray-500">Valid up to</p>
          <p className="text-sm font-semibold text-gray-900">Not available</p>
        </div>
      </PanelSurface>

      <button
        type="button"
        className="rt-btn-primary mb-2 w-full rounded-2xl py-3 text-sm font-medium"
        onClick={() => navigate(`${RESTAURANT_BASE}/fssai/update`)}
      >
        Update FSSAI license
      </button>
      <p className="text-center text-xs text-gray-600">
        Haven&apos;t renewed your FSSAI?{" "}
        <button
          type="button"
          className="text-[var(--rt-primary-strong)] underline underline-offset-2"
          onClick={() => navigate(`${RESTAURANT_BASE}/fssai/update`)}
        >
          Apply Now
        </button>
      </p>
    </RestaurantSubPageShell>
  )
}
