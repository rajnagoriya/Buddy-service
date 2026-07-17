import { useState, useEffect } from "react"
import { Bike, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import { adminAPI } from "@food/api"

export default function ReassignDriverModal({
  isOpen,
  onOpenChange,
  order,
  onConfirm,
  isProcessing,
}) {
  const [partners, setPartners] = useState([])
  const [selectedPartnerId, setSelectedPartnerId] = useState("")
  const [isLoadingPartners, setIsLoadingPartners] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isOpen) {
      setSelectedPartnerId("")
      setError("")
      return
    }

    let cancelled = false
    const fetchPartners = async () => {
      setIsLoadingPartners(true)
      setError("")
      try {
        const response = await adminAPI.getDeliveryPartners({
          page: 1,
          limit: 500,
        })
        if (cancelled) return
        const list = response?.data?.data?.deliveryPartners || []
        setPartners(list)
      } catch {
        if (!cancelled) {
          setError("Failed to load delivery partners")
          setPartners([])
        }
      } finally {
        if (!cancelled) setIsLoadingPartners(false)
      }
    }

    fetchPartners()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  const handleConfirm = () => {
    if (!selectedPartnerId) {
      setError("Please select a delivery partner")
      return
    }
    onConfirm(selectedPartnerId)
  }

  const handleClose = () => {
    if (!isProcessing) {
      setSelectedPartnerId("")
      setError("")
      onOpenChange(false)
    }
  }

  if (!order) return null

  const currentDriverId =
    order.deliveryPartnerId ||
    order.dispatch?.deliveryPartnerId?._id ||
    order.dispatch?.deliveryPartnerId

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Bike className="w-5 h-5 text-emerald-600" />
            Reassign Driver
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Order ID: <span className="font-semibold">{order.orderId}</span>
            {order.deliveryPartnerName && (
              <span className="block mt-1">
                Current driver:{" "}
                <span className="font-medium">{order.deliveryPartnerName}</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Select Delivery Partner
            </label>
            {isLoadingPartners ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading delivery partners...
              </div>
            ) : (
              <select
                value={selectedPartnerId}
                onChange={(e) => {
                  setSelectedPartnerId(e.target.value)
                  setError("")
                }}
                disabled={isProcessing}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Choose a driver</option>
                {partners.map((partner) => (
                  <option
                    key={partner._id}
                    value={partner._id}
                    disabled={String(partner._id) === String(currentDriverId)}
                  >
                    {partner.name}
                    {partner.phone ? ` (${partner.phone})` : ""}
                    {String(partner._id) === String(currentDriverId)
                      ? " — current"
                      : ""}
                  </option>
                ))}
              </select>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || isLoadingPartners || !selectedPartnerId}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Assigning...
              </>
            ) : (
              "Assign Driver"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
