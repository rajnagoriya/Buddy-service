import { useEffect, useMemo, useState } from "react"
import { RefreshCw, Bell, X } from "lucide-react"
import RestaurantSubPageShell from "@food/components/restaurant/panel/RestaurantSubPageShell"
import { PanelSurface } from "@food/components/restaurant/panel/panelUi"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"
import { restaurantAPI } from "@food/api"
import useNotificationInbox from "@food/hooks/useNotificationInbox"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const DISMISSED_KEY = "restaurant_dismissed_notifications"

const getStatusLabel = (status = "") => {
  const normalized = String(status).toLowerCase()
  if (normalized === "confirmed") return "New order received"
  if (normalized === "preparing") return "Order is preparing"
  if (normalized === "ready") return "Order is ready for pickup"
  if (normalized === "out_for_delivery") return "Order out for delivery"
  if (normalized === "delivered") return "Order delivered"
  if (normalized === "cancelled") return "Order cancelled"
  if (normalized === "rejected") return "Order rejected"
  return "Order update"
}

export default function Notifications() {
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(DISMISSED_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const {
    items: broadcastNotifications,
    loading: broadcastLoading,
    markAsRead: markBroadcastAsRead,
    dismiss: dismissBroadcastNotification,
    dismissAll: dismissAllBroadcastNotifications,
    refresh: refreshBroadcastNotifications,
  } = useNotificationInbox("restaurant", { limit: 100, pollMs: 5 * 60 * 1000 })

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getOrders({ page: 1, limit: 30 })
      const rows = response?.data?.data?.orders || response?.data?.data?.data?.orders || []
      setOrders(rows)
    } catch (error) {
      if (error.response?.status !== 401) {
        debugError("Error fetching notifications:", error)
      }
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  useEffect(() => {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissedIds))
  }, [dismissedIds])

  const notifications = useMemo(() => {
    const orderNotifications = (orders || [])
      .map((order) => {
        const id = order._id || order.orderId
        const timestamp = order.updatedAt || order.createdAt
        return {
          id,
          orderId: order.orderId || "N/A",
          message: getStatusLabel(order.orderStatus || order.status),
          timeValue: timestamp ? new Date(timestamp).getTime() : 0,
          time: timestamp
            ? new Date(timestamp).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })
            : "N/A",
        }
      })
      .filter((item) => item.id && !dismissedIds.includes(item.id))
    const broadcastRows = (broadcastNotifications || []).map((item) => ({
      id: item.id,
      message: item.title || "Broadcast notification",
      detail: item.message || "",
      source: "broadcast",
      read: item.read,
      timeValue: item.createdAt ? new Date(item.createdAt).getTime() : 0,
      time: item.createdAt
        ? new Date(item.createdAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "N/A",
    }))

    return [...broadcastRows, ...orderNotifications].sort((a, b) => b.timeValue - a.timeValue)
  }, [broadcastNotifications, dismissedIds, orders])

  const removeNotification = (id, source = "order") => {
    if (source === "broadcast") {
      dismissBroadcastNotification(id)
      return
    }
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  const clearAll = () => {
    dismissAllBroadcastNotifications()
    const ids = notifications
      .filter((item) => item.source !== "broadcast")
      .map((n) => n.id)
      .filter(Boolean)
    setDismissedIds((prev) => [...new Set([...prev, ...ids])])
  }

  const handleRefresh = async () => {
    await Promise.all([fetchNotifications(), refreshBroadcastNotifications()])
  }

  return (
    <RestaurantSubPageShell
      title="Notifications"
      subtitle="Order updates and admin announcements"
      backTo={RESTAURANT_BASE}
      headerRight={
        <button
          type="button"
          onClick={handleRefresh}
          className="rounded-xl border border-[var(--rt-border)] p-2 hover:bg-gray-50"
          aria-label="Refresh"
        >
          <RefreshCw className="h-4 w-4 text-gray-700" />
        </button>
      }
    >
      {!loading && notifications.length > 0 && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-red-600 hover:text-red-700"
          >
            Clear all
          </button>
        </div>
      )}

      {loading || broadcastLoading ? (
        <div className="py-12 text-center text-sm text-gray-600">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <PanelSurface className="py-12 text-center text-sm text-gray-600">No notifications</PanelSurface>
      ) : (
        <div className="space-y-2">
          {notifications.map((item) => (
            <PanelSurface
              key={item.id}
              className={`cursor-default p-3 ${
                item.source === "broadcast" && !item.read
                  ? "border-blue-200 bg-blue-50/40 cursor-pointer"
                  : ""
              }`}
              onClick={() => (item.source === "broadcast" ? markBroadcastAsRead(item.id) : undefined)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {item.source === "broadcast" && <Bell className="h-4 w-4 text-blue-600" />}
                    <p className="text-sm font-medium text-gray-900">{item.message}</p>
                  </div>
                  {item.source === "broadcast" ? (
                    <p className="mt-0.5 text-xs text-gray-600">{item.detail || "Admin notification"}</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-gray-600">Order: {item.orderId}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">{item.time}</p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    removeNotification(item.id, item.source)
                  }}
                  className="rounded-full p-1.5 hover:bg-gray-100"
                  aria-label="Remove notification"
                >
                  <X className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </PanelSurface>
          ))}
        </div>
      )}
    </RestaurantSubPageShell>
  )
}


