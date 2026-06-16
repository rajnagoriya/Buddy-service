/**
 * Unified driver profile.
 *
 * One profile page powering both the taxi-driver and food-delivery portals.
 * It pulls identity + capability state from the unified onboarding/mode
 * endpoints and surfaces:
 *   - the driver's basic info (header + KYC summary card),
 *   - the per-service status (food/quick + taxi) with portal deep-links,
 *   - shared account sections (wallet, history, documents, bank, etc.),
 *   - common settings (notifications, refer-and-earn, support, legal),
 *   - and the danger zone (delete account + logout).
 *
 * The deep-links for wallet / history / etc. flip between the food and taxi
 * portals based on the driver's current active service so the right module
 * always opens.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  BadgePercent,
  Bike,
  Car,
  ChevronRight,
  FileText,
  Gift,
  HandCoins,
  HelpCircle,
  History,
  Info,
  Landmark,
  Loader2,
  LogOut,
  Phone,
  Shield,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  Wallet,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import {
  clearIdentitySession,
  driverModeAPI,
  driverOnboardingAPI,
} from "@food/api";
import { clearModuleAuth } from "@food/utils/auth";

const OFF_VALUES = new Set(["off", "none", "offline", "", null, undefined]);
const normalizeMode = (raw) => (OFF_VALUES.has(raw) ? "off" : raw);

const CAP_READY = new Set(["approved", "enabled", "active"]);
const isCapabilityReady = (cap) => CAP_READY.has(String(cap || "").toLowerCase());
const isCapabilityEnrolled = (cap) =>
  cap && String(cap).toLowerCase() !== "not_enabled";

const capabilityLabel = (cap) => {
  const value = String(cap || "").toLowerCase();
  if (!value || value === "not_enabled") return "Not enrolled";
  if (value === "pending") return "Awaiting approval";
  if (value === "rejected") return "Rejected";
  if (CAP_READY.has(value)) return "Active";
  return value.replace(/_/g, " ");
};

const formatPhone = (phone) => {
  if (!phone) return "—";
  const digits = String(phone).replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
};

const capitaliseFirst = (value) => {
  const str = String(value || "");
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, " ");
};

// Mask the middle of an identifier so the page can show partial KYC numbers
// without leaking the full value. e.g. "1234 5678 9012" → "•••• •••• 9012".
const maskNumber = (value, keepLast = 4) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length <= keepLast) return raw;
  const tail = raw.slice(-keepLast);
  const lead = raw.length - keepLast;
  return `${"•".repeat(Math.min(lead, 12))} ${tail}`;
};

const LEGAL_CONTENT = {
  terms: {
    title: "Terms & Conditions",
    Icon: FileText,
    description: "General rules for using the Buddy Service platform.",
    body: `By using the Buddy Service platform, you agree to comply with all applicable
transport regulations and our safety standards.

Highlights:
• Professionalism: Drivers must maintain a high standard of service.
• Vehicle Readiness: All vehicles listed must be in active, roadworthy condition.
• Compliance: You must ensure all permits and insurance are valid.
• Platform Fees: Buddy Service charges a service fee for every successful booking.
• Account Security: You are responsible for keeping your credentials secure.`,
  },
  privacy: {
    title: "Privacy Policy",
    Icon: Shield,
    description: "How we handle your data.",
    body: `Buddy Service takes data security seriously. We collect specific information
to ensure safety and service quality.

Data we collect:
• Identity & KYC documents (encrypted at rest).
• Live location during active jobs only.
• Phone and email for booking updates and support.

We never share your KYC documents with third-party advertising networks.`,
  },
  refund: {
    title: "Refund Policy",
    Icon: HandCoins,
    description: "Cancellation and refund guidelines.",
    body: `Booking Cancellations:
• Customer-initiated: Refund varies based on how close the pickup time is.
• Operator-initiated: If a vehicle fails inspection, a full refund is processed
  to the customer.

Processing Time: Refunds are typically credited back to the original payment
method within 5–7 working days.`,
  },
};

export default function DriverProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  // The whole onboarding state response — basics / kyc / bank / vehicle /
  // selfieUrl / phone / activeService / createdAt / etc.
  const [state, setState] = useState(null);
  const [capabilities, setCapabilities] = useState({
    food: "not_enabled",
    taxi: "not_enabled",
  });
  const [activeService, setActiveService] = useState("off");
  const [error, setError] = useState("");
  const [legalModal, setLegalModal] = useState(null);
  const [showLogout, setShowLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const token =
      localStorage.getItem("driver_accessToken") ||
      localStorage.getItem("delivery_accessToken") ||
      localStorage.getItem("driverToken");
    if (!token) {
      navigate("/driver/login", { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [stateRes, modeRes] = await Promise.all([
          driverOnboardingAPI.getState().catch(() => null),
          driverModeAPI.get().catch(() => null),
        ]);
        if (cancelled) return;

        const stateData = stateRes?.data?.data || stateRes?.data || {};
        const modeData = modeRes?.data?.data || modeRes?.data || {};

        if (stateData?.onboardingComplete === false) {
          navigate("/driver/onboarding", { replace: true });
          return;
        }

        setState(stateData || null);
        if (stateData?.capabilities) setCapabilities(stateData.capabilities);
        if (modeData?.capabilities) {
          setCapabilities((prev) => ({ ...prev, ...modeData.capabilities }));
        }
        if (stateData?.activeService) {
          setActiveService(normalizeMode(stateData.activeService));
        }
        if (modeData?.activeService) {
          setActiveService(normalizeMode(modeData.activeService));
        }
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 401) {
          navigate("/driver/login", { replace: true });
          return;
        }
        setError(err?.response?.data?.message || err?.message || "Unable to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const basics = state?.basics || {};
  const kyc = state?.kyc || {};
  const bank = state?.bank || {};
  const vehicle = state?.vehicle || {};

  const driverName = useMemo(() => {
    const name = String(basics?.name || "").trim();
    return name || "Buddy Partner";
  }, [basics?.name]);
  const driverPhone = useMemo(() => formatPhone(state?.phone), [state?.phone]);
  const driverEmail = useMemo(() => basics?.email || "—", [basics?.email]);
  const profileImage = basics?.profileImage || null;

  const joinedAt = useMemo(() => {
    if (!state?.createdAt) return "";
    try {
      return new Date(state.createdAt).toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }, [state?.createdAt]);

  const personalDetails = useMemo(() => {
    const items = [];
    if (basics?.gender) items.push({ label: "Gender", value: capitaliseFirst(basics.gender) });
    if (basics?.city) items.push({ label: "City", value: basics.city });
    if (joinedAt) items.push({ label: "Joined", value: joinedAt });
    if (state?.isVerified) items.push({ label: "Verified", value: "Yes" });
    return items;
  }, [basics?.city, basics?.gender, joinedAt, state?.isVerified]);

  const kycRows = useMemo(() => [
    { id: "aadhaar", label: "Aadhaar", doc: kyc?.aadhaar },
    { id: "pan", label: "PAN", doc: kyc?.pan },
    { id: "dl", label: "Driving Licence", doc: kyc?.drivingLicense },
  ], [kyc?.aadhaar, kyc?.drivingLicense, kyc?.pan]);

  const hasVehicle = Boolean(
    vehicle?.type || vehicle?.make || vehicle?.model || vehicle?.number,
  );

  const hasBank = Boolean(
    bank?.accountHolderName ||
      bank?.accountNumber ||
      bank?.ifscCode ||
      bank?.upiId,
  );

  // Pick which portal's deep links to prefer. Active service wins; otherwise
  // fall back to whichever capability is approved; otherwise taxi.
  const preferredPortal = useMemo(() => {
    if (activeService === "food" || activeService === "taxi") return activeService;
    if (isCapabilityReady(capabilities.taxi)) return "taxi";
    if (isCapabilityReady(capabilities.food)) return "food";
    return "taxi";
  }, [activeService, capabilities.food, capabilities.taxi]);

  const links = useMemo(() => {
    const taxi = {
      home: "/taxi/driver/home",
      editProfile: "/taxi/driver/edit-profile",
      wallet: "/taxi/driver/wallet",
      history: "/taxi/driver/history",
      bank: "/taxi/driver/profile/bank-details",
      documents: "/taxi/driver/documents",
      vehicle: "/taxi/driver/vehicle-fleet",
      notifications: "/taxi/driver/notifications",
      referral: "/taxi/driver/referral",
      incentives: "/taxi/driver/incentives",
      sos: "/taxi/driver/security",
      help: "/taxi/driver/help-support",
      deleteAccount: "/taxi/driver/delete-account",
    };
    const food = {
      home: "/food/delivery",
      editProfile: "/food/delivery/profile/details",
      wallet: "/food/delivery/pocket",
      history: "/food/delivery/history",
      bank: "/food/delivery/profile/bank",
      documents: "/food/delivery/profile/documents",
      vehicle: "/taxi/driver/vehicle-fleet",
      notifications: "/food/delivery/notifications",
      referral: "/food/delivery/profile",
      incentives: "/taxi/driver/incentives",
      sos: "/taxi/driver/security",
      help: "/food/delivery/support",
      deleteAccount: "/food/delivery/profile",
    };
    return preferredPortal === "food" ? food : taxi;
  }, [preferredPortal]);

  const goLogout = async () => {
    if (loggingOut) return;
    try {
      setLoggingOut(true);
      clearModuleAuth("driver");
      clearModuleAuth("delivery");
      clearIdentitySession();
      [
        "driverToken",
        "token",
        "driverInfo",
        "role",
        "driverRole",
        "chatRole",
        "buddy_identity",
        "driver_capabilities",
        "driver_activeService",
      ].forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {
          /* ignore */
        }
      });
      toast.success("Logged out");
      navigate("/driver/login", { replace: true });
    } finally {
      setLoggingOut(false);
      setShowLogout(false);
    }
  };

  const sections = useMemo(
    () => [
      {
        title: "Account",
        items: [
          {
            id: "personal",
            label: "Personal Information",
            sub: driverPhone,
            icon: <UserIcon size={20} />,
            path: links.editProfile,
          },
          {
            id: "bank",
            label: "Bank Details",
            sub: "UPI, QR, Account",
            icon: <Landmark size={20} />,
            path: links.bank,
          },
          {
            id: "documents",
            label: "Documents",
            sub: "KYC, RC, License",
            icon: <FileText size={20} />,
            path: links.documents,
          },
        ],
      },
      {
        title: "Activity",
        items: [
          {
            id: "wallet",
            label: "Wallet & Earnings",
            sub:
              preferredPortal === "food"
                ? "Food & Quick Commerce wallet"
                : "Taxi wallet",
            icon: <Wallet size={20} />,
            path: links.wallet,
          },
          {
            id: "history",
            label: "Trip / Order History",
            sub: preferredPortal === "food" ? "Delivery history" : "Ride history",
            icon: <History size={20} />,
            path: links.history,
          },
          {
            id: "incentives",
            label: "Incentives",
            sub: "Bonuses and milestones",
            icon: <BadgePercent size={20} />,
            path: links.incentives,
          },
        ],
      },
      {
        title: "Preferences",
        items: [
          {
            id: "notifications",
            label: "Notifications",
            icon: <ShieldCheck size={20} />,
            path: links.notifications,
          },
          {
            id: "refer",
            label: "Refer & Earn",
            sub: "Invite friends to Buddy",
            icon: <Gift size={20} />,
            path: links.referral,
          },
          {
            id: "sos",
            label: "Emergency SOS",
            icon: <Shield size={20} />,
            path: links.sos,
          },
        ],
      },
      {
        title: "Support & Legal",
        items: [
          {
            id: "help",
            label: "Help & Support",
            icon: <HelpCircle size={20} />,
            path: links.help,
          },
          {
            id: "terms",
            label: "Terms & Conditions",
            icon: <FileText size={20} />,
            action: () => setLegalModal(LEGAL_CONTENT.terms),
          },
          {
            id: "privacy",
            label: "Privacy Policy",
            icon: <Shield size={20} />,
            action: () => setLegalModal(LEGAL_CONTENT.privacy),
          },
          {
            id: "refund",
            label: "Refund Policy",
            icon: <HandCoins size={20} />,
            action: () => setLegalModal(LEGAL_CONTENT.refund),
          },
        ],
      },
    ],
    [
      driverPhone,
      links.bank,
      links.documents,
      links.editProfile,
      links.help,
      links.history,
      links.incentives,
      links.notifications,
      links.referral,
      links.sos,
      links.wallet,
      preferredPortal,
    ],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans select-none pb-28">
      {/* Header */}
      <header className="px-5 pt-4 pb-5 border-b border-slate-50 bg-white">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-[12px] font-semibold text-slate-500"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => navigate(links.help)}
            className="flex items-center gap-1.5 text-[#88B04B] font-bold text-[13px]"
          >
            <Info size={16} />
            Help & Support
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h1 className="text-[22px] font-bold text-slate-900 leading-tight">
              {driverName}
            </h1>
            <div className="flex items-center gap-2 text-[12px] text-slate-500">
              <Phone size={12} />
              <span className="font-medium">{driverPhone}</span>
            </div>
          </div>
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
            {profileImage ? (
              <img
                src={profileImage}
                alt={driverName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <UserIcon size={28} className="text-slate-400" />
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-emerald-500 border-2 border-white flex items-center justify-center">
              <ShieldCheck size={11} className="text-white" strokeWidth={3} />
            </span>
          </div>
        </div>

        {/* Identity mini-card */}
        <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 grid grid-cols-2 gap-x-3 gap-y-3 text-left">
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Email</p>
            <p className="text-[12px] font-bold text-slate-900 break-all">{driverEmail}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Active</p>
            <p className="text-[12px] font-bold text-slate-900 capitalize">
              {activeService === "off" ? "Offline" : activeService}
            </p>
          </div>
          {personalDetails.map((item) => (
            <div key={item.label}>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{item.label}</p>
              <p className="text-[12px] font-bold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-3 text-[11px] font-medium text-rose-500">{error}</p>
        )}
      </header>

      {/* Service capability + switch */}
      <section className="px-5 pt-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[#88B04B]" />
          <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">
            Your Services
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CapabilityCard
            Icon={Bike}
            title="Food & Quick"
            capability={capabilities.food}
            active={activeService === "food"}
            onClick={() =>
              isCapabilityReady(capabilities.food)
                ? navigate("/food/delivery")
                : navigate("/driver/home")
            }
          />
          <CapabilityCard
            Icon={Car}
            title="Taxi"
            capability={capabilities.taxi}
            active={activeService === "taxi"}
            onClick={() =>
              isCapabilityReady(capabilities.taxi)
                ? navigate("/taxi/driver/home")
                : navigate("/driver/home")
            }
          />
        </div>

        <button
          type="button"
          onClick={() => navigate("/driver/home")}
          className="mt-3 w-full bg-slate-900 text-white rounded-2xl px-5 py-4 flex items-center justify-between active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <ArrowLeftRight size={18} />
            </div>
            <div className="text-left">
              <p className="text-[14px] font-bold leading-tight">Switch Service</p>
              <p className="text-[11px] text-white/60 font-medium">
                Change between Food, Taxi, or go offline
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-white/60" />
        </button>
      </section>

      {/* KYC details */}
      <section className="px-5 pt-7">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">
            KYC Documents
          </h2>
          <button
            type="button"
            onClick={() => navigate(links.documents)}
            className="text-[11px] font-bold text-[#88B04B] uppercase tracking-widest"
          >
            Manage
          </button>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 divide-y divide-slate-100 overflow-hidden">
          {kycRows.map(({ id, label, doc }) => {
            const number = doc?.number || "";
            const uploaded = Boolean(doc?.documentUrl || doc?.backDocumentUrl);
            const ok = Boolean(number && uploaded);
            return (
              <div key={id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-slate-900">{label}</p>
                  <p className="text-[11px] font-medium text-slate-500 truncate">
                    {number ? maskNumber(number) : "Not provided"}
                  </p>
                </div>
                <span
                  className={[
                    "text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full",
                    ok
                      ? "bg-emerald-50 text-emerald-600"
                      : number
                        ? "bg-amber-50 text-amber-600"
                        : "bg-slate-100 text-slate-500",
                  ].join(" ")}
                >
                  {ok ? "Verified" : number ? "Awaiting Upload" : "Pending"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Vehicle details */}
      {hasVehicle && (
        <section className="px-5 pt-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">
              Vehicle
            </h2>
            <button
              type="button"
              onClick={() => navigate(links.vehicle)}
              className="text-[11px] font-bold text-[#88B04B] uppercase tracking-widest"
            >
              Manage
            </button>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
                {vehicle?.photoUrl ? (
                  <img src={vehicle.photoUrl} alt="vehicle" className="w-full h-full object-cover" />
                ) : (
                  <Car size={22} className="text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-slate-900 truncate">
                  {[vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Registered Vehicle"}
                </p>
                <p className="text-[11px] font-medium text-slate-500 truncate">
                  {[capitaliseFirst(vehicle?.type), capitaliseFirst(vehicle?.color)].filter(Boolean).join(" • ") || "Type & colour not set"}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-left">
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Number</p>
                <p className="text-[12px] font-bold text-slate-900">{vehicle?.number || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">RC</p>
                <p className="text-[12px] font-bold text-slate-900">{vehicle?.rcUrl ? "Uploaded" : "Pending"}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Insurance</p>
                <p className="text-[12px] font-bold text-slate-900">{vehicle?.insuranceUrl ? "Uploaded" : "Pending"}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Photo</p>
                <p className="text-[12px] font-bold text-slate-900">{vehicle?.photoUrl ? "Uploaded" : "Pending"}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Bank details */}
      {hasBank && (
        <section className="px-5 pt-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">
              Bank Account
            </h2>
            <button
              type="button"
              onClick={() => navigate(links.bank)}
              className="text-[11px] font-bold text-[#88B04B] uppercase tracking-widest"
            >
              Edit
            </button>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center">
                <Landmark size={20} className="text-slate-700" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-slate-900 truncate">
                  {bank?.accountHolderName || "Account holder"}
                </p>
                <p className="text-[11px] font-medium text-slate-500 truncate">
                  {bank?.bankName || bank?.branchName || "Linked bank"}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-left">
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">A/C No.</p>
                <p className="text-[12px] font-bold text-slate-900">
                  {bank?.accountNumber ? maskNumber(bank.accountNumber) : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">IFSC</p>
                <p className="text-[12px] font-bold text-slate-900">{bank?.ifscCode || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">UPI</p>
                <p className="text-[12px] font-bold text-slate-900 truncate">{bank?.upiId || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">UPI QR</p>
                <p className="text-[12px] font-bold text-slate-900">{bank?.upiQrCodeUrl ? "Uploaded" : "—"}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Settings list */}
      <main className="mt-2">
        {sections.map((section, idx) => (
          <div key={idx} className="pt-6">
            <h3 className="px-6 text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
              {section.title}
            </h3>
            <div className="space-y-0">
              {section.items.map((item) => (
                <motion.div
                  key={item.id}
                  whileTap={{ backgroundColor: "#F8F9FA" }}
                  onClick={() => {
                    if (item.action) item.action();
                    else if (item.path) navigate(item.path);
                  }}
                  className="flex items-center justify-between px-6 py-3.5 group cursor-pointer border-b border-slate-50/70"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-slate-400 group-hover:text-slate-900 transition-colors">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-[14px] font-medium text-slate-800 tracking-tight">
                        {item.label}
                      </h4>
                      {item.sub && (
                        <p className="text-[11px] text-slate-400 font-medium">
                          {item.sub}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-200" />
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </main>

      {/* Danger zone */}
      <section className="px-6 pt-8 space-y-3">
        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
          Danger Zone
        </h3>
        <button
          type="button"
          onClick={() => navigate(links.deleteAccount)}
          className="w-full flex items-center justify-between px-4 py-4 rounded-2xl border border-rose-100 bg-rose-50/40 hover:bg-rose-50 transition-colors"
        >
          <span className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-rose-100 text-rose-500 flex items-center justify-center">
              <X size={18} />
            </span>
            <span className="text-[13px] font-bold text-rose-500">Delete Account</span>
          </span>
          <ChevronRight size={16} className="text-rose-200" />
        </button>
        <button
          type="button"
          onClick={() => setShowLogout(true)}
          className="w-full flex items-center justify-between px-4 py-4 rounded-2xl border border-rose-100 bg-rose-50/40 hover:bg-rose-50 transition-colors"
        >
          <span className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-rose-100 text-rose-500 flex items-center justify-center">
              <LogOut size={18} />
            </span>
            <span className="text-[13px] font-bold text-rose-500">Logout</span>
          </span>
          <ChevronRight size={16} className="text-rose-200" />
        </button>
      </section>

      {/* Logout modal */}
      <AnimatePresence>
        {showLogout && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 px-5 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="w-full max-w-xs rounded-[28px] bg-white p-6 shadow-2xl border border-slate-100"
            >
              <div className="space-y-2 text-center">
                <h3 className="text-[18px] font-bold text-slate-900 tracking-tight">Logout?</h3>
                <p className="text-[13px] font-medium text-slate-500">
                  You'll need to sign in again to receive new jobs.
                </p>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogout(false)}
                  className="h-12 rounded-2xl border border-slate-200 text-slate-700 font-bold text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={goLogout}
                  disabled={loggingOut}
                  className="h-12 rounded-2xl bg-rose-500 text-white font-bold text-[13px] disabled:opacity-60"
                >
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Legal modal */}
      <AnimatePresence>
        {legalModal && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 backdrop-blur-sm px-4 pb-8 sm:items-center sm:pb-0">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-lg overflow-hidden rounded-[32px] bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-slate-50 text-slate-900 border border-slate-100">
                    <legalModal.Icon size={28} />
                  </div>
                  <button
                    onClick={() => setLegalModal(null)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="mt-6">
                  <h3 className="text-2xl font-bold text-slate-950">{legalModal.title}</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {legalModal.description}
                  </p>
                </div>
                <div className="mt-6 max-h-[40vh] overflow-y-auto pr-2">
                  <div className="whitespace-pre-line text-sm leading-7 text-slate-700 font-medium">
                    {legalModal.body}
                  </div>
                </div>
                <button
                  onClick={() => setLegalModal(null)}
                  className="mt-8 w-full rounded-2xl bg-slate-950 py-4 text-sm font-bold text-white transition hover:bg-slate-800 active:scale-95"
                >
                  Got it
                </button>
              </div>
            </motion.div>
            <div className="absolute inset-0 -z-10" onClick={() => setLegalModal(null)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CapabilityCard({ Icon, title, capability, active, onClick }) {
  const enrolled = isCapabilityEnrolled(capability);
  const ready = isCapabilityReady(capability);
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border p-4 text-left transition-colors",
        ready
          ? "bg-emerald-50 border-emerald-100"
          : enrolled
            ? "bg-amber-50 border-amber-100"
            : "bg-slate-50 border-slate-100",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <Icon
          size={20}
          className={
            ready
              ? "text-emerald-600"
              : enrolled
                ? "text-amber-600"
                : "text-slate-400"
          }
        />
        {active && (
          <span className="text-[9px] uppercase tracking-widest font-black text-emerald-600">
            Active
          </span>
        )}
      </div>
      <p className="mt-3 text-[14px] font-bold text-slate-900">{title}</p>
      <p
        className={[
          "text-[11px] font-medium mt-0.5 capitalize",
          ready
            ? "text-emerald-700"
            : enrolled
              ? "text-amber-700"
              : "text-slate-500",
        ].join(" ")}
      >
        {capabilityLabel(capability)}
      </p>
    </button>
  );
}
