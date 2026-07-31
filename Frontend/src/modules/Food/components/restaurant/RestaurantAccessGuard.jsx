import { Navigate, useLocation } from "react-router-dom";
import Loader from "@food/components/Loader";
import { clearModuleAuth, isModuleAuthenticated } from "@food/utils/auth";
import { useRestaurantSession, invalidateRestaurantSession } from "@food/context/RestaurantSessionContext";
import { resolveRestaurantOnboardingStatus } from "@food/utils/onboardingUtils";
import { isRestaurantBanned } from "@food/utils/restaurantBan";

export function invalidateRestaurantAccessGuardCache() {
  // Kept for callers that invalidate on auth change; session context handles reload.
}

function buildSessionPayload(onboarding, restaurant) {
  return {
    ...(onboarding || {}),
    // Prefer live restaurant account fields so approved outlets are not
    // bounced back to onboarding by a stale onboardingStatus.
    // approvedAt is the reliable approval signal; isActive is outlet online/offline only.
    status: restaurant?.status ?? onboarding?.status,
    approvedAt: restaurant?.approvedAt ?? onboarding?.approvedAt,
    isActive: restaurant?.isActive ?? onboarding?.isActive,
    rejectionReason: restaurant?.rejectionReason ?? onboarding?.rejectionReason,
    bannedAt: restaurant?.bannedAt ?? onboarding?.bannedAt,
    onboardingStatus:
      onboarding?.onboardingStatus || restaurant?.onboardingStatus || null,
    currentStep: onboarding?.currentStep ?? restaurant?.currentStep,
    rejectionStep: onboarding?.rejectionStep,
    adminRemarks: onboarding?.adminRemarks || restaurant?.rejectionReason,
  };
}

function resolveRedirect(sessionPayload, mode, pathname, locationState = {}) {
  const status = resolveRestaurantOnboardingStatus(sessionPayload);
  const currentStep =
    sessionPayload?.rejectionStep || sessionPayload?.currentStep || 1;

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

  if (status === "BANNED") {
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
  const { onboarding, restaurant, loading, error } = useRestaurantSession();

  const logoutAndGoLogin = (state = {}) => {
    clearModuleAuth("restaurant");
    invalidateRestaurantSession();
    window.dispatchEvent(new Event("restaurantAuthChanged"));
    return (
      <Navigate
        to="/food/restaurant/login"
        replace
        state={state}
      />
    );
  };

  const logoutBanned = () =>
    logoutAndGoLogin({
      banned: true,
      message: "Your restaurant account has been banned. Please contact support.",
    });

  if (!isModuleAuthenticated("restaurant")) {
    return (
      <Navigate
        to="/food/restaurant/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (loading) {
    return <Loader />;
  }

  // Auth expired / invalid: clear tokens and send to login — do NOT treat as onboarding.
  if (error?.response?.status === 401) {
    return logoutAndGoLogin({
      from: location.pathname + location.search,
      message: "Session expired. Please log in again.",
    });
  }

  if (error?.response?.status === 403) {
    return logoutBanned();
  }

  // Network / transient errors: stay put with last known data if we have it;
  // never send an authenticated approved restaurant to onboarding on a failed fetch.
  const sessionPayload = buildSessionPayload(onboarding, restaurant);
  const hasSession = Boolean(restaurant || onboarding);

  if (error && !hasSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-slate-600">
          Couldn’t load your restaurant session. Check your connection and try again.
        </p>
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  const banned =
    isRestaurantBanned(restaurant) ||
    isRestaurantBanned(sessionPayload) ||
    resolveRestaurantOnboardingStatus(sessionPayload) === "BANNED";

  if (banned) {
    return logoutBanned();
  }

  const redirectTo = resolveRedirect(
    sessionPayload,
    mode,
    location.pathname,
    location.state,
  );

  if (redirectTo) {
    const status = resolveRestaurantOnboardingStatus(sessionPayload);
    return (
      <Navigate
        to={redirectTo}
        replace
        state={
          status === "REJECTED"
            ? {
                isRejected: true,
                rejectionReason:
                  sessionPayload?.adminRemarks ||
                  sessionPayload?.rejectionReason ||
                  "",
                rejectionStep:
                  sessionPayload?.rejectionStep ||
                  sessionPayload?.currentStep ||
                  1,
              }
            : undefined
        }
      />
    );
  }

  return children;
}
