import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bike,
  Car,
  Loader2,
  LogOut,
  Sparkles,
  Plus,
  AlertCircle,
  Pencil,
  Package,
} from "lucide-react";
import { toast } from "sonner";

import {
  driverModeAPI,
  driverOnboardingAPI,
  clearIdentitySession,
  getApiErrorMessage,
} from "@food/api";
import { clearModuleAuth } from "@food/utils/auth";

const OFF_VALUES = new Set(["off", "none", "offline", "", null, undefined]);
const normalizeMode = (raw) => (OFF_VALUES.has(raw) ? "off" : raw);

const SERVICE_STATUS_CARDS = [
  { key: "food", label: "Food", Icon: Bike, accent: "text-orange-400" },
  { key: "quickCommerce", label: "Quick Commerce", Icon: Package, accent: "text-emerald-400" },
  { key: "taxi", label: "Taxi", Icon: Car, accent: "text-sky-400" },
];

const SERVICE_TOGGLES = [
  {
    key: "food",
    label: "Food & Quick Commerce",
    description: "Restaurant orders and quick-commerce deliveries",
    Icon: Bike,
    accent: "text-orange-400",
  },
  {
    key: "taxi",
    label: "Taxi Mode",
    description: "Rides, parcels, and intercity trips",
    Icon: Car,
    accent: "text-sky-400",
  },
];

const APPLY_FOR_SERVICE = {
  food: {
    service: "food",
    label: "Food & Quick Commerce",
    title: "Apply for Food & Quick Commerce",
    description:
      "Use your existing verified profile to start delivering restaurant orders and quick-commerce packages.",
    Icon: Bike,
    accent: "from-orange-500/20 to-orange-500/5 border-orange-500/25",
    btnClass: "bg-orange-500 hover:bg-orange-600",
  },
  taxi: {
    service: "taxi",
    label: "Taxi Driving",
    title: "Apply for Taxi Driving",
    description:
      "Use your existing verified profile to accept rides, parcels, and intercity trips.",
    Icon: Car,
    accent: "from-sky-500/20 to-sky-500/5 border-sky-500/25",
    btnClass: "bg-sky-500 hover:bg-sky-600",
  },
};

/**
 * Single home for a driver. Mutually-exclusive service toggles (food vs taxi)
 * plus quick links into the food-delivery and taxi-driver portals.
 */
export default function DriverHome() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("off");
  const [capabilities, setCapabilities] = useState({
    food: "not_enabled",
    quickCommerce: "not_enabled",
    taxi: "not_enabled",
  });
  const [identity, setIdentity] = useState(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [enrollingService, setEnrollingService] = useState(null);
  const [latLng, setLatLng] = useState(null);
  const [rejection, setRejection] = useState({ food: null, quickCommerce: null, taxi: null });
  const [resubmitAllowed, setResubmitAllowed] = useState(false);

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
        const [stateRes, modeRes] = await Promise.all([
          driverOnboardingAPI.getState().catch(() => null),
          driverModeAPI.get().catch(() => null),
        ]);
        if (cancelled) return;
        const onboardingState = stateRes?.data?.data || stateRes?.data || {};
        const modeState = modeRes?.data?.data || modeRes?.data || {};
        if (onboardingState && onboardingState.onboardingComplete === false) {
          navigate("/driver/onboarding", { replace: true });
          return;
        }
        setResubmitAllowed(Boolean(onboardingState?.resubmitAllowed));
        setRejection(onboardingState?.rejection || { food: null, quickCommerce: null, taxi: null });
        setIdentity(onboardingState?.identity || onboardingState || null);
        if (onboardingState?.capabilities) setCapabilities(onboardingState.capabilities);
        if (modeState?.capabilities) setCapabilities((prev) => ({ ...prev, ...modeState.capabilities }));
        if (modeState?.activeService) setMode(normalizeMode(modeState.activeService));
      } catch (err) {
        if (err?.response?.status === 401) navigate("/driver/login", { replace: true });
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();

    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLatLng({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 5000 },
      );
    }
    return () => { cancelled = true; };
  }, [navigate]);

  const PORTAL_TARGETS = {
    taxi: "/taxi/driver/home",
    food: "/food/delivery",
  };

  const foodRejected = capabilities?.food === "rejected";
  const qcRejected = capabilities?.quickCommerce === "rejected";
  const taxiRejected = capabilities?.taxi === "rejected";
  const anyRejected = foodRejected || qcRejected || taxiRejected;
  const foodEnabled = capabilities?.food && capabilities.food !== "not_enabled";
  const qcEnabled = capabilities?.quickCommerce && capabilities.quickCommerce !== "not_enabled";
  const taxiEnabled = capabilities?.taxi && capabilities.taxi !== "not_enabled";
  const foodApproved = capabilities?.food === "approved" || capabilities?.food === "enabled" || capabilities?.food === "active";
  const qcApproved = capabilities?.quickCommerce === "approved" || capabilities?.quickCommerce === "enabled" || capabilities?.quickCommerce === "active";
  const taxiApproved = capabilities?.taxi === "approved" || capabilities?.taxi === "enabled" || capabilities?.taxi === "active";
  const deliveryApproved = foodApproved || qcApproved;
  const deliveryEnabled = foodEnabled || qcEnabled;
  const missingServiceKey = foodEnabled && !taxiEnabled ? "taxi" : taxiEnabled && !foodEnabled ? "food" : null;
  const applyCta = missingServiceKey ? APPLY_FOR_SERVICE[missingServiceKey] : null;

  const refreshCapabilities = async () => {
    const [stateRes, modeRes] = await Promise.all([
      driverOnboardingAPI.getState().catch(() => null),
      driverModeAPI.get().catch(() => null),
    ]);
    const onboardingState = stateRes?.data?.data || stateRes?.data || {};
    const modeState = modeRes?.data?.data || modeRes?.data || {};
    if (onboardingState?.capabilities) {
      setCapabilities(onboardingState.capabilities);
    }
    if (onboardingState?.rejection) {
      setRejection(onboardingState.rejection);
    }
    setResubmitAllowed(Boolean(onboardingState?.resubmitAllowed));
    if (modeState?.capabilities) {
      setCapabilities((prev) => ({ ...prev, ...modeState.capabilities }));
    }
  };

  const handleApplyForService = async (service) => {
    if (enrollingService) return;
    setEnrollingService(service);
    try {
      const res = await driverOnboardingAPI.enableCapability(service);
      const data = res?.data?.data || res?.data || {};
      const status = data?.status || "pending";
      setCapabilities((prev) => ({ ...prev, [service]: status }));
      await refreshCapabilities();
      toast.success(
        service === "food"
          ? "Food & Quick Commerce application submitted — pending admin approval"
          : "Taxi application submitted — pending admin approval",
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not submit application"));
    } finally {
      setEnrollingService(null);
    }
  };

  const applyMode = async (next) => {
    setSwitching(true);
    try {
      const res = await driverModeAPI.set(next, latLng || {});
      const data = res?.data?.data || res?.data || {};
      setMode(normalizeMode(data?.activeService) || "off");
      if (data?.capabilities) setCapabilities(data.capabilities);
      if (next === "off") {
        toast.success("You're offline — not receiving jobs");
      } else if (next === "food") {
        toast.success("Food & Quick Commerce is now active");
      } else if (next === "taxi") {
        toast.success("Taxi mode is now active");
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, "Could not switch mode — finish your current job first");
      toast.error(msg);
    } finally {
      setSwitching(false);
    }
  };

  const toggleService = async (serviceKey, turningOn) => {
    if (switching) return;

    if (serviceKey === "taxi" && !taxiEnabled) {
      toast.error("Apply for Taxi below to enable this service.");
      return;
    }
    if (serviceKey === "food" && !deliveryEnabled) {
      toast.error("Apply for Food or Quick Commerce below to enable this service.");
      return;
    }
    if (serviceKey === "taxi" && taxiEnabled && !taxiApproved) {
      toast.info("Taxi profile is pending admin approval.");
      return;
    }
    if (serviceKey === "food" && deliveryEnabled && !deliveryApproved) {
      toast.info("Delivery profile is pending admin approval.");
      return;
    }

    if (turningOn) {
      await applyMode(serviceKey);
      return;
    }

    if (mode === serviceKey) {
      await applyMode("off");
    }
  };

  const handleLogout = () => {
    clearModuleAuth("driver");
    clearModuleAuth("delivery");
    clearIdentitySession();
    ["driverToken", "token", "driverInfo", "role", "driverRole", "chatRole"].forEach((k) =>
      localStorage.removeItem(k),
    );
    navigate("/driver/login", { replace: true });
  };

  if (bootLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c1410] text-white">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const isOffline = mode === "off";
  const foodActive = mode === "food";
  const taxiActive = mode === "taxi";

  return (
    <div className="min-h-screen bg-[#0c1410] text-white font-['Poppins']">
      <div className="max-w-md mx-auto p-5 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="uppercase text-[10px] text-[#9bc78a] font-bold tracking-[0.25em]">
              Buddy Partner
            </p>
            <h1 className="text-white text-2xl font-black mt-1">
              {identity?.name ? `Hi, ${identity.name.split(" ")[0]}` : "Welcome back"}
            </h1>
            <p className="text-white/40 text-[12px] font-medium">+91 {identity?.phone || "—"}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-3xl bg-white/[0.04] border border-white/10 p-5 mb-5">
          <p className="text-[12px] uppercase tracking-widest font-bold text-[#9bc78a] mb-3">
            Service status
          </p>
          <div className="space-y-2">
            {SERVICE_STATUS_CARDS.map(({ key, label, Icon, accent }) => {
              const status = capabilities?.[key] || "not_enabled";
              const rejected = status === "rejected";
              const approved = status === "approved" || status === "enabled" || status === "active";
              const pending = status === "pending";
              const notEnabled = status === "not_enabled";
              const reason = rejection?.[key]?.reason;
              return (
                <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0 ${accent}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[13px]">{label}</span>
                      {approved ? (
                        <span className="text-[10px] uppercase tracking-widest text-[#88c170]">Approved</span>
                      ) : pending ? (
                        <span className="text-[10px] uppercase tracking-widest text-amber-400">Pending</span>
                      ) : rejected ? (
                        <span className="text-[10px] uppercase tracking-widest text-red-400">Rejected</span>
                      ) : notEnabled ? (
                        <span className="text-[10px] uppercase tracking-widest text-white/40">Not selected</span>
                      ) : null}
                    </div>
                    {rejected && reason ? (
                      <p className="text-[12px] text-red-200/90 mt-1 leading-relaxed">{reason}</p>
                    ) : null}
                    {rejected && resubmitAllowed ? (
                      <button
                        type="button"
                        onClick={() => navigate("/driver/onboarding")}
                        className="mt-2 text-[11px] font-bold text-red-300 underline"
                      >
                        Edit & Resubmit
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {anyRejected && resubmitAllowed ? (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-5 mb-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-widest font-bold text-red-300">
                  Action required
                </p>
                <p className="text-white font-bold text-[15px] mt-1">
                  One or more services were rejected
                </p>
                <p className="text-[13px] text-red-100/70 mt-2">
                  Update the rejected service details and resubmit for admin review.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/driver/onboarding")}
                  className="mt-4 w-full sm:w-auto h-11 px-5 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-extrabold text-[13px] flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                >
                  <Pencil className="w-4 h-4" />
                  Edit & Resubmit
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Service toggles */}
        <div className="rounded-3xl bg-white/[0.04] border border-white/10 p-5 mb-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#88c170]" />
              <span className="text-[12px] uppercase tracking-widest font-bold text-[#9bc78a]">
                Service Mode
              </span>
            </div>
            <span
              className={[
                "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full",
                isOffline
                  ? "bg-white/10 text-white/50"
                  : "bg-[#88c170]/20 text-[#88c170]",
              ].join(" ")}
            >
              {isOffline ? "Offline" : foodActive ? "Food Active" : "Taxi Active"}
            </span>
          </div>
          <p className="text-[13px] text-white/60 mb-4 leading-relaxed">
            Turn on one service at a time. If both are off, you won't receive any jobs.
          </p>

          <div className="space-y-3">
            {SERVICE_TOGGLES.map(({ key, label, description, Icon, accent }) => {
              const enabled = key === "food" ? deliveryEnabled : taxiEnabled;
              const approved = key === "food" ? deliveryApproved : taxiApproved;
              const rejected = key === "food" ? (foodRejected || qcRejected) : taxiRejected;
              const pending = enabled && !approved && !rejected;
              const active = key === "food" ? foodActive : taxiActive;
              const disabled = !enabled || pending || rejected || switching;

              return (
                <div
                  key={key}
                  className={[
                    "rounded-2xl border p-4 flex items-center gap-3 transition-all",
                    active ? "bg-[#88c170]/10 border-[#88c170]/40" : "bg-white/5 border-white/10",
                    !enabled ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <div className={["w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center shrink-0", accent].join(" ")}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[14px] flex items-center gap-2 flex-wrap">
                      {label}
                      {pending && (
                        <span className="text-[10px] uppercase tracking-widest text-amber-400">Pending</span>
                      )}
                      {(key === "food" ? foodRejected : taxiRejected) && (
                        <span className="text-[10px] uppercase tracking-widest text-red-400">Rejected</span>
                      )}
                      {!enabled && (
                        <span className="text-[10px] uppercase tracking-widest text-white/40">Not Enrolled</span>
                      )}
                    </div>
                    <div className="text-white/50 text-[12px] mt-0.5">{description}</div>
                  </div>
                  <label className="relative inline-flex items-center shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={active}
                      disabled={disabled}
                      onChange={(e) => toggleService(key, e.target.checked)}
                    />
                    <div
                      className={[
                        "w-12 h-7 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#88c170]/40",
                        disabled ? "bg-white/10 cursor-not-allowed" : "bg-white/15 peer-checked:bg-[#88c170]",
                      ].join(" ")}
                    />
                    <div
                      className={[
                        "absolute left-0.5 top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform",
                        active ? "translate-x-5" : "translate-x-0",
                        switching ? "opacity-60" : "",
                      ].join(" ")}
                    />
                  </label>
                </div>
              );
            })}
          </div>

          {switching && (
            <div className="flex items-center justify-center gap-2 mt-4 text-[12px] text-white/50">
              <Loader2 className="w-4 h-4 animate-spin" />
              Updating service mode…
            </div>
          )}
        </div>

        {applyCta && (
          <ApplyForServiceCard
            cta={applyCta}
            loading={enrollingService === applyCta.service}
            onApply={() => handleApplyForService(applyCta.service)}
          />
        )}

        {/* Capability cards — open portals */}
        <div className="grid grid-cols-2 gap-3">
          <CapabilityCard
            Icon={Bike}
            title="Food & Quick"
            status={capabilities.food}
            enabled={foodEnabled}
            href={PORTAL_TARGETS.food}
          />
          <CapabilityCard
            Icon={Car}
            title="Taxi Driving"
            status={capabilities.taxi}
            enabled={taxiEnabled}
            href={PORTAL_TARGETS.taxi}
          />
        </div>
      </div>
    </div>
  );
}

function ApplyForServiceCard({ cta, loading, onApply }) {
  const { Icon, title, description, btnClass } = cta;
  return (
    <div
      className={[
        "rounded-3xl border bg-gradient-to-br p-5 mb-5",
        cta.accent,
      ].join(" ")}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-white font-bold text-[15px] leading-snug">{title}</h3>
          <p className="text-[12px] text-white/60 mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onApply}
        disabled={loading}
        className={[
          "w-full h-12 rounded-2xl text-white font-extrabold text-[14px] flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-60",
          btnClass,
        ].join(" ")}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Plus className="w-5 h-5" />
            <span>{title}</span>
          </>
        )}
      </button>
    </div>
  );
}

function CapabilityCard({ Icon, title, status, enabled, href }) {
  const normalized = String(status || "").toLowerCase();
  const label = !enabled
    ? "Not enrolled"
    : normalized === "rejected"
      ? "Rejected"
      : String(status || "active").replace(/_/g, " ");
  const isReady = enabled && (normalized === "approved" || normalized === "enabled" || normalized === "active");
  const isPending = enabled && !isReady && normalized !== "rejected";
  const isRejected = enabled && normalized === "rejected";
  const target = !enabled || isRejected ? null : isPending ? "/driver/home" : href;

  const className = [
    "block rounded-2xl border p-4 transition-all",
    isReady ? "bg-[#88c170]/10 border-[#88c170]/30" : isRejected ? "bg-red-500/10 border-red-500/30" : "bg-white/5 border-white/10",
    !enabled ? "opacity-70" : "",
  ].join(" ");

  const content = (
    <>
      <Icon className={[
        "w-5 h-5 mb-2",
        isReady ? "text-[#88c170]" : "text-white/40",
      ].join(" ")} />
      <div className="text-white font-bold text-[13px]">{title}</div>
      <div className="text-[11px] text-white/40 mt-1 capitalize">{label}</div>
    </>
  );

  if (!target) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link to={target} className={className}>
      {content}
    </Link>
  );
}
