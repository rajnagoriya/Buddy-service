import { DAY_NAMES, formatTime12Hour, getDefaultDays } from "@food/utils/outletTimingsUtils"

export default function OutletTimingsEditor({ value, onChange, compact = false }) {
  const days = { ...getDefaultDays(), ...(value && typeof value === "object" ? value : {}) }

  const updateDay = (day, patch) => {
    onChange?.({
      ...days,
      [day]: {
        ...(days[day] || getDefaultDays()[day]),
        ...patch,
      },
    })
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold text-slate-700">Weekly outlet timings</p>
        <p className="text-[11px] text-slate-500">Set open/close hours for each day</p>
      </div>
      <div className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        {DAY_NAMES.map((day) => {
          const dayData = days[day] || getDefaultDays()[day]
          const isOpen = dayData.isOpen !== false
          return (
            <div key={day} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">{day}</span>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => {
                      const nextOpen = e.target.checked
                      updateDay(day, {
                        isOpen: nextOpen,
                        openingTime: nextOpen ? dayData.openingTime || "09:00" : "",
                        closingTime: nextOpen ? dayData.closingTime || "22:00" : "",
                      })
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  Open
                </label>
              </div>
              {isOpen ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Open</label>
                    <input
                      type="time"
                      value={dayData.openingTime || "09:00"}
                      onChange={(e) => updateDay(day, { openingTime: e.target.value })}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Close</label>
                    <input
                      type="time"
                      value={dayData.closingTime || "22:00"}
                      onChange={(e) => updateDay(day, { closingTime: e.target.value })}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[11px] font-medium text-rose-500">Closed</p>
              )}
              {isOpen && dayData.openingTime && dayData.closingTime ? (
                <p className="mt-1.5 text-[10px] text-slate-500">
                  {formatTime12Hour(dayData.openingTime)} – {formatTime12Hour(dayData.closingTime)}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
