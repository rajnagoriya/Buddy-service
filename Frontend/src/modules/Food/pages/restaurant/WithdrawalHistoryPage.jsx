import { useState, useEffect } from "react"
import { Wallet } from "lucide-react"
import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import { PanelPill, PanelSurface } from "@food/components/restaurant/panel/panelUi"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"
import { restaurantAPI } from "@food/api"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function WithdrawalHistoryPage() {
  const [withdrawalHistoryTab, setWithdrawalHistoryTab] = useState("pending")
  const [withdrawalRequests, setWithdrawalRequests] = useState([])
  const [loadingWithdrawalRequests, setLoadingWithdrawalRequests] = useState(false)

  useEffect(() => {
    const fetchWithdrawalRequests = async () => {
      try {
        setLoadingWithdrawalRequests(true)
        const response = await restaurantAPI.getWithdrawalHistory()
        const history = response?.data?.data || []

        const mapped = history.map((h) => ({
          id: h._id,
          amount: h.amount,
          status: h.status === "approved" ? "Approved" : h.status === "rejected" ? "Rejected" : "Pending",
          requestedAt: h.createdAt,
          processedAt: h.processedAt,
        }))

        setWithdrawalRequests(mapped)
      } catch (error) {
        if (error.response?.status !== 401) {
          debugError("Error fetching withdrawal requests:", error)
        }
      } finally {
        setLoadingWithdrawalRequests(false)
      }
    }

    fetchWithdrawalRequests()
  }, [])

  const formatDateTime = (value) =>
    value
      ? new Date(value).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "N/A"

  const pendingRequests = withdrawalRequests.filter((req) => req.status === "Pending")
  const successfulRequests = withdrawalRequests.filter(
    (req) => req.status === "Approved" || req.status === "Processed"
  )
  const activeList = withdrawalHistoryTab === "pending" ? pendingRequests : successfulRequests

  return (
    <RestaurantSubPageShell
      title="Withdrawal history"
      subtitle="Track pending and completed payouts"
      backTo={`${RESTAURANT_BASE}/hub-finance`}
    >
      <div className="mb-4 flex gap-2">
        <PanelPill
          active={withdrawalHistoryTab === "pending"}
          onClick={() => setWithdrawalHistoryTab("pending")}
          className="flex-1"
        >
          Pending
        </PanelPill>
        <PanelPill
          active={withdrawalHistoryTab === "successful"}
          onClick={() => setWithdrawalHistoryTab("successful")}
          className="flex-1"
        >
          Successful
        </PanelPill>
      </div>

      {loadingWithdrawalRequests ? (
        <div className="py-8 text-center text-gray-500">Loading...</div>
      ) : activeList.length === 0 ? (
        <PanelSurface className="py-12 text-center">
          <Wallet className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <p className="text-lg font-medium text-gray-500">
            {withdrawalHistoryTab === "pending"
              ? "No pending withdrawal requests"
              : "No successful withdrawals"}
          </p>
        </PanelSurface>
      ) : (
        <div className="space-y-3">
          {activeList.map((request) => (
            <PanelSurface key={request.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="mb-2 text-lg font-bold text-gray-900">
                    ₹
                    {request.amount?.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-xs text-gray-600">
                    {withdrawalHistoryTab === "pending"
                      ? `Requested: ${formatDateTime(request.requestedAt)}`
                      : `Processed: ${formatDateTime(request.processedAt)}`}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    withdrawalHistoryTab === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {withdrawalHistoryTab === "pending" ? "Pending" : request.status}
                </span>
              </div>
            </PanelSurface>
          ))}
        </div>
      )}
    </RestaurantSubPageShell>
  )
}
