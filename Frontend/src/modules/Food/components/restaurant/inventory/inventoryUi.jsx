import { PanelSurface } from "@food/components/restaurant/panel/panelUi"

export function InventoryStatCard({ label, value, tone = "default" }) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : tone === "muted"
          ? "bg-gray-100 text-gray-600"
          : "bg-[var(--rt-primary-soft)] text-[var(--rt-primary-strong)]"

  return (
    <div className={`rounded-xl px-3 py-2.5 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  )
}

export function InventoryStatsRow({ activeTab, stats }) {
  const isAddons = activeTab === "add-ons"

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {isAddons ? (
        <>
          <InventoryStatCard label="Add-ons" value={stats.addons} />
          <InventoryStatCard label="Live" value={stats.addonsLive} tone="success" />
          <InventoryStatCard label="Pending" value={stats.addonsPending} tone="warning" />
          <InventoryStatCard label="Paused" value={stats.addonsPaused} tone="muted" />
        </>
      ) : (
        <>
          <InventoryStatCard label="Categories" value={stats.categories} />
          <InventoryStatCard label="Menu items" value={stats.total} />
          <InventoryStatCard label="In stock" value={stats.inStock} tone="success" />
          <InventoryStatCard label="Paused" value={stats.paused} tone="warning" />
        </>
      )}
    </div>
  )
}

export function InventoryEmptyState({ title, description }) {
  return (
    <PanelSurface className="border-dashed px-6 py-14 text-center">
      <p className="text-base font-semibold text-gray-900">{title}</p>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </PanelSurface>
  )
}
