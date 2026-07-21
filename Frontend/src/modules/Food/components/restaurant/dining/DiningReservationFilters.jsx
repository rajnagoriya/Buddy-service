import { Search } from "lucide-react"
import { DINING_STATUS_FILTERS } from "./diningUi"

export default function DiningReservationFilters({
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  counts = {},
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Search guest, phone, booking ID..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {DINING_STATUS_FILTERS.map((filter) => {
          const active = statusFilter === filter.id
          const count = counts[filter.id]
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onStatusFilterChange?.(filter.id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {filter.label}
              {typeof count === "number" ? (
                <span className={`ml-1.5 ${active ? "text-white/80" : "text-slate-400"}`}>
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
