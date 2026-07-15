import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Car,
  CircleAlert,
  Clock,
  CreditCard,
  History,
  IndianRupee,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  Activity,
  ChevronRight,
  ArrowRight,
  Zap,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminService } from '../../services/adminService';
import { BACKEND_LABEL } from '../../../../shared/api/runtimeConfig';

const currency = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
const DASHBOARD_REFRESH_INTERVAL_MS = 120000;

const MetricCard = ({ label, value, icon: Icon, color, isLoading, subtitle }) => (
  <div className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:border-neutral-300 hover:shadow-md">
     <div className="flex items-start justify-between">
        <div>
           <p className="text-sm font-medium text-neutral-500 mb-1">{label}</p>
           {isLoading ? (
             <div className="h-8 w-24 animate-pulse rounded-md bg-neutral-100" />
           ) : (
             <h4 className="text-2xl font-bold text-neutral-900">{value}</h4>
           )}
           {subtitle && <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>}
        </div>
        <div className={`rounded-lg bg-neutral-50 p-2.5 ${color} transition-colors group-hover:bg-neutral-900 group-hover:text-white`}>
           <Icon size={20} />
        </div>
     </div>
  </div>
);

const RevenueGrid = ({ label, value, icon: Icon, color, isLoading }) => (
  <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/50 p-4 transition-all hover:bg-white hover:shadow-sm group">
     <div className="flex items-center gap-4">
        <div className={`rounded-lg bg-white p-2 shadow-sm ${color} group-hover:bg-neutral-900 group-hover:text-white transition-colors`}>
           <Icon size={16} />
        </div>
        <div>
           <p className="text-xs font-medium text-neutral-500">{label}</p>
           <p className="text-sm font-bold text-neutral-900 mt-0.5">₹{currency(value)}</p>
        </div>
     </div>
  </div>
);

const MainDashboard = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetch = async (silent = false) => {
      try {
        silent ? setIsRefreshing(true) : setIsLoading(true);
        const res = await adminService.getDashboardData();
        if (!isMounted) return;
        setDashboard(res?.data || res || {});
        setDashboardError('');
        setLastUpdatedAt(new Date());
      } catch (err) {
        if (!isMounted) return;
        setDashboardError(`System offline. Connection to ${BACKEND_LABEL} failed.`);
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    fetch();
    const interval = setInterval(() => fetch(true), DASHBOARD_REFRESH_INTERVAL_MS);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  const todayEarnings = dashboard?.todayEarnings || {};
  const overallEarnings = dashboard?.overallEarnings || {};
  const notifiedSos = dashboard?.notifiedSos || {};
  const todayTrips = dashboard?.todayTrips || {};

  return (
    <div className="min-h-screen animate-in fade-in duration-500 bg-neutral-50/50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Executive Header */}
        <div className="flex items-end justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
               <div className="h-2 w-2 rounded-full bg-emerald-500" />
               <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">Terminal Infrastructure</span>
            </div>
            <h1 className="text-2xl font-semibold text-neutral-900">Executive Dashboard</h1>
          </div>
          <div className="hidden md:flex flex-col items-end gap-2">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-md border border-neutral-200 shadow-sm">
                <Clock size={14} className="text-neutral-400" />
                <span className="text-xs font-medium text-neutral-600">
                   Live: {lastUpdatedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
             </div>
             {isRefreshing && <p className="text-[10px] font-medium text-emerald-500 animate-pulse">Syncing...</p>}
          </div>
        </div>

        {dashboardError && (
          <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 flex items-center gap-4">
            <div className="h-10 w-10 bg-white rounded-lg flex items-center justify-center text-rose-500 shadow-sm"><CircleAlert size={20} /></div>
            <div>
               <p className="text-sm font-semibold text-rose-900">Communication Error</p>
               <p className="text-xs text-rose-600 mt-0.5">{dashboardError}</p>
            </div>
          </div>
        )}

        {/* Primary KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
             label="Fleet Inventory" 
             value={dashboard?.totalDrivers?.total || 0} 
             icon={Car} 
             color="text-neutral-900" 
             isLoading={isLoading} 
             subtitle="Registered Units"
          />
          <MetricCard 
             label="Verified Assets" 
             value={dashboard?.totalDrivers?.approved || 0} 
             icon={ShieldCheck} 
             color="text-emerald-500" 
             isLoading={isLoading} 
             subtitle="Operational Now"
          />
          <MetricCard 
             label="Awaiting Audit" 
             value={dashboard?.totalDrivers?.declined || 0} 
             icon={Clock} 
             color="text-amber-500" 
             isLoading={isLoading} 
             subtitle="Pending Onboarding"
          />
          <MetricCard 
             label="User Database" 
             value={dashboard?.totalUsers || 0} 
             icon={Users} 
             color="text-sky-500" 
             isLoading={isLoading} 
             subtitle="Global Network"
          />
        </div>

        {/* Intelligence Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
           {/* Revenue Intel */}
           <div className="lg:col-span-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                 <div>
                    <h3 className="text-lg font-semibold text-neutral-900">Revenue Intel</h3>
                    <p className="text-xs text-neutral-500 mt-1">Transaction Breakdown · Today</p>
                 </div>
                 <div className="bg-neutral-50 px-4 py-2 rounded-lg border border-neutral-100 text-right">
                    <p className="text-[10px] font-medium text-neutral-500 uppercase mb-0.5">Net Volume</p>
                    <p className="text-base font-bold text-neutral-900">₹{currency(todayEarnings.total)}</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                 <RevenueGrid label="Cash Flows" value={todayEarnings.by_cash} icon={Wallet} color="text-emerald-500" isLoading={isLoading} />
                 <RevenueGrid label="Digital Assets" value={todayEarnings.by_wallet} icon={Zap} color="text-sky-500" isLoading={isLoading} />
                 <RevenueGrid label="Electronic" value={todayEarnings.by_card} icon={CreditCard} color="text-indigo-500" isLoading={isLoading} />
                 <RevenueGrid label="Commission" value={todayEarnings.admin_commission} icon={ShieldCheck} color="text-amber-500" isLoading={isLoading} />
                 <RevenueGrid label="Fleet Payouts" value={todayEarnings.driver_earnings} icon={UserCheck} color="text-neutral-500" isLoading={isLoading} />
                 <div className="flex items-center justify-between rounded-xl border border-dashed border-neutral-200 bg-white p-4 group cursor-pointer hover:border-neutral-400 transition-all">
                    <div className="flex items-center gap-3">
                       <div className="rounded-lg bg-neutral-50 p-2 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                          <BarChart3 size={16} />
                       </div>
                       <p className="text-xs font-medium text-neutral-500">Analytics</p>
                    </div>
                    <ArrowRight size={14} className="text-neutral-300 group-hover:text-neutral-900" />
                 </div>
              </div>

              <div className="mt-8 pt-6 border-t border-neutral-100">
                 <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-semibold text-neutral-500 uppercase">Performance Trajectory</p>
                    <div className="flex items-center gap-1.5 text-emerald-500">
                       <TrendingUp size={14} />
                       <span className="text-xs font-medium">+12.5% Growth</span>
                    </div>
                 </div>
                 <div className="h-32 w-full bg-neutral-50/50 rounded-xl border border-neutral-100 flex items-center justify-center text-xs text-neutral-400">
                    Interactive Revenue Graph Initializing...
                 </div>
              </div>
           </div>

           {/* SOS Terminal */}
           <div className="lg:col-span-4 space-y-6">
              <div 
                onClick={() => navigate('/admin/safety')}
                className="group h-full flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:border-neutral-300 hover:shadow-md cursor-pointer"
              >
                 <div className="flex items-start justify-between">
                    <div>
                       <h3 className="text-lg font-semibold text-neutral-900">SOS Terminal</h3>
                       <p className="text-xs text-neutral-500 mt-1">Safety Monitoring</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-500 transition-colors group-hover:bg-rose-500 group-hover:text-white">
                       <Activity size={20} />
                    </div>
                 </div>

                 <div className="py-8 flex flex-col items-center">
                    <div className="relative">
                       <div className="text-5xl font-bold text-neutral-900">{notifiedSos.total || 0}</div>
                       {Number(notifiedSos.total || 0) > 0 && (
                          <div className="absolute -top-1 -right-2 h-3 w-3 bg-rose-500 rounded-full border-2 border-white animate-ping" />
                       )}
                    </div>
                    <p className="mt-2 text-xs font-medium uppercase tracking-wider text-neutral-500">Active Distress Signals</p>
                 </div>

                 <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 border border-neutral-100 group-hover:bg-white transition-colors">
                       <span className="text-xs font-medium text-neutral-600">Assigned Response</span>
                       <span className="text-sm font-semibold text-neutral-900">{notifiedSos.assigned || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 border border-neutral-100 group-hover:bg-white transition-colors">
                       <span className="text-xs font-medium text-neutral-600">Resolved Nodes</span>
                       <span className="text-sm font-semibold text-neutral-900">{notifiedSos.closed || 0}</span>
                    </div>
                 </div>

                 <button className="mt-6 w-full py-3 rounded-lg bg-neutral-900 text-white text-sm font-medium shadow-sm transition-all hover:bg-neutral-800">
                    Enter Emergency Ops
                 </button>
              </div>
           </div>
        </div>

        {/* Global Statistics */}
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
           <div className="flex items-center justify-between mb-6">
              <div>
                 <h3 className="text-lg font-semibold text-neutral-900">Platform Sovereignty</h3>
                 <p className="text-xs text-neutral-500 mt-1">Lifecycle Metrics & Fleet Payouts</p>
              </div>
              <button onClick={() => navigate('/admin/trips')} className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">View Deep Analytics</button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Cumulative Volume', val: overallEarnings.total, icon: IndianRupee, color: 'text-neutral-900' },
                { label: 'Platform Sovereignty', val: overallEarnings.admin_commission, icon: ShieldCheck, color: 'text-amber-500' },
                { label: 'Fleet Disbursement', val: overallEarnings.driver_earnings, icon: UserCheck, color: 'text-sky-500' },
                { label: 'Completed Missions', val: todayTrips.completed || 0, icon: History, color: 'text-emerald-500', isCurrency: false },
              ].map((item, i) => (
                <div key={i} className="group p-5 rounded-xl bg-neutral-50/50 border border-neutral-100 transition-all hover:bg-white hover:shadow-sm">
                   <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-neutral-500">{item.label}</p>
                      <item.icon size={16} className={item.color} />
                   </div>
                   <p className="text-xl font-bold text-neutral-900">{item.isCurrency === false ? item.val : `₹${currency(item.val)}`}</p>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default MainDashboard;
