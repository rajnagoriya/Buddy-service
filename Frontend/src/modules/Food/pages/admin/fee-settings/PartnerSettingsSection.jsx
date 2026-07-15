import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"

export default function PartnerSettingsSection({ settings, onChange }) {
  const [activeTab, setActiveTab] = useState("weekly")

  const update = (patch) => onChange({ ...settings, ...patch })

  const addSalarySlab = (type) => {
    const key = type === "weekly" ? "weeklySalarySlabs" : "monthlySalarySlabs"
    update({ [key]: [...(settings[key] || []), { orderCount: "", salaryAmount: "" }] })
  }

  const updateSalarySlab = (type, index, field, value) => {
    const key = type === "weekly" ? "weeklySalarySlabs" : "monthlySalarySlabs"
    const slabs = [...(settings[key] || [])]
    slabs[index] = { ...slabs[index], [field]: value }
    update({ [key]: slabs })
  }

  const removeSalarySlab = (type, index) => {
    const key = type === "weekly" ? "weeklySalarySlabs" : "monthlySalarySlabs"
    const slabs = [...(settings[key] || [])]
    slabs.splice(index, 1)
    update({ [key]: slabs })
  }

  const slabs = activeTab === "weekly" ? settings.weeklySalarySlabs : settings.monthlySalarySlabs

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Admin Commission (Per Order)</h2>
        <p className="text-sm text-slate-600 mb-4">
          Deducted from delivery earnings for partners on the <strong>per_order</strong> model.
        </p>
        <div className="relative max-w-[200px]">
          <input
            type="number"
            min="0"
            max="100"
            value={settings.adminCommissionPercentage}
            onChange={(e) => update({ adminCommissionPercentage: e.target.value })}
            className="w-full pl-4 pr-8 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-green-500 outline-none"
            placeholder="10"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">%</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Multi-Restaurant Settings</h2>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-slate-600">Enable Multi-Restaurant Orders</span>
          <button
            type="button"
            onClick={() => update({ multiOrderEnabled: !settings.multiOrderEnabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.multiOrderEnabled ? "bg-green-600" : "bg-slate-300"
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.multiOrderEnabled ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Max Road Distance (KM)</label>
            <input
              type="number"
              value={settings.multiOrderMaxDistance}
              onChange={(e) => update({ multiOrderMaxDistance: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-green-500"
              placeholder="3"
            />
            <p className="text-xs text-slate-500 mt-1">Max km between restaurants in one cart</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Extra Charge (₹)</label>
            <input
              type="number"
              value={settings.multiOrderAdditionalCharge}
              onChange={(e) => update({ multiOrderAdditionalCharge: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-green-500"
              placeholder="0"
            />
            <p className="text-xs text-slate-500 mt-1">Added to delivery fee for multi-restaurant orders</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Split Large Orders</h2>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-slate-600">Enable split delivery for large carts</span>
          <button
            type="button"
            onClick={() => update({ splitOrderEnabled: !settings.splitOrderEnabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.splitOrderEnabled !== false ? "bg-green-600" : "bg-slate-300"
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.splitOrderEnabled !== false ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Item Count Threshold</label>
          <input
            type="number"
            min="1"
            value={settings.splitOrderThreshold}
            onChange={(e) => update({ splitOrderThreshold: e.target.value })}
            className="w-full max-w-[200px] px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-1 focus:ring-green-500"
            placeholder="20"
          />
          <p className="text-xs text-slate-500 mt-1">At or above this item count, base delivery fee is doubled</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-slate-900">Salary Slabs</h2>
          <div className="flex bg-white rounded-lg p-1 border border-slate-200">
            <button type="button" onClick={() => setActiveTab("weekly")} className={`px-3 py-1 text-sm font-medium rounded-md ${activeTab === "weekly" ? "bg-green-100 text-green-700" : "text-slate-600"}`}>Weekly</button>
            <button type="button" onClick={() => setActiveTab("monthly")} className={`px-3 py-1 text-sm font-medium rounded-md ${activeTab === "monthly" ? "bg-green-100 text-green-700" : "text-slate-600"}`}>Monthly</button>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Fixed salary for partners on the <strong>salary</strong> model based on order count.
        </p>
        <div className="space-y-3 mb-4 max-h-[240px] overflow-y-auto pr-2">
          {(slabs || []).map((slab, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="number" placeholder="Orders" value={slab.orderCount} onChange={(e) => updateSalarySlab(activeTab, i, "orderCount", e.target.value)} className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-green-500" />
              <span className="text-slate-500 text-sm font-medium">orders =</span>
              <div className="flex-1 relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                <input type="number" placeholder="Salary" value={slab.salaryAmount} onChange={(e) => updateSalarySlab(activeTab, i, "salaryAmount", e.target.value)} className="w-full pl-6 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-green-500" />
              </div>
              <button type="button" onClick={() => removeSalarySlab(activeTab, i)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {(!slabs || slabs.length === 0) && (
            <p className="text-sm text-slate-400 text-center py-4">No {activeTab} salary slabs configured</p>
          )}
        </div>
        <button type="button" onClick={() => addSalarySlab(activeTab)} className="w-full py-2 border-2 border-dashed border-green-200 text-green-600 font-medium text-sm rounded-lg hover:bg-green-50 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add Slab
        </button>
      </div>
    </div>
  )
}
