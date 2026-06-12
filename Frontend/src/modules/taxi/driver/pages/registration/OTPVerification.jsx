import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck, ChevronRight, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    buildDriverOnboardingSessionSnapshot,
    getDriverOnboardingResumeStep,
    getDriverOnboardingSession,
    getStoredDriverRegistrationSession,
    clearDriverRegistrationSession,
    getPoolingDriverOnboardingSession,
    persistDriverAuthSession,
    saveDriverRegistrationSession,
    sendDriverLoginOtp,
    sendDriverOtp,
    startPoolingDriverOnboarding,
    verifyDriverLoginOtp,
    verifyDriverOtp,
    verifyPoolingDriverOnboardingOtp,
} from '../../services/registrationService';
import taxiBg from '../../../../assets/images/light-taxi-bg.png';

const unwrap = (response) => response?.data?.data || response?.data || response;
const normalizeDriverRole = (role) => {
    const normalized = String(role || 'driver').toLowerCase();
    if (normalized === 'owner') return 'owner';
    if (normalized === 'pooling_driver' || normalized === 'pooling-driver' || normalized === 'poolingdriver' || normalized === 'pooling') return 'pooling_driver';
    if (normalized === 'service_center' || normalized === 'service-center' || normalized === 'servicecenter') return 'service_center';
    if (normalized === 'service_center_staff' || normalized === 'service-center-staff' || normalized === 'servicecenterstaff') return 'service_center_staff';
    if (normalized === 'bus_driver' || normalized === 'bus-driver' || normalized === 'busdriver') return 'bus_driver';
    return 'driver';
};

const isDriverApproved = (driver) => {
    if (!driver) return false;
    const approval = String(driver?.approve ?? '').toLowerCase();
    const status = String(driver?.status || '').toLowerCase();
    return (
        driver?.approve === true ||
        driver?.approve === 1 ||
        ['true', '1', 'yes', 'approved'].includes(approval) ||
        ['approved', 'active', 'verified'].includes(status)
    );
};

const getPostLoginRoute = (role, driver, routePrefix) => {
    const normalizedRole = normalizeDriverRole(role);
    if (normalizedRole === 'service_center' || normalizedRole === 'service_center_staff') return '/taxi/driver/service-center';
    if (normalizedRole === 'bus_driver') return '/taxi/driver/bus-home';
    if (normalizedRole === 'pooling_driver') return '/taxi/driver/pooling';
    if (normalizedRole === 'owner' || normalizedRole === 'driver') {
        return isDriverApproved(driver)
            ? normalizedRole === 'owner' ? '/taxi/owner/home' : '/taxi/driver/home'
            : `${routePrefix}/registration-status`;
    }
    return '/taxi/driver/home';
};

const syncPushTokens = async () => {
    await Promise.allSettled([
        window.__flushNativeFcmToken?.(),
        window.__registerBrowserFcmToken?.({ interactive: true }),
    ]);
};

const OTPVerification = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [otp, setOtp] = useState(['', '', '', '']);
    const inputs = useRef([]);
    const [timer, setTimer] = useState(60);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resolvingSession, setResolvingSession] = useState(false);

    const session = {
        ...getStoredDriverRegistrationSession(),
        ...(location.state || {}),
    };
    const routePrefix = location.pathname.startsWith('/taxi/owner') ? '/taxi/owner' : '/taxi/driver';
    const phone = String(session.phone || '').replace(/\D/g, '').slice(-10);
    const role = session.role || 'driver';
    const roleConfirmed = session.roleConfirmed !== false;
    const registrationId = session.registrationId || '';
    const isLoginFlow = Boolean(session.loginMode);
    const isPoolingOnboardingFlow = Boolean(session.poolingOnboarding);
    const entryPath = String(session.entryPath || (isLoginFlow ? `${routePrefix}/login` : `${routePrefix}/reg-phone`));
    const sessionResumeKey = JSON.stringify({
        registrationId,
        phone,
        otpVerified: Boolean(session.otpVerified),
        status: session.status || '',
        fullName: session.fullName || '',
        email: session.email || '',
        gender: session.gender || '',
        locationId: session.locationId || '',
        vehicleTypeId: session.vehicleTypeId || '',
        role: session.role || '',
        roleConfirmed: session.roleConfirmed !== false,
    });

    useEffect(() => {
        let active = true;

        const resumeIfVerified = async () => {
            if (isLoginFlow || !phone || !registrationId) {
                return;
            }

            const locallyVerified = Boolean(session.otpVerified);
            if (locallyVerified) {
                if (isPoolingOnboardingFlow) {
                    navigate('/taxi/driver/pooling/onboarding', {
                        replace: true,
                    });
                    return;
                }
                const nextStep = getDriverOnboardingResumeStep(session);
                navigate(`${routePrefix}/${nextStep}`, {
                    replace: true,
                    state: saveDriverRegistrationSession(session),
                });
                return;
            }

            setResolvingSession(true);
            try {
                const response = isPoolingOnboardingFlow
                    ? await getPoolingDriverOnboardingSession({ registrationId, phone })
                    : await getDriverOnboardingSession({ registrationId, phone });
                const payload = unwrap(response);
                const nextSession = isPoolingOnboardingFlow
                    ? saveDriverRegistrationSession({
                        ...session,
                        registrationId: payload?.session?.registrationId || session.registrationId,
                        phone: payload?.session?.phone || session.phone,
                        role: payload?.session?.role || session.role,
                        status: payload?.session?.status || session.status,
                        otpVerified: Boolean(payload?.session?.otpVerified),
                        fullName: payload?.personal?.fullName || session.fullName || '',
                    })
                    : saveDriverRegistrationSession(
                        buildDriverOnboardingSessionSnapshot(payload, session),
                    );

                if (!active || !nextSession.otpVerified) {
                    return;
                }

                if (isPoolingOnboardingFlow) {
                    navigate('/taxi/driver/pooling/onboarding', {
                        replace: true,
                    });
                    return;
                }

                if (nextSession.roleConfirmed === false) {
                    navigate('/taxi/driver/select-role', {
                        replace: true,
                    });
                    return;
                }

                const nextStep = getDriverOnboardingResumeStep(nextSession);
                navigate(`${routePrefix}/${nextStep}`, {
                    replace: true,
                    state: nextSession,
                });
            } catch (err) {
                const status = Number(err?.status || err?.response?.status || 0);
                if (status === 404 || status === 410) {
                    clearDriverRegistrationSession();
                }
            } finally {
                if (active) {
                    setResolvingSession(false);
                }
            }
        };

        resumeIfVerified();

        return () => {
            active = false;
        };
    }, [isLoginFlow, isPoolingOnboardingFlow, navigate, phone, registrationId, routePrefix, sessionResumeKey]);

    useEffect(() => {
        if (!phone) {
            navigate(entryPath, { replace: true });
            return;
        }
        const interval = setInterval(() => {
            setTimer(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [entryPath, navigate, phone]);

    useEffect(() => {
        const focusTimer = window.setTimeout(() => {
            inputs.current[0]?.focus();
        }, 300);
        return () => window.clearTimeout(focusTimer);
    }, []);

    const handleChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);
        if (value && index < 3) {
            inputs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputs.current[index - 1].focus();
        }
    };

    const handleVerify = async () => {
        if (otp.join('').length !== 4) {
            setError('Enter 4-digit code');
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (isLoginFlow) {
                const response = await verifyDriverLoginOtp({ phone, otp: otp.join(''), role });
                const payload = unwrap(response);
                const token = payload?.token;
                if (token) {
                    const normalizedRole = normalizeDriverRole(role);
                    persistDriverAuthSession({ token, role: normalizedRole });
                    await syncPushTokens();
                }
                clearDriverRegistrationSession();
                const normalizedRole = normalizeDriverRole(role);
                const nextPath = getPostLoginRoute(normalizedRole, payload?.driver, routePrefix);
                navigate(nextPath, { replace: true });
                return;
            }

            if (isPoolingOnboardingFlow) {
                await verifyPoolingDriverOnboardingOtp({ registrationId, phone, otp: otp.join('') });
                saveDriverRegistrationSession({
                    ...session,
                    otpVerified: true,
                    status: 'otp_verified',
                });
                navigate('/taxi/driver/pooling/onboarding');
                return;
            }

            const response = await verifyDriverOtp({ registrationId, phone, otp: otp.join('') });
            const payload = unwrap(response);
            const shouldForceRoleSelection =
                routePrefix === '/taxi/driver'
                && (session.needsRoleSelection === true || session.roleConfirmed === false);
            const nextSession = saveDriverRegistrationSession({
                ...session,
                otpVerified: true,
                role: payload?.session?.role || session.role || 'driver',
                roleConfirmed: shouldForceRoleSelection
                    ? false
                    : (payload?.session?.roleConfirmed ?? session.roleConfirmed ?? true),
                needsRoleSelection: shouldForceRoleSelection,
                status: payload?.session?.status || 'otp_verified',
                otpSession: payload?.session || null,
            });
            if (shouldForceRoleSelection || nextSession.roleConfirmed === false) {
                navigate('/taxi/driver/select-role');
                return;
            }
            navigate(`${routePrefix}/step-personal`);
        } catch (err) {
            setError(err?.message || 'Invalid code');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (timer > 0) return;
        setLoading(true);
        setError('');
        try {
            const response = isLoginFlow
                ? await sendDriverLoginOtp({ phone, role })
                : isPoolingOnboardingFlow
                    ? await startPoolingDriverOnboarding({ phone })
                    : await sendDriverOtp(roleConfirmed ? { phone, role } : { phone });
            const payload = unwrap(response);
            const nextSession = isLoginFlow
                ? saveDriverRegistrationSession({
                    ...session,
                    phone,
                    role,
                    loginMode: true,
                    entryPath,
                })
                : isPoolingOnboardingFlow
                    ? saveDriverRegistrationSession({
                        ...session,
                        phone,
                        role,
                        loginMode: false,
                        poolingOnboarding: true,
                        registrationId: payload?.session?.registrationId || session.registrationId || '',
                        debugOtp: payload?.session?.debugOtp || '',
                        status: payload?.session?.status || 'otp_sent',
                        entryPath,
                    })
                : saveDriverRegistrationSession(
                    buildDriverOnboardingSessionSnapshot(payload, {
                        ...session,
                        phone,
                        role,
                        entryPath,
                    }),
                );

            setOtp(['', '', '', '']);
            inputs.current[0]?.focus();
            setTimer(60);
            setError(nextSession?.debugOtp ? `Code resent successfully. OTP: ${nextSession.debugOtp}` : 'Code resent successfully');
        } catch (err) {
            setError(err?.message || 'Failed to resend');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative bg-white select-none overflow-x-hidden font-['Outfit']">
            {/* Background */}
            <div className="fixed inset-0 z-0">
                <motion.img 
                    initial={{ scale: 1.05, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 1.2 }}
                    src={taxiBg} 
                    alt="" 
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px]" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/40 to-white" />
            </div>

            <main className="relative z-10 mx-auto max-w-sm px-6 flex flex-col min-h-screen pt-12 pb-32">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 space-y-10"
                >
                    <header className="space-y-6">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => navigate(entryPath)}
                            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-slate-100 text-slate-900 shadow-xl shadow-slate-100"
                        >
                            <ArrowLeft size={20} strokeWidth={3} />
                        </motion.button>
                        
                        <div className="space-y-2">
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                                Verify
                            </h1>
                            <p className="text-slate-500 font-medium text-lg">
                                Code sent to <span className="text-slate-900 font-bold">+91 {phone}</span>
                            </p>
                        </div>
                    </header>

                    <section className="bg-white rounded-[40px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-slate-50 space-y-10">
                        <div className="flex justify-between gap-3">
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={el => inputs.current[index] = el}
                                    type="tel"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={e => handleChange(index, e.target.value)}
                                    onKeyDown={e => handleKeyDown(index, e)}
                                    className={`h-16 w-full rounded-2xl border-2 text-center text-3xl font-black transition-all outline-none ${
                                        digit 
                                            ? 'border-amber-400 bg-amber-50/20 text-slate-900' 
                                            : 'border-slate-50 bg-slate-50 text-slate-900 focus:border-amber-200 focus:bg-white'
                                    }`}
                                />
                            ))}
                        </div>

                        <div className="space-y-6">
                            <AnimatePresence>
                                {error && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className={`rounded-2xl border p-4 text-center ${
                                            error.includes('successfully') 
                                                ? 'border-emerald-100 bg-emerald-50 text-emerald-600'
                                                : 'border-rose-100 bg-rose-50 text-rose-600'
                                        }`}
                                    >
                                        <p className="text-xs font-bold uppercase tracking-widest">{error}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="flex flex-col items-center gap-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    Didn't get it?
                                </p>
                                <button
                                    onClick={handleResend}
                                    disabled={timer > 0 || loading}
                                    className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all ${
                                        timer > 0 
                                            ? 'text-slate-200' 
                                            : 'text-amber-500 hover:opacity-70'
                                    }`}
                                >
                                    <MessageSquare size={14} />
                                    {timer > 0 ? `Retry in ${timer}s` : 'Resend Code'}
                                </button>
                            </div>
                        </div>
                    </section>
                </motion.div>

                <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-white via-white/80 to-transparent">
                    <div className="mx-auto max-w-sm">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleVerify}
                            disabled={loading || resolvingSession || otp.join('').length !== 4}
                            className={`group flex h-18 w-full items-center justify-center gap-4 rounded-[24px] text-lg font-black transition-all ${
                                otp.join('').length === 4
                                    ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/20'
                                    : 'bg-slate-100 text-slate-300 pointer-events-none'
                            }`}
                        >
                            {loading ? (
                                <div className="h-6 w-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="uppercase tracking-widest">Verify Code</span>
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

export default OTPVerification;
