import { Calendar, Clock, MessageSquare, Phone, Users } from "lucide-react"
import DiningStatusBadge from "./DiningStatusBadge"
import {
  formatBookingDate,
  getBookerName,
  getBookerPhone,
  getStatusActions,
} from "./diningUi"

function ActionButtons({ booking, onStatusUpdate, updatingId }) {
  const actions = getStatusActions(booking?.status)
  if (!actions.length) return <span className="text-xs text-slate-400">—</span>

  const busy = updatingId && String(updatingId) === String(booking?._id || booking?.id)

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {actions.map((action) => (
        <button
          key={action.status}
          type="button"
          disabled={busy}
          onClick={() => onStatusUpdate?.(booking._id || booking.id, action.status)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            action.tone === "danger"
              ? "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
              : "bg-slate-900 text-white hover:bg-slate-800"
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

export default function DiningReservationsTable({
  bookings = [],
  onStatusUpdate,
  updatingId = null,
}) {
  if (!bookings.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
        <Calendar className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-4 text-base font-semibold text-slate-800">No reservations</h3>
        <p className="mt-1 text-sm text-slate-500">
          Incoming dining bookings will show up here.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Booking
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Guest
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Schedule
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Guests
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((booking) => {
                const id = booking._id || booking.id
                return (
                  <tr key={id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4 align-top">
                      <p className="font-mono text-xs font-semibold text-slate-700">
                        #{booking.bookingId || booking.reservationNumber || "—"}
                      </p>
                      {booking.reservationNumber ? (
                        <p className="mt-1 text-[11px] text-slate-400">
                          {booking.reservationNumber}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="font-medium text-slate-900">{getBookerName(booking)}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="h-3 w-3" />
                        {getBookerPhone(booking) || "No phone"}
                      </p>
                      {booking.specialRequest ? (
                        <p className="mt-2 flex items-start gap-1 text-xs text-slate-500">
                          <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="line-clamp-2">{booking.specialRequest}</span>
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="flex items-center gap-1.5 text-sm text-slate-700">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {formatBookingDate(booking.date)}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {booking.timeSlot || "—"}
                      </p>
                      {booking.table?.name || booking.tableSnapshot?.name ? (
                        <p className="mt-1 text-xs text-slate-400">
                          {booking.table?.name || booking.tableSnapshot?.name}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        <Users className="h-3 w-3" />
                        {booking.guests || 1}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <DiningStatusBadge status={booking.status} />
                    </td>
                    <td className="px-4 py-4 align-top text-right">
                      <ActionButtons
                        booking={booking}
                        onStatusUpdate={onStatusUpdate}
                        updatingId={updatingId}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {bookings.map((booking) => {
          const id = booking._id || booking.id
          return (
            <div key={id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{getBookerName(booking)}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                    #{booking.bookingId || booking.reservationNumber || "—"}
                  </p>
                </div>
                <DiningStatusBadge status={booking.status} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {formatBookingDate(booking.date)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {booking.timeSlot || "—"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  {booking.guests || 1} guests
                </span>
                <span className="flex items-center gap-1.5 truncate">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {getBookerPhone(booking) || "No phone"}
                </span>
              </div>

              {booking.specialRequest ? (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {booking.specialRequest}
                </p>
              ) : null}

              <div className="mt-3">
                <ActionButtons
                  booking={booking}
                  onStatusUpdate={onStatusUpdate}
                  updatingId={updatingId}
                />
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
