import React from 'react';
import { Filter, MoreVertical, Search, Loader2, ChevronRight, Menu, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { adminService } from '../../services/adminService';

const STATUS_STYLES = {
  ACCEPTED: 'bg-[#10B981] text-white', // Emerald/Green from image
  UPCOMING: 'bg-[#F59E0B] text-white', // Amber from image
  ONGOING: 'bg-[#3B82F6] text-white', 
};

const PAYMENT_STYLES = {
  CASH: 'bg-[#F97316] text-white', // Orange from image
  CARD: 'bg-red-500 text-white',
  WALLET: 'bg-teal-500 text-white',
};

const TAB_SET = ['All', 'Accepted', 'Upcoming', 'Ongoing'];

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
};

const Ongoing = () => {
  const [activeTab, setActiveTab] = React.useState('All');
  const [search, setSearch] = React.useState('');
  const [limit, setLimit] = React.useState(10);
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  // Filter state
  const [showFilters, setShowFilters] = React.useState(false);
  const [transportFilter, setTransportFilter] = React.useState('');
  const [paymentFilter, setPaymentFilter] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  const loadRows = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminService.getOngoingRides({
        limit,
        tab: activeTab.toLowerCase(),
        search,
      });
      const data = response?.data?.data || response?.data || response;
      setRows(data?.results || []);
    } catch (err) {
      setError(err?.message || 'Failed to load ongoing rides');
    } finally {
      setLoading(false);
    }
  }, [activeTab, limit, search]);

  React.useEffect(() => {
    loadRows();
  }, [loadRows]);

  const filteredRows = React.useMemo(() => {
    return rows.filter((row) => {
      if (transportFilter && String(row.transportType || '').toLowerCase() !== transportFilter.toLowerCase()) {
        return false;
      }
      if (paymentFilter && String(row.paymentOption || '').toUpperCase() !== paymentFilter.toUpperCase()) {
        return false;
      }
      if (dateFrom || dateTo) {
        const rowDate = row.date ? new Date(row.date) : null;
        if (rowDate && !Number.isNaN(rowDate.getTime())) {
          if (dateFrom && rowDate < new Date(`${dateFrom}T00:00:00`)) return false;
          if (dateTo) {
            const end = new Date(`${dateTo}T23:59:59.999`);
            if (rowDate > end) return false;
          }
        }
      }
      return true;
    });
  }, [rows, transportFilter, paymentFilter, dateFrom, dateTo]);

  const activeFiltersCount = [transportFilter, paymentFilter, dateFrom, dateTo].filter(Boolean).length;

  const handleDelete = async (ride) => {
    const confirmed = window.confirm(`Delete ride ${ride.requestId}? This will remove it for both rider and driver.`);
    if (!confirmed) return;
    try {
      await adminService.deleteOngoingRide(ride.id);
      setRows((prev) => prev.filter((row) => row.id !== ride.id));
    } catch (err) {
      window.alert(err?.message || 'Failed to delete ride');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <div className="p-4 space-y-4">
        {/* Header Block exactly as image */}
        <div className="flex items-center justify-between px-4 py-2 bg-white rounded-t-xl">
           <h1 className="text-[20px] font-black tracking-tight text-slate-800 uppercase">ONGOING REQUESTS</h1>
           <div className="flex items-center gap-2 text-[12px] font-medium text-slate-400">
              <span>Ongoing Requests</span>
              <ChevronRight size={14} className="text-slate-300" />
              <span className="text-slate-500">Ongoing Requests</span>
           </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm relative">
          {/* Top Controls Area */}
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-6 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2 text-[14px] font-medium text-slate-500">
              <span>show</span>
              <select 
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="h-9 w-16 border border-slate-200 rounded-md bg-white px-2 text-[13px] outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>entries</span>
            </div>

            <div className="flex flex-1 justify-center items-center gap-8 flex-wrap">
              {TAB_SET.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative py-1 text-[15px] font-bold transition-all ${
                    activeTab === tab ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div layoutId="ongoing-tab" className="absolute -bottom-3 left-0 right-0 h-0.5 bg-indigo-600" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search ongoing requests"
                  className="h-10 w-52 rounded-full border border-slate-200 bg-white pl-9 pr-4 text-[13px] outline-none focus:border-slate-300"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-bold shadow-sm transition-all ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-slate-900 text-white'
                    : 'bg-[#f46b45] hover:bg-[#e05b38] text-white'
                }`}
              >
                <Filter size={16} />
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 bg-white text-slate-900 text-[10px] rounded-full font-black">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="border-b border-slate-100 bg-slate-50/70 px-6 py-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end"
            >
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Transport Type</label>
                <select
                  value={transportFilter}
                  onChange={(e) => setTransportFilter(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="">All Transport Types</option>
                  <option value="taxi">Taxi</option>
                  <option value="parcel">Parcel</option>
                  <option value="intercity">Intercity</option>
                  <option value="pooling">Pooling</option>
                  <option value="rental">Rental</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Payment Option</label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="">All Payment Options</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="WALLET">Wallet</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none focus:border-indigo-500 font-medium"
                />
              </div>
              <div className="flex gap-2.5 items-end">
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTransportFilter('');
                      setPaymentFilter('');
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="h-9 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>
            </motion.div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50">
                  {['Request Id', 'Date', 'User Name', 'Driver Name', 'Transport Type', 'Trip Status', 'Payment Option', 'Action'].map((h) => (
                    <th key={h} className="px-6 py-4 text-[13px] font-bold text-slate-900 border-b border-slate-100">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <Loader2 className="animate-spin text-slate-300 mx-auto" size={32} />
                    </td>
                  </tr>
                ) : filteredRows.length > 0 ? (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/30">
                      <td className="px-6 py-5 text-[14px] text-slate-600 font-medium">{row.requestId}</td>
                      <td className="px-6 py-5 text-[14px] text-slate-600 font-medium">{formatDate(row.date)}</td>
                      <td className="px-6 py-5 text-[14px] text-slate-600 font-medium">{row.userName}</td>
                      <td className="px-6 py-5 text-[14px] text-slate-600 font-medium">{row.driverName || '----'}</td>
                      <td className="px-6 py-5 text-[14px] text-slate-600 font-medium">{row.transportType}</td>
                      <td className="px-6 py-5">
                        <span className={`inline-block px-3 py-1 text-[10px] font-bold rounded uppercase ${STATUS_STYLES[row.tripStatus] || 'bg-slate-200 text-slate-700'}`}>
                          {row.tripStatus}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-block px-3 py-1 text-[10px] font-bold rounded uppercase ${PAYMENT_STYLES[row.paymentOption] || 'bg-orange-500 text-white'}`}>
                          {row.paymentOption || 'CASH'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                         <div className="flex items-center gap-3">
                           <button onClick={() => handleDelete(row)} className="text-rose-400 hover:text-rose-600">
                             <Trash2 size={16} />
                           </button>
                           <button className="text-slate-400 hover:text-slate-800">
                             <MoreVertical size={18} />
                           </button>
                         </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-20 text-center text-[14px] font-medium text-slate-400">
                      {rows.length > 0 ? 'No ongoing requests match your selected filters.' : 'No Ongoing Requests Found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Floating Action Button from image */}
          <button className="fixed bottom-10 right-10 w-14 h-14 bg-[#00BFA5] text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform z-50">
            <Menu size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Ongoing;
