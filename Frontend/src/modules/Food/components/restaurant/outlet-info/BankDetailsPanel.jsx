import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/
const UPI_REGEX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/

const EMPTY_FORM = {
  accountHolderName: "",
  accountNumber: "",
  confirmAccountNumber: "",
  ifscCode: "",
  upiId: "",
}

export default forwardRef(function BankDetailsPanel(_props, ref) {
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_FORM)
  const [savedForm, setSavedForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    restaurantAPI
      .getCurrentRestaurant()
      .then((res) => {
        const data = res?.data?.data?.restaurant || res?.data?.restaurant
        if (data) {
          const pending = data.pendingProfile || {}
          const isActivePending = data.hasPendingProfileReview || data.profileReviewStatus === "pending" || data.profileReviewStatus === "rejected" || data.status === "rejected"
          
          const getVal = (key) => (isActivePending && pending[key] !== undefined) ? pending[key] : data[key]
          
          const accountNumber = getVal("accountNumber") || ""
          const next = {
            accountHolderName: getVal("accountHolderName") || "",
            accountNumber: accountNumber,
            confirmAccountNumber: accountNumber,
            ifscCode: getVal("ifscCode") || "",
            upiId: getVal("upiId") || "",
          }
          setForm(next)
          setSavedForm(next)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const validate = () => {
    const nextErrors = {}
    const accountHolderName = String(form.accountHolderName || "").trim()
    const accountNumber = String(form.accountNumber || "").replace(/\s|-/g, "")
    const confirmAccountNumber = String(form.confirmAccountNumber || "").replace(/\s|-/g, "")
    const ifscCode = String(form.ifscCode || "").trim().toUpperCase()
    const upiId = String(form.upiId || "").trim()
    const anyBankField = Boolean(accountHolderName || accountNumber || ifscCode)

    if (anyBankField) {
      if (!accountHolderName) nextErrors.accountHolderName = "Required"
      if (!accountNumber) nextErrors.accountNumber = "Required"
      else if (!/^\d{9,18}$/.test(accountNumber)) nextErrors.accountNumber = "Invalid account number"
      if (confirmAccountNumber !== accountNumber) nextErrors.confirmAccountNumber = "Numbers do not match"
      if (!ifscCode) nextErrors.ifscCode = "Required"
      else if (!IFSC_REGEX.test(ifscCode)) nextErrors.ifscCode = "Invalid IFSC"
    }
    if (upiId && !UPI_REGEX.test(upiId)) nextErrors.upiId = "Invalid UPI ID"

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const save = async () => {
    if (!validate()) return false

    try {
      const res = await restaurantAPI.updateProfile({
        accountHolderName: form.accountHolderName.trim(),
        accountNumber: String(form.accountNumber).replace(/\s|-/g, ""),
        ifscCode: form.ifscCode.trim().toUpperCase(),
        upiId: form.upiId.trim(),
      })
      setSavedForm(form)
      const restaurant = res?.data?.data?.restaurant
      const labels =
        restaurant?.lastSubmittedFieldLabels ||
        restaurant?.pendingSubmittedFieldLabels ||
        ["Bank Details"]
      if (restaurant?.requiresApproval || restaurant?.hasPendingProfileReview) {
        toast.success(`Submitted for admin review: ${labels.join(", ")}`)
        window.dispatchEvent(new Event("restaurantProfileRefresh"))
      } else {
        toast.success("Bank details updated")
      }
      return true
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update bank details")
      return false
    }
  }

  useImperativeHandle(ref, () => ({
    save,
    hasUnsavedChanges: JSON.stringify(form) !== JSON.stringify(savedForm),
  }))

  const inputClass = (key) =>
    `w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${
      errors[key]
        ? "border-red-500 focus:ring-red-500"
        : "border-[var(--rt-border)] focus:ring-[var(--rt-primary-strong)]"
    }`

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Bank and UPI changes require admin approval before going live.
      </p>

      {[
        ["accountHolderName", "Account holder name", "text"],
        ["accountNumber", "Account number", "text"],
        ["confirmAccountNumber", "Confirm account number", "text"],
        ["ifscCode", "IFSC code", "text"],
        ["upiId", "UPI ID (optional)", "text"],
      ].map(([key, label, type]) => (
        <div key={key}>
          <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
          <input
            type={type}
            value={form[key]}
            onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
            className={inputClass(key)}
          />
          {errors[key] ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              {errors[key]}
            </p>
          ) : null}
        </div>
      ))}

      <div className="pt-4 mt-4">
        <button
          type="button"
          onClick={save}
          disabled={JSON.stringify(form) === JSON.stringify(savedForm)}
          className="w-full rounded-xl bg-[var(--rt-primary-strong)] py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          Save Bank Details
        </button>
      </div>
    </div>
  )
})
