import { useState } from "react"
import { AlertCircle, FileText } from "lucide-react"
import RestaurantPanelModal from "@food/components/restaurant/panel/RestaurantPanelModal"

const formatAddress = (doc) => {
  if (!doc) return "—"
  const loc = doc?.location || {}
  const parts = [
    doc?.addressLine1 || loc.addressLine1,
    doc?.addressLine2 || loc.addressLine2,
    doc?.area || loc.area,
    doc?.city || loc.city,
    doc?.pincode || loc.pincode,
    doc?.landmark || loc.landmark,
  ].filter(Boolean)
  return parts.join(", ") || "—"
}

const imageUrl = (value) => {
  if (!value) return ""
  if (typeof value === "string") return value
  if (Array.isArray(value) && value[0]) return imageUrl(value[0])
  return value?.url || ""
}

const imageUrls = (value) => {
  if (!value) return []
  if (typeof value === "string") return value ? [value] : []
  if (Array.isArray(value)) {
    return value.map((item) => imageUrl(item)).filter(Boolean)
  }
  const single = imageUrl(value)
  return single ? [single] : []
}

const dietaryLabel = (doc) => {
  if (!doc) return "—"
  if (doc?.pureVegRestaurant === true) return "Pure Veg"
  if (doc?.dietaryType) return String(doc.dietaryType).replace(/_/g, " ")
  if (doc?.pureVegRestaurant === false) return "Non-Veg / Mixed"
  return "—"
}

const formatValue = (field, value, doc) => {
  if (value === undefined || value === null || value === "") return "—"
  if (typeof value === "object") {
    if (field === "location") return formatAddress({ location: value, ...doc })
    return "—"
  }
  if (field === "cuisines" && Array.isArray(value)) return value.join(", ") || "—"
  if (field === "location") return formatAddress({ location: value, ...doc })
  if (field === "pureVegRestaurant" || field === "dietaryType") return dietaryLabel(doc)
  if (field === "accountNumber") return value ? `••••${String(value).slice(-4)}` : "—"
  return String(value)
}

function ImagePreviewGrid({ urls, emptyLabel = "—" }) {
  if (!urls.length) {
    return <span className="text-sm text-slate-500">{emptyLabel}</span>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-white"
        >
          <img src={url} alt="" className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  )
}

function ChangeRow({ label, current, proposed, currentImages, proposedImages, isRejected }) {
  const hasImages = Boolean(currentImages?.length || proposedImages?.length)
  const currentText = String(current ?? "—")
  const proposedText = String(proposed ?? "—")

  if (!hasImages && currentText === proposedText) return null
  if (hasImages && imageUrls(currentImages).join("|") === imageUrls(proposedImages).join("|")) return null

  const borderColor = isRejected ? "border-rose-100" : "border-amber-100"
  const bgColor = isRejected ? "bg-rose-50/50" : "bg-amber-50/50"
  const labelColor = isRejected ? "text-rose-800" : "text-amber-800"
  const proposedBorder = isRejected ? "border-rose-200" : "border-amber-200"
  const proposedLabelColor = isRejected ? "text-rose-600" : "text-amber-600"

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-3`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${labelColor}`}>{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-100 bg-white px-3 py-2">
          <p className="text-[9px] font-semibold uppercase text-slate-400">Live details</p>
          {hasImages ? (
            <div className="mt-2">
              <ImagePreviewGrid urls={imageUrls(currentImages)} emptyLabel="No image" />
            </div>
          ) : (
            <p className="mt-0.5 break-words text-sm text-slate-700">{currentText}</p>
          )}
        </div>
        <div className={`rounded-lg border ${proposedBorder} bg-white px-3 py-2`}>
          <p className={`text-[9px] font-semibold uppercase ${proposedLabelColor}`}>
            Requested change
          </p>
          {hasImages ? (
            <div className="mt-2">
              <ImagePreviewGrid urls={imageUrls(proposedImages)} emptyLabel="No image" />
            </div>
          ) : (
            <p className="mt-0.5 break-words text-sm font-semibold text-slate-900">{proposedText}</p>
          )}
        </div>
      </div>
    </div>
  )
}

const FIELD_LABELS = {
  restaurantName: "Restaurant name",
  ownerName: "Full name (owner)",
  location: "Location",
  cuisines: "Cuisines",
  pureVegRestaurant: "Non-Veg / Mixed",
  dietaryType: "Dietary type",
  profileImage: "Profile image",
  coverImages: "Outlet photos",
  panNumber: "PAN number",
  nameOnPan: "Name on PAN",
  fssaiNumber: "FSSAI number",
  accountHolderName: "Account holder",
  accountNumber: "Account number",
  ifscCode: "IFSC",
  upiId: "UPI ID",
}

const HIDDEN_FIELDS = new Set([
  "imagePublicIds",
  "restaurantNameNormalized",
  "_approvedSnapshot",
  "pendingFields",
  "pendingUpdateReason",
  "submittedAt",
  "area",
  "city",
  "state",
  "pincode",
  "addressLine1",
  "addressLine2",
  "landmark",
])

const LOCATION_FIELDS = new Set(["location", "area", "city", "state", "pincode", "addressLine1", "addressLine2", "landmark"])
const IMAGE_FIELDS = new Set(["profileImage", "coverImages"])

export default function RequestedChangesPanel({ restaurant, className = "" }) {
  const [isOpen, setIsOpen] = useState(false)
  const pending = restaurant?.pendingProfile || {}
  const isRejected = restaurant?.profileReviewStatus === "rejected" || restaurant?.status === "rejected"
  
  if (!restaurant?.pendingProfile && !isRejected) return null

  const snapshot = pending._approvedSnapshot || {}
  const pendingFields = Array.isArray(pending.pendingFields) ? pending.pendingFields : []

  const baseLocation = restaurant?.location || restaurant?.onboarding?.step1?.location || {}
  const liveDoc = {
    ...restaurant,
    ...snapshot,
    location: { ...baseLocation, ...(snapshot.location || {}) },
  }
  const proposedDoc = { ...restaurant, ...pending, location: { ...baseLocation, ...(pending.location || {}) } }

  const normalizedFields = []
  const hasLocationChange = pendingFields.some((f) => LOCATION_FIELDS.has(f))
  if (hasLocationChange) normalizedFields.push("location")

  for (const field of pendingFields) {
    if (HIDDEN_FIELDS.has(field)) continue
    if (LOCATION_FIELDS.has(field)) continue
    if (!normalizedFields.includes(field)) normalizedFields.push(field)
  }

  const rows = normalizedFields.map((field) => {
    if (field === "location") {
      return {
        label: FIELD_LABELS.location,
        current: formatAddress(liveDoc),
        proposed: formatAddress(proposedDoc),
      }
    }

    const getFallbackValue = (field) => {
      if (restaurant?.[field] !== undefined) return restaurant[field]
      const ob = restaurant?.onboarding || {}
      switch (field) {
        case "ownerName": return ob.step1?.ownerName
        case "restaurantName": return restaurant?.name
        case "cuisines": return ob.step2?.cuisines
        case "dietaryType": return ob.step2?.dietaryType
        case "profileImage": return restaurant?.profileImageUrl?.url || restaurant?.restaurantImage || ob.step2?.profileImage
        case "panNumber": return ob.step3?.pan?.panNumber
        case "nameOnPan": return ob.step3?.pan?.nameOnPan
        case "panImage": return ob.step3?.pan?.image
        case "fssaiNumber": return ob.step3?.fssai?.registrationNumber
        case "fssaiExpiry": return ob.step3?.fssai?.expiryDate
        case "fssaiImage": return ob.step3?.fssai?.image
        case "gstRegistered": return ob.step3?.gst?.isRegistered
        case "gstNumber": return ob.step3?.gst?.gstNumber
        case "gstLegalName": return ob.step3?.gst?.legalName
        case "gstAddress": return ob.step3?.gst?.address
        case "gstImage": return ob.step3?.gst?.image
        case "accountHolderName": return ob.step3?.bank?.accountHolderName
        case "accountNumber": return ob.step3?.bank?.accountNumber
        case "ifscCode": return ob.step3?.bank?.ifscCode
        case "accountType": return ob.step3?.bank?.accountType
        default: return undefined
      }
    }

    const snapshotValue = snapshot[field] ?? getFallbackValue(field)
    const pendingValue = field === "restaurantName" ? pending.restaurantName : pending[field]

    if (IMAGE_FIELDS.has(field)) {
      return {
        label: FIELD_LABELS[field] || field,
        currentImages: snapshotValue,
        proposedImages: pendingValue,
      }
    }

    return {
      label: FIELD_LABELS[field] || field,
      current: formatValue(field, snapshotValue, liveDoc),
      proposed: formatValue(field, pendingValue, proposedDoc),
    }
  })

  const visibleRows = rows.filter((row) => {
    if (row.currentImages || row.proposedImages) {
      return imageUrls(row.currentImages).join("|") !== imageUrls(row.proposedImages).join("|")
    }
    return row.proposed !== "—" && String(row.current) !== String(row.proposed)
  })

  if (visibleRows.length === 0 && !isRejected) return null

  const titleColor = isRejected ? "text-rose-900" : "text-amber-900"
  const subtitleColor = isRejected ? "text-rose-800" : "text-amber-800"
  const panelBg = isRejected ? "bg-rose-50" : "bg-amber-50"
  const panelBorder = isRejected ? "border-rose-200" : "border-amber-200"

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex w-full items-center justify-between gap-4 rounded-xl border ${panelBorder} ${panelBg} p-4 text-left transition hover:opacity-90 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm`}>
            {isRejected ? <AlertCircle className="h-5 w-5 text-rose-600" /> : <FileText className="h-5 w-5 text-amber-600" />}
          </div>
          <div>
            <p className={`text-sm font-bold ${titleColor}`}>
              {isRejected ? "Profile update rejected" : "Requested changes under review"}
            </p>
            <p className={`mt-0.5 text-xs ${subtitleColor}`}>
              {isRejected
                ? "Your requested changes were rejected. View details to see why."
                : "These changes are pending admin approval."}
            </p>
          </div>
        </div>
        <div className={`shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold shadow-sm ${isRejected ? 'text-rose-700' : 'text-amber-700'}`}>
          View Details
        </div>
      </button>

      <RestaurantPanelModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={isRejected ? "Rejected Changes" : "Pending Changes"}
        description={isRejected ? "Review the rejection reason below." : "Live approved data vs your requested changes."}
        size="lg"
      >
        <div className="space-y-5 px-5 py-5">
          {isRejected && (
             <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-800 mb-1">Rejection Reason</p>
                <p className="font-medium">{restaurant.pendingUpdateReason || restaurant.rejectionReason || pending.pendingUpdateReason || "Your requested changes were rejected."}</p>
             </div>
          )}
          <div className="space-y-3">
            {visibleRows.map((row) => (
              <ChangeRow key={row.label} {...row} isRejected={isRejected} />
            ))}
          </div>
        </div>
      </RestaurantPanelModal>
    </>
  )
}
