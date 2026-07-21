import { useCallback, useEffect, useMemo, useState } from "react"
import { Settings } from "lucide-react"
import { diningAPI, restaurantAPI } from "@food/api"
import Loader from "@food/components/Loader"
import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import DiningReservationFilters from "@food/components/restaurant/dining/DiningReservationFilters"
import DiningReservationsTable from "@food/components/restaurant/dining/DiningReservationsTable"
import DiningSettingsPanel from "@food/components/restaurant/dining/DiningSettingsPanel"
import {
  countByDiningStatus,
  filterDiningBookings,
} from "@food/components/restaurant/dining/diningUi"
import { toast } from "sonner"

const getRestaurantFromResponse = (response) =>
  response?.data?.data?.restaurant ||
  response?.data?.restaurant ||
  response?.data?.data ||
  null

export default function DiningReservations() {
  const [view, setView] = useState("list") // list | settings
  const [loading, setLoading] = useState(true)
  const [restaurant, setRestaurant] = useState(null)
  const [bookings, setBookings] = useState([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [updatingId, setUpdatingId] = useState(null)

  const loadData = useCallback(async () => {
    const resResponse = await restaurantAPI.getCurrentRestaurant()
    if (!resResponse?.data?.success) return

    const resData = getRestaurantFromResponse(resResponse)
    setRestaurant(resData)

    const bookingsResponse = await diningAPI.getRestaurantBookings(resData)
    if (bookingsResponse?.data?.success) {
      const payload = bookingsResponse.data.data
      setBookings(Array.isArray(payload) ? payload : payload?.bookings || [])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        setLoading(true)
        await loadData()
      } catch (error) {
        if (!cancelled) {
          toast.error(error?.response?.data?.message || "Failed to load reservations")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [loadData])

  const counts = useMemo(() => countByDiningStatus(bookings), [bookings])
  const filteredBookings = useMemo(
    () => filterDiningBookings(bookings, { statusFilter, search }),
    [bookings, statusFilter, search]
  )

  const handleStatusUpdate = async (bookingId, nextStatus) => {
    try {
      setUpdatingId(bookingId)
      const response = await diningAPI.updateBookingStatusRestaurant(bookingId, nextStatus)
      if (response?.data?.success) {
        const updated = response.data.data
        setBookings((prev) =>
          prev.map((booking) =>
            String(booking._id || booking.id) === String(bookingId)
              ? { ...booking, ...(updated || {}), status: updated?.status || nextStatus }
              : booking
          )
        )
        toast.success("Reservation updated")
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update status")
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) return <Loader />

  if (view === "settings") {
    return (
      <RestaurantSubPageShell
        title="Dining settings"
        subtitle="Manage dining availability, tables, and slots"
      >
        <DiningSettingsPanel
          restaurant={restaurant}
          onBack={() => setView("list")}
          onRestaurantUpdated={loadData}
        />
      </RestaurantSubPageShell>
    )
  }

  return (
    <RestaurantSubPageShell
      title="Dining reservations"
      subtitle="Incoming table bookings"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{counts.all} total bookings</p>
        <button
          type="button"
          onClick={() => setView("settings")}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Settings className="h-4 w-4" />
          Dining settings
        </button>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <DiningReservationFilters
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          search={search}
          onSearchChange={setSearch}
          counts={counts}
        />
      </div>

      <DiningReservationsTable
        bookings={filteredBookings}
        onStatusUpdate={handleStatusUpdate}
        updatingId={updatingId}
      />
    </RestaurantSubPageShell>
  )
}
