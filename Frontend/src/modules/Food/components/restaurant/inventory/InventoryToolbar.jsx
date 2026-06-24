import { motion } from "framer-motion"
import { Plus, Search, SlidersHorizontal, X } from "lucide-react"

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
  onOpenAddAddon,
  isAddAddonOpen,
  onOpenCategoryJump,
}) {
  return (
    <div className="space-y-4">
      {/* Tab Switcher - Simple and modern tabs */}
      <div className="flex border-b border-slate-100 bg-white px-2 rounded-xl">
        <button
          type="button"
          onClick={() => onTabChange("all-items")}
          className={`pb-3 pt-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "all-items"
              ? "border-[#16A34A] text-[#16A34A]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Menu Items
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
              activeTab === "all-items" ? "bg-[#16A34A]/10 text-[#16A34A]" : "bg-slate-100 text-slate-500"
            }`}
          >
            {totalItems}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("add-ons")}
          className={`pb-3 pt-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "add-ons"
              ? "border-[#16A34A] text-[#16A34A]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Add-ons
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
              activeTab === "add-ons" ? "bg-[#16A34A]/10 text-[#16A34A]" : "bg-slate-100 text-slate-500"
            }`}
          >
            {addonsCount}
          </span>
        </button>
      </div>

      {/* Search and Filter Section */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={
                activeTab === "add-ons" ? "Search add-ons..." : "Search categories or dishes..."
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A]/30 transition-all shadow-sm"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenFilters}
              className={`relative flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all shadow-sm ${
                hasActiveFilter
                  ? "bg-[#16A34A]/5 border-[#16A34A] text-[#16A34A]"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilter ? (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#16A34A] text-[9px] font-bold text-white">
                  1
                </span>
              ) : null}
            </button>

            {activeTab === "add-ons" ? (
              <button
                type="button"
                onClick={onOpenAddAddon}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-[#16A34A] px-3.5 text-xs font-bold text-white hover:bg-[#15803D] transition-all shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                {isAddAddonOpen ? "Close Form" : "New Add-on"}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenCategoryJump}
                className="flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 lg:hidden transition-all shadow-sm"
              >
                Categories
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Badge */}
        {hasActiveFilter ? (
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A]/5 px-2.5 py-1 text-xs font-bold text-[#16A34A] border border-[#16A34A]/10">
              Filter: {filterOptions?.find((o) => o.value === selectedFilter)?.label}
              <button
                type="button"
                onClick={() => onFilterSelect("all")}
                className="rounded-full p-0.5 hover:bg-[#16A34A]/10 transition-colors"
                aria-label="Remove filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
