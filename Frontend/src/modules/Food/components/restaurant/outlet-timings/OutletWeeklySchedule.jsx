import { forwardRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, ChevronUp, Clock } from "lucide-react"
import { PanelSurface } from "@food/components/restaurant/panel/panelUi"
import { Switch } from "@food/components/ui/switch"
import { MobileTimePicker } from "@mui/x-date-pickers/MobileTimePicker"
import {
  DAY_NAMES,
  formatTime12Hour,
  stringToTime,
  timeToString,
} from "@food/utils/outletTimingsUtils"

const timePickerSx = {
  "& .MuiOutlinedInput-root": {
    height: "40px",
    fontSize: "13px",
    backgroundColor: "white",
    "& fieldset": { borderColor: "#e5e7eb" },
    "&:hover fieldset": { borderColor: "#d1d5db" },
    "&.Mui-focused fieldset": { borderColor: "var(--rt-primary-strong, #27A344)" },
  },
  "& .MuiInputBase-input": { padding: "8px 12px", fontSize: "13px" },
}

const OutletWeeklySchedule = forwardRef(function OutletWeeklySchedule(
  {
    days,
    expandedDay,
    onToggleDay,
    onToggleDayOpen,
    onTimeChange,
    todayName,
  },
  ref,
) {
  return (
    <div ref={ref} className="scroll-mt-24">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Weekly schedule</h2>
        <p className="mt-0.5 text-xs text-gray-500">Set opening and closing hours for each day</p>
      </div>

      <div className="space-y-2">
        {DAY_NAMES.map((day, index) => {
          const dayData = days[day] || { isOpen: true, openingTime: "09:00", closingTime: "22:00" }
          const isExpanded = expandedDay === day
          const isToday = day === todayName

          return (
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.02 }}
            >
              <PanelSurface
                className={`overflow-hidden p-0 ${isToday ? "ring-1 ring-[var(--rt-primary-strong)]/30" : ""}`}
              >
                <div
                  className={`flex w-full items-center justify-between px-4 py-3 transition-colors ${
                    isExpanded ? "bg-gray-50" : "hover:bg-gray-50/80"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleDay(day)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-600" />
                    )}
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{day}</span>
                      {isToday ? (
                        <span className="ml-2 rounded-md bg-[var(--rt-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--rt-primary-strong)]">
                          Today
                        </span>
                      ) : null}
                      {!isExpanded && dayData.isOpen ? (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {formatTime12Hour(dayData.openingTime)} – {formatTime12Hour(dayData.closingTime)}
                        </p>
                      ) : null}
                      {!isExpanded && !dayData.isOpen ? (
                        <p className="mt-0.5 text-xs text-gray-500">Closed</p>
                      ) : null}
                    </div>
                  </button>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-gray-500">{dayData.isOpen ? "Open" : "Closed"}</span>
                    <Switch
                      checked={dayData.isOpen}
                      onCheckedChange={() => onToggleDayOpen(day)}
                      className="data-[state=checked]:bg-[var(--rt-primary-strong)] data-[state=unchecked]:bg-gray-300"
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 border-t border-[var(--rt-border)] p-4">
                        {dayData.isOpen ? (
                          <>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <Clock className="h-4 w-4" />
                                Opening time
                              </label>
                              <MobileTimePicker
                                value={stringToTime(dayData.openingTime)}
                                onChange={(newValue) => {
                                  if (newValue) onTimeChange(day, "openingTime", newValue)
                                }}
                                onAccept={(newValue) => {
                                  if (newValue) onTimeChange(day, "openingTime", newValue)
                                }}
                                slotProps={{
                                  textField: {
                                    variant: "outlined",
                                    size: "small",
                                    fullWidth: true,
                                    placeholder: "Select opening time",
                                    sx: timePickerSx,
                                  },
                                }}
                                format="hh:mm a"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <Clock className="h-4 w-4" />
                                Closing time
                              </label>
                              <MobileTimePicker
                                value={stringToTime(dayData.closingTime)}
                                onChange={(newValue) => {
                                  if (newValue) onTimeChange(day, "closingTime", newValue)
                                }}
                                onAccept={(newValue) => {
                                  if (newValue) onTimeChange(day, "closingTime", newValue)
                                }}
                                slotProps={{
                                  textField: {
                                    variant: "outlined",
                                    size: "small",
                                    fullWidth: true,
                                    placeholder: "Select closing time",
                                    sx: timePickerSx,
                                  },
                                }}
                                format="hh:mm a"
                              />
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">This day is marked closed.</p>
                        )}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </PanelSurface>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
})

export default OutletWeeklySchedule
