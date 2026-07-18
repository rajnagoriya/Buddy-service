import { useState, useEffect, useMemo } from "react"
import { Eye, Printer, ArrowUpDown, Phone, User, MoreVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"

const getStatusColor = (status) => {
  const colors = {
    Ordered: "bg-blue-100 text-blue-700",
    Accepted: "bg-green-100 text-green-700",
    "Restaurant Accepted": "bg-emerald-100 text-emerald-700",
    "Delivery Boy Assigned": "bg-purple-100 text-purple-700",
    "Delivery Boy Reached Pickup": "bg-orange-100 text-orange-700",
    "Reached Pickup": "bg-orange-100 text-orange-700",
    "Order ID Accepted": "bg-indigo-100 text-indigo-700",
    "Reached Drop": "bg-amber-100 text-amber-700",
  }
  return colors[status] || "bg-slate-100 text-slate-700"
}

export default function OrderDetectDeliveryTable({
  orders,
  visibleColumns,
  onViewOrder,
  onPrintOrder,
  currentPage: controlledPage,
  totalPages: controlledTotalPages,
  totalItems: controlledTotalItems,
  pageSize = 30,
  onPageChange,
}) {
  const isServerPaginated = typeof onPageChange === "function"
  const [clientPage, setClientPage] = useState(1)
  const itemsPerPage = pageSize || 30

  const currentPage = isServerPaginated
    ? Math.max(1, Number(controlledPage) || 1)
    : clientPage

  const totalItems = isServerPaginated
    ? Math.max(0, Number(controlledTotalItems) || 0)
    : orders.length

  const totalPages = isServerPaginated
    ? Math.max(0, Number(controlledTotalPages) || 0)
    : Math.ceil(orders.length / itemsPerPage)

  useEffect(() => {
    if (!isServerPaginated) {
      setClientPage(1)
    }
  }, [orders.length, isServerPaginated])

  const paginatedOrders = useMemo(() => {
    if (isServerPaginated) return orders
    const start = (currentPage - 1) * itemsPerPage
    return orders.slice(start, start + itemsPerPage)
  }, [orders, currentPage, itemsPerPage, isServerPaginated])

  const handlePageChange = (page) => {
    const nextPage = Math.max(1, Math.min(page, Math.max(totalPages, 1)))
    if (isServerPaginated) {
      onPageChange(nextPage)
    } else {
      setClientPage(nextPage)
    }
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-32 h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center shadow-md">
              <span className="text-5xl text-orange-500 font-bold">!</span>
            </div>
          </div>
          <p className="text-lg font-semibold text-slate-700 mb-1">No live orders</p>
          <p className="text-sm text-slate-500">There are no in-progress orders right now</p>
        </div>
      </div>
    )
  }

  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const rangeEnd = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {visibleColumns.si && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>SI</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              )}
              {visibleColumns.orderId && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Order ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              )}
              {visibleColumns.userInfo && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>User Name & Number</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              )}
              {visibleColumns.restaurantName && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Restaurant Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              )}
              {visibleColumns.deliveryBoy && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Delivery Boy Name & Number</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              )}
              {visibleColumns.status && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              )}
              {visibleColumns.actions && (
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {paginatedOrders.map((order, index) => (
              <tr key={order.orderId || index} className="hover:bg-slate-50 transition-colors">
                {visibleColumns.si && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-700">
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </span>
                  </td>
                )}
                {visibleColumns.orderId && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-900">#{order.orderId}</span>
                  </td>
                )}
                {visibleColumns.userInfo && (
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 mb-1">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-sm font-medium text-slate-700">{order.userName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs text-slate-600">{order.userNumber}</span>
                      </div>
                    </div>
                  </td>
                )}
                {visibleColumns.restaurantName && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-700">{order.restaurantName}</span>
                  </td>
                )}
                {visibleColumns.deliveryBoy && (
                  <td className="px-6 py-4">
                    {order.deliveryBoyName ? (
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 mb-1">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-sm font-medium text-slate-700">
                            {order.deliveryBoyName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-xs text-slate-600">{order.deliveryBoyNumber}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Not assigned</span>
                    )}
                  </td>
                )}
                {visibleColumns.status && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                    >
                      {order.status}
                    </span>
                  </td>
                )}
                {visibleColumns.actions && (
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-50"
                      >
                        <DropdownMenuItem
                          onClick={() => onViewOrder(order)}
                          className="cursor-pointer flex items-center gap-2 text-orange-600"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Details</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onPrintOrder(order)}
                          className="cursor-pointer flex items-center gap-2 text-blue-600"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Print Order</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(totalPages > 1 || (isServerPaginated && totalItems > 0)) && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-slate-600">
            Showing <span className="font-semibold">{rangeStart}</span> to{" "}
            <span className="font-semibold">{rangeEnd}</span> of{" "}
            <span className="font-semibold">{totalItems}</span> orders
            {isServerPaginated && (
              <span className="text-slate-400"> · {itemsPerPage} per page</span>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                        currentPage === pageNum
                          ? "bg-emerald-500 text-white shadow-md"
                          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
