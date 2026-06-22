import { Loader2, Plus, Trash2 } from "lucide-react"
import { SectionHeader } from "./outletInfoUi"

export default function OutletPhotoGallery({
  coverImages,
  uploadingImage,
  imageType,
  onAddClick,
  onDelete,
}) {
  return (
    <div>
      <SectionHeader
        title="Outlet photos"
        description="Shown on your restaurant page. First photo is used as the main banner."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {coverImages.map((image, index) => (
          <div
            key={`${image.url}-${index}`}
            className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--rt-border)] bg-gray-100"
          >
            <img src={image.url} alt={`Outlet ${index + 1}`} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />

            {index === 0 ? (
              <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Banner
              </span>
            ) : null}

            <button
              type="button"
              onClick={() => onDelete(index)}
              className="absolute right-2 top-2 rounded-lg bg-white/95 p-1.5 text-red-600 opacity-100 shadow-sm transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
              aria-label="Delete photo"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={onAddClick}
          disabled={uploadingImage && imageType === "menu"}
          className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--rt-border)] text-gray-400 transition hover:border-[var(--rt-primary-strong)] hover:bg-[var(--rt-primary-soft)]/40 hover:text-[var(--rt-primary-strong)] disabled:opacity-60"
        >
          {uploadingImage && imageType === "menu" ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Plus className="h-6 w-6" />
          )}
          <span className="text-xs font-semibold">Add photo</span>
        </button>
      </div>
    </div>
  )
}
