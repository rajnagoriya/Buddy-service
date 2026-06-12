import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as Motion from 'framer-motion';
import AuthLayout from '../../components/AuthLayout';
import { User, Mail, Camera, Smartphone, LifeBuoy, Gift, Trash2 } from 'lucide-react';
import { clearLocalUserSession, userAuthService } from '../../services/authService';
import { useSettings } from '../../../../shared/context/SettingsContext';
import { uploadService } from '../../../../shared/services/uploadService';

const fieldShellClassName =
  'rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition-all flex items-center gap-3 focus-within:border-slate-900 focus-within:ring-4 focus-within:ring-slate-900/5';

const fieldInputClassName =
  'w-full bg-transparent border-none text-[16px] font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none';

const PENDING_SIGNUP_PHONE_KEY = 'pendingUserSignupPhone';
const PENDING_SIGNUP_REFERRAL_CODE_KEY = 'pendingUserSignupReferralCode';
const syncPushTokens = () => {
  window.__flushNativeFcmToken?.().catch?.(() => {});
  window.__registerBrowserFcmToken?.({ interactive: true }).catch?.(() => {});
};

const notifyAuthReady = () => {
  window.dispatchEvent(new CustomEvent('app:auth-ready', {
    detail: {
      role: 'user',
      hasToken: true,
      source: 'user',
    },
  }));
};

const Signup = () => {
  const location = useLocation();
  const { settings } = useSettings();
  const referralCodeFromQuery = new URLSearchParams(location.search).get('ref') || '';
  const preservedPhone = typeof window !== 'undefined' ? sessionStorage.getItem(PENDING_SIGNUP_PHONE_KEY) || '' : '';
  const preservedReferralCode = typeof window !== 'undefined'
    ? sessionStorage.getItem(PENDING_SIGNUP_REFERRAL_CODE_KEY) || ''
    : '';
  const initialPhone = String(location.state?.phone || preservedPhone || '').replace(/\D/g, '').slice(-10);
  const [formData, setFormData] = useState({
    phone: initialPhone,
    name: '',
    email: '',
    gender: 'prefer-not-to-say',
    profileImage: '',
    referralCode: String(location.state?.referralCode || referralCodeFromQuery || preservedReferralCode || '').trim().toUpperCase(),
  });
  const [loading, setLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [error, setError] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const appName = settings.general?.app_name || 'App';
  const isValidPhone = /^\d{10}$/.test(formData.phone);
  const hasVerifiedSignupContext = Boolean(location.state?.otpVerified) || Boolean(preservedPhone);
  const [step, setStep] = useState(() => (hasVerifiedSignupContext ? 'profile' : 'phone'));

  useEffect(() => {
    if (step === 'profile' && isValidPhone) {
      sessionStorage.setItem(PENDING_SIGNUP_PHONE_KEY, formData.phone);
    }
  }, [formData.phone, isValidPhone, step]);

  useEffect(() => {
    const normalizedReferralCode = String(formData.referralCode || '').trim().toUpperCase();

    if (normalizedReferralCode) {
      sessionStorage.setItem(PENDING_SIGNUP_REFERRAL_CODE_KEY, normalizedReferralCode);
    } else {
      sessionStorage.removeItem(PENDING_SIGNUP_REFERRAL_CODE_KEY);
    }
  }, [formData.referralCode]);

  useEffect(() => {
    if (location.state?.otpVerified) {
      setStep('profile');
    }
  }, [location.state?.otpVerified]);

  const avatarPreviewUrl = useMemo(() => {
    return formData.profileImage || '';
  }, [formData.profileImage]);

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });

  const imageFileToUploadDataUrl = async (file, { maxSize = 1280, quality = 0.82 } = {}) => {
    const dataUrl = await readFileAsDataUrl(file);
    if (!String(dataUrl || '').startsWith('data:image/')) {
      throw new Error('Please choose an image file');
    }

    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to process image'));
      img.src = dataUrl;
    });

    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', quality);
  };

  const extractUploadUrl = (uploadPayload) =>
    uploadPayload?.data?.url ||
    uploadPayload?.data?.secureUrl ||
    uploadPayload?.url ||
    uploadPayload?.secureUrl ||
    '';

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError('');
    setPhotoUploading(true);

    try {
      const dataUrl = await imageFileToUploadDataUrl(file, { maxSize: 900, quality: 0.84 });
      const uploadPayload = await uploadService.uploadImage(dataUrl, 'user-profile');
      const secureUrl = extractUploadUrl(uploadPayload);

      if (!secureUrl) {
        throw new Error('Upload failed');
      }

      setFormData((prev) => ({ ...prev, profileImage: secureUrl }));
    } catch (err) {
      setPhotoError(err?.message || 'Photo upload failed');
      setFormData((prev) => ({ ...prev, profileImage: '' }));
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  };

  const handleStartSignup = async (e) => {
    e.preventDefault();
    if (!isValidPhone) return;

    setOtpSending(true);
    setError('');

    try {
      clearLocalUserSession();
      await userAuthService.startOtp(formData.phone);

      navigate('/taxi/user/verify-otp', {
        state: {
          phone: formData.phone,
          referralCode: formData.referralCode,
        },
      });
    } catch (err) {
      setError(err?.message || 'Unable to send OTP. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleSignup = async (e, overrides = {}) => {
    e.preventDefault();
    if (!formData.name.trim() || !isValidPhone) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await userAuthService.signup({
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        gender: formData.gender,
        profileImage: overrides.profileImage ?? formData.profileImage,
        referralCode: formData.referralCode,
      });
      const payload = response?.data || {};

      localStorage.setItem('token', payload.token || '');
      localStorage.setItem('userToken', payload.token || '');
      localStorage.setItem('role', 'user');
      localStorage.setItem('userInfo', JSON.stringify(payload.user || {}));
      notifyAuthReady();
      syncPushTokens();
      sessionStorage.removeItem(PENDING_SIGNUP_PHONE_KEY);
      sessionStorage.removeItem(PENDING_SIGNUP_REFERRAL_CODE_KEY);
      navigate('/taxi/user', { replace: true });
    } catch (err) {
      const message = err?.message || 'Signup failed. Please try again.';

      if (message === 'OTP session not found' || message === 'Verify OTP before signup' || message === 'OTP session expired') {
        sessionStorage.removeItem(PENDING_SIGNUP_PHONE_KEY);
        setStep('phone');
        setError('Your verification session expired. Please request a fresh OTP to continue.');
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };




  return (
    <AuthLayout
      title={step === 'profile' ? 'Complete your profile' : 'Create your account'}
      subtitle={
        step === 'profile'
          ? `Just a few details to get started with ${appName}`
          : `Start with your mobile number and we will verify it before creating your ${appName} account.`
      }
    >
      {step === 'phone' ? (
        <form onSubmit={handleStartSignup} className="space-y-6">
          <div className="space-y-2">
            <label className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-600">Mobile Number *</label>
            <div className={fieldShellClassName}>
              <Smartphone size={18} className="text-slate-500" />
              <span className="text-[16px] font-bold text-slate-700">+91</span>
              <input
                type="tel"
                maxLength={10}
                placeholder="Enter 10-digit number"
                className={fieldInputClassName}
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                required
              />
            </div>
            <p className="ml-1 text-sm text-slate-500">We’ll send a 4-digit OTP to this number.</p>
          </div>

          {error && (
            <p className="text-sm font-bold text-red-500 text-center">{error}</p>
          )}

          <Motion.motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={!isValidPhone || otpSending}
            className={`w-full py-4 rounded-xl text-lg font-bold transition-all flex items-center justify-center gap-3 ${
              isValidPhone && !otpSending
                ? 'bg-black text-white shadow-xl shadow-black/10'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
            }`}
          >
            {otpSending ? (
              <div className="flex items-center gap-3">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Sending OTP...</span>
              </div>
            ) : (
              <span>Continue</span>
            )}
          </Motion.motion.button>

          <div className="space-y-3 text-center">
            <p className="text-sm font-medium text-slate-500">
              Already have an account?{' '}
              <Link
                to="/taxi/user/login"
                state={{ phone: formData.phone }}
                className="font-bold text-black underline underline-offset-4"
              >
                Login
              </Link>
            </p>
            <p className="text-[12px] text-slate-400 font-medium leading-relaxed px-2">
              By continuing, you agree to our
              <Link to="/terms" className="ml-1 text-black underline hover:opacity-70 transition-colors">
                Terms
              </Link>
              {' '}and
              <Link to="/privacy" className="ml-1 text-black underline hover:opacity-70 transition-colors">
                Privacy Policy
              </Link>
            </p>
          </div>
        </form>
      ) : (
      <form onSubmit={handleSignup} className="space-y-6 sm:space-y-8">
        {/* Avatar Section */}
        <div className="flex flex-col items-center">
          <div 
            onClick={() => !photoUploading && fileInputRef.current?.click()}
            className={`relative group w-24 h-24 rounded-full bg-slate-50 border-2 ${
              photoUploading ? 'border-slate-200 cursor-not-allowed' : 'border-slate-200 hover:border-slate-950 cursor-pointer'
            } flex items-center justify-center overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md active:scale-95`}
          >
            {avatarPreviewUrl ? (
              <img src={avatarPreviewUrl} alt="Profile" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <User size={40} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
            )}
            
            {/* Hover Overlay */}
            {!photoUploading && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity duration-300">
                <Camera size={18} className="drop-shadow" />
                <span className="text-[9px] font-bold uppercase tracking-wider mt-1 drop-shadow">Upload</span>
              </div>
            )}

            {/* Upload Spinner overlay */}
            {photoUploading && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center text-white">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            disabled={photoUploading}
            className="hidden"
            onChange={handlePhotoChange}
          />

          <div className="mt-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-900">
              Profile Photo <span className="text-slate-400">(Optional)</span>
            </p>
            {avatarPreviewUrl && (
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, profileImage: '' }))}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-600 transition-colors cursor-pointer"
              >
                <Trash2 size={12} />
                Remove photo
              </button>
            )}
            {photoError && <p className="text-[11px] font-bold text-red-500 mt-1.5">{photoError}</p>}
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <div className="space-y-2">
            <label className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-600">Mobile Number *</label>
            <div className={`${fieldShellClassName} bg-slate-50 border-slate-200/60`}>
              <Smartphone size={18} className="text-slate-400" />
              <span className="text-[16px] font-bold text-slate-400">+91</span>
              <input
                type="tel"
                value={formData.phone}
                readOnly
                aria-readonly="true"
                className={`${fieldInputClassName} text-slate-400 cursor-not-allowed`}
              />
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                Verified
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-600">Full Name *</label>
            <div className={fieldShellClassName}>
              <User size={18} className="text-slate-500" />
              <input 
                type="text" 
                placeholder="Enter your name"
                className={fieldInputClassName}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-600">Email Address (Optional)</label>
            <div className={fieldShellClassName}>
              <Mail size={18} className="text-slate-500" />
              <input 
                type="email" 
                placeholder="Enter email address"
                className={fieldInputClassName}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-600">Referral Code (Optional)</label>
            <div className={fieldShellClassName}>
              <Gift size={18} className="text-slate-500" />
              <input
                type="text"
                placeholder="Enter referral code"
                className={fieldInputClassName}
                value={formData.referralCode}
                onChange={(e) => setFormData((current) => ({
                  ...current,
                  referralCode: e.target.value.trim().toUpperCase(),
                }))}
              />
            </div>
            <p className="ml-1 text-[11px] font-medium text-slate-400">If someone shared a referral link, the code should already be filled in.</p>
          </div>

          {error && (
            <p className="text-sm font-bold text-red-500 text-center">{error}</p>
          )}
        </div>

        <div className="space-y-3">
          <Motion.motion.button 
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={!formData.name.trim() || !isValidPhone || loading || photoUploading}
            className={`w-full py-4 rounded-xl text-lg font-bold shadow-xl transition-all flex items-center justify-center gap-3 mt-4 ${
              formData.name.trim() && isValidPhone && !loading && !photoUploading
              ? 'bg-black text-white shadow-black/10 hover:bg-slate-900 cursor-pointer' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
            }`}
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <span>Let's Go!</span>
            )}
          </Motion.motion.button>

          <button
            type="button"
            onClick={() => navigate('/taxi/user/support')}
            className="w-full py-3 text-sm font-bold text-slate-500 transition-colors hover:text-slate-900 flex items-center justify-center gap-2 cursor-pointer"
          >
            <LifeBuoy size={16} />
            Need Help?
          </button>
        </div>

        <div className="space-y-3 text-center">
          <p className="text-sm font-medium text-slate-500">
            Already have an account?{' '}
            <Link
              to="/taxi/user/login"
              state={{ phone: formData.phone }}
              className="font-bold text-black underline underline-offset-4"
            >
              Login
            </Link>
          </p>
          <p className="text-[12px] text-slate-400 font-medium leading-relaxed px-1 sm:px-2">
            By creating an account, you agree to our
            <Link to="/terms" className="ml-1 text-black underline hover:opacity-70 transition-colors">
              Terms
            </Link>
            {' '}and
            <Link to="/privacy" className="ml-1 text-black underline hover:opacity-70 transition-colors">
              Privacy Policy
            </Link>
          </p>
        </div>
      </form>
      )}
    </AuthLayout>
  );
};

export default Signup;
