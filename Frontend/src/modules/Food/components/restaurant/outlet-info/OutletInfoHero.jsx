import { Loader2, Pencil, Plus, Star } from "lucide-react"

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop"

export default function OutletInfoHero({
  mainImage,
  thumbnailImage,
  restaurantName,
  rating,
  totalRatings,
  loading,
  uploadingImage,
  imageType,
  onCoverClick,
  onProfileClick,
  menuImageInputRef,
  profileImageInputRef,
  onCoverFiles,
  onProfileFile,
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--rt-border)] bg-white shadow-sm lg:rounded-[var(--rt-radius-xl)]">
      <div className="relative h-40 sm:h-48 lg:h-52">
        <img
          src={mainImage || FALLBACK_COVER}
          alt="Restaurant cover"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

        <button
          type="button"
          onClick={onCoverClick}
          disabled={uploadingImage}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/20 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/30 disabled:opacity-60"
        >
          {uploadingImage && imageType === "menu" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          <span>{uploadingImage && imageType === "menu" ? "Uploading..." : "Add cover"}</span>
        </button>
        <input
          ref={menuImageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onCoverFiles(Array.from(e.target.files || []))}
        />
      </div>

      <div className="relative px-4 pb-4 pt-0">
        <div className="-mt-10 flex items-end gap-4">
          <div className="relative shrink-0">
            <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md sm:h-24 sm:w-24">
              <img src={thumbnailImage} alt="Restaurant logo" className="h-full w-full object-cover" />
            </div>
            <button
              type="button"
              onClick={onProfileClick}
              disabled={uploadingImage}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--rt-primary-strong)] text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
              aria-label="Update profile photo"
            >
              {uploadingImage && imageType === "profile" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              ref={profileImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onProfileFile(e.target.files?.[0])}
            />
          </div>

          <div className="min-w-0 flex-1 pb-1">
            <h1 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
              {loading ? "Loading..." : restaurantName || "My Restaurant"}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--rt-primary-strong)] px-2 py-0.5 text-xs font-bold text-white">
                {rating?.toFixed(1) || "0.0"}
                <Star className="h-3 w-3 fill-white" />
              </span>
              <span className="text-xs text-gray-500">{totalRatings || 0} reviews</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
