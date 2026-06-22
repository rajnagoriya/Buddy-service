import { ChevronDown, ChevronUp } from "lucide-react"
import { PanelSurface } from "@food/components/restaurant/panel/panelUi"
import { Switch } from "@food/components/ui/switch"

export default function InventoryCategorySidebar({
  categories,
  activeCategoryPill,
  onSelect,
  onJumpToCategory,
}) {
  return (
    <PanelSurface className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto p-2 lg:block">
      <p className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Categories
      </p>
      <button
        type="button"
        onClick={() => onSelect("all")}
        className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
          activeCategoryPill === "all"
            ? "bg-[var(--rt-primary-soft)] text-[var(--rt-primary-strong)]"
            : "text-gray-700 hover:bg-gray-50"
        }`}
      >
        <span>All items</span>
      </button>
      {categories.map((category) => {
        const count = category.items?.length || category.itemCount || 0
        const isActive = activeCategoryPill === String(category.id)
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => {
              onSelect(String(category.id))
              onJumpToCategory?.(category.id)
            }}
            className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
              isActive
                ? "bg-[var(--rt-primary-soft)] font-semibold text-[var(--rt-primary-strong)]"
                : "font-medium text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="truncate pr-2">{category.name}</span>
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-500">
              {count}
            </span>
          </button>
        )
      })}
    </PanelSurface>
  )
}

export function InventoryCategoryHeader({
  category,
  isExpanded,
  outOfStockCount,
  recommendedCount,
  onToggleExpand,
  onToggleStock,
}) {
  return (
    <div
      className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 hover:bg-gray-50/80"
      onClick={onToggleExpand}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold text-gray-900">{category.name}</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
            {category.items?.length || 0} items
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              category.inStock ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {category.inStock ? "All live" : `${outOfStockCount} paused`}
          </span>
          {recommendedCount > 0 ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              {recommendedCount} recommended
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Switch
          checked={category.inStock}
          onCheckedChange={onToggleStock}
          className="data-[state=checked]:bg-[var(--rt-primary-strong)]"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand()
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--rt-border)] bg-white text-gray-600"
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
