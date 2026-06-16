import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  Bike,
  Car,
  Banknote,
  IdCard,
  User,
  Camera,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { driverOnboardingAPI } from "@food/api";

const STEPS = [
  { key: "basics", label: "About You", Icon: User },
  { key: "kyc", label: "KYC", Icon: IdCard },
  { key: "bank", label: "Bank", Icon: Banknote },
  { key: "vehicle", label: "Vehicle", Icon: Car },
  { key: "selfie", label: "Selfie", Icon: Camera },
  { key: "services", label: "Services", Icon: CheckCircle2 },
];

/* ----------------------------- validators ------------------------------- */
// Each rule returns "" when valid, otherwise the user-facing error string.

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_AADHAAR = /^[2-9]\d{11}$/; // 12 digits, can't start with 0 or 1
const RE_PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const RE_DL = /^[A-Z]{2}[ -]?\d{2}[ -]?\d{4,11}$/i; // permissive Indian DL
const RE_IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const RE_UPI = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;
const RE_VEHICLE = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/; // MH12AB1234, DL3CAB1234
const RE_URL = /^https?:\/\/.+/i;

const required = (label) => (val) => (val && String(val).trim() ? "" : `${label} is required`);
const minLen = (label, n) => (val) => (String(val || "").trim().length >= n ? "" : `${label} must be at least ${n} characters`);
const maxLen = (label, n) => (val) => (String(val || "").length <= n ? "" : `${label} is too long (max ${n})`);
const matches = (re, msg) => (val) => (!val || re.test(String(val || "").trim()) ? "" : msg);
const optionalMatches = (re, msg) => (val) =>
  !val || !String(val).trim() ? "" : re.test(String(val).trim()) ? "" : msg;

const compose = (...rules) => (val, ctx) => {
  for (const rule of rules) {
    const out = rule(val, ctx);
    if (out) return out;
  }
  return "";
};

// Validators bucketed by step + field. `ctx` is the whole step's state.
const VALIDATORS = {
  basics: {
    "basics.name": compose(required("Full name"), minLen("Full name", 2), maxLen("Full name", 80)),
    "basics.email": optionalMatches(RE_EMAIL, "Enter a valid email address"),
  },
  kyc: {
    "kyc.aadhaar.number": compose(
      required("Aadhaar number"),
      matches(RE_AADHAAR, "Aadhaar must be a 12-digit number"),
    ),
    "kyc.aadhaar.documentUrl": optionalMatches(RE_URL, "Document URL must be a valid http(s) URL"),
    "kyc.pan.number": optionalMatches(RE_PAN, "PAN must look like ABCDE1234F"),
    "kyc.pan.documentUrl": optionalMatches(RE_URL, "Document URL must be a valid http(s) URL"),
    "kyc.drivingLicense.number": compose(
      required("Driving licence number"),
      matches(RE_DL, "Enter a valid driving licence number"),
    ),
    "kyc.drivingLicense.documentUrl": optionalMatches(RE_URL, "Document URL must be a valid http(s) URL"),
  },
  bank: {
    "bank.mode": (_v, ctx) => {
      const hasBank = ctx?.accountNumber && ctx?.ifscCode;
      const hasUpi = ctx?.upiId;
      return hasBank || hasUpi ? "" : "Provide a bank account or a UPI ID";
    },
    "bank.accountHolderName": (val, ctx) =>
      ctx?.accountNumber ? compose(required("Account holder name"), minLen("Account holder name", 2))(val) : "",
    "bank.accountNumber": (val, ctx) =>
      ctx?.accountNumber || ctx?.ifscCode
        ? compose(
            required("Account number"),
            matches(/^\d{9,18}$/, "Account number must be 9–18 digits"),
          )(val)
        : "",
    "bank.ifscCode": (val, ctx) =>
      ctx?.accountNumber || ctx?.ifscCode
        ? compose(required("IFSC"), matches(RE_IFSC, "IFSC should look like HDFC0001234"))(val)
        : "",
    "bank.upiId": (val) => (val ? matches(RE_UPI, "UPI must look like name@bank")(val) : ""),
  },
  vehicle: {
    "vehicle.type": required("Vehicle type"),
    "vehicle.number": compose(
      required("Vehicle number"),
      matches(RE_VEHICLE, "Vehicle number must look like MH12AB1234"),
    ),
    "vehicle.photoUrl": optionalMatches(RE_URL, "Photo URL must be a valid http(s) URL"),
    "vehicle.rcUrl": optionalMatches(RE_URL, "RC URL must be a valid http(s) URL"),
    "vehicle.insuranceUrl": optionalMatches(RE_URL, "Insurance URL must be a valid http(s) URL"),
  },
  selfie: {
    "selfie.selfieUrl": compose(required("Selfie URL"), matches(RE_URL, "Selfie URL must be a valid http(s) URL")),
  },
  services: {
    "services": (val) => (Array.isArray(val) && val.length > 0 ? "" : "Select at least one service"),
  },
};

/**
 * Single onboarding wizard for any new driver. Captures the minimum the
 * backend needs to provision both FoodDeliveryPartner and Driver records
 * if the partner opts in to both.
 *
 * Endpoints used:
 *   PATCH /driver/onboarding/{basics|kyc|bank|vehicle|selfie}
 *   POST  /driver/onboarding/complete  { services: [...] }
 */
export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [activeIdx, setActiveIdx] = useState(0);

  // Schema mirrors backend shapes exactly so we can POST state as-is.
  const [state, setState] = useState({
    basics: { name: "", email: "", gender: "", city: "" },
    kyc: {
      aadhaar: { number: "", documentUrl: "", backDocumentUrl: "" },
      pan: { number: "", documentUrl: "" },
      drivingLicense: { number: "", documentUrl: "" },
    },
    bank: {
      accountHolderName: "",
      accountNumber: "",
      ifscCode: "",
      bankName: "",
      branchName: "",
      upiId: "",
      upiQrCodeUrl: "",
    },
    vehicle: {
      type: "bike",
      make: "",
      model: "",
      number: "",
      color: "",
      photoUrl: "",
      rcUrl: "",
      insuranceUrl: "",
    },
    selfie: { selfieUrl: "" },
    services: ["food"],
  });

  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [bootLoading, setBootLoading] = useState(true);
  const [stepLoading, setStepLoading] = useState(false);

  /* ------------------------- prefill from server ------------------------ */
  useEffect(() => {
    let cancelled = false;
    driverOnboardingAPI
      .getState()
      .then((res) => {
        if (cancelled) return;
        const data = res?.data?.data || res?.data || {};

        if (data?.onboardingComplete) {
          navigate("/driver/home", { replace: true });
          return;
        }

        const stepKey = String(data?.onboardingStep || "basics").toLowerCase();
        const idx = Math.max(0, STEPS.findIndex((s) => s.key === stepKey));
        setActiveIdx(idx === -1 ? 0 : idx);

        setState((prev) => ({
          ...prev,
          basics: {
            name: data?.basics?.name || prev.basics.name,
            email: data?.basics?.email || prev.basics.email,
            gender: data?.basics?.gender || prev.basics.gender,
            city: data?.basics?.city || prev.basics.city,
          },
          kyc: {
            aadhaar: {
              number: data?.kyc?.aadhaar?.number || "",
              documentUrl: data?.kyc?.aadhaar?.documentUrl || "",
              backDocumentUrl: data?.kyc?.aadhaar?.backDocumentUrl || "",
            },
            pan: {
              number: data?.kyc?.pan?.number || "",
              documentUrl: data?.kyc?.pan?.documentUrl || "",
            },
            drivingLicense: {
              number: data?.kyc?.drivingLicense?.number || "",
              documentUrl: data?.kyc?.drivingLicense?.documentUrl || "",
            },
          },
          bank: {
            accountHolderName: data?.bank?.accountHolderName || "",
            accountNumber: data?.bank?.accountNumber || "",
            ifscCode: data?.bank?.ifscCode || "",
            bankName: data?.bank?.bankName || "",
            branchName: data?.bank?.branchName || "",
            upiId: data?.bank?.upiId || "",
            upiQrCodeUrl: data?.bank?.upiQrCodeUrl || "",
          },
          vehicle: {
            type: data?.vehicle?.type || "bike",
            make: data?.vehicle?.make || "",
            model: data?.vehicle?.model || "",
            number: data?.vehicle?.number || "",
            color: data?.vehicle?.color || "",
            photoUrl: data?.vehicle?.photoUrl || "",
            rcUrl: data?.vehicle?.rcUrl || "",
            insuranceUrl: data?.vehicle?.insuranceUrl || "",
          },
          selfie: { selfieUrl: data?.selfieUrl || "" },
        }));
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          navigate("/driver/login", { replace: true });
        }
      })
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const current = STEPS[activeIdx];

  /* ---------------------------- validation ------------------------------ */
  const validateStep = (stepKey) => {
    const rules = VALIDATORS[stepKey] || {};
    const ctx = state[stepKey];
    const out = {};
    for (const [path, rule] of Object.entries(rules)) {
      const value = getByPath(state, path);
      const err = rule(value, ctx);
      if (err) out[path] = err;
    }
    return out;
  };

  const stepErrors = useMemo(() => validateStep(current.key), [current.key, state]); // eslint-disable-line react-hooks/exhaustive-deps
  const stepIsValid = Object.keys(stepErrors).length === 0;

  const showErr = (path) => (touched[path] ? stepErrors[path] || errors[path] || "" : "");

  const markTouched = (path) =>
    setTouched((prev) => ({ ...prev, [path]: true }));

  /* ---------------------------- mutators -------------------------------- */
  const setField = (path, value) => {
    setState((prev) => setByPath(prev, path, value));
  };

  /* ----------------------------- submit --------------------------------- */
  const persistAndAdvance = async (apiCall, payload) => {
    setStepLoading(true);
    try {
      await apiCall(payload);
      toast.success("Saved");
      setActiveIdx((idx) => Math.min(idx + 1, STEPS.length - 1));
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Could not save");
    } finally {
      setStepLoading(false);
    }
  };

  const handleNext = async () => {
    // Mark all of this step's fields as touched so errors render.
    const rules = VALIDATORS[current.key] || {};
    setTouched((prev) => {
      const next = { ...prev };
      Object.keys(rules).forEach((p) => { next[p] = true; });
      return next;
    });

    if (!stepIsValid) {
      const firstMsg = Object.values(stepErrors)[0] || "Please fix the highlighted fields";
      toast.error(firstMsg);
      return;
    }

    if (current.key === "basics") {
      await persistAndAdvance(driverOnboardingAPI.saveBasics, state.basics);
    } else if (current.key === "kyc") {
      await persistAndAdvance(driverOnboardingAPI.saveKyc, {
        aadhaar: state.kyc.aadhaar,
        pan: state.kyc.pan.number ? state.kyc.pan : undefined,
        drivingLicense: state.kyc.drivingLicense,
      });
    } else if (current.key === "bank") {
      await persistAndAdvance(driverOnboardingAPI.saveBank, state.bank);
    } else if (current.key === "vehicle") {
      await persistAndAdvance(driverOnboardingAPI.saveVehicle, state.vehicle);
    } else if (current.key === "selfie") {
      await persistAndAdvance(driverOnboardingAPI.saveSelfie, state.selfie);
    } else if (current.key === "services") {
      setStepLoading(true);
      try {
        await driverOnboardingAPI.complete(state.services);
        toast.success("Onboarding submitted for approval");
        navigate("/driver/home", { replace: true });
      } catch (err) {
        toast.error(err?.response?.data?.message || err?.message || "Could not submit");
      } finally {
        setStepLoading(false);
      }
    }
  };

  const handleBack = () => setActiveIdx((idx) => Math.max(0, idx - 1));

  if (bootLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c1410] text-white">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c1410] text-white font-['Poppins'] flex flex-col sm:items-center sm:justify-center">
      <div className="w-full max-w-md mx-auto flex flex-col min-h-screen sm:min-h-0 sm:rounded-3xl sm:shadow-2xl sm:overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#1f3a23] via-[#2a4e2f] to-[#3a6b41] px-6 pt-6 pb-8 relative">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute top-5 left-5 text-white/70 hover:text-white"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="uppercase text-[11px] text-[#9bc78a] font-bold tracking-[0.25em] text-center mb-1">
            Partner Onboarding
          </p>
          <h2 className="text-2xl font-black tracking-tight text-center mb-4">
            Step {activeIdx + 1} of {STEPS.length}: {current.label}
          </h2>

          <div className="flex items-center justify-between gap-1 mt-3">
            {STEPS.map((s, idx) => {
              const Icon = s.Icon;
              const done = idx < activeIdx;
              const active = idx === activeIdx;
              return (
                <div key={s.key} className="flex flex-col items-center flex-1">
                  <div
                    className={[
                      "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                      done
                        ? "bg-[#88c170] text-[#0c1410]"
                        : active
                        ? "bg-white text-[#0c1410] ring-4 ring-white/20"
                        : "bg-white/10 text-white/40",
                    ].join(" ")}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className={["text-[10px] mt-1 text-center", active ? "text-white font-bold" : "text-white/40"].join(" ")}>
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step body */}
        <div className="flex-1 p-6 space-y-4 bg-[#0c1410]">
          {current.key === "basics" && (
            <>
              <Field
                label="Full Name"
                value={state.basics.name}
                onChange={(v) => setField("basics.name", v)}
                onBlur={() => markTouched("basics.name")}
                error={showErr("basics.name")}
                placeholder="As per government ID"
              />
              <Field
                label="Email (optional)"
                value={state.basics.email}
                onChange={(v) => setField("basics.email", v)}
                onBlur={() => markTouched("basics.email")}
                error={showErr("basics.email")}
                placeholder="you@example.com"
                type="email"
              />
              <Select
                label="Gender (optional)"
                value={state.basics.gender}
                onChange={(v) => setField("basics.gender", v)}
                options={[
                  { value: "", label: "Prefer not to say" },
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                ]}
              />
              <Field
                label="City (optional)"
                value={state.basics.city}
                onChange={(v) => setField("basics.city", v)}
                placeholder="e.g. Indore"
              />
            </>
          )}

          {current.key === "kyc" && (
            <>
              <Field
                label="Aadhaar Number"
                value={state.kyc.aadhaar.number}
                onChange={(v) => setField("kyc.aadhaar.number", v.replace(/\D/g, "").slice(0, 12))}
                onBlur={() => markTouched("kyc.aadhaar.number")}
                error={showErr("kyc.aadhaar.number")}
                placeholder="12-digit Aadhaar"
                inputMode="numeric"
              />
              <Field
                label="Aadhaar Document URL"
                value={state.kyc.aadhaar.documentUrl}
                onChange={(v) => setField("kyc.aadhaar.documentUrl", v.trim())}
                onBlur={() => markTouched("kyc.aadhaar.documentUrl")}
                error={showErr("kyc.aadhaar.documentUrl")}
                placeholder="https://… (upload first, paste link)"
              />
              <Field
                label="Driving Licence Number"
                value={state.kyc.drivingLicense.number}
                onChange={(v) => setField("kyc.drivingLicense.number", v.toUpperCase())}
                onBlur={() => markTouched("kyc.drivingLicense.number")}
                error={showErr("kyc.drivingLicense.number")}
                placeholder="e.g. MH12 20230012345"
              />
              <Field
                label="DL Document URL"
                value={state.kyc.drivingLicense.documentUrl}
                onChange={(v) => setField("kyc.drivingLicense.documentUrl", v.trim())}
                onBlur={() => markTouched("kyc.drivingLicense.documentUrl")}
                error={showErr("kyc.drivingLicense.documentUrl")}
                placeholder="https://…"
              />
              <Field
                label="PAN Number (optional)"
                value={state.kyc.pan.number}
                onChange={(v) => setField("kyc.pan.number", v.toUpperCase().replace(/\s+/g, "").slice(0, 10))}
                onBlur={() => markTouched("kyc.pan.number")}
                error={showErr("kyc.pan.number")}
                placeholder="ABCDE1234F"
              />
              <Field
                label="PAN Document URL (optional)"
                value={state.kyc.pan.documentUrl}
                onChange={(v) => setField("kyc.pan.documentUrl", v.trim())}
                onBlur={() => markTouched("kyc.pan.documentUrl")}
                error={showErr("kyc.pan.documentUrl")}
                placeholder="https://…"
              />
            </>
          )}

          {current.key === "bank" && (
            <>
              <p className="text-[12px] text-white/50 leading-relaxed -mt-1 mb-1">
                Add either a bank account <span className="text-white/80">or</span> a UPI ID. You can
                add both later from your profile.
              </p>
              {showErr("bank.mode") && (
                <p className="text-[11px] font-semibold text-red-400 -mt-1">{showErr("bank.mode")}</p>
              )}

              <Field
                label="Account Holder Name"
                value={state.bank.accountHolderName}
                onChange={(v) => setField("bank.accountHolderName", v)}
                onBlur={() => markTouched("bank.accountHolderName")}
                error={showErr("bank.accountHolderName")}
                placeholder="As per bank passbook"
              />
              <Field
                label="Account Number"
                value={state.bank.accountNumber}
                onChange={(v) => setField("bank.accountNumber", v.replace(/\D/g, ""))}
                onBlur={() => {
                  markTouched("bank.accountNumber");
                  markTouched("bank.mode");
                }}
                error={showErr("bank.accountNumber")}
                placeholder="Numbers only"
                inputMode="numeric"
              />
              <Field
                label="IFSC"
                value={state.bank.ifscCode}
                onChange={(v) => setField("bank.ifscCode", v.toUpperCase().replace(/\s+/g, "").slice(0, 11))}
                onBlur={() => {
                  markTouched("bank.ifscCode");
                  markTouched("bank.mode");
                }}
                error={showErr("bank.ifscCode")}
                placeholder="HDFC0001234"
              />
              <Field
                label="Bank Name (optional)"
                value={state.bank.bankName}
                onChange={(v) => setField("bank.bankName", v)}
                placeholder="e.g. HDFC Bank"
              />
              <div className="rounded-xl border border-white/10 my-2 relative">
                <span className="absolute -top-2 left-3 px-2 text-[10px] uppercase tracking-widest text-white/40 bg-[#0c1410]">
                  or
                </span>
                <div className="p-3 pt-4 space-y-3">
                  <Field
                    label="UPI ID"
                    value={state.bank.upiId}
                    onChange={(v) => setField("bank.upiId", v.trim())}
                    onBlur={() => {
                      markTouched("bank.upiId");
                      markTouched("bank.mode");
                    }}
                    error={showErr("bank.upiId")}
                    placeholder="name@bank"
                  />
                </div>
              </div>
            </>
          )}

          {current.key === "vehicle" && (
            <>
              <Select
                label="Vehicle Type"
                value={state.vehicle.type}
                onChange={(v) => setField("vehicle.type", v)}
                options={[
                  { value: "bike", label: "Bike" },
                  { value: "scooter", label: "Scooter" },
                  { value: "auto", label: "Auto" },
                  { value: "car", label: "Car / Mini" },
                  { value: "sedan", label: "Sedan" },
                  { value: "suv", label: "SUV" },
                ]}
              />
              <Field
                label="Vehicle Number"
                value={state.vehicle.number}
                onChange={(v) => setField("vehicle.number", v.toUpperCase().replace(/\s+/g, ""))}
                onBlur={() => markTouched("vehicle.number")}
                error={showErr("vehicle.number")}
                placeholder="MH12AB1234"
              />
              <Field
                label="Make (optional)"
                value={state.vehicle.make}
                onChange={(v) => setField("vehicle.make", v)}
                placeholder="e.g. Honda"
              />
              <Field
                label="Model (optional)"
                value={state.vehicle.model}
                onChange={(v) => setField("vehicle.model", v)}
                placeholder="e.g. Activa 6G"
              />
              <Field
                label="Color (optional)"
                value={state.vehicle.color}
                onChange={(v) => setField("vehicle.color", v)}
                placeholder="e.g. Black"
              />
              <Field
                label="RC Document URL (optional)"
                value={state.vehicle.rcUrl}
                onChange={(v) => setField("vehicle.rcUrl", v.trim())}
                onBlur={() => markTouched("vehicle.rcUrl")}
                error={showErr("vehicle.rcUrl")}
                placeholder="https://…"
              />
              <Field
                label="Insurance URL (optional)"
                value={state.vehicle.insuranceUrl}
                onChange={(v) => setField("vehicle.insuranceUrl", v.trim())}
                onBlur={() => markTouched("vehicle.insuranceUrl")}
                error={showErr("vehicle.insuranceUrl")}
                placeholder="https://…"
              />
              <Field
                label="Vehicle Photo URL (optional)"
                value={state.vehicle.photoUrl}
                onChange={(v) => setField("vehicle.photoUrl", v.trim())}
                onBlur={() => markTouched("vehicle.photoUrl")}
                error={showErr("vehicle.photoUrl")}
                placeholder="https://…"
              />
            </>
          )}

          {current.key === "selfie" && (
            <>
              <Field
                label="Selfie URL"
                value={state.selfie.selfieUrl}
                onChange={(v) => setField("selfie.selfieUrl", v.trim())}
                onBlur={() => markTouched("selfie.selfieUrl")}
                error={showErr("selfie.selfieUrl")}
                placeholder="https://…"
              />
              <p className="text-[12px] text-white/40 leading-relaxed">
                Take a well-lit selfie holding your ID for fastest approval. We only use it for
                verification.
              </p>
            </>
          )}

          {current.key === "services" && (
            <>
              <p className="text-[13px] text-white/70 font-medium mb-3">
                Choose which services you want to start with. You can enable the other one anytime
                later from your profile.
              </p>
              <ServiceToggle
                checked={state.services.includes("food")}
                onChange={(checked) =>
                  setState((s) => ({
                    ...s,
                    services: checked
                      ? Array.from(new Set([...s.services, "food"]))
                      : s.services.filter((x) => x !== "food"),
                  }))
                }
                Icon={Bike}
                title="Food Delivery"
                subtitle="Deliver restaurant orders nearby"
              />
              <ServiceToggle
                checked={state.services.includes("taxi")}
                onChange={(checked) =>
                  setState((s) => ({
                    ...s,
                    services: checked
                      ? Array.from(new Set([...s.services, "taxi"]))
                      : s.services.filter((x) => x !== "taxi"),
                  }))
                }
                Icon={Car}
                title="Taxi & Cab"
                subtitle="Take ride and parcel requests"
              />
              {showErr("services") && (
                <p className="text-[11px] font-semibold text-red-400 mt-1">{showErr("services")}</p>
              )}
              <div className="rounded-2xl bg-[#88c170]/5 border border-[#88c170]/20 p-3 text-[11px] text-[#cfe3c6] mt-2">
                You'll only ever be active on ONE service at a time. The other one will be paused
                while you're on a job.
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 pt-3 bg-[#0c1410] border-t border-white/5 flex gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={activeIdx === 0 || stepLoading}
            className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/10 text-white/80 disabled:text-white/30 font-bold disabled:bg-white/0"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={stepLoading}
            className="flex-[2] h-12 rounded-2xl bg-[#88c170] hover:bg-[#7eb463] disabled:bg-white/10 disabled:text-white/30 text-[#0c1410] font-extrabold flex items-center justify-center gap-2"
          >
            {stepLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>{activeIdx === STEPS.length - 1 ? "Submit for Approval" : "Save & Continue"}</span>
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- helpers -------------------------------- */

function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function setByPath(obj, path, value) {
  const keys = path.split(".");
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  let cursor = clone;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const existing = cursor[key];
    cursor[key] = Array.isArray(existing) ? [...existing] : { ...(existing || {}) };
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
  return clone;
}

function Field({ label, value, onChange, onBlur, placeholder, type = "text", inputMode, error }) {
  const invalid = Boolean(error);
  return (
    <div>
      <label className="text-[11px] text-white/50 font-bold uppercase tracking-widest mb-1.5 block">
        {label}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={invalid}
        className={[
          "w-full h-12 bg-white/5 rounded-xl px-4 text-white font-semibold outline-none placeholder:text-white/30 transition-colors",
          invalid
            ? "border border-red-400 focus:ring-2 focus:ring-red-400/30"
            : "border border-white/10 focus:border-[#88c170] focus:ring-2 focus:ring-[#88c170]/20",
        ].join(" ")}
      />
      {invalid && (
        <p className="text-[11px] font-semibold text-red-400 mt-1.5">{error}</p>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-[11px] text-white/50 font-bold uppercase tracking-widest mb-1.5 block">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white font-semibold outline-none focus:border-[#88c170]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#0c1410]">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ServiceToggle({ checked, onChange, Icon, title, subtitle }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-3",
        checked
          ? "bg-[#88c170]/10 border-[#88c170] shadow-[0_0_0_2px_rgba(136,193,112,0.15)]"
          : "bg-white/5 border-white/10",
      ].join(" ")}
    >
      <div
        className={[
          "w-11 h-11 rounded-xl flex items-center justify-center",
          checked ? "bg-[#88c170] text-[#0c1410]" : "bg-white/10 text-white/60",
        ].join(" ")}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="text-white font-bold">{title}</div>
        <div className="text-[12px] text-white/50">{subtitle}</div>
      </div>
      <div
        className={[
          "w-6 h-6 rounded-full border-2 flex items-center justify-center",
          checked ? "border-[#88c170] bg-[#88c170] text-[#0c1410]" : "border-white/20",
        ].join(" ")}
      >
        {checked && <CheckCircle2 className="w-4 h-4" />}
      </div>
    </button>
  );
}
