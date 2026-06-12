import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSettings, normalizeAssetUrl } from '../../../shared/context/SettingsContext';
import bikeIcon from '../../../assets/icons/bike.png';
import autoIcon from '../../../assets/icons/auto.png';
import carIcon from '../../../assets/icons/car.png';
import deliveryIcon from '../../../assets/icons/Delivery.png';
import busIcon from '../../../assets/icons/bus.png';
import scootyIcon from '../../../assets/icons/scooty.png';
import truckIcon from '../../../assets/icons/truck.png';
import premiumCarIcon from '../../../assets/icons/premium_car.png';

const getLocalIcon = (module) => {
  const name = String(module?.name || '').trim().toLowerCase();
  const serviceType = String(module?.service_type || '').trim().toLowerCase();
  const transportType = String(module?.transport_type || '').trim().toLowerCase();

  if (name.includes('truck') || transportType === 'truck') return truckIcon;
  if (name.includes('delivery') || name.includes('parcel') || transportType === 'delivery') return deliveryIcon;
  if (name.includes('bus') || transportType === 'bus') return busIcon;
  if (name.includes('bike') || transportType === 'bike') return bikeIcon;
  if (name.includes('auto') || transportType === 'auto') return autoIcon;
  if (name.includes('pooling') || serviceType === 'pooling') return premiumCarIcon;
  if (name.includes('scooty') || name.includes('scooter')) return scootyIcon;
  
  return carIcon;
};

const getIconUrl = (module) => {
  const icon = module?.mobile_menu_icon;
  if (icon && (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('data:'))) {
    return icon;
  }
  return getLocalIcon(module);
};

const normalizeModuleText = (value = '') => String(value || '').trim().toLowerCase();

const isDeliveryModule = (module = {}) => {
  const name = normalizeModuleText(module?.name);
  const serviceType = normalizeModuleText(module?.service_type);
  const transportType = normalizeModuleText(module?.transport_type);

  return (
    transportType === 'delivery' ||
    serviceType === 'delivery' ||
    name.includes('delivery') ||
    name.includes('delhivery')
  );
};

const isNormalRideModule = (module = {}) => {
  const name = normalizeModuleText(module?.name);
  const serviceType = normalizeModuleText(module?.service_type);
  const transportType = normalizeModuleText(module?.transport_type);

  if (isDeliveryModule(module)) {
    return false;
  }

  if (['rental', 'outstation', 'bus', 'pooling'].includes(serviceType)) {
    return false;
  }

  return (
    ['normal', 'taxi', 'ride', 'ride_hailing', 'ride-hailing'].includes(serviceType) ||
    ['taxi', 'both'].includes(transportType) ||
    name.includes('taxi') ||
    name.includes('cab') ||
    name.includes('ride') ||
    name.includes('normal')
  );
};

const getPinnedModuleOrder = (module = {}) => {
  if (isNormalRideModule(module)) return 1;
  if (isDeliveryModule(module)) return 2;
  return null;
};

const Motion = motion;

const ServiceTile = ({ icon, label, description, path, accentClass, loading }) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex w-full min-h-[112px] items-center justify-center">
        <div className="flex h-[100px] w-[90%] animate-pulse flex-col items-center justify-center gap-2 rounded-[16px] border border-white/20 bg-white/65 px-1 py-1.5">
        <div className="h-[72px] w-[72px] rounded-[16px] bg-gray-200" />
          <div className="h-3 w-12 rounded-full bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      whileHover={{ y: -1.5 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => path && navigate(path)}
      className="flex h-full min-h-[112px] w-full items-center justify-center transition-transform"
    >
      <div className="flex h-[108px] w-[92%] flex-col items-center justify-center gap-1.5 px-1 py-1">
        <div className={`flex h-[82px] w-[82px] items-center justify-center rounded-[18px] ${accentClass || 'bg-gray-50'}`}>
          <img src={icon} alt={label} className="h-[70px] w-[70px] object-contain drop-shadow-sm" />
        </div>

        <div className="flex flex-col items-center gap-0.5 text-center">
          <span className="min-h-[24px] text-[10.5px] font-semibold leading-tight text-slate-900 line-clamp-2 uppercase">
            {label}
          </span>
          <span className="sr-only">{description}</span>
        </div>
      </div>
    </motion.button>
  );
};

const ServiceGrid = () => {
  const getServiceKey = (service, index) => {
    const label = String(service?.label || '').trim();
    const path = String(service?.path || '').trim();
    return label || path ? `${label || 'service'}-${path || index}` : `service-${index}`;
  };

  const getPath = (module) => {
    const serviceType = String(module?.service_type || '').trim().toLowerCase();
    const transportType = String(module?.transport_type || '').trim().toLowerCase();
    const moduleName = String(module?.name || '').trim().toLowerCase();

    if (transportType === 'delivery') return '/taxi/user/parcel/type';
    if (serviceType === 'rental') return '/taxi/user/rental';
    if (serviceType === 'outstation') return '/taxi/user/intercity';
    if (serviceType === 'pooling' || moduleName.includes('pooling')) {
      return '/taxi/user/pooling';
    }

    if (serviceType === 'bus' || transportType === 'bus' || moduleName.includes('bus')) {
      return '/taxi/user/bus';
    }

    // Regular ride-hailing modules should always start from category selection.
    if (
      ['normal', 'taxi', 'ride', 'ride_hailing', 'ride-hailing'].includes(serviceType) ||
      ['taxi', 'both'].includes(transportType) ||
      moduleName.includes('taxi') ||
      moduleName.includes('cab')
    ) {
      return '/taxi/user/ride/select-category';
    }

    return '/taxi/user/ride/select-category';
  };

  const getAccent = (index) => {
    const accnets = [
      'bg-[linear-gradient(135deg,#FFF7ED_0%,#FFE5C2_100%)]', // Orange
      'bg-[linear-gradient(135deg,#FEFCE8_0%,#FDE68A_100%)]', // Yellow
      'bg-[linear-gradient(135deg,#EFF6FF_0%,#DBEAFE_100%)]', // Blue
      'bg-[linear-gradient(135deg,#F5F3FF_0%,#E9D5FF_100%)]', // Purple
      'bg-[linear-gradient(135deg,#ECFDF5_0%,#A7F3D0_100%)]', // Green
      'bg-[linear-gradient(135deg,#FFF1F2_0%,#FECDD3_100%)]', // Rose
    ];
    return accnets[index % accnets.length];
  };

  const { modules, loading: settingsLoading } = useSettings();
  const loading = settingsLoading;
  const services = loading
    ? []
    : (modules || [])
        .filter((m) => m.active)
        .slice()
        .sort((a, b) => {
          const pinnedA = getPinnedModuleOrder(a);
          const pinnedB = getPinnedModuleOrder(b);

          if (pinnedA !== null || pinnedB !== null) {
            if (pinnedA === null) return 1;
            if (pinnedB === null) return -1;
            if (pinnedA !== pinnedB) return pinnedA - pinnedB;
          }

          const orderA = Number(a?.order_by);
          const orderB = Number(b?.order_by);
          const hasOrderA = Number.isFinite(orderA);
          const hasOrderB = Number.isFinite(orderB);

          if (hasOrderA && hasOrderB && orderA !== orderB) {
            return orderA - orderB;
          }

          if (hasOrderA !== hasOrderB) {
            return hasOrderA ? -1 : 1;
          }

          return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' });
        })
        .map((m, idx) => {
          return {
            icon: getIconUrl(m),
            label: m.name,
            description: m.short_description,
            path: getPath(m),
            accentClass: getAccent(idx),
          };
        });

  const optionCount = loading ? '...' : services.length;
  const optionLabel = services.length === 1 ? 'option' : 'options';

  return (
    <div className="px-5">
      <Motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="py-1"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Services</p>
            <h2 className="mt-1 text-[18px] font-semibold text-slate-900">Choose your ride</h2>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">Tap to start quickly.</p>
          </div>

          <div className="rounded-full border border-white/80 bg-white/90 px-3 py-2 text-[11px] font-medium text-slate-600 shadow-sm">
            {optionCount} {optionLabel}
          </div>
        </div>

        <div className="mt-4 grid auto-rows-fr grid-cols-3 gap-3 md:grid-cols-4">
          {loading ? (
             [...Array(4)].map((_, i) => <ServiceTile key={i} loading />)
          ) : (
            services.map((service, index) => (
              <ServiceTile key={getServiceKey(service, index)} {...service} />
            ))
          )}
        </div>
      </Motion.section>
    </div>
  );
};

export default ServiceGrid;
