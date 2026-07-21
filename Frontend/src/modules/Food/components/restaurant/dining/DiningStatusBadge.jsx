import { getDiningStatusMeta } from "./diningUi"

export default function DiningStatusBadge({ status, className = "" }) {
  const meta = getDiningStatusMeta(status)
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className} ${className}`}
    >
      {meta.label}
    </span>
  )
}
