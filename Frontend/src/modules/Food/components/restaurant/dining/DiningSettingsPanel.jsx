import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { diningAPI, restaurantAPI } from "@food/api"
import { toast } from "sonner"

const TABLE_TYPES = ["standard", "vip", "outdoor", "booth", "bar", "private", "other"]

const DEFAULT_RESERVATION_SETTINGS = {
  slotIntervalMinutes: 30,
  advanceBookingDays: 7,
  cancellationCutoffMinutes: 60,
  autoConfirm: false,
}

function normalizeDiningTypes(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))].sort()
  }
  if (!value) return []
  return [String(value).trim()].filter(Boolean).sort()
}

function buildAvailabilitySnapshot({ isEnabled, maxGuests, diningType }) {
  return {
    isEnabled: Boolean(isEnabled),
    maxGuests: Math.max(0, Number(maxGuests) || 0),
    diningType: normalizeDiningTypes(diningType),
  }
}

function buildReservationSnapshot(settings = {}) {
  return {
    slotIntervalMinutes: Number(settings.slotIntervalMinutes) || 30,
    advanceBookingDays: Number(settings.advanceBookingDays) || 7,
    cancellationCutoffMinutes: Number(settings.cancellationCutoffMinutes) || 60,
    autoConfirm: Boolean(settings.autoConfirm),
  }
}

function isSameSnapshot(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function Section({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400"

export default function DiningSettingsPanel({
  restaurant,
  onBack,
  onRestaurantUpdated,
}) {
  const [diningEnabled, setDiningEnabled] = useState(false)
  const [maxGuests, setMaxGuests] = useState(6)
  const [diningType, setDiningType] = useState([])
  const [categories, setCategories] = useState([])
  const [savingEnablement, setSavingEnablement] = useState(false)
  const [savedAvailability, setSavedAvailability] = useState(() =>
    buildAvailabilitySnapshot({ isEnabled: false, maxGuests: 6, diningType: [] })
  )

  const [reservationSettings, setReservationSettings] = useState(DEFAULT_RESERVATION_SETTINGS)
  const [savedReservationSettings, setSavedReservationSettings] = useState(
    DEFAULT_RESERVATION_SETTINGS
  )
  const [savingReservation, setSavingReservation] = useState(false)

  const [tables, setTables] = useState([])
  const [slots, setSlots] = useState([])
  const [setupLoading, setSetupLoading] = useState(false)
  const [tableForm, setTableForm] = useState({
    name: "",
    tableNumber: "",
    capacity: 2,
    tableType: "standard",
  })
  const [slotForm, setSlotForm] = useState({ timeLabel: "", durationMinutes: 60 })

  useEffect(() => {
    const settings = restaurant?.diningSettings || {}
    const enabled = Boolean(settings.isEnabled)
    const guests = Math.max(1, parseInt(settings.maxGuests, 10) || 6)
    const types = normalizeDiningTypes(settings.diningType)

    setDiningEnabled(enabled)
    setMaxGuests(guests)
    setDiningType(types)
    setSavedAvailability(
      buildAvailabilitySnapshot({
        isEnabled: enabled,
        maxGuests: guests,
        diningType: types,
      })
    )
  }, [restaurant])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const catRes = await diningAPI.getCategories()
        if (cancelled) return

        if (catRes?.data?.success) {
          setCategories(Array.isArray(catRes.data.data) ? catRes.data.data : [])
        }
      } catch {
        // ignore initial load errors
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const loadTablesAndSlots = async () => {
    try {
      setSetupLoading(true)
      const [tablesRes, slotsRes, settingsRes] = await Promise.all([
        diningAPI.listTables().catch(() => null),
        diningAPI.listSlots().catch(() => null),
        diningAPI.getReservationSettings().catch(() => null),
      ])
      setTables(Array.isArray(tablesRes?.data?.data) ? tablesRes.data.data : [])
      setSlots(Array.isArray(slotsRes?.data?.data) ? slotsRes.data.data : [])
      if (settingsRes?.data?.success && settingsRes.data.data) {
        const next = buildReservationSnapshot({
          ...DEFAULT_RESERVATION_SETTINGS,
          ...settingsRes.data.data,
        })
        setReservationSettings(next)
        setSavedReservationSettings(next)
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load dining setup")
    } finally {
      setSetupLoading(false)
    }
  }

  useEffect(() => {
    loadTablesAndSlots()
  }, [])

  const currentAvailability = useMemo(
    () =>
      buildAvailabilitySnapshot({
        isEnabled: diningEnabled,
        maxGuests,
        diningType,
      }),
    [diningEnabled, maxGuests, diningType]
  )

  const currentReservation = useMemo(
    () => buildReservationSnapshot(reservationSettings),
    [reservationSettings]
  )

  const hasCategory = currentAvailability.diningType.length > 0
  const canTurnDiningOn = hasCategory
  const availabilityDirty = !isSameSnapshot(currentAvailability, savedAvailability)
  const reservationDirty = !isSameSnapshot(currentReservation, savedReservationSettings)

  const canSaveAvailability =
    !savingEnablement &&
    availabilityDirty &&
    (!diningEnabled || hasCategory)

  const canSaveReservation = !savingReservation && reservationDirty
  const canAddTable = Boolean(tableForm.name.trim()) && !setupLoading
  const canAddSlot = Boolean(slotForm.timeLabel.trim()) && !setupLoading

  const handleToggleDining = () => {
    if (!diningEnabled && !canTurnDiningOn) {
      toast.error("Select at least one dining category before enabling")
      return
    }
    const next = !diningEnabled
    setDiningEnabled(next)
    if (!next) setMaxGuests(0)
    else if (!maxGuests) setMaxGuests(6)
  }

  const handleSaveEnablement = async () => {
    if (!availabilityDirty) return
    if (diningEnabled && !hasCategory) {
      toast.error("Select at least one dining category")
      return
    }

    try {
      setSavingEnablement(true)
      const payload = {
        isEnabled: diningEnabled,
        maxGuests: diningEnabled ? Math.max(1, Number(maxGuests) || 1) : 0,
        diningType,
      }
      const response = await restaurantAPI.updateDiningSettings(payload)
      if (response?.data?.success) {
        const nextSnapshot = buildAvailabilitySnapshot(payload)
        setSavedAvailability(nextSnapshot)
        setDiningEnabled(nextSnapshot.isEnabled)
        setMaxGuests(nextSnapshot.maxGuests)
        setDiningType(nextSnapshot.diningType)
        toast.success("Dining availability updated")
        onRestaurantUpdated?.()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save dining settings")
    } finally {
      setSavingEnablement(false)
    }
  }

  const handleSaveReservationSettings = async () => {
    if (!reservationDirty) return

    try {
      setSavingReservation(true)
      const payload = {
        slotIntervalMinutes: currentReservation.slotIntervalMinutes,
        advanceBookingDays: currentReservation.advanceBookingDays,
        cancellationCutoffMinutes: currentReservation.cancellationCutoffMinutes,
        autoConfirm: currentReservation.autoConfirm,
        maxGuests: Math.max(1, Number(maxGuests) || 6),
      }
      const response = await diningAPI.updateReservationSettings(payload)
      if (response?.data?.success) {
        const next = buildReservationSnapshot({
          ...payload,
          ...(response.data.data || {}),
        })
        setReservationSettings(next)
        setSavedReservationSettings(next)
        toast.success("Reservation settings saved")
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save reservation settings")
    } finally {
      setSavingReservation(false)
    }
  }

  const handleCreateTable = async () => {
    if (!tableForm.name.trim()) {
      toast.error("Table name is required")
      return
    }
    try {
      await diningAPI.createTable({
        name: tableForm.name.trim(),
        tableNumber: tableForm.tableNumber.trim(),
        capacity: Number(tableForm.capacity) || 2,
        tableType: tableForm.tableType,
      })
      toast.success("Table added")
      setTableForm({ name: "", tableNumber: "", capacity: 2, tableType: "standard" })
      loadTablesAndSlots()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to add table")
    }
  }

  const handleDeleteTable = async (tableId) => {
    try {
      await diningAPI.deleteTable(tableId)
      toast.success("Table deleted")
      loadTablesAndSlots()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete table")
    }
  }

  const handleCreateSlot = async () => {
    if (!slotForm.timeLabel.trim()) {
      toast.error("Time slot is required")
      return
    }
    try {
      await diningAPI.createSlot({
        timeLabel: slotForm.timeLabel.trim(),
        durationMinutes: Number(slotForm.durationMinutes) || 60,
      })
      toast.success("Slot added")
      setSlotForm({ timeLabel: "", durationMinutes: 60 })
      loadTablesAndSlots()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to add slot")
    }
  }

  const handleToggleSlot = async (slot) => {
    try {
      await diningAPI.updateSlot(slot._id, { isActive: !slot.isActive })
      loadTablesAndSlots()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update slot")
    }
  }

  const handleDeleteSlot = async (slotId) => {
    try {
      await diningAPI.deleteSlot(slotId)
      toast.success("Slot deleted")
      loadTablesAndSlots()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete slot")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
          aria-label="Back to reservations"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Dining settings</h2>
          <p className="text-sm text-slate-500">Enable dining, tables, slots, and booking rules</p>
        </div>
      </div>

      <Section
        title="Dining availability"
        description="Turn dining on/off and set guest capacity."
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 px-4 py-2">
            <span className="text-sm font-medium text-slate-700">
              {diningEnabled ? "Dining enabled" : "Dining paused"}
            </span>
            <button
              type="button"
              disabled={savingEnablement || (!diningEnabled && !canTurnDiningOn)}
              onClick={handleToggleDining}
              title={
                !diningEnabled && !canTurnDiningOn
                  ? "Select a dining category first"
                  : undefined
              }
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                diningEnabled ? "bg-emerald-600" : "bg-slate-300"
              }`}
              aria-pressed={diningEnabled}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  diningEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2">
            <span className="text-sm text-slate-600">Max guests</span>
            <button
              type="button"
              disabled={!diningEnabled || savingEnablement}
              onClick={() => setMaxGuests((v) => Math.max(1, Number(v) - 1))}
              className="h-8 w-8 rounded-lg bg-slate-100 text-slate-700 disabled:opacity-40"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-semibold">{maxGuests}</span>
            <button
              type="button"
              disabled={!diningEnabled || savingEnablement}
              onClick={() => setMaxGuests((v) => Number(v) + 1)}
              className="h-8 w-8 rounded-lg bg-slate-100 text-slate-700 disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-slate-600">
            Dining categories <span className="text-rose-500">*</span>
          </p>
          {!hasCategory ? (
            <p className="mb-2 text-xs text-amber-700">
              Select at least one category to enable dining.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const selected = diningType.includes(cat.slug)
              return (
                <button
                  key={cat._id || cat.slug}
                  type="button"
                  disabled={savingEnablement}
                  onClick={() => {
                    setDiningType((prev) =>
                      selected
                        ? prev.filter((slug) => slug !== cat.slug)
                        : [...prev, cat.slug]
                    )
                  }}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                    selected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {cat.name}
                </button>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={!canSaveAvailability}
          onClick={handleSaveEnablement}
          className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {savingEnablement ? "Saving..." : "Save availability"}
        </button>
      </Section>

      {diningEnabled ? (
        <>
          <Section
            title="Booking rules"
            description="How far ahead guests can book and how slots behave."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Slot interval (minutes)">
                <input
                  type="number"
                  min={15}
                  className={inputClass}
                  value={reservationSettings.slotIntervalMinutes}
                  onChange={(e) =>
                    setReservationSettings((prev) => ({
                      ...prev,
                      slotIntervalMinutes: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Advance booking (days)">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={reservationSettings.advanceBookingDays}
                  onChange={(e) =>
                    setReservationSettings((prev) => ({
                      ...prev,
                      advanceBookingDays: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Cancel cutoff (minutes)">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={reservationSettings.cancellationCutoffMinutes}
                  onChange={(e) =>
                    setReservationSettings((prev) => ({
                      ...prev,
                      cancellationCutoffMinutes: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Auto confirm bookings">
                <button
                  type="button"
                  onClick={() =>
                    setReservationSettings((prev) => ({
                      ...prev,
                      autoConfirm: !prev.autoConfirm,
                    }))
                  }
                  className={`relative mt-1 inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    reservationSettings.autoConfirm ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      reservationSettings.autoConfirm ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </Field>
            </div>
            <button
              type="button"
              disabled={!canSaveReservation}
              onClick={handleSaveReservationSettings}
              className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingReservation ? "Saving..." : "Save booking rules"}
            </button>
          </Section>

          <Section
            title="Tables"
            description="Manage tables guests can reserve. If empty, booking uses capacity rules only."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={tableForm.name}
                  onChange={(e) => setTableForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Table 1"
                />
              </Field>
              <Field label="Number">
                <input
                  className={inputClass}
                  value={tableForm.tableNumber}
                  onChange={(e) =>
                    setTableForm((prev) => ({ ...prev, tableNumber: e.target.value }))
                  }
                  placeholder="T1"
                />
              </Field>
              <Field label="Capacity">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={tableForm.capacity}
                  onChange={(e) =>
                    setTableForm((prev) => ({ ...prev, capacity: e.target.value }))
                  }
                />
              </Field>
              <Field label="Type">
                <select
                  className={inputClass}
                  value={tableForm.tableType}
                  onChange={(e) =>
                    setTableForm((prev) => ({ ...prev, tableType: e.target.value }))
                  }
                >
                  {TABLE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={!canAddTable}
                  onClick={handleCreateTable}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {setupLoading ? (
                <p className="text-sm text-slate-400">Loading tables...</p>
              ) : tables.length === 0 ? (
                <p className="text-sm text-slate-400">No tables yet.</p>
              ) : (
                tables.map((table) => (
                  <div
                    key={table._id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {table.name}
                        {table.tableNumber ? ` (#${table.tableNumber})` : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        {table.capacity} seater · {table.tableType}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteTable(table._id)}
                      className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                      aria-label="Delete table"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </Section>

          <Section
            title="Time slots"
            description="Optional custom slots. If empty, slots are generated from outlet timings."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Time">
                <input
                  className={inputClass}
                  value={slotForm.timeLabel}
                  onChange={(e) =>
                    setSlotForm((prev) => ({ ...prev, timeLabel: e.target.value }))
                  }
                  placeholder="7:30 PM"
                />
              </Field>
              <Field label="Duration (min)">
                <input
                  type="number"
                  min={15}
                  className={inputClass}
                  value={slotForm.durationMinutes}
                  onChange={(e) =>
                    setSlotForm((prev) => ({ ...prev, durationMinutes: e.target.value }))
                  }
                />
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={!canAddSlot}
                  onClick={handleCreateSlot}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {setupLoading ? (
                <p className="text-sm text-slate-400">Loading slots...</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-slate-400">Using auto-generated slots from outlet timings.</p>
              ) : (
                slots.map((slot) => (
                  <div
                    key={slot._id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{slot.timeLabel}</p>
                      <p className="text-xs text-slate-500">
                        {slot.durationMinutes || 60} min · {slot.isActive ? "Active" : "Disabled"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleSlot(slot)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {slot.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(slot._id)}
                        className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                        aria-label="Delete slot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Section>
        </>
      ) : null}
    </div>
  )
}
