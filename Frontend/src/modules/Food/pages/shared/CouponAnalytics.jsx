import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, TrendingUp, Users, Ticket, IndianRupee } from "lucide-react"
import { toast } from "sonner"
import { adminAPI, restaurantAPI } from "@food/api"

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
      </div>
    </div>
  )
}

export default function CouponAnalytics({ mode = "admin" }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [analytics, setAnalytics] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const api = mode === "restaurant" ? restaurantAPI : adminAPI
      const analyticsFn = mode === "restaurant" ? api.getMyOfferAnalytics : api.getAdminOfferAnalytics
      const historyFn = mode === "restaurant" ? api.getMyOfferUsageHistory : api.getAdminOfferUsageHistory
      const [aRes, hRes] = await Promise.all([
        analyticsFn(id),
        historyFn(id, { limit: 50 }),
      ])
      setAnalytics(aRes?.data?.data || aRes?.data || null)
      setHistory(hRes?.data?.data?.history || hRes?.data?.history || [])
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }, [id, mode])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const backPath = mode === "restaurant" ? "/food/restaurant/coupons" : "/admin/food/coupons"

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading analytics...</div>
  }

  if (!analytics) {
    return <div className="p-6 text-sm text-red-600">Coupon not found</div>
  }

  const dailyEntries = Object.entries(analytics.dailyUsage || {}).slice(-14)

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(backPath)} className="p-2 rounded-lg hover:bg-white border border-slate-200">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{analytics.couponCode}</h1>
            <p className="text-sm text-slate-500">Coupon analytics</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Ticket} label="Total Uses" value={analytics.totalUses ?? 0} color="bg-blue-100 text-blue-600" />
          <StatCard icon={TrendingUp} label="Today's Uses" value={analytics.todayUses ?? 0} color="bg-green-100 text-green-600" />
          <StatCard icon={Users} label="Unique Users" value={analytics.uniqueUsers ?? 0} color="bg-purple-100 text-purple-600" />
          <StatCard icon={IndianRupee} label="Discount Given" value={`₹${analytics.totalDiscount ?? 0}`} color="bg-amber-100 text-amber-600" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={TrendingUp} label="This Week" value={analytics.weekUses ?? 0} color="bg-slate-100 text-slate-600" />
          <StatCard icon={TrendingUp} label="This Month" value={analytics.monthUses ?? 0} color="bg-slate-100 text-slate-600" />
          <StatCard icon={IndianRupee} label="Revenue Generated" value={`₹${analytics.revenueGenerated ?? 0}`} color="bg-emerald-100 text-emerald-600" />
          <StatCard icon={IndianRupee} label="Free Delivery Cost" value={`₹${analytics.freeDeliveryCost ?? 0}`} color="bg-orange-100 text-orange-600" />
        </div>

        {dailyEntries.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Daily Usage (last 14 days)</h2>
            <div className="flex items-end gap-1 h-24">
              {dailyEntries.map(([day, count]) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${Math.max(8, (count / Math.max(...dailyEntries.map(([, c]) => c), 1)) * 80)}px` }}
                    title={`${day}: ${count}`}
                  />
                  <span className="text-[9px] text-slate-400 rotate-0 truncate w-full text-center">{day.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Usage History</h2>
          </div>
          {history.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No usage yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-600 uppercase">
                    {["Order", "Customer", "Restaurant", "Discount", "Order Amt", "Subsidy", "Date", "Status"].map((h) => (
                      <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((row) => (
                    <tr key={`${row.orderId}-${row.usedAt}`}>
                      <td className="px-3 py-2 font-mono text-xs">{String(row.orderId).slice(-8)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.customerName}<br /><span className="text-xs text-slate-400">{row.customerPhone}</span></td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.restaurant}</td>
                      <td className="px-3 py-2">₹{row.discountAmount ?? 0}</td>
                      <td className="px-3 py-2">₹{row.orderAmount ?? 0}</td>
                      <td className="px-3 py-2">₹{row.platformSubsidy ?? 0}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{row.usedAt ? new Date(row.usedAt).toLocaleString() : "—"}</td>
                      <td className="px-3 py-2 capitalize">{row.orderStatus || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
