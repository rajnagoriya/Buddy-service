import { AlertCircle, Power } from "lucide-react"
import { PanelSurface } from "@food/components/restaurant/panel/panelUi"
import { Switch } from "@food/components/ui/switch"

export default function OutletOnlineStatusCard({
  restaurantName,
  restaurantMeta,
  loading,
  deliveryStatus,
  onDeliveryStatusChange,
  todaySlotLabel,
  isDayClosed,
  isWithinTimings,
  showOutsideWarning,
  isUnderReview = false,
}) {
  return (
    <PanelSurface className="overflow-hidden p-0">
      <div className="border-b border-[var(--rt-border)] bg-[var(--rt-primary-soft)]/50 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Power className="h-4 w-4 text-[var(--rt-primary-strong)]" />
          <h2 className="text-sm font-semibold text-gray-900">Online status</h2>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">Control whether customers can place orders now</p>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {isUnderReview ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-900">
              You are under admin review. Your outlet cannot go online until your profile changes are approved.
            </p>
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-gray-900">
              {loading ? "Loading..." : restaurantName || "Restaurant"}
            </p>
            {restaurantMeta ? <p className="mt-0.5 text-xs text-gray-500">{restaurantMeta}</p> : null}
          </div>
          <div
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              deliveryStatus
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {deliveryStatus ? "Online" : "Offline"}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[var(--rt-border)] bg-gray-50/80 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Accepting orders</p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${deliveryStatus ? "bg-emerald-500" : "bg-gray-400"}`}
              />
              <p className="text-xs text-gray-500">
                {deliveryStatus ? "Receiving orders" : "Not receiving orders"}
              </p>
            </div>
          </div>
          <Switch
            checked={deliveryStatus}
            onCheckedChange={onDeliveryStatusChange}
            disabled={isUnderReview}
            className="data-[state=checked]:bg-[var(--rt-primary-strong)] data-[state=unchecked]:bg-gray-300 disabled:opacity-50"
          />
        </div>

        <div className="rounded-xl border border-[var(--rt-border)] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Today&apos;s hours</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {loading ? "Loading..." : todaySlotLabel}
          </p>
          {isDayClosed ? (
            <p className="mt-1 text-xs text-amber-700">Outlet is marked closed for today. Open the day below to go online.</p>
          ) : null}
        </div>

        {showOutsideWarning && !isDayClosed ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs text-amber-800">
              You are outside today&apos;s scheduled hours. Update timings below or turn on delivery manually.
            </p>
          </div>
        ) : null}

        {!isWithinTimings && deliveryStatus && !isDayClosed ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <p className="text-xs text-rose-800">
              Delivery is on outside scheduled hours. Customers may still order if your outlet is open.
            </p>
          </div>
        ) : null}
      </div>
    </PanelSurface>
  )
}
