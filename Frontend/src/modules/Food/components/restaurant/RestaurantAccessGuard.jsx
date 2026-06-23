import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import Loader from "@food/components/Loader";
import { isModuleAuthenticated } from "@food/utils/auth";
import { restaurantAPI } from "@food/api";

let guardCache = null;

export function invalidateRestaurantAccessGuardCache() {
  guardCache = null;
}

function loadOnboardingState() {
  const token = localStorage.getItem("restaurant_accessToken");
  if (guardCache && guardCache.token === token) return guardCache.promise;

  const promise = restaurantAPI
    .getOnboardingProgress()
    .then((res) => res?.data?.data?.onboarding || res?.data?.onboarding || null)
    .catch((err) => {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        guardCache = null;
        throw err;
      }
      return null;
    });

  guardCache = { token, promise };
  return promise;
}

if (typeof window !== "undefined" && !window.__restaurantGuardWired) {
  window.__restaurantGuardWired = true;
  window.addEventListener("restaurantAuthChanged", invalidateRestaurantAccessGuardCache);
  window.addEventListener("storage", (e) => {
    if (e.key === "restaurant_accessToken" || e.key === null) {
      invalidateRestaurantAccessGuardCache();
    }
  });
}

function resolveRedirect(onboarding, mode, pathname, locationState = {}) {
  const status = String(onboarding?.onboardingStatus || "").toUpperCase();
  const currentStep =
    onboarding?.rejectionStep || onboarding?.currentStep || 1;

  if (status === "APPROVED") {
    if (mode === "onboarding" || pathname === "/food/restaurant/pending-verification") {
      return "/food/restaurant";
    }
    return null;
  }

  if (status === "SUBMITTED" || status === "UNDER_REVIEW") {
    if (mode === "dashboard" || pathname === "/food/restaurant/onboarding") {
      return "/food/restaurant/pending-verification";
    }
    return null;
  }

  if (status === "REJECTED") {
    if (mode === "dashboard") {
      return "/food/restaurant/pending-verification";
    }
    if (
      mode === "onboarding" &&
      pathname === "/food/restaurant/onboarding" &&
      !locationState?.fromRejection
    ) {
      return "/food/restaurant/pending-verification";
    }
    return null;
  }

  if (status === "IN_PROGRESS" || status === "NOT_STARTED") {
    if (mode === "dashboard") {
      return `/food/restaurant/onboarding?step=${currentStep}`;
    }
    return null;
  }

  if (mode === "dashboard") {
    return `/food/restaurant/onboarding?step=${currentStep || 1}`;
  }

  return null;
}

export default function RestaurantAccessGuard({ children, mode = "dashboard" }) {
  const location = useLocation();
  const [state, setState] = useState({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!isModuleAuthenticated("restaurant")) {
        if (!cancelled) {
          setState({
            kind: "redirect",
            to: "/food/restaurant/login",
            from: location.pathname + location.search,
          });
        }
        return;
      }

      try {
        const onboarding = await loadOnboardingState();
        if (cancelled) return;

        const redirectTo = resolveRedirect(
          onboarding,
          mode,
          location.pathname,
          location.state,
        );

        if (redirectTo) {
          const status = String(onboarding?.onboardingStatus || "").toUpperCase();
          setState({
            kind: "redirect",
            to: redirectTo,
            state:
              status === "REJECTED"
                ? {
                    isRejected: true,
                    rejectionReason: onboarding?.adminRemarks || "",
                    rejectionStep:
                      onboarding?.rejectionStep || onboarding?.currentStep || 1,
                  }
                : undefined,
          });
          return;
        }

        setState({ kind: "ok", onboarding });
      } catch {
        if (!cancelled) {
          setState({
            kind: "redirect",
            to: "/food/restaurant/login",
            from: location.pathname + location.search,
          });
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, mode]);

  if (state.kind === "loading") {
    return <Loader />;
  }

  if (state.kind === "redirect") {
    return (
      <Navigate
        to={state.to}
        replace
        state={{
          from: state.from,
          ...(state.state || {}),
        }}
      />
    );
  }

  return children;
}
