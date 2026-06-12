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
  <div className="group relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:border-slate-900 hover:shadow-2xl hover:shadow-slate-200/50">
     <div className="flex items-start justify-between">
        <div>
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{label}</p>
           {isLoading ? (
             <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-50" />
           ) : (
             <h4 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h4>
           )}
           {subtitle && <p className="mt-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{subtitle}</p>}
        </div>
        <div className={`rounded-2xl bg-slate-50 p-3 ${color} transition-colors group-hover:bg-slate-900 group-hover:text-white`}>
           <Icon size={20} strokeWidth={2.5} />
        </div>
     </div>
  </div>
);

const RevenueGrid = ({ label, value, icon: Icon, color, isLoading }) => (
  <div className="flex items-center justify-between rounded-3xl border border-slate-100 bg-slate-50/50 p-5 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/30 group">
     <div className="flex items-center gap-4">
        <div className={`rounded-2xl bg-white p-2.5 shadow-sm ${color} group-hover:bg-slate-900 group-hover:text-white transition-colors`}>
           <Icon size={16} strokeWidth={2.5} />
        </div>
        <div>
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
           <p className="text-[14px] font-black text-slate-900 mt-0.5">₹{currency(value)}</p>
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
    <div className="min-h-screen animate-in fade-in duration-500 bg-[#F8F9FA] p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Executive Header */}
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
               <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Terminal Infrastructure</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Executive Dashboard</h1>
          </div>
          <div className="hidden md:flex flex-col items-end gap-2">
             <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm">
                <Clock size={14} className="text-slate-400" />
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">
                   Live: {lastUpdatedAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
             </div>
             {isRefreshing && <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] animate-pulse">Syncing Cloud Nodes...</p>}
          </div>
        </div>

        {dashboardError && (
          <div className="rounded-3xl bg-rose-50 border border-rose-100 p-6 flex items-center gap-5">
            <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-rose-500 shadow-sm"><CircleAlert size={24} /></div>
            <div>
               <p className="text-[14px] font-black text-rose-900">Communication Error</p>
               <p className="text-xs font-bold text-rose-600 mt-1 uppercase tracking-widest">{dashboardError}</p>
            </div>
          </div>
        )}

        {/* Primary KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <MetricCard 
             label="Fleet Inventory" 
             value={dashboard?.totalDrivers?.total || 0} 
             icon={Car} 
             color="text-slate-900" 
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* Revenue Intel */}
           <div className="lg:col-span-8 rounded-[3rem] border border-slate-200 bg-white p-10 shadow-sm">
              <div className="flex items-center justify-between mb-10">
                 <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Revenue Intel</h3>
                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-1">Transaction Breakdown · Today</p>
                 </div>
                 <div className="bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Volume</p>
                    <p className="text-lg font-black text-slate-900 tracking-tight">₹{currency(todayEarnings.total)}</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                 <RevenueGrid label="Cash Flows" value={todayEarnings.by_cash} icon={Wallet} color="text-emerald-500" isLoading={isLoading} />
                 <RevenueGrid label="Digital Assets" value={todayEarnings.by_wallet} icon={Zap} color="text-sky-500" isLoading={isLoading} />
                 <RevenueGrid label="Electronic" value={todayEarnings.by_card} icon={CreditCard} color="text-indigo-500" isLoading={isLoading} />
                 <RevenueGrid label="Commission" value={todayEarnings.admin_commission} icon={ShieldCheck} color="text-amber-500" isLoading={isLoading} />
                 <RevenueGrid label="Fleet Payouts" value={todayEarnings.driver_earnings} icon={UserCheck} color="text-slate-400" isLoading={isLoading} />
                 <div className="flex items-center justify-between rounded-3xl border border-dashed border-slate-200 bg-white p-5 group cursor-pointer hover:border-slate-900 transition-all">
                    <div className="flex items-center gap-4">
                       <div className="rounded-2xl bg-slate-50 p-2.5 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                          <BarChart3 size={16} />
                       </div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analytics</p>
                    </div>
                    <ArrowRight size={14} className="text-slate-200 group-hover:text-slate-900" />
                 </div>
              </div>

              <div className="mt-12 pt-10 border-t border-slate-50">
                 <div className="flex items-center justify-between mb-6">
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-300">Performance Trajectory</p>
                    <div className="flex items-center gap-2 text-emerald-500">
                       <TrendingUp size={14} />
                       <span className="text-[10px] font-black uppercase tracking-widest">+12.5% Growth</span>
                    </div>
                 </div>
                 <div className="h-40 w-full bg-slate-50/50 rounded-[2rem] border border-slate-100 flex items-center justify-center italic text-[13px] font-bold text-slate-300 uppercase tracking-widest">
                    Interactive Revenue Graph Initializing...
                 </div>
              </div>
           </div>

           {/* SOS Terminal */}
           <div className="lg:col-span-4 space-y-8">
              <div 
                onClick={() => navigate('/admin/safety')}
                className="group h-full flex flex-col justify-between rounded-[3rem] border border-slate-200 bg-white p-10 shadow-sm transition-all hover:border-slate-900 hover:shadow-2xl hover:shadow-slate-200/50 cursor-pointer"
              >
                 <div className="flex items-start justify-between">
                    <div>
                       <h3 className="text-xl font-black text-slate-900 tracking-tight">SOS Terminal</h3>
                       <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-1">Safety Monitoring</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-rose-50 text-rose-500 transition-colors group-hover:bg-rose-500 group-hover:text-white">
                       <Activity size={24} strokeWidth={2.5} />
                    </div>
                 </div>

                 <div className="py-12 flex flex-col items-center">
                    <div className="relative">
                       <div className="text-7xl font-black text-slate-900 tracking-tighter leading-none">{notifiedSos.total || 0}</div>
                       {Number(notifiedSos.total || 0) > 0 && (
                          <div className="absolute -top-2 -right-2 h-4 w-4 bg-rose-500 rounded-full border-2 border-white animate-ping" />
                       )}
                    </div>
                    <p className="mt-4 text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">Active Distress Signals</p>
                 </div>

                 <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-white transition-colors">
                       <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Assigned Response</span>
                       <span className="text-sm font-black text-slate-900">{notifiedSos.assigned || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-white transition-colors">
                       <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Resolved Nodes</span>
                       <span className="text-sm font-black text-slate-900">{notifiedSos.closed || 0}</span>
                    </div>
                 </div>

                 <button className="mt-8 w-full py-4 rounded-2xl bg-slate-900 text-white text-[13px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 transition-all group-hover:scale-[1.02]">
                    Enter Emergency Ops
                 </button>
              </div>
           </div>
        </div>

        {/* Global Statistics */}
        <div className="rounded-[3rem] border border-slate-200 bg-white p-10 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <div>
                 <h3 className="text-xl font-black text-slate-900 tracking-tight">Platform Sovereignty</h3>
                 <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lifecycle Metrics & Fleet Payouts</p>
              </div>
              <button onClick={() => navigate('/admin/trips')} className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors">View Deep Analytics</button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Cumulative Volume', val: overallEarnings.total, icon: IndianRupee, color: 'text-slate-900' },
                { label: 'Platform Sovereignty', val: overallEarnings.admin_commission, icon: ShieldCheck, color: 'text-amber-500' },
                { label: 'Fleet Disbursement', val: overallEarnings.driver_earnings, icon: UserCheck, color: 'text-sky-500' },
                { label: 'Completed Missions', val: todayTrips.completed || 0, icon: History, color: 'text-emerald-500', isCurrency: false },
              ].map((item, i) => (
                <div key={i} className="group p-6 rounded-[2rem] bg-slate-50/50 border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/40">
                   <div className="flex items-center justify-between mb-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                      <item.icon size={14} className={item.color} strokeWidth={2.5} />
                   </div>
                   <p className="text-2xl font-black text-slate-900">{item.isCurrency === false ? item.val : `₹${currency(item.val)}`}</p>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default MainDashboard;
