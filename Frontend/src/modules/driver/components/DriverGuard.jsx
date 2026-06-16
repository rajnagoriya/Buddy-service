import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { driverOnboardingAPI } from "@food/api";
import Loader from "@food/components/Loader";

/**
 * Single source of truth for /driver/* access control.
 *
 *   <DriverGuard>                          // requires a valid driver token
 *   <DriverGuard requireOnboardingComplete>// requires token AND submitted onboarding
 *   <DriverGuard publicOnly>               // login page: bounce already-onboarded drivers away
 *
 * Unauthenticated  →  /driver/login
 * Authenticated but not onboarded  →  /driver/onboarding
 * Authenticated + complete  →  /driver/home  (only when `publicOnly`)
 */

function getDriverToken() {
  return (
    localStorage.getItem("driver_accessToken") ||
    localStorage.getItem("delivery_accessToken") ||
    localStorage.getItem("driverToken") ||
    ""
  );
}

// Per-tab cache so route transitions don't trigger duplicate /driver/onboarding
// fetches. Invalidated on login / logout via custom events + the storage event.
let cache = null; // { token, promise }

export function invalidateDriverGuardCache() {
  cache = null;
}

function loadOnboardingComplete(token) {
  if (cache && cache.token === token) return cache.promise;
  const promise = driverOnboardingAPI
    .getState()
    .then((res) => {
      const data = res?.data?.data || res?.data || {};
      return Boolean(data?.onboardingComplete);
    })
    .catch((err) => {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        cache = null;
        throw err;
      }
      return false;
    });
  cache = { token, promise };
  return promise;
}

if (typeof window !== "undefined" && !window.__driverGuardWired) {
  window.__driverGuardWired = true;
  window.addEventListener("identity:driver-login", invalidateDriverGuardCache);
  window.addEventListener("identity:driver-logout", invalidateDriverGuardCache);
  window.addEventListener("storage", (e) => {
    if (e.key === "driver_accessToken" || e.key === null) invalidateDriverGuardCache();
  });
}

export default function DriverGuard({
  children,
  requireOnboardingComplete = false,
  publicOnly = false,
}) {
  const location = useLocation();
  const [status, setStatus] = useState("loading"); // loading | ok | redirect
  const [redirectTo, setRedirectTo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const token = getDriverToken();

    if (publicOnly) {
      if (!token) {
        setStatus("ok");
        return undefined;
      }
      loadOnboardingComplete(token)
        .then((complete) => {
          if (cancelled) return;
          setRedirectTo(complete ? "/driver/home" : "/driver/onboarding");
          setStatus("redirect");
        })
        .catch(() => {
          if (cancelled) return;
          setStatus("ok");
        });
      return () => {
        cancelled = true;
      };
    }

    if (!token) {
      setRedirectTo("/driver/login");
      setStatus("redirect");
      return undefined;
    }

    if (!requireOnboardingComplete) {
      setStatus("ok");
      return undefined;
    }

    loadOnboardingComplete(token)
      .then((complete) => {
        if (cancelled) return;
        if (complete) {
          setStatus("ok");
        } else {
          setRedirectTo("/driver/onboarding");
          setStatus("redirect");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRedirectTo("/driver/login");
        setStatus("redirect");
      });

    return () => {
      cancelled = true;
    };
  }, [publicOnly, requireOnboardingComplete, location.pathname]);

  if (status === "loading") return <Loader />;
  if (status === "redirect" && redirectTo) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }
  return children;
}
