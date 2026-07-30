import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Clock, Map, User, Car, Utensils } from 'lucide-react';
import { useSettings, normalizeAssetUrl } from '../../../shared/context/SettingsContext';
import busIcon from '../../../assets/3d images/AutoCab/bus.png';

const isEnabledFlag = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(normalized);
};

const BottomNavbar = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [showHomeDropup, setShowHomeDropup] = useState(false);
  const dropupRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropupRef.current && !dropupRef.current.contains(event.target)) {
        setShowHomeDropup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (
    pathname.includes('/admin') ||
    pathname.includes('/owner') ||
    pathname.includes('/driver')
  ) {
    return null;
  }

  const { settings, modules, loading, hasBootstrapSettings } = useSettings();
  const showBusService = isEnabledFlag(settings.transportRide?.enable_bus_service);
  const busModule = (modules || []).find(m => m.service_type === 'bus' || m.name.toLowerCase() === 'bus');
  const dynamicBusIcon = busModule?.mobile_menu_icon && (busModule.mobile_menu_icon.startsWith('http://') || busModule.mobile_menu_icon.startsWith('https://') || busModule.mobile_menu_icon.startsWith('data:'))
    ? normalizeAssetUrl(busModule.mobile_menu_icon)
    : busIcon;
  const showNavSkeleton = loading && !hasBootstrapSettings;

  const navItems = [
    { icon: Home, label: 'Ride', path: '/taxi/user' },
    { icon: Clock, label: 'Rides', path: '/taxi/user/activity' },
    // Bus tab hidden — re-enable when bus service is ready
    // ...(showBusService ? [{ imageIcon: dynamicBusIcon, label: 'Bus', path: '/taxi/user/bus' }] : []),
    { icon: Map, label: 'Support', path: '/taxi/user/support' },
    { icon: User, label: 'Profile', path: '/taxi/user/profile' },
  ];

  if (showNavSkeleton) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-[100] mx-auto w-full max-w-lg px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-2 pointer-events-none">
        <div className="flex items-center justify-around overflow-visible rounded-[32px] border border-white/40 bg-white/85 px-2 py-2 shadow-[0_20px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl pointer-events-auto relative">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex flex-1 flex-col items-center justify-center py-1.5">
              <div className="h-[21px] w-[21px] animate-pulse rounded-full bg-slate-200" />
              <div className="mt-2 h-2.5 w-10 animate-pulse rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] mx-auto w-full max-w-lg px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-2 pointer-events-none">
      <div className="flex items-center justify-around overflow-visible rounded-[32px] border border-white/40 bg-white/85 px-2 py-2 shadow-[0_20px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl pointer-events-auto relative">
        {navItems.map(({ icon: Icon, imageIcon, label, path }) => {
          const isHomeTab = label === 'Ride';
          const isActive =
            path === '/taxi/user'
              ? pathname === path
              : pathname === path || pathname.startsWith(`${path}/`);

          return (
            <div 
              key={label} 
              className="flex-1 flex flex-col items-center justify-center relative"
              ref={isHomeTab ? dropupRef : null}
            >
              <AnimatePresence>
                {isHomeTab && showHomeDropup && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="absolute bottom-[calc(100%+16px)] left-1/2 -translate-x-1/2 w-48 bg-white rounded-[20px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 overflow-hidden z-[110]"
                  >
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowHomeDropup(false); navigate('/taxi/user'); }}
                      className="w-full flex items-center px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors border-b border-slate-100"
                    >
                      <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mr-3 shrink-0">
                        <Car size={18} strokeWidth={2.5} />
                      </div>
                      <span className="text-[13px] font-bold text-slate-800 tracking-tight">Taxi Homepage</span>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowHomeDropup(false); navigate('/food/user'); }}
                      className="w-full flex items-center px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mr-3 shrink-0">
                        <Utensils size={18} strokeWidth={2.5} />
                      </div>
                      <span className="text-[13px] font-bold text-slate-800 tracking-tight">Food Homepage</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                type="button"
                onClick={() => {
                  if (isHomeTab) {
                    setShowHomeDropup((prev) => !prev);
                  } else {
                    navigate(path);
                  }
                }}
                className="w-full flex flex-col items-center justify-center py-1.5 relative z-10 outline-none tap-highlight-transparent group"
              >
              <div className="relative flex flex-col items-center">
                {/* Active Sliding Background Pill */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="active-pill"
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 32,
                        mass: 1
                      }}
                      className="absolute -inset-y-2 -inset-x-4 bg-slate-900 rounded-[20px] shadow-[0_8px_20px_rgba(15,23,42,0.25)]"
                    />
                  )}
                </AnimatePresence>

                {/* Icon Container with Transition */}
                <motion.div
                  animate={{ 
                    scale: isActive ? 1.15 : 1,
                    y: isActive ? -1 : 0
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 30
                  }}
                  className="relative z-20"
                >
                  {imageIcon ? (
                    <img
                      src={imageIcon}
                      alt=""
                      className={`h-[21px] w-[21px] object-contain transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-80'}`}
                      draggable={false}
                    />
                  ) : (
                    <Icon
                      size={21}
                      strokeWidth={isActive ? 2.5 : 2}
                      className={`transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`}
                    />
                  )}
                </motion.div>

                {/* Label with Transition */}
                <motion.span 
                  animate={{ 
                    opacity: isActive ? 1 : 0.5,
                    y: isActive ? 2 : 1,
                    scale: isActive ? 1 : 0.95
                  }}
                  transition={{
                    duration: 0.2
                  }}
                  className={`relative z-20 mt-1 font-['Outfit'] text-[10px] font-medium uppercase tracking-[0.12em] transition-colors duration-300 ${
                    isActive ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  {label}
                </motion.span>
                
                {/* Subtle Bottom Glow for Active Tab */}
                {isActive && (
                  <motion.div
                    layoutId="active-glow"
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 32
                    }}
                    className="absolute -bottom-2 w-4 h-1 bg-white/20 rounded-full blur-[2px]"
                  />
                )}
              </div>
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavbar;
