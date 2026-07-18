import { useState, useMemo, useEffect } from "react"
import { CheckCircle, Mail } from "lucide-react"
import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import RestaurantPanelModal from "@food/components/restaurant/panel/RestaurantPanelModal"
import { PanelSurface } from "@food/components/restaurant/panel/panelUi"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"

const REPORT_VIEWS = [
  { id: "detailed", label: "Detailed report" },
  { id: "item", label: "Item sales report" },
]

const VIEW_TYPES = ["DAILY", "WEEKLY", "MONTHLY"]

export default function DownloadReport() {
  const [reportView, setReportView] = useState("detailed")
  const [viewType, setViewType] = useState("DAILY")
  const durations = useMemo(() => {
    if (viewType === "WEEKLY") {
      return [
        { id: "4w", label: "Last 4 weeks" },
        { id: "8w", label: "Last 8 weeks" },
        { id: "12w", label: "Last 12 weeks" },
        { id: "custom", label: "Custom" },
      ]
    }
    if (viewType === "MONTHLY") {
      return [
        { id: "3m", label: "Last 3 months" },
        { id: "6m", label: "Last 6 months" },
        { id: "12m", label: "Last 12 months" },
        { id: "custom", label: "Custom" },
      ]
    }
    return [
      { id: "7", label: "Last 7 days" },
      { id: "14", label: "Last 14 days" },
      { id: "30", label: "Last 30 days" },
      { id: "custom", label: "Custom" },
    ]
  }, [viewType])

  const [duration, setDuration] = useState("7")
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (durations.length > 0 && !durations.find((d) => d.id === duration)) {
      setDuration(durations[0].id)
    }
  }, [viewType, durations, duration])

  const handleSend = () => {
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
  }

  return (
    <RestaurantSubPageShell
      title="Download report"
      subtitle="Generate and email finance reports"
      backTo={`${RESTAURANT_BASE}/hub-finance`}
    >
      <PanelSurface className="mb-4 border-amber-200 bg-[#f8e7a0] p-3 text-sm text-gray-900">
        You are generating a report for <span className="font-semibold">All Outlets</span>
      </PanelSurface>

      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">Select the report view:</p>
          <div className="space-y-3">
            {REPORT_VIEWS.map((opt) => (
              <label key={opt.id} className="flex items-center gap-3 text-sm text-gray-900">
                <input
                  type="radio"
                  name="reportView"
                  value={opt.id}
                  checked={reportView === opt.id}
                  onChange={() => setReportView(opt.id)}
                  className="w-5 h-5 accent-black"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">Select view for data:</p>
          <div className="grid grid-cols-3 border border-gray-300 rounded-xl overflow-hidden text-center text-sm font-semibold">
            {VIEW_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setViewType(type)}
                className={`py-2 ${viewType === type ? "bg-black text-white" : "bg-white text-gray-800"}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">Select duration for report:</p>
          <div className="space-y-3">
            {durations.map((opt) => (
              <label key={opt.id} className="flex items-center gap-3 text-sm text-gray-900">
                <input
                  type="radio"
                  name="duration"
                  value={opt.id}
                  checked={duration === opt.id}
                  onChange={() => setDuration(opt.id)}
                  className="w-5 h-5 accent-black"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSend}
        className="rt-btn-primary mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold"
      >
        <Mail className="h-5 w-5" />
        Send an email
      </button>

      <RestaurantPanelModal
        open={showSuccess}
        onClose={() => setShowSuccess(false)}
        title="Report queued"
        description="We'll email it to you shortly."
        size="sm"
        mobileMaxHeight="auto"
        showDragHandle={false}
        bodyClassName="px-4 py-3 lg:px-5 lg:py-4"
      >
        <div className="flex items-center gap-3">
          <CheckCircle className="h-6 w-6 shrink-0 text-green-600" />
        </div>
      </RestaurantPanelModal>
    </RestaurantSubPageShell>
  )
}







