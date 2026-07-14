import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { driverOnboardingAPI } from "@food/api";
import DriverPageLoader from "../components/DriverPageLoader";

/**
 * Entry route at `/driver`. Decides where to send the driver based on the
 * current onboarding/auth state:
 *   no token            → /driver/login
 *   token + onboarding  → /driver/onboarding
 *   token + complete    → /driver/home
 */
export default function DriverGate() {
  const [decision, setDecision] = useState(null);

  useEffect(() => {
    const token =
      localStorage.getItem("driver_accessToken") ||
      localStorage.getItem("delivery_accessToken") ||
      localStorage.getItem("driverToken");
    if (!token) {
      setDecision("/driver/login");
      return;
    }
    let cancelled = false;
    driverOnboardingAPI
      .getState()
      .then((res) => {
        if (cancelled) return;
        const data = res?.data?.data || res?.data || {};
        const complete = Boolean(data?.onboardingComplete);
        setDecision(complete ? "/driver/home" : "/driver/onboarding");
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          setDecision("/driver/login");
        } else {
          // network glitch — let the driver pick a service manually
          setDecision("/driver/home");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!decision) return <DriverPageLoader />;
  return <Navigate to={decision} replace />;
}
