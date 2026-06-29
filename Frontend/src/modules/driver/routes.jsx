/**
 * Unified Driver module.
 *
 * One login + one onboarding wizard + one mode selector for both
 * food-delivery and taxi-driver capabilities. The token issued here
 * works against every existing food-delivery and taxi-driver endpoint
 * because the backend embeds both `userId` and `sub` in the JWT.
 *
 * Every route below /driver/* (except the login page) is gated by
 * `DriverGuard`:
 *   - no token            → kicks to /driver/login
 *   - token + onboarding  → kicks to /driver/onboarding
 * /driver/login itself bounces already-onboarded drivers to /driver/home.
 */

import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import DriverGuard from "./components/DriverGuard";
import DriverPageLoader from "./components/DriverPageLoader";
import Login from "./pages/Login";
import OnboardingWizard from "./pages/OnboardingWizard";
import DriverGate from "./pages/DriverGate";

const DriverHome = lazy(() => import("./pages/DriverHome"));
const DriverProfile = lazy(() => import("./pages/DriverProfile"));

export default function DriverRoutes() {
  return (
    <Suspense fallback={<DriverPageLoader />}>
      <Routes>
        <Route index element={<DriverGate />} />

        <Route
          path="login"
          element={(
            <DriverGuard publicOnly>
              <Login />
            </DriverGuard>
          )}
        />

        <Route
          path="onboarding/*"
          element={(
            <DriverGuard>
              <OnboardingWizard />
            </DriverGuard>
          )}
        />

        <Route
          path="home"
          element={(
            <DriverGuard requireOnboardingComplete>
              <DriverHome />
            </DriverGuard>
          )}
        />

        <Route
          path="profile"
          element={(
            <DriverGuard requireOnboardingComplete>
              <DriverProfile />
            </DriverGuard>
          )}
        />

        {/* Convenience aliases — gated so unfinished/anonymous visitors
            can't slip into the food or taxi portals through these. */}
        <Route
          path="food"
          element={(
            <DriverGuard requireOnboardingComplete>
              <Navigate to="/food/delivery" replace />
            </DriverGuard>
          )}
        />
        <Route
          path="taxi"
          element={(
            <DriverGuard requireOnboardingComplete>
              <Navigate to="/driver/home" replace />
            </DriverGuard>
          )}
        />

        <Route path="*" element={<Navigate to="/driver" replace />} />
      </Routes>
    </Suspense>
  );
}
