import { Navigate, useLocation } from "react-router-dom";
import { hasModuleSession, isModuleAuthenticated } from "@food/utils/auth";

/**
 * Role-based Protected Route Component
 * Only allows access if user is authenticated for the specific module
 */
export default function ProtectedRoute({ children, requiredRole, loginPath = "/user/auth/login" }) {
  const location = useLocation();

  // If no role required, allow access
  if (!requiredRole) {
    return children;
  }

  // Prefer a usable access token; also accept recoverable sessions (refresh token present)
  // so we don't bounce to login while AuthInitializer renews an expired access JWT.
  const isAuthenticated =
    isModuleAuthenticated(requiredRole) || hasModuleSession(requiredRole);

  // If not authenticated for this module, redirect to login
  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
  }

  return children;
}

