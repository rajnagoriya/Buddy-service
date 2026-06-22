export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export const getDefaultDays = () => ({
  Monday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Tuesday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Wednesday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Thursday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Friday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Saturday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Sunday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
})

export const formatTime12Hour = (time24) => {
  if (!time24) return ""
  const [hours, minutes] = time24.split(":").map(Number)
  const period = hours >= 12 ? "pm" : "am"
  const hours12 = hours % 12 || 12
  const minutesStr = minutes.toString().padStart(2, "0")
  return `${hours12}:${minutesStr} ${period}`
}

export const stringToTime = (timeString) => {
  if (!timeString || !timeString.includes(":")) {
    return new Date(2000, 0, 1, 9, 0)
  }
  const [hours, minutes] = timeString.split(":").map(Number)
  const validHours = Math.max(0, Math.min(23, hours || 9))
  const validMinutes = Math.max(0, Math.min(59, minutes || 0))
  return new Date(2000, 0, 1, validHours, validMinutes)
}

export const timeToString = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return "09:00"
  }
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

export const getTodayName = () => new Date().toLocaleDateString("en-US", { weekday: "long" })

export const evaluateOutletTimingState = (outletTimings, now = new Date()) => {
  const currentDayFull = now.toLocaleDateString("en-US", { weekday: "long" })
  const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes()

  if (!outletTimings?.[currentDayFull]) {
    return { isDayClosed: false, isWithinTimings: true, currentDayFull, todayData: null }
  }

  const dayData = outletTimings[currentDayFull]
  if (dayData.isOpen === false) {
    return { isDayClosed: true, isWithinTimings: false, currentDayFull, todayData: dayData }
  }

  if (!dayData.openingTime || !dayData.closingTime) {
    return { isDayClosed: false, isWithinTimings: true, currentDayFull, todayData: dayData }
  }

  const [openHour, openMinute] = dayData.openingTime.split(":").map(Number)
  const [closeHour, closeMinute] = dayData.closingTime.split(":").map(Number)
  const openingTimeInMinutes = openHour * 60 + openMinute
  const closingTimeInMinutes = closeHour * 60 + closeMinute

  let isWithin = false
  if (closingTimeInMinutes > openingTimeInMinutes) {
    isWithin =
      currentTimeInMinutes >= openingTimeInMinutes && currentTimeInMinutes <= closingTimeInMinutes
  } else {
    isWithin =
      currentTimeInMinutes >= openingTimeInMinutes || currentTimeInMinutes <= closingTimeInMinutes
  }

  return { isDayClosed: false, isWithinTimings: isWithin, currentDayFull, todayData: dayData }
}

export const getTodaySlotLabel = (outletTimings, now = new Date()) => {
  const { isDayClosed, todayData } = evaluateOutletTimingState(outletTimings, now)
  if (isDayClosed) return "Closed today"
  if (!todayData?.openingTime || !todayData?.closingTime) return "Not configured"
  const dateStr = now.toLocaleDateString("en-US", { day: "numeric", month: "short" })
  return `${dateStr}, ${formatTime12Hour(todayData.openingTime)} – ${formatTime12Hour(todayData.closingTime)}`
}
