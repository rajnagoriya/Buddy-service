import { useEffect, useRef, useState } from "react"
import { Building2, Clock, CreditCard, Phone } from "lucide-react"
import RestaurantPanelModal from "@food/components/restaurant/panel/RestaurantPanelModal"
import OutletTimingsPanel from "@food/components/restaurant/outlet-info/OutletTimingsPanel"
import ContactPhonePanel from "@food/components/restaurant/outlet-info/ContactPhonePanel"
import BankDetailsPanel from "@food/components/restaurant/outlet-info/BankDetailsPanel"
import ZoneSelectionPanel from "@food/components/restaurant/outlet-info/ZoneSelectionPanel"

const TABS = [
  { id: "hours", label: "Hours & status", icon: Clock },
  { id: "phone", label: "Phone numbers", icon: Phone },
  { id: "zone", label: "Zone setup", icon: Building2 },
  { id: "finance", label: "Payouts & finance", icon: CreditCard },
]

export default function ManageOutletModal({ open, onClose, initialTab = "hours" }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([initialTab]))
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const hoursRef = useRef(null)
  const phoneRef = useRef(null)
  const zoneRef = useRef(null)
  const financeRef = useRef(null)

  const panelRefs = {
    hours: hoursRef,
    phone: phoneRef,
    zone: zoneRef,
    finance: financeRef,
  }

  useEffect(() => {
    if (!open) {
      setVisitedTabs(new Set([initialTab]))
      return
    }
    setActiveTab(initialTab)
    setVisitedTabs((prev) => new Set(prev).add(initialTab))
  }, [open, initialTab])

  useEffect(() => {
    if (!open) return
    setVisitedTabs((prev) => new Set(prev).add(activeTab))
  }, [open, activeTab])

  useEffect(() => {
    if (!open) return undefined

    const syncDirtyState = () => {
      const panelRef = panelRefs[activeTab]
      setHasUnsavedChanges(Boolean(panelRef?.current?.hasUnsavedChanges))
    }

    syncDirtyState()
    const interval = setInterval(syncDirtyState, 400)
    return () => clearInterval(interval)
  }, [open, activeTab])

  const handleSave = async () => {
    const panelRef = panelRefs[activeTab]
    if (!panelRef?.current?.save) return

    try {
      setSaving(true)
      const saved = await panelRef.current.save()
      if (saved) setHasUnsavedChanges(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <RestaurantPanelModal
      open={open}
      onClose={onClose}
      title="Manage outlet"
      description="Operational settings — review and save each tab"
      size="2xl"
      mobileMaxHeight="full"
      bodyClassName="flex min-h-0 flex-col overflow-hidden px-0 pb-0"
      className="!max-h-[92vh] lg:!max-h-[88vh]"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      }
    >
      <div className="flex max-h-[calc(92vh-220px)] min-h-0 flex-col lg:max-h-[calc(88vh-240px)] lg:flex-row bg-slate-50/30">
        <div className="shrink-0 border-b border-[var(--rt-border)] bg-slate-50/50 lg:w-56 lg:border-b-0 lg:border-r">
          <div className="flex gap-2 overflow-x-auto px-3 py-3 lg:flex-col lg:p-4">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition-all ${
                  activeTab === id
                    ? "bg-white text-[var(--rt-primary-strong)] shadow-sm ring-1 ring-slate-200"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${activeTab === id ? 'text-[var(--rt-primary-strong)]' : 'text-slate-400'}`} strokeWidth={2.5} />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 lg:px-5 lg:py-5">
          {visitedTabs.has("hours") && (
            <div className={activeTab === "hours" ? "block" : "hidden"}>
              <OutletTimingsPanel ref={hoursRef} />
            </div>
          )}
          {visitedTabs.has("phone") && (
            <div className={activeTab === "phone" ? "block" : "hidden"}>
              <ContactPhonePanel ref={phoneRef} />
            </div>
          )}
          {visitedTabs.has("zone") && (
            <div className={activeTab === "zone" ? "block" : "hidden"}>
              <ZoneSelectionPanel ref={zoneRef} mapActive={activeTab === "zone"} />
            </div>
          )}
          {visitedTabs.has("finance") && (
            <div className={activeTab === "finance" ? "block" : "hidden"}>
              <BankDetailsPanel ref={financeRef} />
            </div>
          )}
        </div>
      </div>
    </RestaurantPanelModal>
  )
}
