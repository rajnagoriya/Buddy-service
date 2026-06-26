import { ChevronRight, Loader2, Pencil } from "lucide-react"
import { PanelSurface } from "@food/components/restaurant/panel/panelUi"

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

export function EditableSection({
  title,
  description,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  saving = false,
  saveDisabled = false,
  editDisabled = false,
  children,
  readContent,
  className = "",
}) {
  return (
    <PanelSurface className={`p-4 sm:p-5 ${className}`}>
      <SectionHeader
        title={title}
        description={!isEditing ? description : null}
        action={
          !isEditing ? (
            <button
              type="button"
              onClick={onEdit}
              disabled={editDisabled}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--rt-border)] text-gray-500 transition hover:border-[var(--rt-primary-strong)] hover:bg-[var(--rt-primary-soft)] hover:text-[var(--rt-primary-strong)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Edit ${title}`}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null
        }
      />
      {isEditing ? (
        <div className="space-y-4">
          {children}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || saveDisabled}
              className="flex-1 rounded-xl bg-[var(--rt-primary-strong)] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        readContent
      )}
    </PanelSurface>
  )
}

export function PendingReviewBanner({ message, fields = [], isRejected = false, reason = "" }) {
  if (!message && fields.length === 0 && !isRejected) return null
  
  const borderColor = isRejected ? "border-rose-200" : "border-amber-200"
  const bgColor = isRejected ? "bg-rose-50" : "bg-amber-50"
  const textColor = isRejected ? "text-rose-900" : "text-amber-900"
  const labelColor = isRejected ? "text-rose-800" : "text-amber-800"
  const tagBorder = isRejected ? "border-rose-200" : "border-amber-200"

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} px-4 py-3 text-sm ${textColor}`}>
      {isRejected ? (
        <div className="mb-2">
          <p className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}>
            Profile Update Rejected
          </p>
          <p className="mt-1 font-medium">{reason || "Your requested changes were rejected."}</p>
        </div>
      ) : message ? (
        <p>{message}</p>
      ) : null}
      
      {fields.length > 0 ? (
        <div className="mt-2">
          {!isRejected && (
            <p className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}>
              Pending admin approval
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {fields.map((field) => (
              <span
                key={field}
                className={`rounded-full border ${tagBorder} bg-white px-2.5 py-0.5 text-xs font-medium ${textColor}`}
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function InfoRow({ icon: Icon, label, value, onClick, loading = false }) {
  const content = (
    <>
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
      {onClick ? <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" /> : null}
    </>
  )

  if (!onClick) {
    return <div className="flex w-full items-center gap-3 px-3 py-3">{content}</div>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition hover:border-[var(--rt-border)] hover:bg-gray-50"
    >
      {content}
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
