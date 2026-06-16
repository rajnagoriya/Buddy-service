import { Navigate, useLocation } from "react-router-dom"
import { isModuleAuthenticated } from "@food/utils/auth"

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const isAuthenticated = isModuleAuthenticated("delivery")

  if (!isAuthenticated) {
    return <Navigate to="/driver/login" state={{ redirect: location.pathname }} replace />
  }

  return children
}

