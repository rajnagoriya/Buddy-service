import { Pencil, ThumbsUp, Utensils } from "lucide-react"
import { Switch } from "@food/components/ui/switch"

export default function MenuItemGridCard({
  item,
  category,
  approvalMeta,
  isRejectedItem,
  onEdit,
  onRecommendToggle,
  onToggleStock,
}) {
  const hasImage = item.image && typeof item.image === 'string' && item.image.trim() !== '' && item.image !== 'null' && item.image !== 'undefined';

  return (
    <article className="rt-panel-surface flex h-full flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-md rounded-2xl border border-slate-100/50">
      <div className="relative aspect-[16/10] bg-[var(--rt-surface-muted)] flex items-center justify-center overflow-hidden">
        {hasImage ? (
          <img
            src={item.image}
            alt={item.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              const fallback = e.target.nextSibling;
              if (fallback) {
                fallback.style.display = 'flex';
              }
            }}
          />
        ) : null}
        <div
          className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-3 text-center"
          style={{ display: hasImage ? 'none' : 'flex' }}
        >
          <Utensils className="h-6 w-6 mb-1 text-slate-300" />
          <span className="text-[10px] font-semibold text-slate-500 line-clamp-2 px-2">{item.name}</span>
        </div>
        <div className="absolute left-2.5 top-2.5 flex gap-1">
          <span
            className={`rounded px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider ${
              item.isVeg ? "bg-green-600 text-white" : "bg-red-500 text-white"
            }`}
          >
            {item.isVeg ? "Veg" : "Non-veg"}
          </span>
          {!item.inStock ? (
            <span className="rounded bg-gray-900/80 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-white">
              Paused
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h4 className="line-clamp-1 text-sm font-bold text-gray-900">{item.name}</h4>
        <p className="mt-0.5 text-base font-extrabold text-[var(--rt-primary-strong)]">
          ₹{Number(item.price || 0).toFixed(0)}
        </p>
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
          <span className={`inline-flex w-fit rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${approvalMeta.className}`}>
            {approvalMeta.label}
          </span>
          {item.categoryDisabled ? (
            <span className="inline-flex w-fit rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
              {item.categoryDisabledByAdmin ? "Category disabled by admin" : "Category disabled"}
            </span>
          ) : null}
        </div>

        {item.description && (
          <p className="mt-2 line-clamp-2 text-xs text-gray-500 leading-snug">
            {item.description}
          </p>
        )}

        <p className="mt-1.5 text-[11px] text-gray-500 font-medium">
          Stock: <span className="font-bold text-gray-700">{item.stockQuantity || "Unlimited"}</span> {item.stockQuantity !== "Unlimited" && item.unit ? `${item.unit}(s)` : ""}
        </p>

        {item.variants && item.variants.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.variants.map((v, i) => (
              <span key={v.id || i} className="inline-flex items-center gap-1 rounded bg-slate-50 border border-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                {v.name}: ₹{v.price}{v.unit ? ` / ${v.unit}` : ''}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-slate-50 mt-3">
          <button
            type="button"
            onClick={() => onRecommendToggle(category.id, item.id)}
            className={`rounded-lg border p-1.5 ${
              item.isRecommended
                ? "border-blue-200 bg-blue-50 text-blue-600"
                : "border-[var(--rt-border)] text-gray-400"
            }`}
            aria-label="Recommend item"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>

          <Switch
            checked={item.inStock}
            onCheckedChange={(checked) => onToggleStock(category.id, item.id, checked)}
            className="data-[state=checked]:bg-[var(--rt-primary-strong)] scale-90"
          />

          <button
            type="button"
            onClick={() => onEdit(category, item)}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              isRejectedItem
                ? "bg-red-600 text-white"
                : "bg-[var(--rt-primary-soft)] text-[var(--rt-primary-strong)]"
            }`}
          >
            <Pencil className="h-3 w-3" />
            {isRejectedItem ? "Fix" : "Edit"}
          </button>
        </div>
      </div>
    </article>
  )
}
