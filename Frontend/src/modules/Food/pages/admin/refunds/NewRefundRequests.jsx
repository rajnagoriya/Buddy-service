import { useState, useMemo, useEffect, useCallback } from "react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import OrdersTopbar from "@food/components/admin/orders/OrdersTopbar"
import FilterPanel from "@food/components/admin/orders/FilterPanel"
import ViewOrderDialog from "@food/components/admin/orders/ViewOrderDialog"
import SettingsDialog from "@food/components/admin/orders/SettingsDialog"
import { useGenericTableManagement } from "@food/components/admin/orders/useGenericTableManagement"

function mapOrderForRefundTable(order) {
  const createdAtRaw = order.createdAt || order.created_at || order.orderDate || null
  const createdAt = createdAtRaw ? new Date(createdAtRaw) : null
  const date =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt
          .toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
          .toUpperCase()
      : ""
  const time =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt
          .toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
          .toUpperCase()
      : ""

  const pricing = order.pricing || {}
  const totalAmount = Number(pricing.total ?? order.totalAmount ?? 0)
  const paymentMethod = String(order.payment?.method || order.paymentMethod || "").toLowerCase()
  const refund = order.payment?.refund || {}
  const backendStatus = String(order.orderStatus || order.status || "").toLowerCase()

  let paymentStatus = "Pending"
  const paymentStatusRaw = String(order.payment?.status || "").toLowerCase()
  if (paymentStatusRaw === "refunded") paymentStatus = "Refunded"
  else if (["paid", "authorized", "captured", "settled"].includes(paymentStatusRaw)) {
    paymentStatus = "Paid"
  }

  const cancellationReason =
    order.cancellationReason ||
    [...(Array.isArray(order.statusHistory) ? order.statusHistory : [])]
      .reverse()
      .find((entry) => String(entry?.to || "").toLowerCase().includes("cancel"))?.note ||
    ""

  const cancelledBy = (() => {
    if (backendStatus === "cancelled_by_user") return "Customer"
    if (backendStatus === "cancelled_by_restaurant") return "Restaurant"
    if (backendStatus === "cancelled_by_admin") {
      if (
        String(cancellationReason).toLowerCase().includes("no delivery partner") ||
        order.failureReason === "driver_not_found"
      ) {
        return "System (No driver)"
      }
      return "Admin"
    }
    return ""
  })()

  const restaurant =
    order.isMultiRestaurant || (Array.isArray(order.pickups) && order.pickups.length > 1)
      ? `Multiple Restaurants (${order.pickups?.length || 0})`
      : order.restaurant ||
        order.restaurantName ||
        order.restaurantId?.restaurantName ||
        "N/A"

  return {
    ...order,
    id: order._id || order.id,
    orderId: order.orderId || order.order_id || order._id,
    date,
    time,
    customerName: order.customerName || order.userId?.name || order.userId?.fullName || "N/A",
    customerPhone: order.customerPhone || order.userId?.phone || "N/A",
    restaurant,
    totalAmount,
    paymentStatus,
    paymentType:
      paymentMethod === "wallet"
        ? "Wallet"
        : paymentMethod === "cash" || paymentMethod === "cod"
          ? "Cash on Delivery"
          : paymentMethod
            ? "Online"
            : "N/A",
    cancellationReason,
    cancelledBy,
    refundStatus:
      refund.status ||
      (paymentStatusRaw === "refunded" ? "processed" : paymentMethod === "cash" ? "not_applicable" : "pending"),
    refundDestination: refund.destination || null,
    refundAmount: refund.amount ?? totalAmount,
    refundProcessedAt: refund.processedAt || null,
  }
}

export default function NewRefundRequests() {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    orderId: true,
    orderDate: true,
    customer: true,
    restaurant: true,
    totalAmount: true,
    orderStatus: true,
    actions: true,
  })

  const fetchRefundOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await adminAPI.getOrders({
        page: 1,
        limit: 1000,
        status: "cancelled",
      })

      const payload = response?.data?.data ?? response?.data ?? {}
      const rawOrders =
        payload?.orders ??
        payload?.docs ??
        (Array.isArray(payload?.data) ? payload.data : null) ??
        (Array.isArray(payload) ? payload : null)
      const nextOrders = (Array.isArray(rawOrders) ? rawOrders : [])
        .map(mapOrderForRefundTable)
        .filter((order) => {
          const method = String(order.payment?.method || "").toLowerCase()
          const paid = String(order.payment?.status || "").toLowerCase()
          return method !== "cash" && method !== "cod" && paid !== "cod_pending"
        })

      setOrders(nextOrders)
      setTotalCount(
        Number(payload?.pagination?.total) ||
          nextOrders.length,
      )
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Failed to fetch refund requests")
      setOrders([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRefundOrders()
  }, [fetchRefundOrders])

  const {
    searchQuery,
    setSearchQuery,
    isFilterOpen,
    setIsFilterOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isViewOrderOpen,
    setIsViewOrderOpen,
    selectedOrder,
    filters,
    setFilters,
    filteredData,
    count,
    activeFiltersCount,
    handleApplyFilters,
    handleResetFilters,
    handleExport,
    handleViewOrder,
    handlePrintOrder,
    toggleColumn,
  } = useGenericTableManagement(
    orders,
    "New Refund Requests",
    ["orderId", "customerName", "restaurant", "customerPhone", "cancellationReason", "cancelledBy"],
  )

  const restaurants = useMemo(() => {
    return [...new Set(orders.map((o) => o.restaurant))]
  }, [orders])

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      orderId: true,
      orderDate: true,
      customer: true,
      restaurant: true,
      totalAmount: true,
      orderStatus: true,
      actions: true,
    })
  }

  const refundStatusLabel = (order) => {
    if (order.refundStatus === "processed") return "Credited to wallet"
    if (order.refundStatus === "failed") return "Refund failed"
    if (order.refundStatus === "not_applicable") return "N/A (COD)"
    return "Pending"
  }

  const refundStatusClass = (order) => {
    if (order.refundStatus === "processed") return "bg-emerald-100 text-emerald-700"
    if (order.refundStatus === "failed") return "bg-red-100 text-red-700"
    if (order.refundStatus === "not_applicable") return "bg-slate-100 text-slate-600"
    return "bg-amber-100 text-amber-700"
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <OrdersTopbar
        title="Requested Orders"
        count={count}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onFilterClick={() => setIsFilterOpen(true)}
        activeFiltersCount={activeFiltersCount}
        onExport={handleExport}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      <FilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        restaurants={restaurants}
      />
      <SettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        resetColumns={resetColumns}
      />
      <ViewOrderDialog
        isOpen={isViewOrderOpen}
        onOpenChange={setIsViewOrderOpen}
        order={selectedOrder}
      />
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-20">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-4" />
            <p className="text-sm text-slate-600">Loading refund requests...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">SI</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Order ID</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Order Date</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Customer</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Restaurant</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-700 uppercase">Total Amount</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Cancelled By</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Cancellation Reason</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Refund Status</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-20 text-center">
                      <p className="text-sm text-slate-500">No refund requests found</p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((order, index) => (
                    <tr key={order.orderId} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{index + 1}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">{order.orderId}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{order.date}, {order.time}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700">{order.customerName}</span>
                          <span className="text-xs text-slate-500 mt-0.5">{order.customerPhone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{order.restaurant}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-slate-900">
                          {"\u20B9"}
                          {Number(order.totalAmount || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-xs text-emerald-600 mt-0.5">{order.paymentStatus}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{order.cancelledBy || "—"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-red-600 max-w-xs">
                          {order.cancellationReason || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${refundStatusClass(order)}`}
                          >
                            {refundStatusLabel(order)}
                          </span>
                          {order.refundStatus === "processed" && order.refundAmount != null ? (
                            <p className="text-[11px] text-slate-500">
                              {order.refundDestination === "wallet"
                                ? `Wallet · ${"\u20B9"}${Number(order.refundAmount).toFixed(2)}`
                                : `Refunded · ${"\u20B9"}${Number(order.refundAmount).toFixed(2)}`}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleViewOrder(order)}
                          className="p-1.5 rounded text-orange-600 hover:bg-orange-50 transition-colors"
                          title="View Details"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!isLoading && totalCount > 0 ? (
            <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-500">
              Showing {filteredData.length} cancelled online orders with refund details
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
