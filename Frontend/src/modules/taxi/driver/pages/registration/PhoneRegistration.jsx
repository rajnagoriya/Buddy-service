import React, { useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, ChevronRight, Smartphone } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  clearDriverRegistrationSession,
  getStoredDriverRegistrationSession,
  saveDriverRegistrationSession,
  sendDriverOtp,
} from '../../services/registrationService';
import { useSettings } from '../../../../shared/context/SettingsContext';
import taxiBg from '../../../../assets/images/light-taxi-bg.png';

const getErrorMessage = (err) => String(
  err?.message ||
  err?.error ||
  err?.response?.data?.message ||
  '',
).trim();

const PhoneRegistration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const appName = settings.general?.app_name || 'Buddy Service';
  const appLogo = settings.general?.logo || settings.customization?.logo || settings.general?.favicon || '';
  const storedSession = getStoredDriverRegistrationSession();
  const isOwnerPortal = location.pathname.startsWith('/taxi/owner');
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const sharedReferralCode = String(
    searchParams.get('ref') ||
    searchParams.get('referral') ||
    searchParams.get('code') ||
    storedSession.referralCode ||
    '',
  ).trim().toUpperCase();

  const [phone, setPhone] = useState(() => String(location.state?.phone || storedSession.phone || '').replace(/\D/g, '').slice(-10));
  const [agreed, setAgreed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const routePrefix = isOwnerPortal ? '/taxi/owner' : '/taxi/driver';
  const isLoginPage = location.pathname === `${routePrefix}/login` || location.pathname === `${routePrefix}/login/`;
  const entryPath = `${routePrefix}/login`;
  const HeaderIcon = isOwnerPortal ? Briefcase : Smartphone;
  const portalLabel = isOwnerPortal ? 'Owner' : 'Driver';

  const handleSendOTP = async () => {
    if (phone.length !== 10) {
      setError('Please enter 10 digits');
      return;
    }

    if (!agreed) {
      setError('Accept terms to continue');
      return;
    }

    setLoading(true);
    setError('');

    try {
      clearDriverRegistrationSession();

      const response = await sendDriverOtp(
        isOwnerPortal
          ? { phone, role: 'owner' }
          : { phone },
      );

      const payload = response?.data?.data || response?.data || response;
      const sessionData = payload?.session || {};
      const loginMode = Boolean(payload?.loginMode || sessionData?.loginMode);
      const nextState = saveDriverRegistrationSession({
        phone,
        role: sessionData.role || (isOwnerPortal ? 'owner' : ''),
        roleConfirmed: sessionData.roleConfirmed ?? isOwnerPortal,
        needsRoleSelection: !isOwnerPortal && sessionData.roleConfirmed === false,
        registrationId: sessionData.registrationId || '',
        debugOtp: sessionData.debugOtp || '',
        loginMode,
        poolingOnboarding: false,
        entryPath,
        referralCode: sharedReferralCode,
        status: sessionData.status || '',
      });

      navigate(`${routePrefix}/otp-verify`, { state: nextState });
    } catch (requestError) {
      setError(getErrorMessage(requestError) || 'Try again in a moment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-[#F8FAFC] select-none overflow-x-hidden font-['Outfit']">
      <div className="fixed inset-0 z-0">
        <motion.img
          initial={{ scale: 1.05, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          src={taxiBg}
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/40 to-white" />
      </div>

      <main className="relative z-10 mx-auto max-w-sm px-6 flex flex-col min-h-screen pt-10 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 space-y-8"
        >
          <header className="text-center space-y-4">
            <div className="flex flex-col items-center gap-3">
              {appLogo ? (
                <img
                  src={appLogo}
                  alt={`${appName} logo`}
                  className="h-14 w-14 rounded-2xl object-cover bg-white p-1.5 shadow-xl shadow-slate-200/70 border border-white"
                />
              ) : (
                <div className="rounded-2xl bg-slate-900 px-4 py-2 text-base font-black tracking-tight text-white shadow-xl shadow-slate-900/10">
                  {appName}
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                  {appName}
                </p>
              </div>
            </div>
            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-amber-200/40 mx-auto flex items-center justify-center border border-amber-50 mb-6">
              <HeaderIcon size={34} className={isOwnerPortal ? 'text-emerald-500' : 'text-amber-500'} strokeWidth={2.5} />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              {isLoginPage ? 'Hello!' : 'Welcome'}
            </h1>
            <p className="text-slate-500 font-medium text-lg">
              {isOwnerPortal
                ? 'Use your owner number to sign in or continue registration'
                : 'Enter your mobile number. Existing accounts open directly and new numbers choose a role after OTP.'}
            </p>
            {!isOwnerPortal && (
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Driver, owner, pooling, bus, and service center logins all start here
              </p>
            )}
          </header>

          <motion.div
            layout
            className="bg-white rounded-[40px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-50 space-y-8"
          >
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">
                {portalLabel} Mobile Number
              </p>
              <div className={`flex items-center gap-4 p-5 rounded-2xl transition-all border-2 ${error ? 'border-rose-100 bg-rose-50/30' : 'border-slate-50 bg-slate-50 focus-within:border-amber-400 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-amber-100/50'}`}>
                <div className="flex items-center gap-2 pr-4 border-r border-slate-200">
                  <span className="text-slate-400 text-sm font-black">+91</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, ''));
                    if (error) setError('');
                  }}
                  placeholder="Phone Number"
                  className="flex-1 bg-transparent border-none p-0 text-xl font-bold text-slate-900 outline-none focus:ring-0 placeholder:text-slate-300"
                />
                {phone.length === 10 && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <CheckCircle2 size={20} className="text-emerald-500" />
                  </motion.div>
                )}
              </div>
            </div>

            <div className="flex gap-4 items-start px-1">
              <input
                type="checkbox"
                id="terms"
                checked={agreed}
                onChange={() => setAgreed(!agreed)}
                className="h-6 w-6 rounded-lg border-2 border-slate-100 bg-slate-50 text-amber-500 focus:ring-amber-500 transition-all cursor-pointer"
              />
              <label htmlFor="terms" className="text-sm font-medium text-slate-400 leading-snug cursor-pointer select-none">
                I accept the <button type="button" onClick={() => navigate(`${routePrefix}/terms`)} className="text-amber-500 font-bold hover:underline">Terms</button> & <button type="button" onClick={() => navigate(`${routePrefix}/privacy`)} className="text-amber-500 font-bold hover:underline">Privacy</button>
              </label>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-rose-500 text-xs font-bold text-center bg-rose-50 p-3 rounded-xl"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate(`${routePrefix}/support`)}
              className="text-slate-400 text-sm font-bold hover:text-slate-600 transition-colors"
            >
              Need help? <span className="text-amber-500">Contact Support</span>
            </button>
          </div>
        </motion.div>

        <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-white via-white/80 to-transparent">
          <div className="mx-auto max-w-sm">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSendOTP}
              disabled={loading || !agreed || phone.length !== 10}
              className={`group flex h-18 w-full items-center justify-center gap-3 rounded-[24px] text-lg font-black transition-all ${
                agreed && phone.length === 10
                  ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/20'
                  : 'bg-slate-100 text-slate-300 pointer-events-none'
              }`}
            >
              {loading ? (
                <div className="h-6 w-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span className="uppercase tracking-widest">Continue</span>
                  <ChevronRight size={24} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </motion.button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PhoneRegistration;
