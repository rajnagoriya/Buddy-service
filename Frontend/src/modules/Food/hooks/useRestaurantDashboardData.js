import { useCallback, useEffect, useState } from "react"
import { restaurantAPI, diningAPI } from "@food/api"
import { useRestaurantSession } from "@food/context/RestaurantSessionContext"

const normalizeOrderStatus = (status) => {
  const value = String(status || "").toLowerCase()
  if (value === "created") return "confirmed"
  return value
}

const isToday = (dateValue) => {
  if (!dateValue) return false
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

const LIVE_STATUSES = new Set([
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "out-for-delivery",
  "scheduled",
])

const countOrdersByStatus = (orders = []) => {
  const counts = {
    live: 0,
    preparing: 0,
    ready: 0,
    pending: 0,
    complaints: 0,
  }

  orders.forEach((order) => {
    const status = normalizeOrderStatus(order?.status || order?.orderStatus)
    if (LIVE_STATUSES.has(status)) counts.live += 1
    if (status === "preparing") counts.preparing += 1
    if (status === "ready") counts.ready += 1
    if (status === "pending" || status === "confirmed") counts.pending += 1
  })

  return counts
}

const sumTodayRevenue = (orders = []) =>
  orders.reduce((sum, order) => {
    if (!isToday(order?.createdAt)) return sum
    const status = normalizeOrderStatus(order?.status || order?.orderStatus)
    if (status === "cancelled") return sum
    const total = Number(order?.pricing?.total ?? order?.total ?? 0)
    return sum + (Number.isFinite(total) ? total : 0)
  }, 0)

const countTodayOrders = (orders = []) =>
  orders.filter((order) => {
    if (!isToday(order?.createdAt)) return false
    const status = normalizeOrderStatus(order?.status || order?.orderStatus)
    return status !== "cancelled"
  }).length

const extractComplaints = (response) => {
  const payload = response?.data?.data
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.complaints)) return payload.complaints
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

const countOpenComplaints = (complaints = []) =>
  complaints.filter((item) => {
    const status = String(item?.status || "").toLowerCase()
    return !status || status === "open" || status === "pending" || status === "new"
  }).length

const countUpcomingReservations = (bookings = []) =>
  bookings.filter((booking) => {
    const status = String(booking?.status || "").toLowerCase()
    return status === "pending" || status === "confirmed" || status === "accepted"
  }).length

const initialState = {
  restaurant: null,
  isOnline: false,
  todayOrders: 0,
  todayRevenue: 0,
  liveOrders: 0,
  preparingCount: 0,
  readyCount: 0,
  pendingCount: 0,
  availableBalance: 0,
  currentCycleOrders: 0,
  openComplaints: 0,
  upcomingReservations: 0,
  averageRating: null,
}

export default function useRestaurantDashboardData({ pollMs = 60_000 } = {}) {
  const { restaurant: sessionRestaurant } = useRestaurantSession()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(initialState)

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const [ordersRes, financeRes, complaintsRes] = await Promise.allSettled([
        restaurantAPI.getOrders({ page: 1, limit: 100 }),
        restaurantAPI.getFinance(),
        restaurantAPI.getComplaints({ page: 1, limit: 20 }),
      ])

      const restaurant = sessionRestaurant

      const orders =
        ordersRes.status === "fulfilled"
          ? ordersRes.value?.data?.data?.orders || []
          : []

      const finance =
        financeRes.status === "fulfilled" ? financeRes.value?.data?.data || null : null

      const complaints =
        complaintsRes.status === "fulfilled"
          ? extractComplaints(complaintsRes.value)
          : []

      let upcomingReservations = 0
      if (restaurant) {
        try {
          const bookingsRes = await diningAPI.getRestaurantBookings(restaurant)
          const bookings = bookingsRes?.data?.data || []
          upcomingReservations = countUpcomingReservations(bookings)
        } catch {
          upcomingReservations = 0
        }
      }

      const statusCounts = countOrdersByStatus(orders)
      const rating =
        restaurant?.rating ??
        restaurant?.averageRating ??
        restaurant?.stats?.averageRating ??
        null

      setData({
        restaurant,
        isOnline: Boolean(
          restaurant?.isAcceptingOrders ??
            restaurant?.availability?.isAcceptingOrders ??
            restaurant?.isOnline,
        ),
        todayOrders: countTodayOrders(orders),
        todayRevenue: sumTodayRevenue(orders),
        liveOrders: statusCounts.live,
        preparingCount: statusCounts.preparing,
        readyCount: statusCounts.ready,
        pendingCount: statusCounts.pending,
        availableBalance: Number(
          finance?.wallet?.availableBalance ??
            finance?.availableBalance ??
            finance?.currentCycle?.estimatedPayout ??
            0,
        ),
        currentCycleOrders: Number(finance?.currentCycle?.totalOrders ?? 0),
        openComplaints: countOpenComplaints(complaints),
        upcomingReservations,
        averageRating: rating != null ? Number(rating) : null,
      })
      setError(null)
    } catch (err) {
      if (err?.response?.status !== 401) {
        setError(err?.response?.data?.message || "Could not load dashboard")
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [sessionRestaurant])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    if (!pollMs) return undefined
    const timer = window.setInterval(() => {
      loadDashboard({ silent: true })
    }, pollMs)
    return () => window.clearInterval(timer)
  }, [loadDashboard, pollMs])

  return {
    ...data,
    loading,
    refreshing,
    error,
    refresh: () => loadDashboard({ silent: true }),
  }
}
