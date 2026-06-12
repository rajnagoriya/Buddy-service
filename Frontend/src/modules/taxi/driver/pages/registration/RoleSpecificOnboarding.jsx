import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BusFront, Building2, ChevronRight, Search, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  clearDriverRegistrationSession,
  completeDriverOnboarding,
  getDriverOnboardingSignupOptions,
  getStoredDriverRegistrationSession,
  persistDriverAuthSession,
  saveDriverOnboardingRoleDetails,
  saveDriverRegistrationSession,
} from '../../services/registrationService';

const unwrap = (response) => response?.data?.data || response?.data || response;

const ROLE_META = {
  bus_driver: {
    title: 'Bus Assignment',
    subtitle: 'Choose the bus service you should be linked to.',
    Icon: BusFront,
    color: 'text-blue-600',
  },
  service_center: {
    title: 'Center Details',
    subtitle: 'Set up your service center request for admin approval.',
    Icon: Building2,
    color: 'text-violet-600',
  },
  service_center_staff: {
    title: 'Center Access',
    subtitle: 'Pick the service center you want to work under.',
    Icon: UserRound,
    color: 'text-rose-600',
  },
};

const RoleSpecificOnboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getStoredDriverRegistrationSession();
  const role = String(session.role || '').toLowerCase();
  const meta = ROLE_META[role];
  const phone = String(session.phone || '').replace(/\D/g, '').slice(-10);
  const registrationId = String(session.registrationId || '').trim();

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState({
    serviceLocations: [],
    serviceCenters: [],
    busServices: [],
  });
  const [formData, setFormData] = useState(() => ({
    centerName: session.roleDetails?.centerName || '',
    address: session.roleDetails?.address || '',
    serviceLocationId: session.roleDetails?.serviceLocationId || '',
    serviceCenterId: session.roleDetails?.serviceCenterId || '',
    busServiceId: session.roleDetails?.busServiceId || '',
    requestNote: session.roleDetails?.requestNote || '',
  }));

  useEffect(() => {
    if (!phone || !registrationId || !meta) {
      navigate('/taxi/driver/login', { replace: true });
      return;
    }

    let active = true;

    const loadOptions = async () => {
      try {
        setLoadingOptions(true);
        const response = await getDriverOnboardingSignupOptions();
        if (!active) return;
        setOptions(unwrap(response));
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.message || 'Unable to load signup options');
      } finally {
        if (active) {
          setLoadingOptions(false);
        }
      }
    };

    loadOptions();
    return () => {
      active = false;
    };
  }, [meta, navigate, phone, registrationId]);

  useEffect(() => {
    saveDriverRegistrationSession({
      ...session,
      roleDetails: {
        ...(session.roleDetails || {}),
        ...formData,
      },
    });
  }, [formData]);

  const filteredServiceCenters = useMemo(() => {
    const term = String(search || '').trim().toLowerCase();
    const items = Array.isArray(options.serviceCenters) ? options.serviceCenters : [];
    if (!term) return items;
    return items.filter((item) =>
      [item.name, item.address, item.ownerPhone, item.serviceLocationName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [options.serviceCenters, search]);

  const filteredBusServices = useMemo(() => {
    const term = String(search || '').trim().toLowerCase();
    const items = Array.isArray(options.busServices) ? options.busServices : [];
    if (!term) return items;
    return items.filter((item) =>
      [item.operatorName, item.busName, item.serviceNumber, item.routeName, item.originCity, item.destinationCity]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [options.busServices, search]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const roleDetails =
        role === 'service_center'
          ? {
              centerName: formData.centerName,
              address: formData.address,
              serviceLocationId: formData.serviceLocationId,
            }
          : role === 'service_center_staff'
            ? {
                serviceCenterId: formData.serviceCenterId,
              }
            : {
                busServiceId: formData.busServiceId,
                requestNote: formData.requestNote,
              };

      await saveDriverOnboardingRoleDetails({
        registrationId,
        phone,
        roleDetails,
      });

      const response = await completeDriverOnboarding({ registrationId, phone });
      const payload = unwrap(response);

      if (payload?.token) {
        persistDriverAuthSession({ token: payload.token, role });
      }

      saveDriverRegistrationSession({
        ...session,
        roleDetails,
        completedRegistration: payload || null,
      });
      clearDriverRegistrationSession();
      navigate('/taxi/driver/registration-status', {
        replace: true,
        state: {
          role,
          completedRegistration: payload || null,
        },
      });
    } catch (requestError) {
      setError(requestError?.message || 'Unable to submit this signup request');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    role === 'service_center'
      ? Boolean(formData.centerName.trim() && formData.address.trim() && formData.serviceLocationId)
      : role === 'service_center_staff'
        ? Boolean(formData.serviceCenterId)
        : Boolean(formData.busServiceId);

  if (!meta) {
    return null;
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f6efe4_0%,#fcfaf6_28%,#ffffff_100%)] px-5 pb-32 pt-8 select-none"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <main className="mx-auto max-w-sm space-y-6">
        <header className="space-y-5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/taxi/driver/step-personal')}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-slate-900 shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="rounded-full bg-slate-900/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 border border-slate-900/5">
              Final Step
            </div>
          </div>

          <div className="space-y-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-[1.25rem] bg-white shadow-sm ${meta.color}`}>
              <meta.Icon size={22} />
            </div>
            <h1 className="font-['Outfit'] text-[42px] font-black leading-[1] tracking-[-0.04em] text-slate-900">
              {meta.title}
            </h1>
            <p className="text-[15px] leading-relaxed text-slate-500 font-bold opacity-80">
              {meta.subtitle}
            </p>
          </div>
        </header>

        {role === 'service_center' ? (
          <section className="space-y-4 rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm">
            <input
              value={formData.centerName}
              onChange={(event) => setFormData((current) => ({ ...current, centerName: event.target.value }))}
              placeholder="Service center name"
              className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-900 outline-none"
            />
            <textarea
              value={formData.address}
              onChange={(event) => setFormData((current) => ({ ...current, address: event.target.value }))}
              placeholder="Center address"
              rows={4}
              className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-900 outline-none"
            />
            <select
              value={formData.serviceLocationId}
              onChange={(event) => setFormData((current) => ({ ...current, serviceLocationId: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-900 outline-none"
            >
              <option value="">Select service location</option>
              {(options.serviceLocations || []).map((item) => (
                <option key={item._id || item.id} value={item._id || item.id}>
                  {item.service_location_name || item.name}
                </option>
              ))}
            </select>
          </section>
        ) : null}

        {role !== 'service_center' ? (
          <section className="space-y-4 rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={role === 'bus_driver' ? 'Search bus service' : 'Search service center'}
                className="w-full rounded-2xl border border-slate-200 pl-11 pr-4 py-4 text-sm font-bold text-slate-900 outline-none"
              />
            </div>

            <div className="space-y-3">
              {(role === 'service_center_staff' ? filteredServiceCenters : filteredBusServices).map((item) => {
                const isSelected =
                  role === 'service_center_staff'
                    ? String(formData.serviceCenterId) === String(item.id)
                    : String(formData.busServiceId) === String(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setFormData((current) => ({
                        ...current,
                        serviceCenterId: role === 'service_center_staff' ? item.id : current.serviceCenterId,
                        busServiceId: role === 'bus_driver' ? item.id : current.busServiceId,
                      }))
                    }
                    className={`w-full rounded-[22px] border p-4 text-left transition ${
                      isSelected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'
                    }`}
                  >
                    <p className="text-sm font-black">
                      {role === 'service_center_staff' ? item.name : `${item.operatorName} - ${item.busName}`}
                    </p>
                    <p className={`mt-1 text-xs font-bold ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>
                      {role === 'service_center_staff'
                        ? `${item.serviceLocationName || 'Location not set'} - ${item.address || 'Address not set'}`
                        : `${item.originCity || 'Origin'} to ${item.destinationCity || 'Destination'}${item.serviceNumber ? ` - ${item.serviceNumber}` : ''}`}
                    </p>
                  </button>
                );
              })}
            </div>

            {role === 'bus_driver' ? (
              <textarea
                value={formData.requestNote}
                onChange={(event) => setFormData((current) => ({ ...current, requestNote: event.target.value }))}
                placeholder="Optional note for the admin"
                rows={3}
                className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-900 outline-none"
              />
            ) : null}
          </section>
        ) : null}

        {loadingOptions ? (
          <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm font-bold text-slate-500">
            Loading signup options...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
            {error}
          </div>
        ) : null}
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
        <div className="mx-auto max-w-sm">
          <motion.button
            whileHover={canSubmit && !submitting ? { scale: 1.02 } : {}}
            whileTap={canSubmit && !submitting ? { scale: 0.98 } : {}}
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting || loadingOptions}
            className={`flex h-16 w-full items-center justify-center gap-3 rounded-[1.8rem] text-[15px] font-black tracking-tight transition-all ${
              canSubmit && !loadingOptions
                ? 'bg-slate-900 text-white shadow-[0_20px_40px_rgba(0,0,0,0.2)]'
                : 'bg-slate-200 text-slate-400'
            }`}
          >
            {submitting ? (
              <span className="h-5 w-5 rounded-full border-2 border-white/25 border-t-white animate-spin" />
            ) : (
              <>
                <span className="uppercase tracking-widest">Submit Request</span>
                <ChevronRight size={18} />
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default RoleSpecificOnboarding;
