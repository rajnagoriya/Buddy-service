import { motion } from "framer-motion"
import { Plus, Search, SlidersHorizontal, X } from "lucide-react"
import { PanelPill, PanelSurface } from "@food/components/restaurant/panel/panelUi"

export default function InventoryToolbar({
  activeTab,
  totalItems,
  addonsCount,
  onTabChange,
  searchQuery,
  onSearchChange,
  onOpenFilters,
  hasActiveFilter,
  selectedFilter,
  onFilterSelect,
  filterOptions,
  filterCounts,
  hasActiveTools,
  onClearTools,
  onOpenAddAddon,
  isAddAddonOpen,
  isDesktop,
  listToRender,
  activeCategoryPill,
  onCategoryPillChange,
  onOpenCategoryJump,
}) {
  return (
    <div className="space-y-4">
      <div className="grid max-w-lg grid-cols-2 gap-2">
        <motion.button
          type="button"
          onClick={() => onTabChange("all-items")}
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            activeTab === "all-items"
              ? "rt-pill-active shadow-sm"
              : "border-[var(--rt-border)] bg-white text-gray-600"
          }`}
          whileTap={{ scale: 0.98 }}
        >
          <span className="flex items-center justify-center gap-2">
            Menu items
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === "all-items" ? "bg-white/80" : "bg-gray-100 text-gray-500"
              }`}
            >
              {totalItems}
            </span>
          </span>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => onTabChange("add-ons")}
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            activeTab === "add-ons"
              ? "rt-pill-active shadow-sm"
              : "border-[var(--rt-border)] bg-white text-gray-600"
          }`}
          whileTap={{ scale: 0.98 }}
        >
          <span className="flex items-center justify-center gap-2">
            Add-ons
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === "add-ons" ? "bg-white/80" : "bg-gray-100 text-gray-500"
              }`}
            >
              {addonsCount}
            </span>
          </span>
        </motion.button>
      </div>

      <PanelSurface className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {activeTab === "add-ons" ? "Manage add-ons" : "Browse menu inventory"}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {activeTab === "add-ons"
                ? "Create, approve, and toggle add-on availability"
                : "Search dishes, filter stock, and update availability"}
            </p>
          </div>
          {hasActiveTools ? (
            <button
              type="button"
              onClick={onClearTools}
              className="rounded-full border border-[var(--rt-border)] px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={
                activeTab === "add-ons" ? "Search add-ons..." : "Search categories or dishes..."
              }
              className="h-11 w-full rounded-xl border border-[var(--rt-border)] bg-white pl-10 pr-9 text-sm outline-none focus:border-[var(--rt-primary-strong)]"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onOpenFilters}
            className="relative flex h-11 items-center gap-2 rounded-xl border border-[var(--rt-border)] bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <SlidersHorizontal className="h-4 w-4 text-[var(--rt-primary-strong)]" />
            Filters
            {hasActiveFilter ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--rt-primary-strong)]" />
            ) : null}
          </button>

          {activeTab === "add-ons" ? (
            <button
              type="button"
              onClick={onOpenAddAddon}
              className="flex h-11 items-center gap-1.5 rounded-xl bg-[var(--rt-primary-strong)] px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {isAddAddonOpen ? "Close form" : "New add-on"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenCategoryJump}
              className="flex h-11 items-center rounded-xl border border-[var(--rt-border)] bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 lg:hidden"
            >
              Categories
            </button>
          )}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filterOptions.map((option) => {
            const isActive = selectedFilter === option.value
            return (
              <PanelPill
                key={option.value}
                active={isActive}
                onClick={() => onFilterSelect(option.value)}
                className="shrink-0 text-xs"
              >
                {option.label}
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                    isActive ? "bg-white/25" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {filterCounts[option.value] || 0}
                </span>
              </PanelPill>
            )
          })}
        </div>

        {isDesktop && activeTab === "all-items" && listToRender.length > 0 ? (
          <div className="mt-3 hidden gap-2 overflow-x-auto pb-1 lg:flex scrollbar-hide">
            <PanelPill
              active={activeCategoryPill === "all"}
              onClick={() => onCategoryPillChange("all")}
              className="shrink-0 text-xs"
            >
              All ({totalItems})
            </PanelPill>
            {listToRender.map((category) => (
              <PanelPill
                key={category.id}
                active={activeCategoryPill === String(category.id)}
                onClick={() => onCategoryPillChange(String(category.id))}
                className="shrink-0 text-xs"
              >
                {category.name} ({category.items?.length || 0})
              </PanelPill>
            ))}
          </div>
        ) : null}
      </PanelSurface>
    </div>
  )
}
