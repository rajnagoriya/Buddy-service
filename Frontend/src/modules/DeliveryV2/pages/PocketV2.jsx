import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  IndianRupee,
  Package,
  ChevronRight,
  FileText,
  User,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import { formatCurrency } from '@food/utils/currency';

const TRIPS_PAGE_SIZE = 10;

/**
 * PocketV2 — simplified partner wallet:
 * balance, earnings, delivery history, withdraw CTA.
 */
export const PocketV2 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [bankDetailsFilled, setBankDetailsFilled] = useState(false);
  const [balance, setBalance] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [trips, setTrips] = useState([]);
  const [tripsPage, setTripsPage] = useState(1);
  const [tripsTotal, setTripsTotal] = useState(0);
  const [hasMoreTrips, setHasMoreTrips] = useState(false);
  const [loadingMoreTrips, setLoadingMoreTrips] = useState(false);

  const getTripPeriod = (p) => {
    if (p === 'today') return 'daily';
    if (p === 'all') return 'all';
    return p;
  };

  const fetchTrips = useCallback(async (page, { append = false, currentPeriod = period } = {}) => {
    const tripsRes = await deliveryAPI.getTripHistory({
      period: getTripPeriod(currentPeriod),
      status: 'Completed',
      page,
      limit: TRIPS_PAGE_SIZE,
    });

    const payload = tripsRes?.data?.data || {};
    const tripList = Array.isArray(payload.trips) ? payload.trips : [];
    const pagination = payload.pagination || {};
    const total = Number(pagination.total) || tripList.length;
    const hasMore =
      typeof pagination.hasMore === 'boolean'
        ? pagination.hasMore
        : page * TRIPS_PAGE_SIZE < total;

    setTrips((prev) => (append ? [...prev, ...tripList] : tripList));
    setTripsPage(page);
    setTripsTotal(total);
    setHasMoreTrips(hasMore);
  }, [period]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setTrips([]);
        setTripsPage(1);
        setHasMoreTrips(false);
        setTripsTotal(0);

        const [profileRes, earningsRes, walletRes] = await Promise.all([
          deliveryAPI.getProfile().catch(() => null),
          deliveryAPI.getEarnings({ period }),
          deliveryAPI.getWallet(),
        ]);

        if (cancelled) return;

        const profile = profileRes?.data?.data?.profile || {};
        const summary = earningsRes?.data?.data?.summary || {};
        const wallet = walletRes?.data?.data?.wallet || {};

        const bankDetails = profile?.documents?.bankDetails;
        setBankDetailsFilled(!!bankDetails?.accountNumber);
        setBalance(Number(wallet.pocketBalance) || 0);
        setEarnings(Number(summary.totalEarnings) || 0);
        setOrdersCount(Number(summary.totalOrders) || 0);

        await fetchTrips(1, { append: false, currentPeriod: period });
      } catch (err) {
        if (!cancelled) toast.error('Failed to load wallet data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [period, fetchTrips]);

  const handleLoadMore = async () => {
    if (loadingMoreTrips || !hasMoreTrips) return;
    try {
      setLoadingMoreTrips(true);
      await fetchTrips(tripsPage + 1, { append: true, currentPeriod: period });
    } catch (err) {
      toast.error('Failed to load more deliveries');
    } finally {
      setLoadingMoreTrips(false);
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'today':
        return 'Today';
      case 'month':
        return 'This Month';
      case 'all':
        return 'Lifetime';
      default:
        return 'This Week';
    }
  };

  const formatTripDate = (trip) => {
    const raw = trip.deliveredAt || trip.date || trip.createdAt;
    if (!raw) return trip.time || '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return trip.time || '';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FFF9] flex flex-col items-center justify-center font-sans">
        <div className="w-10 h-10 border-4 border-[#16A34A] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Loading Pocket...
        </p>
      </div>
    );
  }

  return (
    <div className="delivery-v2-theme min-h-screen text-[#0F172A] font-sans pb-24">
      <div className="header-blend p-5 safe-top w-full shadow-lg rounded-b-[2rem] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              onClick={() => navigate('/driver/profile')}
              className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20 cursor-pointer active:scale-95 transition-all"
            >
              <User className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h1 className="text-lg font-black text-white uppercase tracking-tight">Pocket</h1>
              <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.2em]">
                Partner Wallet
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-5">
        {!bankDetailsFilled && (
          <div className="bg-[#16A34A]/10 rounded-2xl p-4 flex items-center gap-3 border border-[#16A34A]/20">
            <div className="w-10 h-10 bg-[#16A34A] rounded-xl flex items-center justify-center text-[#0F172A] shrink-0 shadow-lg shadow-green-600/20">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-[11px] font-black text-[#0F172A] mb-0.5 uppercase tracking-tight">
                Submit bank details
              </h3>
              <p className="text-[9px] text-gray-500 font-bold uppercase">Required for payouts</p>
            </div>
            <button
              onClick={() => navigate('/food/delivery/profile/details')}
              className="bg-[#0F172A] text-[#16A34A] px-4 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all"
            >
              Submit
            </button>
          </div>
        )}

        {/* Balance + Withdraw */}
        <div className="bg-white rounded-2xl p-5 shadow-xl shadow-black/5 border border-gray-100">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest mb-1">
                Available balance
              </p>
              <h2 className="text-4xl font-black text-[#0F172A] tracking-tighter">
                {formatCurrency(balance)}
              </h2>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#F0FDF4] border border-[#DCFCE7] flex items-center justify-center text-[#16A34A]">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <button
            onClick={() => navigate('/food/delivery/pocket/withdraw')}
            className="w-full py-3.5 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-green-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Withdraw
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Earnings */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-400 text-[8px] font-black uppercase tracking-widest">
              Earnings · {getPeriodLabel()}
            </p>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="text-[8px] font-black uppercase tracking-tight bg-gray-50 border-none rounded-lg px-2 py-1 outline-none"
            >
              <option value="today">Today</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="all">All</option>
            </select>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-black text-[#0F172A] tracking-tighter">
                {formatCurrency(earnings)}
              </h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                {ordersCount} {ordersCount === 1 ? 'delivery' : 'deliveries'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-[#0F172A]">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Delivery history */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-[#0F172A] uppercase tracking-widest">
              Delivery history
            </h3>
            <span className="bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full text-[10px] font-bold">
              {trips.length}
              {tripsTotal > trips.length ? ` / ${tripsTotal}` : ''}
            </span>
          </div>

          {trips.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-500">No deliveries yet</p>
              <p className="text-[10px] text-gray-400 font-medium mt-1">
                Completed deliveries for {getPeriodLabel().toLowerCase()} will show here
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {trips.map((trip, idx) => {
                  const oid = trip.orderId || trip._id || trip.id;
                  const earning =
                    Number(trip.deliveryEarning ?? trip.earningAmount ?? trip.amount) || 0;
                  return (
                    <motion.div
                      key={`${String(oid)}-${idx}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min((idx % TRIPS_PAGE_SIZE) * 0.03, 0.3) }}
                      className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] border border-[#DCFCE7] flex items-center justify-center text-[#16A34A] shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-[#0F172A] truncate">
                            {trip.restaurantName || trip.restaurant || 'Delivery'}
                          </p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide truncate">
                            {oid} · {formatTripDate(trip)}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-black text-[#16A34A] shrink-0 ml-3">
                        +{formatCurrency(earning)}
                      </p>
                    </motion.div>
                  );
                })}
              </div>

              {hasMoreTrips ? (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMoreTrips}
                  className="w-full py-3.5 bg-white border border-gray-200 rounded-2xl text-xs font-black uppercase tracking-widest text-[#0F172A] active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loadingMoreTrips ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PocketV2;
