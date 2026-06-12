// Routing file
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import { AppShellSkeleton } from '@food/components/ui/loading-skeletons'

const NATIVE_LAST_ROUTE_KEY = 'native_last_route'

// Lazy load the Food service module (Quick-spicy app)
const FoodApp = lazy(() => import('../modules/Food/routes'))
const AuthApp = lazy(() => import('../modules/auth/routes'))
const TaxiApp = lazy(() => import('../modules/taxi/routes'))
import ProtectedRoute from '@food/components/ProtectedRoute'

const PageLoader = () => <AppShellSkeleton />

/**
 * FoodAppWrapper — Quick-spicy App. को /food prefix के साथ render करता है.
 * 
 * Quick-spicy की App.jsx में routes /restaurant, /usermain, /admin, /delivery
 * जैसे hain (bina /food prefix ke). Yahan hum useLocation se /food ke baad wala
 * path nikalne ke baad FoodApp render karte hain. FoodApp internally BrowserRouter
 * nahi use karta (sirf Routes use karta hai), isliye ye directly kaam karta hai.
 */
const FoodAppWrapper = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <FoodApp />
    </Suspense>
  )
}

const RedirectToFood = () => {
  const location = useLocation();
  // We safely replace the exact current pathname with a /food prefixed pathname
  // This effectively catches programmatic navigation to absolute paths like '/restaurant/login'
  // and turns them into '/food/restaurant/login'
  return <Navigate to={`/food${location.pathname}${location.search}`} replace />;
};

// const MasterLandingPage = lazy(() => import('./MasterLandingPage'))
const AdminRouter = lazy(() => import('../modules/Food/components/admin/AdminRouter'))
const QCApp = lazy(() => import('@qc/index'))



const AppRoutes = () => {
  const location = useLocation()
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Mirror Food/QC Admin auth to Taxi Admin auth
    const foodAdminToken = localStorage.getItem('admin_accessToken') || localStorage.getItem('auth_admin');
    if (foodAdminToken && !localStorage.getItem('adminToken')) {
      localStorage.setItem('adminToken', foodAdminToken);
    }
    
    // Mirror Food/QC User auth to Taxi User auth
    const generalToken = localStorage.getItem('user_accessToken') || localStorage.getItem('token') || localStorage.getItem('accessToken');
    if (generalToken && !localStorage.getItem('userToken')) {
      try {
        const payload = JSON.parse(atob(generalToken.split('.')[1]));
        if (String(payload?.role || '').toLowerCase() === 'user') {
          localStorage.setItem('userToken', generalToken);
        }
      } catch (e) {}
    }
    const foodAdminInfo = localStorage.getItem('adminInfo');
    if (foodAdminInfo) {
      try {
        const parsed = JSON.parse(foodAdminInfo);
        if (parsed && (!parsed.permissions || parsed.permissions.length === 0 || !parsed.admin_type)) {
          parsed.permissions = ['*'];
          parsed.admin_type = 'superadmin';
          localStorage.setItem('adminInfo', JSON.stringify(parsed));
        }
      } catch (e) {
        // Ignore
      }
    }

    const protocol = String(window.location?.protocol || '').toLowerCase()
    const userAgent = String(window.navigator?.userAgent || '').toLowerCase()
    const isNativeLikeShell =
      Boolean(window.flutter_inappwebview) ||
      Boolean(window.ReactNativeWebView) ||
      protocol === 'file:' ||
      userAgent.includes(' wv') ||
      userAgent.includes('; wv')

    if (!isNativeLikeShell) return

    const route = `${location.pathname || ''}${location.search || ''}`
    if (route.startsWith('/food/') || route.startsWith('/admin')) {
      localStorage.setItem(NATIVE_LAST_ROUTE_KEY, route)
    }
  }, [location.pathname, location.search])

  return (
    <Routes>
      {/* Auth Module */}
      <Route path="/user/auth/*" element={<AuthApp />} />

      {/* Food Module - Handle both /food and root / for the user app */}
      <Route path="/food/*" element={<FoodAppWrapper />} />

      {/* Quick Commerce Module */}
      <Route path="/qc/*" element={<Suspense fallback={<PageLoader />}><QCApp /></Suspense>} />

      {/* Taxi Module */}
      <Route path="/taxi/*" element={<Suspense fallback={<PageLoader />}><TaxiApp /></Suspense>} />
      <Route path="/rental/*" element={<Navigate to="/taxi/user/rental" replace />} />
      <Route path="/ride/*" element={<Navigate to="/taxi/user/ride" replace />} />
      <Route path="/parcel/*" element={<Navigate to="/taxi/user/parcel" replace />} />
      <Route path="/cab/*" element={<Navigate to="/taxi/user/cab" replace />} />
      <Route path="/intercity/*" element={<Navigate to="/taxi/user/intercity" replace />} />
      <Route path="/bus/*" element={<Navigate to="/taxi/user/bus" replace />} />

      {/* Global Admin Portal - AdminRouter handles its own protection for sub-routes */}
      <Route path="/admin/*" element={<AdminRouter />} />

      {/* Handle root and other paths via FoodAppWrapper */}
      <Route path="/*" element={<FoodAppWrapper />} />
    </Routes>
  )
}


export default AppRoutes

