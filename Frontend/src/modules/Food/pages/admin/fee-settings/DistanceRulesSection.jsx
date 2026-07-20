import { useState, useMemo, useEffect } from "react"
import { Search, Edit, Trash2, Settings, Check, MapPin, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

const columnsConfig = {
  si: "Serial Number",
  name: "Name",
  distanceSlab: "Distance Slab (km)",
  userCharge: "User Charge",
  deliveryBoyFee: "Delivery Boy Fee",
  status: "Status",
  actions: "Actions",
}

const emptyForm = {
  name: "",
  minDistance: "0",
  maxDistance: "",
  maxDistanceUnlimited: false,
  userCharge: "",
  deliveryBoyFee: "",
}

function resolveUserCharge(commission) {
  if (commission?.userCharge != null) return Number(commission.userCharge)
  if (commission?.basePayout != null) return Number(commission.basePayout)
  return 0
}

function resolveDeliveryBoyFee(commission) {
  if (commission?.deliveryBoyFee != null) return Number(commission.deliveryBoyFee)
  if (commission?.basePayout != null) return Number(commission.basePayout)
  return 0
}

function getDistanceSlabLabel(commission) {
  const min = Number(commission.minDistance) || 0
  const max = commission.maxDistance === null || commission.maxDistance === undefined ? null : Number(commission.maxDistance)
  if (max === null) return `${min}+ km`
  return `${min}-${max} km`
}

export default function DistanceRulesSection() {
  const [searchQuery, setSearchQuery] = useState("")
  const [commissions, setCommissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isAddEditOpen, setIsAddEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedCommission, setSelectedCommission] = useState(null)
  const [formData, setFormData] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState({})
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    name: true,
    distanceSlab: true,
    userCharge: true,
    deliveryBoyFee: true,
    status: true,
    actions: true,
  })

  const filteredCommissions = useMemo(() => {
    if (!searchQuery.trim()) return commissions
    const query = searchQuery.toLowerCase().trim()
    return commissions.filter((commission) =>
      commission.name.toLowerCase().includes(query) ||
      getDistanceSlabLabel(commission).toLowerCase().includes(query)
    )
  }, [commissions, searchQuery])

  useEffect(() => {
    fetchCommissionRules()
  }, [])

  const fetchCommissionRules = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getCommissionRules()
      let commissionsData = null
      if (response?.data?.success && response?.data?.data?.commissions) {
        commissionsData = response.data.data.commissions
      } else if (response?.data?.data?.commissions) {
        commissionsData = response.data.data.commissions
      } else if (response?.data?.commissions) {
        commissionsData = response.data.commissions
      }
      if (commissionsData && Array.isArray(commissionsData)) {
        setCommissions(commissionsData.map((commission, index) => ({ ...commission, sl: index + 1 })))
      } else {
        setCommissions([])
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch distance rules")
      setCommissions([])
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (commission) => {
    try {
      const newStatus = !commission.status
      await adminAPI.toggleCommissionRuleStatus(commission._id, newStatus)
      setCommissions(commissions.map((c) => (c._id === commission._id ? { ...c, status: newStatus } : c)))
      toast.success("Rule status updated")
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status")
    }
  }

  const handleAdd = () => {
    setSelectedCommission(null)
    setFormData({ ...emptyForm })
    setFormErrors({})
    setIsAddEditOpen(true)
  }

  const handleEdit = (commission) => {
    setSelectedCommission(commission)
    const isUnlimited = commission.maxDistance === null || commission.maxDistance === undefined
    setFormData({
      name: commission.name,
      minDistance: commission.minDistance?.toString?.() || "",
      maxDistance: isUnlimited ? "" : String(commission.maxDistance),
      maxDistanceUnlimited: isUnlimited,
      userCharge: String(resolveUserCharge(commission)),
      deliveryBoyFee: String(resolveDeliveryBoyFee(commission)),
    })
    setFormErrors({})
    setIsAddEditOpen(true)
  }

  const handleDelete = (commission) => {
    setSelectedCommission(commission)
    setIsDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedCommission) return
    try {
      setDeleting(true)
      await adminAPI.deleteCommissionRule(selectedCommission._id)
      setCommissions(commissions.filter((c) => c._id !== selectedCommission._id))
      setIsDeleteOpen(false)
      setSelectedCommission(null)
      toast.success("Rule deleted")
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete rule")
    } finally {
      setDeleting(false)
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!formData.minDistance.trim() || parseFloat(formData.minDistance) < 0) {
      errors.minDistance = "Minimum distance must be 0 or greater"
    }
    if (!formData.maxDistanceUnlimited && formData.maxDistance !== "" && parseFloat(formData.maxDistance) < parseFloat(formData.minDistance || "0")) {
      errors.maxDistance = "Max distance must be greater than or equal to min distance"
    }
    if (!formData.userCharge.trim() || parseFloat(formData.userCharge) < 0) {
      errors.userCharge = "User charge must be 0 or greater"
    }
    if (!formData.deliveryBoyFee.trim() || parseFloat(formData.deliveryBoyFee) < 0) {
      errors.deliveryBoyFee = "Delivery boy fee must be 0 or greater"
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    try {
      setSaving(true)
      const minDistance = parseFloat(formData.minDistance)
      const maxDistance = formData.maxDistanceUnlimited || formData.maxDistance === "" ? null : parseFloat(formData.maxDistance)
      const commissionData = {
        name: formData.name.trim() || `${minDistance}${maxDistance == null ? "+" : `-${maxDistance}`} km`,
        minDistance,
        maxDistance,
        userCharge: parseFloat(formData.userCharge),
        deliveryBoyFee: parseFloat(formData.deliveryBoyFee),
        status: selectedCommission ? selectedCommission.status : true,
      }

      const extractCommission = (response) =>
        response?.data?.data?.commission || response?.data?.commission || null

      if (selectedCommission) {
        const response = await adminAPI.updateCommissionRule(selectedCommission._id, commissionData)
        const commission = extractCommission(response)
        if (commission) {
          setCommissions(commissions.map((c) => (c._id === selectedCommission._id ? { ...commission, sl: selectedCommission.sl } : c)))
          toast.success("Rule updated")
        }
      } else {
        const response = await adminAPI.createCommissionRule(commissionData)
        const commission = extractCommission(response)
        if (commission) {
          setCommissions([...commissions, { ...commission, sl: commissions.length + 1 }])
          toast.success("Rule created")
        }
      }
      setIsAddEditOpen(false)
      setFormData({ ...emptyForm })
      setSelectedCommission(null)
      await fetchCommissionRules()
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save rule")
    } finally {
      setSaving(false)
    }
  }

  const configuredMinDistance = Number(formData.minDistance !== "" ? formData.minDistance : selectedCommission?.minDistance)
  const formulaMinDistance = Number.isFinite(configuredMinDistance) ? configuredMinDistance : 0
  const colSpan = Object.values(visibleColumns).filter(Boolean).length

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Distance Rules</h2>
          <p className="text-sm text-slate-500 mt-0.5">Fixed delivery fee slabs for customers and partners</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleAdd} className="px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold shadow-sm">
            Add Distance Rule
          </button>
          <button type="button" onClick={() => setIsSettingsOpen(true)} className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-green-900 mb-1">Fixed amount per distance slab</p>
            <p className="text-slate-600">
              Each slab has a fixed <strong>user charge</strong> and <strong>delivery boy fee</strong> (no per-km rate).
              Example: 0–2 km → user ₹30 / driver ₹25; 2–4 km → user ₹40 / driver ₹35.
              Multi-restaurant distance = user → A → B → C. Multi-order extra charge (if set) is added on top.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 relative max-w-sm">
        <input
          type="text"
          placeholder="Search by name or distance..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {visibleColumns.si && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">SI</th>}
              {visibleColumns.name && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Name</th>}
              {visibleColumns.distanceSlab && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Distance Slab</th>}
              {visibleColumns.userCharge && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">User Charge (₹)</th>}
              {visibleColumns.deliveryBoyFee && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Delivery Boy Fee (₹)</th>}
              {visibleColumns.status && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Status</th>}
              {visibleColumns.actions && <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={colSpan} className="px-6 py-8 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading rules...
                  </div>
                </td>
              </tr>
            ) : filteredCommissions.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-6 py-8 text-center text-slate-500">No distance rules found</td>
              </tr>
            ) : (
              filteredCommissions.map((commission) => (
                <tr key={commission._id} className="hover:bg-slate-50">
                  {visibleColumns.si && <td className="px-6 py-4 text-sm text-slate-700">{commission.sl}</td>}
                  {visibleColumns.name && <td className="px-6 py-4 text-sm font-medium text-slate-900">{commission.name}</td>}
                  {visibleColumns.distanceSlab && (
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-900">{getDistanceSlabLabel(commission)}</span>
                    </td>
                  )}
                  {visibleColumns.userCharge && (
                    <td className="px-6 py-4 text-sm font-semibold text-green-700">₹{resolveUserCharge(commission)}</td>
                  )}
                  {visibleColumns.deliveryBoyFee && (
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">₹{resolveDeliveryBoyFee(commission)}</td>
                  )}
                  {visibleColumns.status && (
                    <td className="px-6 py-4">
                      <button type="button" onClick={() => handleToggleStatus(commission)} className={`relative inline-flex h-6 w-11 items-center rounded-full ${commission.status ? "bg-green-600" : "bg-slate-300"}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white ${commission.status ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </td>
                  )}
                  {visibleColumns.actions && (
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" onClick={() => handleEdit(commission)} className="p-1.5 rounded text-green-600 hover:bg-green-50"><Edit className="w-4 h-4" /></button>
                        <button type="button" onClick={() => handleDelete(commission)} className="p-1.5 rounded text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="max-w-md bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>{selectedCommission ? "Edit Distance Rule" : "Add Distance Rule"}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Rule Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" placeholder={`e.g., ${formulaMinDistance}-3 km`} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Minimum Distance (km) *</label>
              <input type="number" step="0.01" min="0" value={formData.minDistance} onChange={(e) => setFormData({ ...formData, minDistance: e.target.value })} className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none ${formErrors.minDistance ? "border-red-500" : "border-slate-200"}`} />
              {formErrors.minDistance && <p className="text-xs text-red-500 mt-1">{formErrors.minDistance}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Maximum Distance (km)</label>
              <label className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                <input type="checkbox" checked={Boolean(formData.maxDistanceUnlimited)} onChange={(e) => setFormData({ ...formData, maxDistanceUnlimited: e.target.checked, maxDistance: e.target.checked ? "" : formData.maxDistance })} />
                Unlimited
              </label>
              <input type="number" step="0.01" min="0" value={formData.maxDistance} disabled={Boolean(formData.maxDistanceUnlimited)} onChange={(e) => setFormData({ ...formData, maxDistanceUnlimited: false, maxDistance: e.target.value })} className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none ${formErrors.maxDistance ? "border-red-500" : "border-slate-200"}`} />
              {formErrors.maxDistance && <p className="text-xs text-red-500 mt-1">{formErrors.maxDistance}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">User Charge (₹) *</label>
              <input type="number" step="0.01" min="0" value={formData.userCharge} onChange={(e) => setFormData({ ...formData, userCharge: e.target.value })} className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none ${formErrors.userCharge ? "border-red-500" : "border-slate-200"}`} placeholder="Fixed amount charged to customer" />
              {formErrors.userCharge && <p className="text-xs text-red-500 mt-1">{formErrors.userCharge}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Delivery Boy Fee (₹) *</label>
              <input type="number" step="0.01" min="0" value={formData.deliveryBoyFee} onChange={(e) => setFormData({ ...formData, deliveryBoyFee: e.target.value })} className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none ${formErrors.deliveryBoyFee ? "border-red-500" : "border-slate-200"}`} placeholder="Fixed amount paid to delivery partner" />
              {formErrors.deliveryBoyFee && <p className="text-xs text-red-500 mt-1">{formErrors.deliveryBoyFee}</p>}
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <button type="button" onClick={() => setIsAddEditOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-200">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {selectedCommission ? "Update" : "Add"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4"><DialogTitle>Delete Distance Rule</DialogTitle></DialogHeader>
          <div className="px-6 pb-6 text-sm text-slate-700">Delete &quot;{selectedCommission?.name}&quot;? This cannot be undone.</div>
          <DialogFooter className="px-6 pb-6">
            <button type="button" onClick={() => setIsDeleteOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-200">Cancel</button>
            <button type="button" onClick={confirmDelete} disabled={deleting} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white disabled:opacity-50 flex items-center gap-2">
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Table Settings</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-2">
            {Object.entries(columnsConfig).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={visibleColumns[key]} onChange={() => setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))} />
                <span className="text-sm text-slate-700">{label}</span>
                {visibleColumns[key] && <Check className="w-4 h-4 text-green-600 ml-auto" />}
              </label>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
