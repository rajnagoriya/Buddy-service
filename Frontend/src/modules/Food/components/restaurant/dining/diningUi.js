export const DINING_STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "accepted", label: "Accepted" },
  { id: "checked-in", label: "Checked in" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "today", label: "Today" },
]

export function normalizeDiningStatus(status) {
  const key = String(status || "").trim().toLowerCase()
  if (key === "confirmed") return "accepted"
  if (key === "checked_in") return "checked-in"
  return key || "pending"
}

export function getDiningStatusMeta(status) {
  const key = normalizeDiningStatus(status)
  const map = {
    pending: {
      label: "Pending",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    },
    accepted: {
      label: "Accepted",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    "checked-in": {
      label: "Checked in",
      className: "bg-orange-50 text-orange-700 border-orange-200",
    },
    completed: {
      label: "Completed",
      className: "bg-blue-50 text-blue-700 border-blue-200",
    },
    rejected: {
      label: "Rejected",
      className: "bg-rose-50 text-rose-700 border-rose-200",
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-slate-100 text-slate-600 border-slate-200",
    },
    no_show: {
      label: "No show",
      className: "bg-rose-50 text-rose-700 border-rose-200",
    },
  }
  return map[key] || { label: key || "Unknown", className: "bg-slate-100 text-slate-600 border-slate-200" }
}

export function getBookerName(booking) {
  return String(
    booking?.user?.name ||
      booking?.guestInfo?.name ||
      booking?.customerName ||
      booking?.bookedBy?.name ||
      booking?.name ||
      "Guest"
  ).trim()
}

export function getBookerPhone(booking) {
  return String(
    booking?.user?.phone ||
      booking?.guestInfo?.phone ||
      booking?.phone ||
      booking?.phoneNumber ||
      booking?.mobile ||
      booking?.bookedBy?.phone ||
      ""
  ).trim()
}

export function formatBookingDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number)
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function isBookingToday(value) {
  if (!value) return false
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const today = new Date()
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
    return value === key
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return date.toDateString() === new Date().toDateString()
}

export function getStatusActions(status) {
  const key = normalizeDiningStatus(status)
  if (key === "pending") {
    return [
      { status: "accepted", label: "Accept", tone: "primary" },
      { status: "cancelled", label: "Decline", tone: "danger" },
    ]
  }
  if (key === "accepted") {
    return [
      { status: "checked-in", label: "Check-in", tone: "primary" },
      { status: "cancelled", label: "Cancel", tone: "danger" },
    ]
  }
  if (key === "checked-in") {
    return [{ status: "completed", label: "Complete", tone: "primary" }]
  }
  return []
}

export function countByDiningStatus(bookings = []) {
  const counts = {
    all: bookings.length,
    pending: 0,
    accepted: 0,
    "checked-in": 0,
    completed: 0,
    cancelled: 0,
    today: 0,
  }

  for (const booking of bookings) {
    const status = normalizeDiningStatus(booking?.status)
    if (status === "rejected" || status === "no_show") {
      counts.cancelled += 1
    } else if (counts[status] !== undefined) {
      counts[status] += 1
    }
    if (isBookingToday(booking?.date)) counts.today += 1
  }

  return counts
}

export function filterDiningBookings(bookings = [], { statusFilter = "all", search = "" } = {}) {
  const term = String(search || "").trim().toLowerCase()

  return bookings
    .filter((booking) => {
      if (statusFilter === "all") return true
      if (statusFilter === "today") return isBookingToday(booking?.date)
      if (statusFilter === "cancelled") {
        const status = normalizeDiningStatus(booking?.status)
        return ["cancelled", "rejected", "no_show"].includes(status)
      }
      return normalizeDiningStatus(booking?.status) === statusFilter
    })
    .filter((booking) => {
      if (!term) return true
      return (
        getBookerName(booking).toLowerCase().includes(term) ||
        getBookerPhone(booking).toLowerCase().includes(term) ||
        String(booking?.bookingId || "").toLowerCase().includes(term) ||
        String(booking?.reservationNumber || "").toLowerCase().includes(term)
      )
    })
    .sort((a, b) => {
      const aPending = normalizeDiningStatus(a?.status) === "pending" ? 0 : 1
      const bPending = normalizeDiningStatus(b?.status) === "pending" ? 0 : 1
      if (aPending !== bPending) return aPending - bPending
      return new Date(b?.createdAt || b?.date || 0) - new Date(a?.createdAt || a?.date || 0)
    })
}
