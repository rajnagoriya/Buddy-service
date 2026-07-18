import { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { Package, Truck, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import OrdersTopbar from "@food/components/admin/orders/OrdersTopbar"
import OrderDetectDeliveryTable from "@food/components/admin/orders/OrderDetectDeliveryTable"
import ViewOrderDetectDeliveryDialog from "@food/components/admin/orders/ViewOrderDetectDeliveryDialog"
import SettingsDialog from "@food/components/admin/orders/SettingsDialog"
import FilterPanel from "@food/components/admin/orders/FilterPanel"
import { useGenericTableManagement } from "@food/components/admin/orders/useGenericTableManagement"
import { extractPagination } from "@food/utils/pagination"

const PAGE_SIZE = 30

const EMPTY_STATS = {
  total: 0,
  ordered: 0,
  restaurantAccepted: 0,
  deliveryBoyAssigned: 0,
  reachedPickup: 0,
  orderIdAccepted: 0,
  reachedDrop: 0,
}

const getOrderStatus = (order) => String(order?.orderStatus || order?.status || "").toLowerCase()
const isCancelledOrder = (status, cancelledAt) =>
  status === "cancelled" ||
  status === "cancelled_by_user" ||
  status === "cancelled_by_restaurant" ||
  status === "rejected_by_restaurant" ||
  status === "cancelled_by_admin" ||
  Boolean(cancelledAt)

const isTerminalLiveOrder = (order) => {
  const status = getOrderStatus(order)
  return (
    status === "delivered" ||
    isCancelledOrder(status, order?.cancelledAt)
  )
}

const mapOrderStatus = (order) => {
  const status = getOrderStatus(order)
  const { deliveryPartnerName, deliveryState, cancelledAt } = order

  if (isCancelledOrder(status, cancelledAt)) return "Rejected"
  if (status === "delivered") return "Ordered Delivered"

  if (deliveryState?.currentPhase === "at_delivery" || deliveryState?.currentPhase === "at_drop") {
    return "Reached Drop"
  }
  if (deliveryState?.currentPhase === "at_pickup") {
    return "Delivery Boy Reached Pickup"
  }
  if (
    deliveryState?.status === "order_confirmed" ||
    deliveryState?.currentPhase === "en_route_to_delivery" ||
    deliveryState?.orderIdConfirmedAt
  ) {
    return "Order ID Accepted"
  }
  if (deliveryPartnerName) return "Delivery Boy Assigned"

  const statusMap = {
    created: "Ordered",
    pending: "Ordered",
    scheduled: "Ordered",
    confirmed: "Restaurant Accepted",
    preparing: "Restaurant Accepted",
    ready_for_pickup: "Restaurant Accepted",
    ready: "Restaurant Accepted",
    reached_pickup: "Delivery Boy Reached Pickup",
    picked_up: "Order ID Accepted",
    out_for_delivery: "Order ID Accepted",
    reached_drop: "Reached Drop",
  }

  return statusMap[status] || "Ordered"
}

const buildStatusHistory = (order) => {
  const history = []
  const { createdAt, tracking, deliveryState, deliveryPartnerName, deliveryPartnerPhone, cancelledAt } = order
  const status = getOrderStatus(order)

  const formatTimestamp = (date) => {
    if (!date) return null
    const d = new Date(date)
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  }

  history.push({
    status: "Ordered",
    timestamp: formatTimestamp(createdAt) || "N/A",
  })

  if (isCancelledOrder(status, cancelledAt)) {
    history.push({
      status: "Rejected",
      timestamp: formatTimestamp(cancelledAt) || formatTimestamp(order.updatedAt) || "N/A",
    })
    return history
  }

  if (tracking?.confirmed?.status && tracking?.confirmed?.timestamp) {
    history.push({
      status: "Restaurant Accepted",
      timestamp: formatTimestamp(tracking.confirmed.timestamp),
    })
  } else if (
    status === "confirmed" ||
    status === "preparing" ||
    status === "ready" ||
    status === "ready_for_pickup"
  ) {
    history.push({
      status: "Restaurant Accepted",
      timestamp: formatTimestamp(order.updatedAt) || "N/A",
    })
  }

  if (deliveryPartnerName) {
    history.push({
      status: "Delivery Boy Assigned",
      timestamp: formatTimestamp(deliveryState?.acceptedAt) || formatTimestamp(order.updatedAt) || "N/A",
      deliveryBoy: deliveryPartnerName || "Delivery Boy",
      deliveryBoyNumber: deliveryPartnerPhone || "N/A",
    })
  }

  if (deliveryState?.reachedPickupAt) {
    history.push({
      status: "Delivery Boy Reached Pickup",
      timestamp: formatTimestamp(deliveryState.reachedPickupAt),
    })
  } else if (deliveryState?.currentPhase === "at_pickup") {
    history.push({
      status: "Delivery Boy Reached Pickup",
      timestamp: formatTimestamp(order.updatedAt) || "N/A",
    })
  }

  if (deliveryState?.orderIdConfirmedAt) {
    history.push({
      status: "Order ID Accepted",
      timestamp: formatTimestamp(deliveryState.orderIdConfirmedAt),
    })
  } else if (
    deliveryState?.status === "order_confirmed" ||
    deliveryState?.currentPhase === "en_route_to_delivery" ||
    status === "picked_up"
  ) {
    history.push({
      status: "Order ID Accepted",
      timestamp: formatTimestamp(order.updatedAt) || "N/A",
    })
  }

  if (deliveryState?.reachedDropAt) {
    history.push({
      status: "Reached Drop",
      timestamp: formatTimestamp(deliveryState.reachedDropAt),
    })
  } else if (
    deliveryState?.currentPhase === "at_delivery" ||
    deliveryState?.currentPhase === "at_drop" ||
    status === "reached_drop"
  ) {
    history.push({
      status: "Reached Drop",
      timestamp: formatTimestamp(order.updatedAt) || "N/A",
    })
  }

  if (status === "delivered") {
    history.push({
      status: "Ordered Delivered",
      timestamp:
        formatTimestamp(tracking?.delivered?.timestamp) ||
        formatTimestamp(order.deliveredAt) ||
        formatTimestamp(order.updatedAt) ||
        "N/A",
    })
  }

  return history
}

const transformOrder = (order, index, pageOffset = 0) => {
  const user = order?.userId && typeof order.userId === "object" ? order.userId : null
  const restaurant =
    order?.restaurantId && typeof order.restaurantId === "object" ? order.restaurantId : null
  const deliveryFromDispatch =
    order?.dispatch?.deliveryPartnerId && typeof order.dispatch.deliveryPartnerId === "object"
      ? order.dispatch.deliveryPartnerId
      : null

  const deliveryBoyName =
    order.deliveryPartnerName ||
    order.deliveryBoyName ||
    deliveryFromDispatch?.name ||
    order.deliveryPartnerId?.name ||
    null

  const deliveryBoyNumber =
    order.deliveryPartnerPhone ||
    order.deliveryBoyNumber ||
    deliveryFromDispatch?.phone ||
    order.deliveryPartnerId?.phone ||
    null

  const normalizedOrder = {
    ...order,
    status: order.status || order.orderStatus,
    deliveryPartnerName: deliveryBoyName,
    deliveryPartnerPhone: deliveryBoyNumber,
  }

  const orderDate = new Date(order.createdAt)
  const dateStr = orderDate
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase()
  const timeStr = orderDate
    .toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase()

  return {
    sl: pageOffset + index + 1,
    orderId: order.orderId || order.order_id || order._id,
    userName: order.customerName || order.userName || user?.name || "Unknown",
    userNumber:
      order.customerPhone ||
      order.userNumber ||
      user?.phone ||
      order.deliveryAddress?.phone ||
      "N/A",
    restaurantName:
      order.restaurantName || order.restaurant || restaurant?.restaurantName || "Unknown Restaurant",
    deliveryBoyName,
    deliveryBoyNumber,
    status: mapOrderStatus(normalizedOrder),
    statusHistory: buildStatusHistory(normalizedOrder),
    orderDate: dateStr,
    orderTime: timeStr,
    originalOrder: order,
  }
}

const computeLiveStats = (list) => {
  const safe = Array.isArray(list) ? list : []
  return {
    total: safe.length,
    ordered: safe.filter((o) => o.status === "Ordered").length,
    restaurantAccepted: safe.filter(
      (o) => o.status === "Restaurant Accepted" || o.status === "Accepted"
    ).length,
    deliveryBoyAssigned: safe.filter((o) => o.status === "Delivery Boy Assigned").length,
    reachedPickup: safe.filter(
      (o) => o.status === "Delivery Boy Reached Pickup" || o.status === "Reached Pickup"
    ).length,
    orderIdAccepted: safe.filter((o) => o.status === "Order ID Accepted").length,
    reachedDrop: safe.filter((o) => o.status === "Reached Drop").length,
  }
}

export default function OrderDetectDelivery() {
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    orderId: true,
    userInfo: true,
    restaurantName: true,
    deliveryBoy: true,
    status: true,
    actions: true,
  })

  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [paginationMeta, setPaginationMeta] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    limit: PAGE_SIZE,
  })
  const [pageStats, setPageStats] = useState({ ...EMPTY_STATS })
  const currentPageRef = useRef(1)

  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])

  const fetchOrders = useCallback(async (options = {}) => {
    const { silent = false, page = currentPageRef.current } = options
    const safePage = Math.max(1, Number(page) || 1)

    try {
      if (!silent) setIsLoading(true)
      setError(null)

      const response = await adminAPI.getOrders({
        page: safePage,
        limit: PAGE_SIZE,
        status: "live",
      })

      const payload = response?.data?.data ?? response?.data ?? {}
      const rawOrders = payload?.orders ?? payload?.docs ?? []
      const list = Array.isArray(rawOrders) ? rawOrders : []

      // Safety net: never show delivered/rejected even if API drifts
      const liveOrders = list.filter((order) => !isTerminalLiveOrder(order))
      const pageOffset = (safePage - 1) * PAGE_SIZE
      const transformed = liveOrders.map((order, index) =>
        transformOrder(order, index, pageOffset)
      )

      const pagination = extractPagination(payload?.pagination || payload)
      const total = Number(pagination.total ?? payload?.total ?? transformed.length) || 0
      const limit = Number(pagination.limit ?? PAGE_SIZE) || PAGE_SIZE
      const totalPages =
        Number(pagination.totalPages) || (total > 0 ? Math.ceil(total / limit) : 0)
      const resolvedPage = Number(pagination.page) || safePage

      if (response.data?.success) {
        setOrders(transformed)
        setPaginationMeta({ total, totalPages, page: resolvedPage, limit })
        setPageStats(computeLiveStats(transformed))
        if (resolvedPage !== currentPageRef.current) {
          setCurrentPage(resolvedPage)
        }
      } else {
        setError(response.data?.message || "Failed to fetch orders")
        toast.error("Failed to fetch orders")
        setOrders([])
        setPaginationMeta({ total: 0, totalPages: 0, page: 1, limit: PAGE_SIZE })
        setPageStats({ ...EMPTY_STATS })
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch orders")
      if (!silent) {
        toast.error(err.response?.data?.message || "Failed to fetch orders")
      }
      setOrders([])
      setPaginationMeta({ total: 0, totalPages: 0, page: 1, limit: PAGE_SIZE })
      setPageStats({ ...EMPTY_STATS })
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders({ silent: false, page: 1 })
  }, [fetchOrders])

  const handlePageChange = useCallback(
    (page) => {
      const nextPage = Math.max(1, Number(page) || 1)
      if (nextPage === currentPageRef.current) return
      currentPageRef.current = nextPage
      setCurrentPage(nextPage)
      fetchOrders({ silent: true, page: nextPage })
    },
    [fetchOrders]
  )

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
    "Order Detect Delivery",
    ["orderId", "userName", "userNumber", "restaurantName", "deliveryBoyName", "status"]
  )

  const hasClientFilters = Boolean(searchQuery.trim()) || activeFiltersCount > 0

  const stats = useMemo(() => {
    if (hasClientFilters) return computeLiveStats(filteredData)
    return {
      ...pageStats,
      total: paginationMeta.total || pageStats.total,
    }
  }, [hasClientFilters, filteredData, pageStats, paginationMeta.total])

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      orderId: true,
      userInfo: true,
      restaurantName: true,
      deliveryBoy: true,
      status: true,
      actions: true,
    })
  }

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          <p className="text-slate-600 font-medium">Loading live orders...</p>
        </div>
      </div>
    )
  }

  if (error && orders.length === 0) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Error Loading Orders</h3>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => fetchOrders({ silent: false, page: 1 })}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const statCards = [
    { label: "Live orders", value: stats.total, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Ordered", value: stats.ordered, icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
    {
      label: "Restaurant Accepted",
      value: stats.restaurantAccepted,
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Delivery Boy Assigned",
      value: stats.deliveryBoyAssigned,
      icon: Truck,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Reached Pickup",
      value: stats.reachedPickup,
      icon: Package,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "Order ID Accepted",
      value: stats.orderIdAccepted,
      icon: CheckCircle,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Reached Drop",
      value: stats.reachedDrop,
      icon: Truck,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ]

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <OrdersTopbar
        title="Order Detect Delivery"
        count={hasClientFilters ? count : paginationMeta.total || count}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onFilterClick={() => setIsFilterOpen(true)}
        activeFiltersCount={activeFiltersCount}
        onExport={handleExport}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">{card.label}</p>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${card.bg}`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <SettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        resetColumns={resetColumns}
        columnsConfig={{
          si: "Serial Number",
          orderId: "Order ID",
          userInfo: "User Name & Number",
          restaurantName: "Restaurant Name",
          deliveryBoy: "Delivery Boy Name & Number",
          status: "Status",
          actions: "Actions",
        }}
      />
      <ViewOrderDetectDeliveryDialog
        isOpen={isViewOrderOpen}
        onOpenChange={setIsViewOrderOpen}
        order={selectedOrder}
      />
      <OrderDetectDeliveryTable
        orders={filteredData}
        visibleColumns={visibleColumns}
        onViewOrder={handleViewOrder}
        onPrintOrder={handlePrintOrder}
        pageSize={PAGE_SIZE}
        {...(hasClientFilters
          ? {}
          : {
              currentPage: paginationMeta.page || currentPage,
              totalPages: paginationMeta.totalPages,
              totalItems: paginationMeta.total,
              onPageChange: handlePageChange,
            })}
      />
      <FilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />
    </div>
  )
}
