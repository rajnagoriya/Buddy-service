import { useCallback, useEffect, useState } from "react"
import {
  Search,
  Loader2,
  IndianRupee,
  Eye,
  X,
  TrendingUp,
  Package,
  Bike,
  Building2,
} from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const formatDate = (dateString) => {
  if (!dateString) return "N/A"
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function SourceRow({ label, value, negative = false, emphasize = false, note }) {
  const amount = Number(value || 0)
  if (!emphasize && amount === 0 && !note) return null
  return (
    <div className={`flex items-start justify-between gap-3 text-sm ${emphasize ? "pt-2 border-t border-slate-200" : ""}`}>
      <div className="min-w-0">
        <p className={`${emphasize ? "font-bold text-slate-900" : "text-slate-600"}`}>{label}</p>
        {note ? <p className="text-[11px] text-slate-400 mt-0.5">{note}</p> : null}
      </div>
      <span
        className={`shrink-0 font-semibold ${
          negative
            ? "text-rose-600"
            : emphasize
              ? "text-emerald-700"
              : "text-slate-900"
        }`}
      >
        {negative ? "−" : ""}
        {formatCurrency(Math.abs(amount))}
      </span>
    </div>
  )
}

export default function AdminRevenue() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({
    totalAdminEarning: 0,
    totalOrders: 0,
    totalDeliveryFee: 0,
    totalPlatformFee: 0,
    totalCommission: 0,
    totalRiderPayout: 0,
    averageAdminEarning: 0,
  })
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 })
  const [filters, setFilters] = useState({
    search: "",
    period: "all",
    employmentType: "",
    fromDate: "",
    toDate: "",
  })
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState(null)

  const fetchRevenue = useCallback(async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getAdminRevenue({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search || undefined,
        period: filters.period || undefined,
        employmentType: filters.employmentType || undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
      })
      if (response.data?.success) {
        setRows(response.data.data.rows || [])
        setSummary(response.data.data.summary || {})
        setPagination((prev) => ({
          ...prev,
          ...(response.data.data.pagination || {}),
        }))
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load admin revenue")
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters])

  useEffect(() => {
    fetchRevenue()
  }, [fetchRevenue])

  const openDetail = async (orderId) => {
    try {
      setDetailOpen(true)
      setDetailLoading(true)
      setDetail(null)
      const response = await adminAPI.getAdminRevenueOrder(orderId)
      if (response.data?.success) {
        setDetail(response.data.data.order)
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load order revenue")
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const sources = detail?.sources || {}

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Revenue</h1>
        <p className="text-sm text-slate-500 mt-1">
          Per-order platform earnings with payment source breakdown. Salary partners keep delivery charges with admin; per-order partners earn slab + speed + multi-resto only.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" /> Total admin earning
          </div>
          <p className="text-2xl font-black text-emerald-800 mt-2">{formatCurrency(summary.totalAdminEarning)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
            <Package className="w-4 h-4" /> Delivered orders
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{summary.totalOrders || 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
            <IndianRupee className="w-4 h-4" /> Avg per order
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{formatCurrency(summary.averageAdminEarning)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
            <Bike className="w-4 h-4" /> Rider payouts
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{formatCurrency(summary.totalRiderPayout)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={filters.search}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, search: e.target.value }))
                setPagination((prev) => ({ ...prev, page: 1 }))
              }}
              placeholder="Search order, restaurant, or rider"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            value={filters.period}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, period: e.target.value, fromDate: "", toDate: "" }))
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
          <select
            value={filters.employmentType}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, employmentType: e.target.value }))
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
          >
            <option value="">All partner types</option>
            <option value="per_order">Per order</option>
            <option value="salary">Salary</option>
          </select>
          <input
            type="date"
            value={filters.fromDate}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, fromDate: e.target.value, period: "all" }))
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
          />
          <input
            type="date"
            value={filters.toDate}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, toDate: e.target.value, period: "all" }))
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Restaurant</th>
                <th className="px-4 py-3 font-semibold">Rider</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Delivery fee</th>
                <th className="px-4 py-3 font-semibold">Rider payout</th>
                <th className="px-4 py-3 font-semibold">Admin earning</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">View</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin inline-block mr-2" />
                    Loading revenue…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-slate-500">
                    No delivered orders found for this filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row._id} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-900">#{row.orderId}</td>
                    <td className="px-4 py-3 text-slate-700">{row.restaurantName}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{row.deliveryPartnerName}</div>
                      {row.deliveryPartnerPhone ? (
                        <div className="text-xs text-slate-400">{row.deliveryPartnerPhone}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                          row.isSalary
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-sky-50 text-sky-700 border border-sky-200"
                        }`}
                      >
                        {row.isSalary ? "Salary" : "Per order"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatCurrency(row.deliveryFee)}</td>
                    <td className="px-4 py-3">{formatCurrency(row.riderPayout)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">{formatCurrency(row.adminEarning)}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openDetail(row._id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Sources
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
            <span className="text-slate-500">
              Page {pagination.page} of {pagination.pages} · {pagination.total} orders
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.pages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Admin earning sources</h2>
                <p className="text-xs text-slate-500">
                  {detail ? `#${detail.orderId}` : "Loading…"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="rounded-full p-2 hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {detailLoading ? (
                <div className="py-16 text-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin inline-block mr-2" />
                  Loading…
                </div>
              ) : detail ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[11px] font-bold uppercase text-slate-400">Restaurant</p>
                      <p className="font-semibold text-slate-900 mt-1">{detail.restaurantName}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[11px] font-bold uppercase text-slate-400">Rider</p>
                      <p className="font-semibold text-slate-900 mt-1">
                        {detail.deliveryPartner?.name || "N/A"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {detail.isSalary ? "Salary basis" : "Per-order basis"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      Admin net earning
                    </p>
                    <p className="text-3xl font-black text-emerald-800 mt-1">
                      {formatCurrency(detail.adminEarning)}
                    </p>
                    <p className="text-xs text-emerald-700/80 mt-2">{detail.payoutRule}</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-slate-500" />
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Payment sources
                      </p>
                    </div>
                    <SourceRow label="Platform fee" value={sources.platformFee} />
                    <SourceRow label="Restaurant commission" value={sources.restaurantCommission} />
                    {detail.isSalary ? (
                      <>
                        <SourceRow
                          label="Full delivery charge → admin"
                          value={sources.deliveryChargeToAdmin}
                          note="Salary rider — no per-order payout; entire customer delivery fee stays with admin"
                        />
                        <SourceRow
                          label="Of which: distance slab user charge"
                          value={sources.distanceSlabUserCharge}
                        />
                        <SourceRow
                          label="Of which: would-be rider fee (retained)"
                          value={sources.salaryReclaim || sources.distanceSlabDeliveryBoyFee}
                        />
                        <SourceRow
                          label="Cart Delivery Speed fee (in delivery)"
                          value={sources.speedFeeModifier}
                        />
                      </>
                    ) : (
                      <>
                        <SourceRow
                          label="Delivery margin (User Charge − Boy Fee)"
                          value={sources.deliveryMarginBase}
                          note="From distance slab rules"
                        />
                        <SourceRow
                          label="Cart Delivery Speed — admin share"
                          value={sources.speedShareAdmin}
                        />
                        <SourceRow
                          label="Delivery portion to admin"
                          value={sources.deliveryChargeToAdmin}
                          note="Margin + admin speed share only"
                        />
                      </>
                    )}
                    <SourceRow
                      label="Free delivery subsidy"
                      value={sources.freeDeliverySubsidy}
                      negative
                    />
                    <SourceRow
                      label="Admin coupon discount"
                      value={sources.adminCouponDiscount}
                      negative
                    />
                    <SourceRow
                      label="Negative speed borne"
                      value={sources.negativeSpeedBear}
                      negative
                    />
                    <SourceRow label="Admin net" value={detail.adminEarning} emphasize />
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Bike className="w-4 h-4 text-slate-500" />
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Rider side
                      </p>
                    </div>
                    <SourceRow
                      label="Distance slab — Delivery Boy Fee"
                      value={sources.distanceSlabDeliveryBoyFee}
                    />
                    <SourceRow
                      label="Multi-restaurant surcharge"
                      value={sources.multiRestaurantSurcharge}
                    />
                    <SourceRow
                      label="Cart Delivery Speed — driver share"
                      value={sources.speedShareDriver}
                    />
                    <SourceRow
                      label={detail.isSalary ? "Rider payout (salary = ₹0)" : "Rider payout"}
                      value={detail.riderPayout}
                      emphasize
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
