import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bike,
  Car,
  Power,
  ChevronRight,
  Wallet,
  History,
  Loader2,
  LogOut,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  driverModeAPI,
  driverOnboardingAPI,
  clearIdentitySession,
} from "@food/api";
import { clearModuleAuth } from "@food/utils/auth";

const MODES = [
  {
    key: "off",
    label: "Offline",
    description: "Not accepting any jobs",
    accent: "from-white/5 to-white/0",
    Icon: Power,
  },
  {
    key: "food",
    label: "Food & Quick Commerce",
    description: "Take restaurant orders + quick-commerce deliveries",
    accent: "from-orange-500/20 to-orange-500/0",
    Icon: Bike,
  },
  {
    key: "taxi",
    label: "Taxi Mode",
    description: "Take rides, parcels, intercity (no food/quick orders)",
    accent: "from-sky-500/20 to-sky-500/0",
    Icon: Car,
  },
];

const OFF_VALUES = new Set(["off", "none", "offline", "", null, undefined]);
const normalizeMode = (raw) => (OFF_VALUES.has(raw) ? "off" : raw);

/**
 * Single home for a driver. Shows the mutually-exclusive mode selector
 * and quick links into the existing food-delivery and taxi-driver portals.
 */
export default function DriverHome() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("off");
  const [capabilities, setCapabilities] = useState({ food: "not_enabled", taxi: "not_enabled" });
  const [identity, setIdentity] = useState(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [latLng, setLatLng] = useState(null);

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

  const switchMode = async (next) => {
    // Capability never enrolled — point the driver to onboarding instead of
    // silently doing nothing.
    if (next === "taxi" && capabilities?.taxi === "not_enabled") {
      toast.error("Taxi capability isn't enabled yet. Add it from onboarding.");
      navigate("/driver/onboarding");
      return;
    }
    if (next === "food" && capabilities?.food === "not_enabled") {
      toast.error("Food capability isn't enabled yet. Add it from onboarding.");
      navigate("/driver/onboarding");
      return;
    }

    if (next === mode && next !== "off") {
      // Already in this mode — jump straight into the portal anyway so the
      // user gets to where they want to go.
      if (PORTAL_TARGETS[next]) navigate(PORTAL_TARGETS[next]);
      return;
    }
    setSwitching(true);

    // For taxi / food, navigate immediately and run the mode-change in the
    // background. The destination module's own guard (DriverLayout for taxi,
    // delivery layout for food) shows either the home, a pending-approval
    // status page, or an onboarding step — whichever applies. This avoids
    // the user being stuck on /driver/home when something on the API side
    // is still pending.
    if (next !== "off" && PORTAL_TARGETS[next]) {
      try {
        const promise = driverModeAPI.set(next, latLng || {});
        toast.success(
          next === "taxi"
            ? "Opening Taxi driver portal"
            : "Opening Food & Quick Commerce portal",
        );
        navigate(PORTAL_TARGETS[next]);
        promise
          .then((res) => {
            const data = res?.data?.data || res?.data || {};
            if (data?.activeService) setMode(normalizeMode(data.activeService));
            if (data?.capabilities) setCapabilities(data.capabilities);
          })
          .catch((err) => {
            const msg = err?.response?.data?.message || err?.message;
            if (msg) toast.error(msg);
          });
      } finally {
        setSwitching(false);
      }
      return;
    }

    // Going off-duty — stay on this page and just persist.
    try {
      const res = await driverModeAPI.set(next, latLng || {});
      const data = res?.data?.data || res?.data || {};
      setMode(normalizeMode(data?.activeService) || "off");
      if (data?.capabilities) setCapabilities(data.capabilities);
      toast.success("You're offline");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message;
      toast.error(msg || "Could not switch mode — finish your current job first");
    } finally {
      setSwitching(false);
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

  const foodEnabled = capabilities?.food && capabilities.food !== "not_enabled";
  const taxiEnabled = capabilities?.taxi && capabilities.taxi !== "not_enabled";
  const foodApproved = capabilities?.food === "approved" || capabilities?.food === "enabled" || capabilities?.food === "active";
  const taxiApproved = capabilities?.taxi === "approved" || capabilities?.taxi === "enabled" || capabilities?.taxi === "active";

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

        {/* Mode selector */}
        <div className="rounded-3xl bg-white/[0.04] border border-white/10 p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#88c170]" />
            <span className="text-[12px] uppercase tracking-widest font-bold text-[#9bc78a]">
              Service Mode
            </span>
          </div>
          <p className="text-[13px] text-white/60 mb-4 leading-relaxed">
            Pick what you want to receive right now. You can only be active on one service
            at a time — switching is instant.
          </p>

          <div className="space-y-2.5">
            {MODES.map(({ key, label, description, accent, Icon }) => {
              const active = mode === key;
              const disabled = (key === "food" && !foodEnabled) || (key === "taxi" && !taxiEnabled);
              const pending =
                (key === "food" && foodEnabled && !foodApproved) ||
                (key === "taxi" && taxiEnabled && !taxiApproved);

              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => !switching && switchMode(key)}
                  disabled={switching}
                  className={[
                    "w-full text-left rounded-2xl border p-3.5 flex items-center gap-3 transition-all",
                    active
                      ? "bg-[#88c170] border-[#88c170] text-[#0c1410]"
                      : "bg-white/5 border-white/10 text-white",
                    disabled ? "opacity-60" : "hover:border-[#88c170]/40",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br",
                      accent,
                      active ? "bg-[#0c1410]/10" : "",
                    ].join(" ")}
                  >
                    <Icon className={["w-5 h-5", active ? "text-[#0c1410]" : "text-[#88c170]"].join(" ")} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold">
                      {label}
                      {pending && (
                        <span className="ml-2 text-[10px] uppercase tracking-widest text-amber-400">
                          Pending
                        </span>
                      )}
                      {disabled && (
                        <span className="ml-2 text-[10px] uppercase tracking-widest text-white/40">
                          Not Enrolled
                        </span>
                      )}
                    </div>
                    <div className={active ? "text-[#0c1410]/70 text-[12px]" : "text-white/50 text-[12px]"}>
                      {description}
                    </div>
                  </div>
                  {switching && active && <Loader2 className="w-4 h-4 animate-spin" />}
                  {active && !switching && <span className="text-[12px] font-bold">ACTIVE</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Capability cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <CapabilityCard
            Icon={Bike}
            title="Food & Quick"
            status={capabilities.food}
            enabled={foodEnabled}
            href="/food/delivery"
          />
          <CapabilityCard
            Icon={Car}
            title="Taxi Driving"
            status={capabilities.taxi}
            enabled={taxiEnabled}
            href="/taxi/driver/home"
          />
        </div>

        {/* Footer quick links */}
        <div className="rounded-3xl bg-white/[0.04] border border-white/10 divide-y divide-white/5 overflow-hidden">
          <QuickLink Icon={Wallet} title="Wallet & Earnings" href="/food/delivery/pocket" />
          <QuickLink Icon={History} title="History" href="/food/delivery/history" />
        </div>
      </div>
    </div>
  );
}

function CapabilityCard({ Icon, title, status, enabled, href }) {
  const label = enabled ? String(status || "active").replace(/_/g, " ") : "Not enrolled";
  const isReady = enabled && (status === "approved" || status === "enabled" || status === "active");
  return (
    <Link
      to={enabled ? href : "/driver/onboarding"}
      className={[
        "block rounded-2xl border p-4 transition-all",
        isReady ? "bg-[#88c170]/10 border-[#88c170]/30" : "bg-white/5 border-white/10",
      ].join(" ")}
    >
      <Icon className={[
        "w-5 h-5 mb-2",
        isReady ? "text-[#88c170]" : "text-white/40",
      ].join(" ")} />
      <div className="text-white font-bold text-[13px]">{title}</div>
      <div className="text-[11px] text-white/40 mt-1 capitalize">{label}</div>
    </Link>
  );
}

function QuickLink({ Icon, title, href }) {
  return (
    <Link
      to={href}
      className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.04] transition-colors"
    >
      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-[#88c170]">
        <Icon className="w-4 h-4" />
      </div>
      <span className="flex-1 text-white font-semibold text-[14px]">{title}</span>
      <ChevronRight className="w-4 h-4 text-white/30" />
    </Link>
  );
}
