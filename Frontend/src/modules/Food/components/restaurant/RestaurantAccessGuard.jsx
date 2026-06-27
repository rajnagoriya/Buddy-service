import { Navigate, useLocation } from "react-router-dom";
import Loader from "@food/components/Loader";
import { clearModuleAuth, isModuleAuthenticated } from "@food/utils/auth";
import { useRestaurantSession, invalidateRestaurantSession } from "@food/context/RestaurantSessionContext";
import { resolveRestaurantOnboardingStatus } from "@food/utils/onboardingUtils";
import { isRestaurantBanned } from "@food/utils/restaurantBan";

export function invalidateRestaurantAccessGuardCache() {
  // Kept for callers that invalidate on auth change; session context handles reload.
}

function resolveRedirect(onboarding, mode, pathname, locationState = {}) {
  const status = resolveRestaurantOnboardingStatus(onboarding);
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

  const logoutBanned = () => {
    clearModuleAuth("restaurant");
    invalidateRestaurantSession();
    window.dispatchEvent(new Event("restaurantAuthChanged"));
    return (
      <Navigate
        to="/food/restaurant/login"
        replace
        state={{
          banned: true,
          message: "Your restaurant account has been banned. Please contact support.",
        }}
      />
    );
  };

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

  if (error?.response?.status === 403) {
    return logoutBanned();
  }

  const sessionPayload = { ...onboarding, status: restaurant?.status, rejectionReason: restaurant?.rejectionReason, bannedAt: restaurant?.bannedAt };
  const banned =
    isRestaurantBanned(restaurant) ||
    isRestaurantBanned(sessionPayload) ||
    resolveRestaurantOnboardingStatus(sessionPayload) === "BANNED";

  if (banned) {
    return logoutBanned();
  }

  const redirectTo = resolveRedirect(
    onboarding,
    mode,
    location.pathname,
    location.state,
  );

  if (redirectTo) {
    const status = resolveRestaurantOnboardingStatus(onboarding);
    return (
      <Navigate
        to={redirectTo}
        replace
        state={
          status === "REJECTED"
            ? {
                isRejected: true,
                rejectionReason: onboarding?.adminRemarks || onboarding?.rejectionReason || "",
                rejectionStep:
                  onboarding?.rejectionStep || onboarding?.currentStep || 1,
              }
            : undefined
        }
      />
    );
  }

  return children;
}
