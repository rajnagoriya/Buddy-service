import React from 'react';
import {
  BarChart3,
  CalendarDays,
  Car,
  ChevronDown,
  IndianRupee,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Wallet,
} from 'lucide-react';
import { adminService } from '../../services/adminService';

const RIDER_TYPES = [
  { value: '', label: 'All rider types' },
  { value: 'ride', label: 'Ride' },
  { value: 'parcel', label: 'Parcel' },
  { value: 'intercity', label: 'Intercity' },
];

const PAYMENT_TYPES = [
  { value: '', label: 'All payments' },
  { value: 'cash', label: 'Cash' },
  { value: 'online', label: 'Online' },
];

const emptyFilters = {
  from: '',
  to: '',
  zone: '',
  vehicle: '',
  riderType: '',
  paymentMethod: '',
  search: '',
};

const currency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFilterDate = (value) => {
  if (!value) return 'Select date';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Select date';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const unwrapResults = (payload, key = 'results') => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  if (Array.isArray(payload?.data?.data?.[key])) return payload.data.data[key];
  return [];
};

const getOptionLabel = (item) => item?.name || item?.type_name || item?.service_location_name || item?.title || 'Option';
const getOptionValue = (item) => String(item?._id || item?.id || getOptionLabel(item));

const StatCard = ({ icon: Icon, label, value, helper, tone = 'emerald' }) => {
  const toneClasses = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    cyan: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{value}</p>
          {helper ? <p className="mt-1.5 text-xs text-gray-400">{helper}</p> : null}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${toneClasses[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
};

const BreakdownPanel = ({ title, icon: Icon, rows, emptyText }) => {
  const max = Math.max(...rows.map((row) => Number(row.adminCommission || 0)), 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-400">Commission split</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
          <Icon size={16} />
        </div>
      </div>

      {rows.length ? (
        <div className="space-y-3.5">
          {rows.slice(0, 5).map((row) => {
            const percent = max ? Math.max(6, (Number(row.adminCommission || 0) / max) * 100) : 0;

            return (
              <div key={row.key || row.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-gray-700">{row.label}</span>
                  <span className="shrink-0 font-semibold text-gray-900">{currency(row.adminCommission)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-gray-400">
                  {row.trips} trips · gross {currency(row.grossFare)}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-xs text-gray-400 font-medium">
          {emptyText}
        </div>
      )}
    </div>
  );
};

const DatePickerField = ({ label, value, onChange }) => {
  const inputRef = React.useRef(null);

  const openPicker = () => {
    if (typeof inputRef.current?.showPicker === 'function') {
      inputRef.current.showPicker();
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.click();
  };

  return (
    <div>
      <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
        <CalendarDays size={13} className="text-gray-400" /> {label}
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={openPicker}
          className="flex h-9 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 outline-none transition hover:border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          <span className={value ? 'text-gray-800' : 'text-gray-400'}>{formatFilterDate(value)}</span>
          <ChevronDown size={14} className="text-gray-400" />
        </button>
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pointer-events-none absolute inset-0 opacity-0"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

const AdminEarnings = () => {
  const [filters, setFilters] = React.useState(emptyFilters);
  const [limit, setLimit] = React.useState(10);
  const [page, setPage] = React.useState(1);
  const [zones, setZones] = React.useState([]);
  const [vehicles, setVehicles] = React.useState([]);
  const [data, setData] = React.useState({
    summary: {},
    breakdowns: { zones: [], vehicles: [], riderTypes: [] },
    results: [],
    paginator: { current_page: 1, last_page: 1, total: 0 },
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = React.useCallback(() => {
    setPage(1);
    setFilters(emptyFilters);
  }, []);

  const loadOptions = React.useCallback(async () => {
    try {
      const [zoneRes, vehicleRes] = await Promise.all([
        adminService.getZones(),
        adminService.getVehicleTypes(),
      ]);

      setZones(unwrapResults(zoneRes?.data || zoneRes));
      setVehicles(unwrapResults(vehicleRes?.data || vehicleRes));
    } catch (err) {
      console.error('Failed to load admin earning filters:', err);
    }
  }, []);

  const loadEarnings = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await adminService.getAdminEarnings({
        ...filters,
        page,
        limit,
      });
      const payload = response?.data || response || {};

      setData({
        summary: payload.summary || {},
        breakdowns: payload.breakdowns || { zones: [], vehicles: [], riderTypes: [] },
        results: Array.isArray(payload.results) ? payload.results : [],
        paginator: payload.paginator || { current_page: 1, last_page: 1, total: 0 },
      });
    } catch (err) {
      setError(err?.message || 'Failed to load admin earnings');
      setData({
        summary: {},
        breakdowns: { zones: [], vehicles: [], riderTypes: [] },
        results: [],
        paginator: { current_page: 1, last_page: 1, total: 0 },
      });
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  React.useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  React.useEffect(() => {
    loadEarnings();
  }, [loadEarnings]);

  const summary = data.summary || {};
  const paginator = data.paginator || {};
  const hasActiveFilters = Object.values(filters).some((value) => String(value || '').trim() !== '');

  return (
    <div className="min-h-screen bg-gray-50/50 p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin Earnings</h1>
          <p className="mt-1 text-xs text-gray-500">
            Track commission revenue from completed rides across zones, vehicles, and rider types.
          </p>
        </div>
        <button
          type="button"
          onClick={loadEarnings}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IndianRupee} label="Admin commission" value={currency(summary.adminCommission)} helper={`${summary.totalTrips || 0} completed transactions`} />
        <StatCard icon={Wallet} label="Gross ride fare" value={currency(summary.grossFare)} helper="Total fare before split" tone="cyan" />
        <StatCard icon={ShieldCheck} label="Average commission" value={currency(summary.averageCommission)} helper="Per completed transaction" tone="amber" />
        <StatCard icon={TrendingUp} label="Driver earnings" value={currency(summary.driverEarnings)} helper={`Cash commission ${currency(summary.byCash)}`} tone="rose" />
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7 items-end">
          <DatePickerField label="From" value={filters.from} onChange={(value) => updateFilter('from', value)} />

          <DatePickerField label="To" value={filters.to} onChange={(value) => updateFilter('to', value)} />

          <div>
            <span className="block text-xs font-medium text-gray-600 mb-1.5">Zone</span>
            <select value={filters.zone} onChange={(event) => updateFilter('zone', event.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 outline-none transition hover:border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
              <option value="">All zones</option>
              {zones.map((zone) => (
                <option key={getOptionValue(zone)} value={getOptionValue(zone)}>{getOptionLabel(zone)}</option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-600 mb-1.5">Vehicle</span>
            <select value={filters.vehicle} onChange={(event) => updateFilter('vehicle', event.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 outline-none transition hover:border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
              <option value="">All vehicles</option>
              {vehicles.map((vehicle) => (
                <option key={getOptionValue(vehicle)} value={getOptionValue(vehicle)}>{getOptionLabel(vehicle)}</option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-600 mb-1.5">Rider type</span>
            <select value={filters.riderType} onChange={(event) => updateFilter('riderType', event.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 outline-none transition hover:border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
              {RIDER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-600 mb-1.5">Payment</span>
            <select value={filters.paymentMethod} onChange={(event) => updateFilter('paymentMethod', event.target.value)} className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 outline-none transition hover:border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
              {PAYMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-gray-600 mb-1.5">Search</span>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Trip, rider, driver..." className="h-9 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-xs text-gray-700 outline-none transition hover:border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 bg-white px-3.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700">{error}</div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <BreakdownPanel title="Zone performance" icon={BarChart3} rows={data.breakdowns.zones || []} emptyText="No zone earnings found." />
        <BreakdownPanel title="Vehicle performance" icon={Car} rows={data.breakdowns.vehicles || []} emptyText="No vehicle earnings found." />
        <BreakdownPanel title="Rider type performance" icon={UserRound} rows={data.breakdowns.riderTypes || []} emptyText="No rider type earnings found." />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-gray-100 p-4 md:flex-row md:items-center">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Transaction history</h3>
            <p className="mt-0.5 text-xs text-gray-400">{paginator.total || 0} commission entries</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
            Show
            <select value={limit} onChange={(event) => { setPage(1); setLimit(Number(event.target.value)); }} className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 outline-none focus:border-indigo-500">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            entries
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                <th className="px-5 py-3.5">Request</th>
                <th className="px-5 py-3.5">Completed</th>
                <th className="px-5 py-3.5">Rider</th>
                <th className="px-5 py-3.5">Driver</th>
                <th className="px-5 py-3.5">Zone</th>
                <th className="px-5 py-3.5">Vehicle</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Payment</th>
                <th className="px-5 py-3.5 text-right">Gross</th>
                <th className="px-5 py-3.5 text-right">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <Loader2 className="mx-auto animate-spin text-gray-300" size={28} />
                  </td>
                </tr>
              ) : data.results.length ? (
                data.results.map((row) => (
                  <tr key={row.id} className="text-xs text-gray-700 hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-gray-900">{row.requestId}</td>
                    <td className="px-5 py-3.5 text-gray-500">{formatDate(row.completedAt)}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{row.userName}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{row.userPhone || '--'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{row.driverName}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{row.driverPhone || '--'}</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{row.zoneName}</td>
                    <td className="px-5 py-3.5 text-gray-600">{row.vehicleName}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">{row.riderType}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 capitalize">{row.paymentMethod}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{currency(row.grossFare)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-emerald-600">{currency(row.adminCommission)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-xs font-medium text-gray-400">
                    No admin earning transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-gray-100 p-4 md:flex-row md:items-center">
          <p className="text-xs text-gray-500">
            Page <span className="font-medium text-gray-700">{paginator.current_page || page}</span> of <span className="font-medium text-gray-700">{paginator.last_page || 1}</span>
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-gray-200 px-3.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= (paginator.last_page || 1)} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-gray-200 px-3.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminEarnings;
