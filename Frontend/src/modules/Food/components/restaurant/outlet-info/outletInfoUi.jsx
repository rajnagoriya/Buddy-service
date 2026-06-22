import { ChevronRight, Loader2 } from "lucide-react"

export function SectionHeader({ title, description, action = null }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function InfoRow({ icon: Icon, label, value, onClick, loading = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition hover:border-[var(--rt-border)] hover:bg-gray-50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--rt-primary-soft)]">
        <Icon className="h-[18px] w-[18px] text-[var(--rt-primary-strong)]" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {loading ? (
          <div className="mt-1.5 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading...
          </div>
        ) : (
          <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-gray-900">{value || "Not set"}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
    </button>
  )
}

export function QuickLinkRow({ icon: Icon, label, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-gray-50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
        <Icon className="h-4 w-4 text-gray-700" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-gray-500">{description}</p> : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
    </button>
  )
}

export function StatChip({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl bg-[var(--rt-primary-soft)] px-3 py-2.5">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-[var(--rt-primary-strong)]" /> : null}
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      </div>
      <p className="mt-1 text-base font-bold text-gray-900">{value}</p>
    </div>
  )
}
