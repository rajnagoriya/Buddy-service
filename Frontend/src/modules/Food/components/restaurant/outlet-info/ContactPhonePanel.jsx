import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { Phone } from "lucide-react"
import { Input } from "@food/components/ui/input"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"

export default forwardRef(function ContactPhonePanel(_props, ref) {
  const [loading, setLoading] = useState(true)
  const [ownerPhone, setOwnerPhone] = useState("")
  const [contactNumber, setContactNumber] = useState("")
  const [savedContactNumber, setSavedContactNumber] = useState("")

  useEffect(() => {
    restaurantAPI
      .getCurrentRestaurant()
      .then((res) => {
        const data = res?.data?.data?.restaurant || res?.data?.restaurant
        if (data) {
          const pending = data.pendingProfile || {}
          const isActivePending = data.hasPendingProfileReview || data.profileReviewStatus === "pending" || data.profileReviewStatus === "rejected" || data.status === "rejected"
          
          setOwnerPhone(data.ownerPhone || "")
          const getVal = (key) => (isActivePending && pending[key] !== undefined) ? pending[key] : data[key]
          
          const contact = getVal("primaryContactNumber") || ""
          setContactNumber(contact)
          setSavedContactNumber(contact)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    const trimmed = contactNumber.trim()
    if (!trimmed) {
      toast.error("Contact number is required")
      return false
    }

    try {
      await restaurantAPI.updateProfile({ primaryContactNumber: trimmed })
      setSavedContactNumber(trimmed)
      toast.success("Contact number updated")
      return true
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update contact number")
      return false
    }
  }

  useImperativeHandle(ref, () => ({
    save,
    hasUnsavedChanges: contactNumber.trim() !== savedContactNumber.trim(),
  }))

  if (loading) {
    return <div className="py-8 text-center text-sm text-gray-500">Loading phone numbers...</div>
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--rt-border)] bg-gray-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
            <Phone className="h-4 w-4 text-gray-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Owner phone (read-only)</p>
            <p className="text-sm font-semibold text-gray-900">{ownerPhone || "Not set"}</p>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600">
          Customer contact number
        </label>
        <Input
          value={contactNumber}
          onChange={(e) => setContactNumber(e.target.value)}
          placeholder="Contact number shown to customers"
          className="h-11 rounded-xl border-[var(--rt-border)]"
        />
        <p className="mt-1.5 text-xs text-gray-500">
          This number is displayed on your restaurant page for customer queries.
        </p>
      </div>

      <div className="pt-4 mt-4">
        <button
          type="button"
          onClick={save}
          disabled={contactNumber.trim() === savedContactNumber.trim()}
          className="w-full rounded-xl bg-[var(--rt-primary-strong)] py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          Save Phone Number
        </button>
      </div>
    </div>
  )
})
