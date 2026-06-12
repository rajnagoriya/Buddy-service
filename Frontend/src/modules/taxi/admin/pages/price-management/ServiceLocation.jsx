import React, { useEffect, useMemo, useState } from 'react';
import { 
  ArrowLeft, 
  Edit2, 
  Globe2, 
  Loader2, 
  Plus, 
  Save, 
  Search, 
  Trash2, 
  ChevronRight, 
  Globe, 
  Tag, 
  MapPin, 
  Clock, 
  DollarSign,
  Activity,
  Info,
  ChevronLeft,
  ChevronDown
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import countryMetadata from '../../constants/countries.json';

const DEFAULT_TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles'
];

const ADMIN_LANGUAGE_OPTIONS = ['English', 'Hindi', 'Arabic', 'French', 'Spanish'];

const defaultFormData = {
  name: '',
  country: '',
  currency_code: '',
  currency_symbol: '',
  timezone: ''
};

const inputClass = "w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-800 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-gray-300";
const labelClass = "block text-xs font-bold text-gray-500 mb-2";
const getCountryName = (value) => {
  if (value == null) return '';

  if (typeof value === 'object') {
    if (typeof value.name === 'string') return value.name;
    if (typeof value.name === 'number') return String(value.name);
    if (typeof value.label === 'string') return value.label;
    if (typeof value.country === 'string') return value.country;
    return '';
  }

  return String(value);
};

const ServiceLocation = ({ mode }) => {
  const navigate = useNavigate();
  const { id, jurisdictionName } = useParams();
  const isCreate = mode === 'create';
  const isEdit = mode === 'edit';
  const isJurisdictions = mode === 'jurisdictions';
  const isList = !isCreate && !isEdit;

  const [locations, setLocations] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLangTab, setActiveLangTab] = useState('English');
  const [formData, setFormData] = useState(defaultFormData);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [locationsRes, countriesRes] = await Promise.allSettled([
        adminService.getServiceLocations(),
        adminService.getCountries()
      ]);

      const nextLocations = locationsRes.status === 'fulfilled' ? (Array.isArray(locationsRes.value?.data) ? locationsRes.value.data : (locationsRes.value?.data?.results || locationsRes.value?.results || [])) : [];
      const nextCountries = countriesRes.status === 'fulfilled' ? (Array.isArray(countriesRes.value?.data?.results) ? countriesRes.value.data.results : (Array.isArray(countriesRes.value?.data) ? countriesRes.value.data : (countriesRes.value?.results || []))) : [];

      setLocations(Array.isArray(nextLocations) ? nextLocations : []);
      setCountries(Array.isArray(nextCountries) ? nextCountries : []);
      
      if (isEdit && id) {
        const item = nextLocations.find(l => String(l._id || l.id) === String(id));
        if (item) {
          const matchedCountry = nextCountries.find(c => (c._id || c.id) === item.country || c.name === item.country || c.name === item.country?.name);
          setFormData({
            name: item.name || item.service_location_name || '',
            country: matchedCountry?._id || matchedCountry?.id || '',
            currency_code: item.currency_code || '',
            currency_symbol: item.currency_symbol || '',
            timezone: item.timezone || ''
          });
        }
      } else if (isCreate) {
        if (Array.isArray(nextCountries) && nextCountries.length > 0) {
          const defaultCountry = nextCountries.find(c => c.name?.toLowerCase() === 'india') || nextCountries[0];
          setFormData(p => ({ ...p, country: defaultCountry?._id || defaultCountry?.id || '' }));
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (formData.country && countries.length > 0) {
      // 1. Try to find in the dynamic API data (highest priority)
      let matched = countries.find(c => String(c._id || c.id) === String(formData.country));
      
      // 2. If dynamic data is missing currency info, fallback to our local master metadata
      if (!matched?.currency_code) {
        const countryName = matched?.name || '';
        matched = countryMetadata.find(c => c.name === countryName || c.code === matched?.code);
      }

      if (matched?.currency_code) {
        setFormData(prev => ({
          ...prev,
          currency_code: prev.currency_code || matched.currency_code,
          currency_symbol: prev.currency_symbol || matched.currency_symbol
        }));
      }
    }
  }, [formData.country, countries]);

  useEffect(() => { fetchData(); }, [mode, id]);

  const filteredLocations = useMemo(() => {
    const q = searchTerm.toLowerCase();
    if (!Array.isArray(locations)) return [];
    return locations.filter(l => {
      const countryName = getCountryName(l.country);
      return [l.name, l.service_location_name, countryName].some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [locations, searchTerm]);

  const jurisdictionSummary = useMemo(() => {
    const grouped = new Map();

    locations.forEach((location) => {
      const countryName = getCountryName(location.country).trim();
      if (!countryName) return;

      if (!grouped.has(countryName)) {
        grouped.set(countryName, {
          name: countryName,
          locationCount: 0,
          timezones: new Set(),
          currencies: new Set(),
        });
      }

      const current = grouped.get(countryName);
      current.locationCount += 1;
      if (location.timezone) current.timezones.add(location.timezone);
      if (location.currency_code) current.currencies.add(location.currency_code);
    });

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        timezones: Array.from(item.timezones),
        currencies: Array.from(item.currencies),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations]);

  const filteredJurisdictions = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return jurisdictionSummary;

    return jurisdictionSummary.filter((item) => {
      const haystack = [
        item.name,
        item.timezones.join(' '),
        item.currencies.join(' '),
        String(item.locationCount),
      ].join(' ').toLowerCase();

      return haystack.includes(q);
    });
  }, [jurisdictionSummary, searchTerm]);

  const decodedJurisdictionName = useMemo(
    () => decodeURIComponent(jurisdictionName || '').trim(),
    [jurisdictionName],
  );

  const selectedJurisdiction = useMemo(() => {
    if (decodedJurisdictionName) {
      const matched = jurisdictionSummary.find(
        (item) => item.name.toLowerCase() === decodedJurisdictionName.toLowerCase(),
      );
      if (matched) return matched;
    }

    return filteredJurisdictions[0] || null;
  }, [decodedJurisdictionName, filteredJurisdictions, jurisdictionSummary]);

  const selectedJurisdictionLocations = useMemo(() => {
    if (!selectedJurisdiction) return [];

    return locations.filter(
      (location) => getCountryName(location.country).trim().toLowerCase() === selectedJurisdiction.name.toLowerCase(),
    );
  }, [locations, selectedJurisdiction]);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name || !formData.country) return alert("Required fields missing");
    setSaving(true);
    try {
      const selectedCountry = countries.find(c => (c._id || c.id) === formData.country);
      const payload = {
        ...formData,
        currency_code: formData.currency_code.toUpperCase(),
        country: selectedCountry?.name || formData.country,
        currency_name: formData.currency_code.toUpperCase()
      };

      const res = isEdit ? await adminService.updateServiceLocation(id, payload) : await adminService.createServiceLocation(payload);
      if (res?.success) {
        navigate('/admin/pricing/service-location');
      } else {
        alert(res?.message || "Operation failed");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm("Delete this service area?")) return;
    try {
      const res = await adminService.deleteServiceLocation(itemId);
      if (res?.success) fetchData();
    } catch (err) {}
  };

  if (isJurisdictions) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 lg:p-8 animate-in fade-in duration-500 font-sans">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2 font-medium uppercase tracking-widest">
                <span>Pricing</span>
                <ChevronRight size={12} />
                <button
                  type="button"
                  onClick={() => navigate('/admin/pricing/service-location')}
                  className="text-gray-500 transition-colors hover:text-gray-700"
                >
                  Service Locations
                </button>
                <ChevronRight size={12} />
                <span className="text-gray-700">Market Jurisdictions</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Market Jurisdictions</h1>
              <p className="text-xs text-gray-500 mt-1 font-medium">
                Browse each jurisdiction, how many service locations sit inside it, and the currency and timezone coverage.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/admin/pricing/service-location')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-700"
            >
              <ArrowLeft size={16} />
              Back To Locations
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Jurisdictions</p>
              <h3 className="mt-2 text-3xl font-black text-gray-900">{jurisdictionSummary.length}</h3>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Covered Hubs</p>
              <h3 className="mt-2 text-3xl font-black text-gray-900">{locations.length}</h3>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Currency Profiles</p>
              <h3 className="mt-2 text-3xl font-black text-gray-900">
                {[...new Set(jurisdictionSummary.flatMap((item) => item.currencies))].filter(Boolean).length}
              </h3>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50/50 p-4">
              <div className="relative w-full max-w-sm">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search jurisdictions..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading Jurisdictions</p>
              </div>
            ) : filteredJurisdictions.length > 0 ? (
              <div className="space-y-5 p-5">
                {selectedJurisdiction ? (
                  <div className="rounded-[28px] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-6 shadow-sm">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-white text-indigo-600 shadow-sm">
                          <Globe2 size={24} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Selected Jurisdiction</p>
                          <h2 className="mt-1 text-2xl font-black text-gray-900">{selectedJurisdiction.name}</h2>
                          <p className="mt-2 text-xs font-medium text-gray-500">
                            This jurisdiction currently contains {selectedJurisdiction.locationCount} service location{selectedJurisdiction.locationCount === 1 ? '' : 's'}.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Locations</p>
                          <p className="mt-1 text-xl font-black text-gray-900">{selectedJurisdiction.locationCount}</p>
                        </div>
                        <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Currencies</p>
                          <p className="mt-1 text-xl font-black text-gray-900">{selectedJurisdiction.currencies.length}</p>
                        </div>
                        <div className="rounded-xl border border-white/80 bg-white px-4 py-3 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Timezones</p>
                          <p className="mt-1 text-xl font-black text-gray-900">{selectedJurisdiction.timezones.length}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Currency Coverage</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedJurisdiction.currencies.length ? selectedJurisdiction.currencies.map((currency) => (
                            <span key={currency} className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
                              {currency}
                            </span>
                          )) : <span className="text-xs font-semibold text-gray-400">No currencies mapped</span>}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Timezone Coverage</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedJurisdiction.timezones.length ? selectedJurisdiction.timezones.map((timezone) => (
                            <span key={timezone} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                              {timezone}
                            </span>
                          )) : <span className="text-xs font-semibold text-gray-400">No timezones mapped</span>}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Service Locations In This Jurisdiction</p>
                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        {selectedJurisdictionLocations.map((location) => (
                          <button
                            key={location._id || location.id}
                            type="button"
                            onClick={() => navigate(`/admin/pricing/service-location/edit/${location._id || location.id}`)}
                            className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/70 px-4 py-3 text-left transition-all hover:border-indigo-200 hover:bg-indigo-50/40"
                          >
                            <div>
                              <p className="text-sm font-bold text-gray-900">{location.name || location.service_location_name}</p>
                              <p className="mt-1 text-xs font-medium text-gray-500">{location.timezone || 'Timezone not set'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-black uppercase tracking-widest text-indigo-500">{location.currency_code || 'N/A'}</p>
                              <p className="mt-1 text-xs font-semibold text-gray-400">{location.currency_symbol || 'No symbol'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {filteredJurisdictions.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => navigate(`/admin/pricing/service-location/jurisdictions/${encodeURIComponent(item.name)}`)}
                    className={`rounded-2xl border p-5 text-left shadow-sm transition-all ${
                      selectedJurisdiction?.name === item.name
                        ? 'border-indigo-200 bg-indigo-50/70'
                        : 'border-gray-100 bg-gray-50/60 hover:border-indigo-100 hover:bg-indigo-50/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600">
                          <Globe2 size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Jurisdiction</p>
                          <h3 className="text-lg font-black text-gray-900">{item.name}</h3>
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Locations</p>
                        <p className="text-lg font-black text-gray-900">{item.locationCount}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Currencies</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.currencies.length ? item.currencies.map((currency) => (
                            <span key={currency} className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                              {currency}
                            </span>
                          )) : <span className="text-xs font-semibold text-gray-400">Not assigned</span>}
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Timezones</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.timezones.length ? item.timezones.map((timezone) => (
                            <span key={timezone} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                              {timezone}
                            </span>
                          )) : <span className="text-xs font-semibold text-gray-400">Not assigned</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                </div>
              </div>
            ) : (
              <div className="py-24 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 text-gray-200">
                  <Globe size={32} />
                </div>
                <h3 className="text-sm font-bold text-gray-900">No Jurisdictions Found</h3>
                <p className="mx-auto mt-1 max-w-xs text-xs text-gray-400">
                  Add service locations first, then this page will summarize each market jurisdiction automatically.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isList) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 lg:p-8 animate-in fade-in duration-500 font-sans">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2 font-medium uppercase tracking-widest">
              <span>Pricing</span>
              <ChevronRight size={12} />
              <span className="text-gray-700">Service Locations</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Active Service Areas</h1>
                <p className="text-xs text-gray-500 mt-1 font-medium">Manage localized settings including currency, timezone, and regional clusters.</p>
              </div>
              <button 
                onClick={() => navigate('/admin/pricing/service-location/add')}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md active:scale-95"
              >
                <Plus size={18} /> Add Location
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Market Jurisdictions', value: Array.isArray(locations) ? [...new Set(locations.map(l => typeof l.country === 'object' ? l.country?.name : l.country))].filter(Boolean).length : 0, icon: Globe, color: 'indigo' },
              { label: 'Operational Hubs', value: Array.isArray(locations) ? locations.length : 0, icon: MapPin, color: 'emerald' },
              { label: 'Active Currencies', value: Array.isArray(locations) ? [...new Set(locations.map(l => l.currency_code))].filter(Boolean).length : 0, icon: DollarSign, color: 'blue' }
            ].map((stat, i) => (
              <button
                key={i}
                type="button"
                onClick={i === 0 ? () => navigate('/admin/pricing/service-location/jurisdictions') : undefined}
                className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 group transition-colors text-left ${
                  i === 0
                    ? 'cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30 active:scale-[0.99]'
                    : 'cursor-default'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm group-hover:scale-110 transition-transform`}>
                  <stat.icon size={24} />
                </div>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${i === 0 ? 'text-indigo-600' : 'text-gray-400'}`}>{stat.label}</p>
                  <h3 className="text-2xl font-black text-gray-900 mt-1">{stat.value}</h3>
                </div>
              </button>
            ))}
          </div>

          {/* List Table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-gray-50/50 border-b border-gray-100">
              <div className="relative w-full max-w-sm">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search locations..." 
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                 <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                    <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Validating Market Access</p>
                 </div>
              ) : filteredLocations.length > 0 ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                      <th className="px-6 py-4">Sector Name</th>
                      <th className="px-6 py-4">Jurisdiction</th>
                      <th className="px-6 py-4 text-center">Settlement</th>
                      <th className="px-6 py-4">Temporal Zone</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLocations.map(l => (
                      <tr key={l._id || l.id} className="hover:bg-gray-50/20 transition-colors group">
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm group-hover:rotate-6 transition-transform"><MapPin size={18} /></div>
                              <span className="text-sm font-bold text-gray-900 leading-tight">{l.name || l.service_location_name}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <button
                             type="button"
                             onClick={() => navigate(`/admin/pricing/service-location/jurisdictions/${encodeURIComponent(getCountryName(l.country).trim())}`)}
                             className="text-xs font-bold uppercase tracking-wider text-indigo-600 transition-colors hover:text-indigo-800 hover:underline"
                           >
                             {typeof l.country === 'object' ? l.country?.name : l.country || '-'}
                           </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg">
                              <span className="text-[10px] font-black text-indigo-600">{l.currency_code}</span>
                              <span className="text-xs font-bold text-gray-400">{l.currency_symbol}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                              <Clock size={12} className="text-indigo-300" /> {l.timezone}
                           </div>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                           <div className="flex items-center justify-end gap-2">
                             <button onClick={() => navigate(`/admin/pricing/service-location/edit/${l._id || l.id}`)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shadow-sm"><Edit2 size={16} /></button>
                             <button onClick={() => handleDelete(l._id || l.id)} className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm"><Trash2 size={16} /></button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-24 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center text-gray-200 mx-auto mb-4 tracking-tighter"><Globe size={32} /></div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">No Hubs Discovered</h3>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto">Initialize service locations to define your operational footprint.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8 animate-in fade-in duration-500 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header - Matching Image */}
        <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-black text-gray-900 uppercase tracking-tight">{isCreate ? 'CREATE' : 'EDIT'}</h1>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              <span>Service Location</span>
              <ChevronRight size={12} className="text-gray-300" />
              <span className="text-gray-900">{isCreate ? 'Create' : 'Edit'}</span>
            </div>
        </div>

        {/* Form Card - Matching Image */}
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-xl shadow-gray-200/20 overflow-hidden p-10">
           {/* Language Tabs */}
           <div className="flex items-center gap-8 border-b border-gray-100 mb-10">
              {ADMIN_LANGUAGE_OPTIONS.map(lang => (
                <button 
                  key={lang}
                  onClick={() => setActiveLangTab(lang)}
                  className={`pb-4 text-[13px] font-bold transition-all relative ${activeLangTab === lang ? 'text-emerald-500' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {lang}
                  {activeLangTab === lang && (
                    <motion.div layoutId="lang-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
                  )}
                </button>
              ))}
           </div>

           <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                 <div className="md:col-span-1 space-y-2">
                    <label className={labelClass}>Name <span className="text-rose-400">*</span></label>
                    <input 
                       value={formData.name}
                       onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                       placeholder={`Enter Name in ${activeLangTab}`} 
                       className={inputClass} 
                       required
                    />
                 </div>

                 <div className="md:col-span-1 border-0" />

                 <div className="space-y-2">
                    <label className={labelClass}>Select Country <span className="text-rose-400">*</span></label>
                    <div className="relative">
                      <select 
                         value={formData.country} 
                         onChange={(e) => setFormData(p => ({ ...p, country: e.target.value }))} 
                         className={inputClass + " appearance-none cursor-pointer"}
                         required
                      >
                         <option value="">Choose Country</option>
                         {countries.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className={labelClass}>Currency Code <span className="text-rose-400">*</span></label>
                    <input 
                       value={formData.currency_code} 
                       onChange={(e) => setFormData(p => ({ ...p, currency_code: e.target.value.toUpperCase() }))} 
                       placeholder="Enter Currency Code" 
                       className={inputClass} 
                       required
                    />
                 </div>

                 <div className="space-y-2">
                    <label className={labelClass}>Currency Symbol <span className="text-rose-400">*</span></label>
                    <input 
                       value={formData.currency_symbol} 
                       onChange={(e) => setFormData(p => ({ ...p, currency_symbol: e.target.value }))} 
                       placeholder="Enter Currency Symbol" 
                       className={inputClass} 
                       required
                    />
                 </div>

                 <div className="space-y-2">
                    <label className={labelClass}>Select Timezone <span className="text-rose-400">*</span></label>
                    <div className="relative">
                      <select 
                         value={formData.timezone} 
                         onChange={(e) => setFormData(p => ({ ...p, timezone: e.target.value }))} 
                         className={inputClass + " appearance-none cursor-pointer"}
                         required
                      >
                         <option value="">Choose Timezone</option>
                         {DEFAULT_TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                 </div>
              </div>

              <div className="pt-10 flex justify-end">
                 <button 
                    type="submit" disabled={saving}
                    className="px-10 py-3 bg-[#38467F] text-white rounded-lg text-sm font-bold hover:bg-[#2D3866] transition-all shadow-lg active:scale-95 flex items-center gap-2"
                 >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                    {isEdit ? 'Update' : 'Save'}
                 </button>
              </div>
           </form>
        </div>
      </div>
    </div>
  );
};

export default ServiceLocation;
