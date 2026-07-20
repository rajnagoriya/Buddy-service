import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  FileText,
  Package,
  IndianRupee,
  LifeBuoy,
  ChevronRight,
  Loader2,
  Power,
  Star,
  Calendar,
  MessageSquare,
  RefreshCw,
  TrendingUp,
} from "lucide-react"
import RestaurantPanelHeader from "@food/components/restaurant/panel/RestaurantPanelHeader"
import PanelCard from "@food/components/restaurant/panel/PanelCard"
import useRestaurantDashboardData from "@food/hooks/useRestaurantDashboardData"
import { RESTAURANT_BASE } from "@food/utils/restaurantNavConfig"

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)

function MetricPill({ label, value, sublabel, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        min-w-[132px] shrink-0 rounded-[20px] border px-4 py-3 text-left transition
        ${active ? "rt-pill-active shadow-sm" : "border-[var(--rt-border)] bg-white hover:bg-gray-50"}
      `}
    >
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
      {sublabel ? <p className="mt-0.5 text-[11px] text-gray-400">{sublabel}</p> : null}
    </button>
  )
}

function QuickTile({ icon: Icon, title, subtitle, onClick, badge }) {
  return (
    <PanelCard onClick={onClick} hoverable padding="p-0" className="overflow-hidden">
      <div className="flex h-full flex-col p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--rt-primary-soft)] text-[var(--rt-primary-strong)]">
            <Icon className="h-5 w-5" />
          </div>
          {badge ? (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{subtitle}</p>
        <div className="mt-auto flex items-center justify-end pt-3 text-[var(--rt-primary-strong)]">
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </PanelCard>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const {
    restaurant,
    isOnline,
    todayOrders,
    todayRevenue,
    liveOrders,
    preparingCount,
    readyCount,
    availableBalance,
    openComplaints,
    upcomingReservations,
    averageRating,
    loading,
    refreshing,
    error,
    refresh,
  } = useRestaurantDashboardData()

  const restaurantName =
    restaurant?.restaurantName ||
    restaurant?.name ||
    restaurant?.businessName ||
    "Your restaurant"

  const attentionItems = [
    liveOrders > 0 && { label: `${liveOrders} live orders`, route: `${RESTAURANT_BASE}/orders/live` },
    preparingCount > 0 && { label: `${preparingCount} preparing`, route: `${RESTAURANT_BASE}/orders/live` },
    readyCount > 0 && { label: `${readyCount} ready`, route: `${RESTAURANT_BASE}/orders/live` },
    openComplaints > 0 && {
      label: `${openComplaints} complaints`,
      route: `${RESTAURANT_BASE}/feedback?tab=complaints`,
    },
  ].filter(Boolean)

  return (
    <div className="rt-panel-bg min-h-screen pb-28 lg:pb-8">
      <div className="hidden lg:block">
        <RestaurantPanelHeader
          title={restaurantName}
          subtitle={isOnline ? "Accepting orders" : "Currently offline"}
          showSearch
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-4 lg:px-6 lg:py-6">
        <div className="mb-5 flex items-start justify-between gap-3 lg:hidden">
          <div>
            <p className="text-sm font-medium text-[var(--rt-primary-strong)]">Dashboard</p>
            <h1 className="text-2xl font-bold text-gray-900">{restaurantName}</h1>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--rt-border)] bg-white px-3 py-1 text-sm">
              <span
                className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-[var(--rt-primary-strong)]" : "bg-gray-400"}`}
              />
              <span className="font-medium text-gray-700">
                {isOnline ? "Accepting orders" : "Currently offline"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="rounded-2xl border border-[var(--rt-border)] bg-white p-2.5 shadow-sm disabled:opacity-60"
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--rt-primary-strong)]" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {error ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </div>
            ) : null}

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">Today at a glance</h2>
                <button
                  type="button"
                  onClick={refresh}
                  disabled={refreshing}
                  className="hidden items-center gap-1 rounded-xl px-2 py-1 text-sm text-gray-500 hover:bg-white lg:inline-flex"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                <MetricPill
                  label="Orders"
                  value={todayOrders}
                  sublabel="Today"
                  active
                  onClick={() => navigate(`${RESTAURANT_BASE}/orders/all`)}
                />
                <MetricPill
                  label="Revenue"
                  value={formatCurrency(todayRevenue)}
                  sublabel="Today"
                  onClick={() => navigate(`${RESTAURANT_BASE}/hub-finance`)}
                />
                <MetricPill
                  label="Payout"
                  value={formatCurrency(availableBalance)}
                  sublabel="Available"
                  onClick={() => navigate(`${RESTAURANT_BASE}/hub-finance`)}
                />
                <MetricPill
                  label="Rating"
                  value={averageRating ? `${averageRating.toFixed(1)} ★` : "—"}
                  sublabel="Average"
                  onClick={() => navigate(`${RESTAURANT_BASE}/feedback`)}
                />
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-base font-bold text-gray-900">Quick actions</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                <QuickTile
                  icon={FileText}
                  title="Live orders"
                  subtitle="Accept and manage incoming orders"
                  badge={liveOrders > 0 ? String(liveOrders) : null}
                  onClick={() => navigate(`${RESTAURANT_BASE}/orders/live`)}
                />
                <QuickTile
                  icon={Package}
                  title="Menu"
                  subtitle="Edit dishes, prices and availability"
                  onClick={() => navigate(`${RESTAURANT_BASE}/inventory`)}
                />
                <QuickTile
                  icon={IndianRupee}
                  title="Accounting"
                  subtitle="Payouts, invoices and bank details"
                  onClick={() => navigate(`${RESTAURANT_BASE}/hub-finance`)}
                />
                <QuickTile
                  icon={Calendar}
                  title="Reservations"
                  subtitle="Table bookings and dining queue"
                  badge={upcomingReservations > 0 ? String(upcomingReservations) : null}
                  onClick={() => navigate(`${RESTAURANT_BASE}/reservations`)}
                />
                <QuickTile
                  icon={Power}
                  title="Online status"
                  subtitle="Go online or schedule off time"
                  onClick={() => navigate(`${RESTAURANT_BASE}/outlet-timings`)}
                />
                <QuickTile
                  icon={MessageSquare}
                  title="Feedback"
                  subtitle="Reviews and customer complaints"
                  badge={openComplaints > 0 ? String(openComplaints) : null}
                  onClick={() => navigate(`${RESTAURANT_BASE}/feedback`)}
                />
                <QuickTile
                  icon={LifeBuoy}
                  title="Support"
                  subtitle="Get help from partner team"
                  onClick={() => navigate(`${RESTAURANT_BASE}/help-centre/support`)}
                />
                <QuickTile
                  icon={Star}
                  title="All settings"
                  subtitle="Outlet, delivery, finance and more"
                  onClick={() => navigate(`${RESTAURANT_BASE}/explore`)}
                />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <PanelCard padding="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[var(--rt-primary-strong)]" />
                  <h3 className="font-bold text-gray-900">Operations summary</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-[var(--rt-surface-muted)] px-3 py-3">
                    <p className="text-gray-500">Live queue</p>
                    <p className="text-xl font-bold text-gray-900">{liveOrders}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--rt-surface-muted)] px-3 py-3">
                    <p className="text-gray-500">Reservations</p>
                    <p className="text-xl font-bold text-gray-900">{upcomingReservations}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--rt-surface-muted)] px-3 py-3">
                    <p className="text-gray-500">Preparing</p>
                    <p className="text-xl font-bold text-gray-900">{preparingCount}</p>
                  </div>
                  <div className="rounded-2xl bg-[var(--rt-surface-muted)] px-3 py-3">
                    <p className="text-gray-500">Ready</p>
                    <p className="text-xl font-bold text-gray-900">{readyCount}</p>
                  </div>
                </div>
              </PanelCard>

              <PanelCard padding="p-5">
                <h3 className="mb-3 font-bold text-gray-900">Shortcuts</h3>
                <div className="space-y-2">
                  {[
                    { label: "Order history", route: `${RESTAURANT_BASE}/orders/all` },
                    { label: "Delivery settings", route: `${RESTAURANT_BASE}/delivery-settings` },
                    { label: "Outlet information", route: `${RESTAURANT_BASE}/outlet-info` },
                    { label: "Zone setup", route: `${RESTAURANT_BASE}/zone-setup` },
                  ].map((item) => (
                    <button
                      key={item.route}
                      type="button"
                      onClick={() => navigate(item.route)}
                      className="flex w-full items-center justify-between rounded-2xl border border-[var(--rt-border)] px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-[var(--rt-surface-muted)]"
                    >
                      {item.label}
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              </PanelCard>
            </section>
          </motion.div>
        )}
      </div>

      {attentionItems.length > 0 ? (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 px-4 lg:bottom-4 lg:left-[290px]">
          <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto rounded-2xl border border-[var(--rt-border)] bg-white p-2 shadow-lg">
            {attentionItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.route)}
                className="shrink-0 rounded-xl bg-[var(--rt-primary-soft)] px-3 py-2 text-xs font-semibold text-[var(--rt-primary-strong)]"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
