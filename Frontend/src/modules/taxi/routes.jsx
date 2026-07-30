import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MapPin, FileText } from 'lucide-react';

// Socket / API initialization
import api from './shared/api/axiosInstance';
import { socketService } from './shared/api/socket';
import { SettingsProvider } from './shared/context/SettingsContext';
import AppAutoUpdater from './shared/components/AppAutoUpdater';
import { clearLocalUserSession, getLocalUserToken } from './user/services/authService';
import { clearCurrentRide } from './user/services/currentRideService';
import RentalLocationTracker from './user/components/RentalLocationTracker';
import userBusService from './user/services/busService';
import { userService } from './user/services/userService';
import { syncUpcomingRideReminders } from './user/utils/upcomingRideReminderService';
import { getAuthenticatedDriverRole, getLocalDriverToken, getCurrentDriver } from './driver/services/registrationService';
import { isUnifiedIdentityDriverSession } from '@food/api';

// Lazy loading pages for performance
const UserHome = lazy(() => import('./user/pages/Home'));
// Taxi user login/verify-otp/signup have been replaced by the unified
// `/user/auth/login` (modules/auth/pages/Login.jsx). The routes below
// redirect deep links to keep marketing pages working.

// Ride Module Pages
const SelectLocation = lazy(() => import('./user/pages/ride/SelectLocation'));
const SelectVehicle = lazy(() => import('./user/pages/ride/SelectVehicle'));
const SelectCategory = lazy(() => import('./user/pages/ride/SelectCategory'));
const SearchingDriver = lazy(() => import('./user/pages/ride/SearchingDriver'));
const RideTracking = lazy(() => import('./user/pages/ride/RideTracking'));
const RideComplete = lazy(() => import('./user/pages/ride/RideComplete'));
const Chat = lazy(() => import('./user/pages/ride/Chat'));
const Support = lazy(() => import('./user/pages/ride/Support'));
const RideDetail = lazy(() => import('./user/pages/ride/RideDetail'));

// Parcel Module Pages
const ParcelType = lazy(() => import('./user/pages/parcel/ParcelType'));
const SenderReceiverDetails = lazy(() => import('./user/pages/parcel/SenderReceiverDetails'));

// Profile & History
const Activity = lazy(() => import('./user/pages/Activity'));
const UnifiedProfile = lazy(() => import('@/shared/profile/UnifiedProfile'));
const BottomNavbar = lazy(() => import('./user/components/BottomNavbar'));
// Legacy taxi profile page — route redirects to unified profile
// const Profile = lazy(() => import('./user/pages/Profile'));
const Wallet = lazy(() => import('./user/pages/Wallet'));

// Coming Soon placeholder (for /tours and any unbuilt routes)
const ComingSoon = lazy(() => import('./shared/pages/ComingSoon'));
const LegalPage = lazy(() => import('./shared/pages/LegalPage'));
const LandingPage = lazy(() => import('./shared/pages/LandingPage'));
const AboutPage = lazy(() => import('./shared/pages/AboutPage'));
const ContactPage = lazy(() => import('./shared/pages/ContactPage'));
const SupportPage = lazy(() => import('./shared/pages/SupportPage'));
const FaqPage = lazy(() => import('./shared/pages/FaqPage'));
const ServicesPage = lazy(() => import('./shared/pages/ServicesPage'));
const BlogPage = lazy(() => import('./shared/pages/BlogPage'));
const LinksPage = lazy(() => import('./shared/pages/LinksPage'));
const PhonePeStatusPage = lazy(() => import('./shared/pages/PhonePeStatusPage'));
const RazorpayStatusPage = lazy(() => import('./shared/pages/RazorpayStatusPage'));
const RazorpayLaunchPage = lazy(() => import('./shared/pages/RazorpayLaunchPage'));

// Phase 1 — Parcel flow completions
const ParcelSearchingDriver = lazy(() => import('./user/pages/parcel/ParcelSearchingDriver'));
const ParcelTracking = lazy(() => import('./user/pages/parcel/ParcelTracking'));

// Phase 2 — Core utility pages
const UserNotifications = lazy(() => import('./user/pages/Notifications'));
const PromoCodes = lazy(() => import('./user/pages/PromoCodes'));
const UserReferral = lazy(() => import('./user/pages/Referral'));

// Phase 3 — Safety & Support
const SOSContacts = lazy(() => import('./user/pages/safety/SOSContacts'));
const SupportTickets = lazy(() => import('./user/pages/support/SupportTickets'));
const SupportTicketDetail = lazy(() => import('./user/pages/support/SupportTicketDetail'));
const DeleteAccount = lazy(() => import('./user/pages/profile/DeleteAccount'));

// Phase 4 — Cab/Intercity/Bus flows
const CabHome = lazy(() => import('./user/pages/cab/CabHome'));
const SharedTaxi = lazy(() => import('./user/pages/cab/SharedTaxi'));
const SharedTaxiSeats = lazy(() => import('./user/pages/cab/SharedTaxiSeats'));
const SharedTaxiConfirm = lazy(() => import('./user/pages/cab/SharedTaxiConfirm'));
const AirportCab = lazy(() => import('./user/pages/cab/AirportCab'));
const AirportCabConfirm = lazy(() => import('./user/pages/cab/AirportCabConfirm'));
const SpiritualTrip = lazy(() => import('./user/pages/cab/SpiritualTrip'));
const SpiritualTripVehicle = lazy(() => import('./user/pages/cab/SpiritualTripVehicle'));
const SpiritualTripConfirm = lazy(() => import('./user/pages/cab/SpiritualTripConfirm'));

const IntercityVehicle = lazy(() => import('./user/pages/intercity/IntercityVehicle'));
const IntercityDetails = lazy(() => import('./user/pages/intercity/IntercityDetails'));
const IntercityConfirm = lazy(() => import('./user/pages/intercity/IntercityConfirm'));

const BusHome = lazy(() => import('./user/pages/bus/BusHome'));
const BusList = lazy(() => import('./user/pages/bus/BusList'));
const BusSeats = lazy(() => import('./user/pages/bus/BusSeats'));
const BusPreview = lazy(() => import('./user/pages/bus/BusPreview'));
const BusDetails = lazy(() => import('./user/pages/bus/BusDetails'));
const BusConfirm = lazy(() => import('./user/pages/bus/BusConfirm'));

// Phase 5 — Onboarding (legacy taxi-specific onboarding — superseded by
// the unified user login). Route kept as a redirect.

// New Feature Pages
const BikeRentalHome = lazy(() => import('./user/pages/rental/BikeRentalHome'));
const RentalVehicleDetail = lazy(() => import('./user/pages/rental/RentalVehicleDetail'));
const RentalSchedule = lazy(() => import('./user/pages/rental/RentalSchedule'));
const RentalKYC = lazy(() => import('./user/pages/rental/RentalKYC'));
const RentalDeposit = lazy(() => import('./user/pages/rental/RentalDeposit'));
const RentalConfirmed = lazy(() => import('./user/pages/rental/RentalConfirmed'));
const IntercityHome = lazy(() => import('./user/pages/intercity/IntercityHome'));
const CabSharing = lazy(() => import('./user/pages/cabsharing/CabSharing'));

// Car Pooling flow
const UserPoolingHome = lazy(() => import('./user/pages/pooling/PoolingHome'));
const UserPoolingList = lazy(() => import('./user/pages/pooling/PoolingList'));
const UserPoolingSeats = lazy(() => import('./user/pages/pooling/PoolingSeats'));
const UserPoolingConfirm = lazy(() => import('./user/pages/pooling/PoolingConfirm'));

// Profile Settings Sub-pages
const ProfileSettings = lazy(() => import('./user/pages/profile/ProfileSettings'));
const PaymentSettings = lazy(() => import('./user/pages/profile/PaymentSettings'));
const AddressSettings = lazy(() => import('./user/pages/profile/AddressSettings'));
const BusBookings = lazy(() => import('./user/pages/profile/BusBookings'));
const BusBookingDetail = lazy(() => import('./user/pages/profile/BusBookingDetail'));
const UserSubscriptions = lazy(() => import('./user/pages/profile/Subscriptions'));

// Driver Module - Common
import DriverLayout from './driver/components/DriverLayout';

// Driver Module - Registration
// PhoneRegistration / OTPVerification are no longer rendered as routes —
// /taxi/driver/login and /taxi/owner/login redirect to the unified
// /driver/login below.
const RoleSelection = lazy(() => import('./driver/pages/registration/RoleSelection'));
const RegistrationStatus = lazy(() => import('./driver/pages/registration/RegistrationStatus'));
const StepPersonal = lazy(() => import('./driver/pages/registration/StepPersonal'));
const StepReferral = lazy(() => import('./driver/pages/registration/StepReferral'));
const StepVehicle = lazy(() => import('./driver/pages/registration/StepVehicle'));
const StepDocuments = lazy(() => import('./driver/pages/registration/StepDocuments'));
const RoleSpecificOnboarding = lazy(() => import('./driver/pages/registration/RoleSpecificOnboarding'));
const ApplicationStatus = lazy(() => import('./driver/pages/registration/ApplicationStatus'));

// Driver Module - Core
const DriverHome = lazy(() => import('./driver/pages/DriverHome'));
const OwnerDashboard = lazy(() => import('./driver/pages/OwnerDashboard'));
const OwnerBusServicePage = lazy(() => import('./driver/pages/OwnerBusServicePage'));
const OwnerBusBookingsPage = lazy(() => import('./driver/pages/OwnerBusBookingsPage'));
const OwnerPoolingVehicleForm = lazy(() => import('./driver/pages/OwnerPoolingVehicleForm'));
const ActiveTrip = lazy(() => import('./driver/pages/ActiveTrip'));
const DriverWallet = lazy(() => import('./driver/pages/DriverWallet'));
const DriverProfile = lazy(() => import('./driver/pages/DriverProfile'));
const DriverBankDetailsPage = lazy(() => import('./driver/pages/DriverBankDetailsPage'));
const ServiceCenterDashboard = lazy(() => import('./driver/pages/ServiceCenterDashboard'));
const ServiceCenterVehicleDetails = lazy(() => import('./driver/pages/ServiceCenterVehicleDetails'));
const RideRequests = lazy(() => import('./driver/pages/RideRequests'));
const DriverIncentives = lazy(() => import('./driver/pages/DriverIncentives'));
const BusDriverHome = lazy(() => import('./driver/pages/BusDriverHome'));
const BusDriverLiveRoute = lazy(() => import('./driver/pages/BusDriverLiveRoute'));
const PoolingDriverDashboard = lazy(() => import('./driver/pages/PoolingDriverDashboard'));
const PoolingDriverOnboarding = lazy(() => import('./driver/pages/pooling/PoolingDriverOnboarding'));
const PoolingDriverPendingStatus = lazy(() => import('./driver/pages/pooling/PoolingDriverPendingStatus'));
const PoolingDriverBookings = lazy(() => import('./driver/pages/pooling/PoolingDriverBookings'));
const PortalSupportPage = lazy(() => import('./driver/pages/PortalSupportPage'));

// Driver Module - Settings
const EditProfile = lazy(() => import('./driver/pages/settings/EditProfile'));
const DriverDocuments = lazy(() => import('./driver/pages/settings/DriverDocuments'));
const Notifications = lazy(() => import('./driver/pages/settings/Notifications'));
const PayoutMethods = lazy(() => import('./driver/pages/settings/PayoutMethods'));
const Referral = lazy(() => import('./driver/pages/settings/Referral'));
const DriverDeleteAccount = lazy(() => import('./driver/pages/settings/DeleteAccount'));
const SecuritySOS = lazy(() => import('./driver/pages/settings/SecuritySOS'));
const DriverSupport = lazy(() => import('./driver/pages/settings/Support'));
const DriverHelpSupportOptions = lazy(() => import('./driver/pages/settings/HelpSupportOptions'));
const DriverSupportChat = lazy(() => import('./driver/pages/settings/SupportChat'));
const VehicleFleet = lazy(() => import('./driver/pages/settings/VehicleFleet'));
const OwnerVehicleFleet = lazy(() => import('./driver/pages/settings/OwnerVehicleFleet'));
const AddVehicle = lazy(() => import('./driver/pages/settings/AddVehicle'));
const ManageDrivers = lazy(() => import('./driver/pages/settings/ManageDrivers'));
const AddDriver = lazy(() => import('./driver/pages/settings/AddDriver'));

// Admin Module Pages
const AdminLayout = lazy(() => import('./admin/components/AdminLayout'));

const AdminDashboard = lazy(() => import('./admin/pages/dashboard/MainDashboard'));
const AdminEarnings = lazy(() => import('./admin/pages/dashboard/AdminEarnings'));
const AdminChat = lazy(() => import('./admin/pages/operations/Chat'));
const AdminTrips = lazy(() => import('./admin/pages/operations/Trips'));
const AdminDeliveries = lazy(() => import('./admin/pages/operations/Deliveries'));
const AdminOngoing = lazy(() => import('./admin/pages/operations/Ongoing'));
const AdminWalletPayment = lazy(() => import('./admin/pages/wallet/WalletPayment'));
const AdminUserList = lazy(() => import('./admin/pages/users/UserList'));
const AdminUserCreate = lazy(() => import('./admin/pages/users/UserCreate'));
const AdminUserDetails = lazy(() => import('./admin/pages/users/UserDetails'));
const AdminDeleteRequestUsers = lazy(() => import('./admin/pages/users/DeleteRequestUsers'));
const AdminUserBulkUpload = lazy(() => import('./admin/pages/users/UserBulkUpload'));
const AdminUserImportCreate = lazy(() => import('./admin/pages/users/UserImportCreate'));
const AdminUserSubscriptions = lazy(() => import('./admin/pages/users/UserSubscriptions'));
const AdminUserSubscriptionCreate = lazy(() => import('./admin/pages/users/UserSubscriptionCreate'));

// DRIVER MANAGEMENT IMPORTS
const AdminDriverList = lazy(() => import('./admin/pages/drivers/DriverList'));
const AdminDriverDetails = lazy(() => import('./admin/pages/drivers/DriverDetails'));
const AdminPendingDrivers = lazy(() => import('./admin/pages/drivers/PendingDrivers'));
const AdminDriverSubscriptions = lazy(() => import('./admin/pages/drivers/DriverSubscriptions'));
const AdminDriverSubscriptionCreate = lazy(() => import('./admin/pages/drivers/DriverSubscriptionCreate'));
const AdminDriverRatings = lazy(() => import('./admin/pages/drivers/DriverRatings'));
const AdminDriverRatingDetail = lazy(() => import('./admin/pages/drivers/DriverRatingDetail'));
const AdminDriverWallet = lazy(() => import('./admin/pages/drivers/DriverWallet'));
const AdminNegativeBalanceDrivers = lazy(() => import('./admin/pages/drivers/NegativeBalanceDrivers'));
const AdminWithdrawalRequestDrivers = lazy(() => import('./admin/pages/drivers/WithdrawalRequestDrivers'));
const AdminWithdrawalRequestDetail = lazy(() => import('./admin/pages/drivers/WithdrawalRequestDetail'));
const AdminDriverDeleteRequests = lazy(() => import('./admin/pages/drivers/DriverDeleteRequests'));
const AdminGlobalDocuments = lazy(() => import('./admin/pages/drivers/GlobalDocuments'));
const AdminDriverDocumentForm = lazy(() => import('./admin/pages/drivers/DriverDocumentForm'));
const AdminDriverBulkUpload = lazy(() => import('./admin/pages/drivers/DriverBulkUpload'));
const AdminDriverImportCreate = lazy(() => import('./admin/pages/drivers/DriverImportCreate'));
const AdminDriverAudit = lazy(() => import('./admin/pages/drivers/DriverAudit'));
const AdminPaymentMethods = lazy(() => import('./admin/pages/drivers/PaymentMethods'));
const AdminDriverCreate = lazy(() => import('./admin/pages/drivers/CreateDriver'));
const AdminDriverEdit = lazy(() => import('./admin/pages/drivers/EditDriver'));
const AdminReferralDashboard = lazy(() => import('./admin/pages/referrals/ReferralDashboard'));
const AdminUserReferralSettings = lazy(() => import('./admin/pages/referrals/UserReferralSettings'));
const AdminDriverReferralSettings = lazy(() => import('./admin/pages/referrals/DriverReferralSettings'));
const AdminReferralTranslation = lazy(() => import('./admin/pages/referrals/ReferralTranslation'));

const AdminPromoCodes = lazy(() => import('./admin/pages/promotions/PromoCodes'));
const AdminSendNotification = lazy(() => import('./admin/pages/promotions/SendNotification'));
const AdminBannerImage = lazy(() => import('./admin/pages/promotions/BannerImage'));

// Price Management
const AdminServiceLocation = lazy(() => import('./admin/pages/price-management/ServiceLocation'));
const AdminServiceStores = lazy(() => import('./admin/pages/price-management/ServiceStores'));
const AdminPendingServiceStores = lazy(() => import('./admin/pages/price-management/PendingServiceStores'));
const AdminPendingServiceStaff = lazy(() => import('./admin/pages/price-management/PendingServiceStaff'));
const AdminZoneManagement = lazy(() => import('./admin/pages/price-management/ZoneManagement'));
const AdminAirportManagement = lazy(() => import('./admin/pages/price-management/Airport'));
const AdminSetPrices = lazy(() => import('./admin/pages/price-management/SetPrices'));
const AdminSetPackagePrices = lazy(() => import('./admin/pages/price-management/SetPackagePrices'));
const AdminCreatePackagePrice = lazy(() => import('./admin/pages/price-management/CreatePackagePrice'));
const AdminDriverIncentive = lazy(() => import('./admin/pages/price-management/DriverIncentive'));
const AdminSurgePricing = lazy(() => import('./admin/pages/price-management/SurgePricing'));
const AdminVehicleType = lazy(() => import('./admin/pages/price-management/VehicleType'));
const AdminRentalVehicleTypes = lazy(() => import('./admin/pages/price-management/RentalVehicleTypes'));
const AdminRentalCommissionManager = lazy(() => import('./admin/pages/price-management/RentalCommissionManager'));
const AdminRentalTracking = lazy(() => import('./admin/pages/price-management/RentalTracking'));
const AdminRentalTrackingDetail = lazy(() => import('./admin/pages/price-management/RentalTrackingDetail'));
const AdminRentalBookingRequests = lazy(() => import('./admin/pages/price-management/RentalBookingRequests'));
const AdminRentalQuoteRequests = lazy(() => import('./admin/pages/price-management/RentalQuoteRequests'));
const AdminRentalPackageTypes = lazy(() => import('./admin/pages/price-management/RentalPackageTypes'));
const AdminGoodsTypes = lazy(() => import('./admin/pages/price-management/GoodsTypes'));
const AdminPoolingManager = lazy(() => import('./admin/pages/pooling/PoolingManager'));
const AdminPoolingVehicles = lazy(() => import('./admin/pages/pooling/PoolingVehicles'));
const AdminPendingPoolingDrivers = lazy(() => import('./admin/pages/pooling/PendingPoolingDrivers'));
const AdminPoolingVehicleForm = lazy(() => import('./admin/pages/pooling/PoolingVehicleForm'));
const AdminPoolingBookings = lazy(() => import('./admin/pages/pooling/PoolingBookings'));
const AdminPoolingCommissionManager = lazy(() => import('./admin/pages/pooling/PoolingCommissionManager'));
const AdminBusServiceManager = lazy(() => import('./admin/pages/bus-service/BusServiceManager'));
const AdminPendingBusDrivers = lazy(() => import('./admin/pages/bus-service/PendingBusDrivers'));
const AdminBusServiceDetails = lazy(() => import('./admin/pages/bus-service/BusServiceDetails'));
const AdminBusBookingManager = lazy(() => import('./admin/pages/bus-service/BusBookingManager'));
const AdminBusCommissionManager = lazy(() => import('./admin/pages/bus-service/BusCommissionManager'));

const AdminOwnerDashboard = lazy(() => import('./admin/pages/owners/OwnerDashboard'));
const AdminManageOwners = lazy(() => import('./admin/pages/owners/ManageOwners'));
const AdminPendingOwners = lazy(() => import('./admin/pages/owners/PendingOwners'));
const AdminOwnerDetails = lazy(() => import('./admin/pages/owners/OwnerDetails'));
const AdminOwnerCreate = lazy(() => import('./admin/pages/owners/OwnerCreate'));
const AdminOwnerPasswordUpdate = lazy(() => import('./admin/pages/owners/OwnerPasswordUpdate'));
const AdminOwnerNeededDocuments = lazy(() => import('./admin/pages/owners/OwnerNeededDocuments'));
const AdminOwnerNeededDocumentsCreate = lazy(() => import('./admin/pages/owners/OwnerNeededDocumentsCreate'));
const AdminManageFleet = lazy(() => import('./admin/pages/owners/ManageFleet'));
const AdminManageFleetCreate = lazy(() => import('./admin/pages/owners/ManageFleetCreate'));
const AdminFleetDrivers = lazy(() => import('./admin/pages/owners/FleetDrivers'));
const AdminFleetDriverCreate = lazy(() => import('./admin/pages/owners/FleetDriverCreate'));
const AdminBlockedFleetDrivers = lazy(() => import('./admin/pages/owners/BlockedFleetDrivers'));
const AdminFleetNeededDocuments = lazy(() => import('./admin/pages/owners/FleetNeededDocuments'));
const AdminFleetNeededDocumentsCreate = lazy(() => import('./admin/pages/owners/FleetNeededDocumentsCreate'));
const AdminWithdrawalRequestOwners = lazy(() => import('./admin/pages/owners/WithdrawalRequestOwners'));
const AdminWithdrawalRequestOwnerDetail = lazy(() => import('./admin/pages/owners/WithdrawalRequestOwnerDetail'));
const AdminDeletedOwners = lazy(() => import('./admin/pages/owners/DeletedOwners'));
const AdminOwnerBookings = lazy(() => import('./admin/pages/owners/OwnerBookings'));

const AdminGeoFencing = lazy(() => import('./admin/pages/geo/GeoFencing'));
const AdminHeatMap = lazy(() => import('./admin/pages/geo/HeatMap'));
const AdminGodsEye = lazy(() => import('./admin/pages/geo/GodsEye'));
const AdminFinance = lazy(() => import('./admin/pages/finance/Finance'));
const AdminFareConfig = lazy(() => import('./admin/pages/finance/FareConfiguration'));
const AdminSafetyCenter = lazy(() => import('./admin/pages/safety/SafetyCenter'));
const AdminCMSBuilder = lazy(() => import('./admin/pages/cms/CMSBuilder'));
const AdminHeaderFooter = lazy(() => import('./admin/pages/cms/HeaderFooter'));
const AdminGlobalSettings = lazy(() => import('./admin/pages/settings/GlobalSettings'));
const AdminGeneralSettings = lazy(() => import('./admin/pages/settings/GeneralSettings'));
const AdminCustomizationSettings = lazy(() => import('./admin/pages/settings/CustomizationSettings'));
const AdminTransportRideSettings = lazy(() => import('./admin/pages/settings/TransportRideSettings'));
const AdminBidRideSettings = lazy(() => import('./admin/pages/settings/BidRideSettings'));
const AdminWalletSettings = lazy(() => import('./admin/pages/settings/WalletSettings'));
const AdminTipSettings = lazy(() => import('./admin/pages/settings/TipSettings'));
const AdminAppModules = lazy(() => import('./admin/pages/settings/AppModules'));
const AdminOnboardingScreens = lazy(() => import('./admin/pages/settings/OnboardingScreens'));
const AdminNotificationChannels = lazy(() => import('./admin/pages/settings/NotificationChannels'));
const AdminDispatcherAddons = lazy(() => import('./admin/pages/settings/DispatcherAddons'));
const AdminCountryManagement = lazy(() => import('./admin/pages/masters/CountryManagement'));
const AdminSupportTicketTitle = lazy(() => import('./admin/pages/support/TicketTitle'));
const AdminSupportTickets = lazy(() => import('./admin/pages/support/SupportTickets'));

// Reports Module
const AdminUserReport = lazy(() => import('./admin/pages/reports/UserReport'));
const AdminDriverReport = lazy(() => import('./admin/pages/reports/DriverReport'));
const AdminDriverDutyReport = lazy(() => import('./admin/pages/reports/DriverDutyReport'));
const AdminOwnerReport = lazy(() => import('./admin/pages/reports/OwnerReport'));
const AdminFinanceReport = lazy(() => import('./admin/pages/reports/FinanceReport'));
const AdminFleetFinanceReport = lazy(() => import('./admin/pages/reports/FleetFinanceReport'));

// Masters Management
const AdminLanguages = lazy(() => import('./admin/pages/masters/Languages'));
const AdminPreferences = lazy(() => import('./admin/pages/masters/Preferences'));

// Admin Management
const AdminAdmins = lazy(() => import('./admin/pages/management/Admins'));
const AdminAdminCreate = lazy(() => import('./admin/pages/management/AdminCreate'));

// Layout & Helpers
const MainLayout = ({ children }) => {
  const location = useLocation();
  const staticPages = ['/about', '/contact', '/support-page', '/faq', '/services', '/terms', '/privacy', '/refund', '/cancellation', '/blog', '/links'];
  const isStaticPath = staticPages.includes(location.pathname.replace(/^\/taxi/, ''));
  const isAdminPath =
    location.pathname.includes('/admin') ||
    location.pathname.includes('/user-import') ||
    location.pathname.includes('/driver-import') ||
    location.pathname.includes('/owner');

  if (isAdminPath) {
    return <div className="redigo-admin-root h-screen bg-gray-50 overflow-hidden">{children}</div>;
  }

  if (isStaticPath) {
    return (
      <div className="redigo-landing-root min-h-screen bg-white">
        <main className="min-h-screen">{children}</main>
      </div>
    );
  }

  return (
    <div className="redigo-app min-h-screen bg-gray-50/50">
      <main className="max-w-lg mx-auto shadow-2xl bg-white min-h-screen relative overflow-x-hidden">
        {children}
      </main>
    </div>
  );
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
};

const clearUserSession = () => {
  clearCurrentRide();
  clearLocalUserSession();
};

const UserProtectedRoute = () => {
  if (!getLocalUserToken()) {
    return <Navigate to="/user/auth/login" replace />;
  }
  return <Outlet />;
};

const REDIRECT_TO_USER_LOGIN = () => <Navigate to="/user/auth/login" replace />;
const REDIRECT_TO_DRIVER_LOGIN = () => <Navigate to="/driver/login" replace />;
const REDIRECT_TO_DRIVER_ONBOARDING = () => <Navigate to="/driver/onboarding" replace />;
const REDIRECT_TO_DRIVER_HOME = () => <Navigate to="/driver/home" replace />;

const UserHomeRoute = ({ taxiPrefixed = false }) => (
  getLocalUserToken()
    ? <UserHome />
    : <Navigate to="/user/auth/login" replace />
);

const UserAccountInvalidationListener = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const isUserRoute =
      !location.pathname.includes('/admin') &&
      !location.pathname.includes('/user-import') &&
      !location.pathname.includes('/driver-import') &&
      !location.pathname.includes('/owner') &&
      !location.pathname.includes('/taxi/driver');

    if (!isUserRoute) return undefined;

    const handleLogout = (loginState = null) => {
      clearUserSession();
      socketService.disconnect();
      navigate('/user/auth/login', { replace: true, state: loginState });
    };

    const handleAuthStale = (event) => {
      const staleToken = event.detail?.token || '';
      const currentUserToken = localStorage.getItem('userToken') || localStorage.getItem('token') || '';
      const currentAdminToken = localStorage.getItem('adminToken') || '';

      if (event.detail?.role === 'user' && (!staleToken || staleToken === currentUserToken)) {
        handleLogout(event.detail?.message ? { error: event.detail.message } : null);
        return;
      }

      if (event.detail?.role === 'admin' && (!staleToken || staleToken === currentAdminToken)) {
        socketService.disconnect();
        navigate('/admin/login');
      }
    };

    window.addEventListener('app:auth-stale', handleAuthStale);
    return () => window.removeEventListener('app:auth-stale', handleAuthStale);
  }, [location.pathname, navigate]);

  return null;
};

const getResponsePayload = (response) => response?.data?.data || response?.data || response || {};
const USER_REMINDER_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const USER_REMINDER_SYNC_COOLDOWN_MS = 60 * 1000;

const UserUpcomingRideReminderBootstrap = () => {
  const location = useLocation();
  const isUserReminderRoute =
    location.pathname.includes('/taxi/user') ||
    location.pathname === '/user' ||
    location.pathname.includes('/ride') ||
    location.pathname.includes('/pooling') ||
    location.pathname.includes('/bus');

  useEffect(() => {
    if (!isUserReminderRoute || !getLocalUserToken()) return undefined;

    let cancelled = false;
    let syncInFlight = false;
    let lastSyncAt = 0;

    const syncReminders = async (reason = 'timer') => {
      if (cancelled || syncInFlight) return;
      const now = Date.now();
      if (reason !== 'mount' && now - lastSyncAt < USER_REMINDER_SYNC_COOLDOWN_MS) return;

      syncInFlight = true;
      lastSyncAt = now;

      try {
        const [busResult, poolingResult, scheduledRideResult] = await Promise.all([
          userBusService.getMyBookings({ page: 1, limit: 20, tripState: 'upcoming' }),
          userService.getMyPoolingBookings(),
          api.get('/rides', { params: { page: 1, limit: 20, category: 'scheduled' } }),
        ]);

        if (cancelled) return;

        const busPayload = getResponsePayload(busResult);
        const poolingPayload = getResponsePayload(poolingResult);
        const scheduledRidePayload = getResponsePayload(scheduledRideResult);

        const rawPoolingBookings = Array.isArray(poolingPayload)
          ? poolingPayload
          : Array.isArray(poolingPayload?.results)
            ? poolingPayload.results
            : [];
        const routeIds = [...new Set(rawPoolingBookings.map((booking) => String(booking?.route?._id || '')).filter(Boolean))];
        const routeDetailsEntries = await Promise.all(
          routeIds.map(async (routeId) => {
            try {
              const routeResponse = await userService.getPoolingRouteDetails(routeId);
              return [routeId, getResponsePayload(routeResponse)];
            } catch {
              return [routeId, null];
            }
          }),
        );

        if (cancelled) return;

        const routeDetailsMap = new Map(routeDetailsEntries);
        const poolingBookings = rawPoolingBookings.map((booking) => {
          const routeId = String(booking?.route?._id || '');
          const routeDetails = routeDetailsMap.get(routeId);
          return routeDetails ? { ...booking, route: { ...(booking.route || {}), ...routeDetails } } : booking;
        });

        syncUpcomingRideReminders({
          busBookings: Array.isArray(busPayload?.results) ? busPayload.results : [],
          poolingBookings,
          scheduledRides: Array.isArray(scheduledRidePayload?.results) ? scheduledRidePayload.results : [],
        });
      } catch {
        // Ignored
      } finally {
        syncInFlight = false;
      }
    };

    const handleVisibilitySync = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        syncReminders('visibility');
      }
    };

    syncReminders('mount');
    const intervalId = window.setInterval(() => syncReminders('timer'), USER_REMINDER_SYNC_INTERVAL_MS);
    window.addEventListener('focus', syncReminders);
    document.addEventListener('visibilitychange', handleVisibilitySync);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncReminders);
      document.removeEventListener('visibilitychange', handleVisibilitySync);
    };
  }, [isUserReminderRoute]);

  return null;
};

const DriverEntryRedirect = () => {
  const token = getLocalDriverToken();
  const role = String(getAuthenticatedDriverRole() || 'driver').toLowerCase();

  useEffect(() => {
    console.log("ENTRY_ROLE", role);
    if (token) {
      getCurrentDriver()
        .then((response) => {
          const data = response?.data?.data || response?.data || response;
          console.log("ME_RESPONSE", data);
        })
        .catch((err) => {
          console.error("ME_RESPONSE error", err);
        });
    }
  }, [token, role]);

  if (!token) {
    return <Navigate to="/driver/login" replace />;
  }

  if (isUnifiedIdentityDriverSession()) {
    return <Navigate to="/driver/home" replace />;
  }

  return (
    <Navigate
      to={
        role === 'owner'
          ? '/taxi/owner/dashboard'
          : role === 'service_center' || role === 'service_center_staff'
            ? '/taxi/driver/service-center'
            : role === 'bus_driver'
              ? '/taxi/driver/bus-home'
              : role === 'pooling_driver'
                ? '/taxi/driver/pooling'
                : '/driver/home'
      }
      replace
    />
  );
};

export default function TaxiApp() {
  return (
    <SettingsProvider>
      <RentalLocationTracker />
      <AppAutoUpdater />
      <ScrollToTop />
      <UserAccountInvalidationListener />
      <UserUpcomingRideReminderBootstrap />
      <MainLayout>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen bg-white">
            <span className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></span>
          </div>
        }>
          <Routes>
            {/* Public/Static Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="faq" element={<FaqPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="blog" element={<BlogPage />} />
            <Route path="links" element={<LinksPage />} />
            <Route path="terms" element={<LegalPage />} />
            <Route path="terms-and-conditions" element={<LegalPage />} />
            <Route path="privacy" element={<LegalPage />} />
            <Route path="privacy-policy" element={<LegalPage />} />
            <Route path="refund" element={<LegalPage />} />
            <Route path="cancellation" element={<LegalPage />} />
            <Route path="phonepe/status" element={<PhonePeStatusPage />} />
            <Route path="razorpay/launch" element={<RazorpayLaunchPage />} />
            <Route path="razorpay/status" element={<RazorpayStatusPage />} />

            {/* Core User Pages — login/signup/onboarding redirect to the
                centralized unified login (`/user/auth/login`). */}
            <Route path="user/onboarding" element={<REDIRECT_TO_USER_LOGIN />} />
            <Route path="user/login" element={<REDIRECT_TO_USER_LOGIN />} />
            <Route path="user/verify-otp" element={<REDIRECT_TO_USER_LOGIN />} />
            <Route path="user/signup" element={<REDIRECT_TO_USER_LOGIN />} />
            <Route path="user" element={<UserHomeRoute taxiPrefixed />} />

            <Route element={<UserProtectedRoute />}>
              <Route path="user/ride/select-category" element={<SelectCategory />} />
              <Route path="user/ride/select-location" element={<SelectLocation />} />
              <Route path="user/ride/select-vehicle" element={<SelectVehicle />} />
              <Route path="user/ride/searching" element={<SearchingDriver />} />
              <Route path="user/ride/tracking" element={<RideTracking />} />
              <Route path="user/ride/complete" element={<RideComplete />} />
              <Route path="user/ride/chat" element={<Chat />} />
              <Route path="user/support" element={<Support />} />
              <Route path="user/ride/detail/:id" element={<RideDetail />} />

              <Route path="user/parcel/type" element={<ParcelType />} />
              <Route path="user/parcel/details" element={<SenderReceiverDetails />} />
              <Route path="user/parcel/contacts" element={<SenderReceiverDetails />} />
              <Route path="user/parcel/searching" element={<ParcelSearchingDriver />} />
              <Route path="user/parcel/tracking" element={<ParcelTracking />} />
              <Route path="user/parcel/detail/:id" element={<RideDetail />} />

              <Route path="user/pooling" element={<UserPoolingHome />} />
              <Route path="user/pooling/list" element={<UserPoolingList />} />
              <Route path="user/pooling/seats/:id" element={<UserPoolingSeats />} />
              <Route path="user/pooling/confirm" element={<UserPoolingConfirm />} />

              <Route path="user/rental" element={<BikeRentalHome />} />
              <Route path="user/rental/vehicle" element={<RentalVehicleDetail />} />
              <Route path="user/rental/schedule" element={<RentalSchedule />} />
              <Route path="user/rental/kyc" element={<RentalKYC />} />
              <Route path="user/rental/deposit" element={<RentalDeposit />} />
              <Route path="user/rental/confirmed" element={<RentalConfirmed />} />

              <Route path="user/intercity" element={<IntercityHome />} />
              <Route path="user/intercity/vehicle" element={<IntercityVehicle />} />
              <Route path="user/intercity/details" element={<IntercityDetails />} />
              <Route path="user/intercity/confirm" element={<IntercityConfirm />} />

              <Route path="user/cab-sharing" element={<CabSharing />} />
              <Route path="user/cab" element={<CabHome />} />
              <Route path="user/cab/shared" element={<SharedTaxi />} />
              <Route path="user/cab/shared/seats" element={<SharedTaxiSeats />} />
              <Route path="user/cab/shared/confirm" element={<SharedTaxiConfirm />} />
              <Route path="user/cab/airport" element={<AirportCab />} />
              <Route path="user/cab/airport-confirm" element={<AirportCabConfirm />} />
              <Route path="user/cab/spiritual" element={<SpiritualTrip />} />
              <Route path="user/cab/spiritual-vehicle" element={<SpiritualTripVehicle />} />
              <Route path="user/cab/spiritual-confirm" element={<SpiritualTripConfirm />} />

              <Route path="user/bus" element={<BusHome />} />
              <Route path="user/bus/list" element={<BusList />} />
              <Route path="user/bus/seats" element={<BusSeats />} />
              <Route path="user/bus/details" element={<BusPreview />} />
              <Route path="user/bus/checkout" element={<BusDetails />} />
              <Route path="user/bus/confirm" element={<BusConfirm />} />
              <Route path="user/tours" element={<ComingSoon />} />

              <Route path="user/activity" element={<Activity />} />
              <Route path="user/profile" element={
                <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-slate-50 font-sans pb-28">
                  <UnifiedProfile />
                  <BottomNavbar />
                </div>
              } />
              <Route path="user/wallet" element={<Wallet />} />
              <Route path="user/notifications" element={<UserNotifications />} />
              <Route path="user/promo" element={<PromoCodes />} />
              <Route path="user/referral" element={<UserReferral />} />

              <Route path="user/profile/settings" element={<ProfileSettings />} />
              <Route path="user/profile/payments" element={<PaymentSettings />} />
              <Route path="user/profile/addresses" element={<AddressSettings />} />
              <Route path="user/profile/bus-bookings" element={<BusBookings />} />
              <Route path="user/profile/bus-bookings/:id" element={<BusBookingDetail />} />
              <Route path="user/profile/subscriptions" element={<UserSubscriptions />} />
              <Route path="user/profile/notifications" element={<UserNotifications />} />
              <Route path="user/profile/delete-account" element={<DeleteAccount />} />
              <Route path="user/safety/sos" element={<SOSContacts />} />
              <Route path="user/support/tickets" element={<SupportTickets />} />
              <Route path="user/support/ticket/:id" element={<SupportTicketDetail />} />
            </Route>

            {/* Non-prefixed Fallbacks for Compatibility */}
            <Route path="login" element={<REDIRECT_TO_USER_LOGIN />} />
            <Route path="signup" element={<REDIRECT_TO_USER_LOGIN />} />
            <Route path="onboarding" element={<REDIRECT_TO_USER_LOGIN />} />
            <Route path="verify-otp" element={<REDIRECT_TO_USER_LOGIN />} />
            <Route path="user/*" element={<Navigate to="/taxi/user" replace />} />

            {/* Driver Routes */}
            <Route path="driver" element={<DriverLayout />}>
              <Route index element={<DriverEntryRedirect />} />
              <Route path="login" element={<REDIRECT_TO_DRIVER_LOGIN />} />
              <Route path="terms" element={<LegalPage />} />
              <Route path="privacy" element={<LegalPage />} />
              <Route path="otp-verify" element={<REDIRECT_TO_DRIVER_LOGIN />} />
              <Route path="select-role" element={<REDIRECT_TO_DRIVER_ONBOARDING />} />
              <Route path="step-personal" element={<REDIRECT_TO_DRIVER_ONBOARDING />} />
              <Route path="role-signup" element={<REDIRECT_TO_DRIVER_ONBOARDING />} />
              <Route path="step-referral" element={<REDIRECT_TO_DRIVER_ONBOARDING />} />
              <Route path="step-vehicle" element={<REDIRECT_TO_DRIVER_ONBOARDING />} />
              <Route path="step-documents" element={<REDIRECT_TO_DRIVER_ONBOARDING />} />
              <Route path="registration-status" element={<REDIRECT_TO_DRIVER_HOME />} />
              <Route path="status" element={<ApplicationStatus />} />
              <Route path="home" element={<DriverHome />} />
              <Route path="bus-home" element={<BusDriverHome />} />
              <Route path="bus-home/live-route" element={<BusDriverLiveRoute />} />
              <Route path="pooling" element={<PoolingDriverDashboard />} />
              <Route path="pooling/onboarding" element={<PoolingDriverOnboarding />} />
              <Route path="pooling/status" element={<PoolingDriverPendingStatus />} />
              <Route path="pooling/bookings" element={<PoolingDriverBookings />} />
              <Route path="dashboard" element={<DriverHome />} />
              <Route path="active-trip" element={<ActiveTrip />} />
              <Route path="chat" element={<Chat />} />
              <Route path="wallet" element={<DriverWallet />} />
              <Route path="profile" element={<DriverProfile />} />
              <Route path="profile/bank-details" element={<DriverBankDetailsPage />} />
              <Route path="service-center" element={<ServiceCenterDashboard />} />
              <Route path="service-center/vehicles/new" element={<ServiceCenterVehicleDetails />} />
              <Route path="service-center/vehicles/:vehicleId" element={<ServiceCenterVehicleDetails />} />
              <Route path="history" element={<RideRequests />} />
              <Route path="incentives" element={<DriverIncentives />} />
              <Route path="edit-profile" element={<EditProfile />} />
              <Route path="documents" element={<DriverDocuments />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="payout-methods" element={<PayoutMethods />} />
              <Route path="referral" element={<Referral />} />
              <Route path="delete-account" element={<DriverDeleteAccount />} />
              <Route path="security" element={<SecuritySOS />} />
              <Route path="support" element={<PortalSupportPage />} />
              <Route path="help-support" element={<DriverHelpSupportOptions />} />
              <Route path="support/chat" element={<DriverSupportChat />} />
              <Route path="support/tickets" element={<SupportTickets />} />
              <Route path="support/ticket/:id" element={<SupportTicketDetail />} />
              <Route path="vehicle-fleet" element={<VehicleFleet />} />
              <Route path="vehicle-fleet/edit/:vehicleId" element={<VehicleFleet />} />
              <Route path="add-vehicle" element={<AddVehicle />} />
              <Route path="manage-drivers" element={<ManageDrivers />} />
              <Route path="add-driver" element={<AddDriver />} />
              <Route path="edit-driver/:driverId" element={<AddDriver />} />
            </Route>

            {/* Fleet Owner Routes */}
            <Route path="owner" element={<DriverLayout />}>
              <Route index element={<DriverEntryRedirect />} />
              <Route path="login" element={<Navigate to="/driver/login" replace />} />
              <Route path="terms" element={<LegalPage />} />
              <Route path="privacy" element={<LegalPage />} />
              <Route path="otp-verify" element={<Navigate to="/driver/login" replace />} />
              <Route path="select-role" element={<RoleSelection />} />
              <Route path="step-personal" element={<StepPersonal />} />
              <Route path="role-signup" element={<RoleSpecificOnboarding />} />
              <Route path="step-referral" element={<StepReferral />} />
              <Route path="step-vehicle" element={<StepVehicle />} />
              <Route path="step-documents" element={<StepDocuments />} />
              <Route path="registration-status" element={<RegistrationStatus />} />
              <Route path="status" element={<ApplicationStatus />} />
              <Route path="home" element={<OwnerDashboard />} />
              <Route path="dashboard" element={<OwnerDashboard />} />
              <Route path="bus-service" element={<OwnerBusServicePage />} />
              <Route path="bus-service/create" element={<OwnerBusServicePage />} />
              <Route path="bus-service/edit/:id" element={<OwnerBusServicePage />} />
              <Route path="bus-service/:id" element={<OwnerBusServicePage />} />
              <Route path="bus-bookings" element={<OwnerBusBookingsPage />} />
              <Route path="pooling-vehicles" element={<OwnerPoolingVehicleForm />} />
              <Route path="pooling-vehicles/create" element={<OwnerPoolingVehicleForm />} />
              <Route path="profile" element={<DriverProfile />} />
              <Route path="profile/bank-details" element={<DriverBankDetailsPage />} />
              <Route path="wallet" element={<DriverWallet />} />
              <Route path="history" element={<RideRequests />} />
              <Route path="edit-profile" element={<EditProfile />} />
              <Route path="documents" element={<DriverDocuments />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="payout-methods" element={<PayoutMethods />} />
              <Route path="referral" element={<Referral />} />
              <Route path="delete-account" element={<DriverDeleteAccount />} />
              <Route path="security" element={<SecuritySOS />} />
              <Route path="support" element={<PortalSupportPage />} />
              <Route path="help-support" element={<DriverHelpSupportOptions />} />
              <Route path="support/chat" element={<DriverSupportChat />} />
              <Route path="support/tickets" element={<SupportTickets />} />
              <Route path="support/ticket/:id" element={<SupportTicketDetail />} />
              <Route path="vehicle-fleet" element={<OwnerVehicleFleet />} />
              <Route path="vehicle-fleet/edit/:vehicleId" element={<OwnerVehicleFleet />} />
              <Route path="add-vehicle" element={<AddVehicle />} />
              <Route path="manage-drivers" element={<ManageDrivers />} />
              <Route path="add-driver" element={<AddDriver />} />
              <Route path="edit-driver/:driverId" element={<AddDriver />} />
            </Route>

            {/* Admin Portal Routes */}
            <Route path="admin/login" element={<Navigate to="/admin/login" replace />} />
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="earnings" element={<AdminEarnings />} />
              <Route path="chat" element={<AdminChat />} />
              <Route path="trips" element={<AdminTrips />} />
              <Route path="deliveries" element={<AdminDeliveries />} />
              <Route path="ongoing" element={<AdminOngoing />} />
              <Route path="bus-service" element={<AdminBusServiceManager />} />
              <Route path="bus-service/pending-drivers" element={<AdminPendingBusDrivers />} />
              <Route path="bus-service/create" element={<AdminBusServiceManager mode="create" />} />
              <Route path="bus-service/edit/:id" element={<AdminBusServiceManager mode="edit" />} />
              <Route path="bus-service/commission" element={<AdminBusCommissionManager />} />
              <Route path="bus-service/bookings" element={<AdminBusBookingManager />} />
              <Route path="bus-service/:id" element={<AdminBusServiceDetails />} />
              <Route path="pooling" element={<Navigate to="pooling/routes" replace />} />
              <Route path="pooling/routes" element={<AdminPoolingManager />} />
              <Route path="pooling/pending-drivers" element={<AdminPendingPoolingDrivers />} />
              <Route path="pooling/create" element={<AdminPoolingManager mode="create" />} />
              <Route path="pooling/edit/:id" element={<AdminPoolingManager mode="edit" />} />
              <Route path="pooling/vehicles" element={<AdminPoolingVehicles />} />
              <Route path="pooling/commission" element={<AdminPoolingCommissionManager />} />
              <Route path="pooling/vehicles/create" element={<AdminPoolingVehicleForm />} />
              <Route path="pooling/vehicles/edit/:id" element={<AdminPoolingVehicleForm />} />
              <Route path="pooling/vehicles/view/:id" element={<AdminPoolingVehicleForm mode="view" />} />
              <Route path="pooling/bookings" element={<AdminPoolingBookings />} />
              <Route path="wallet-payment" element={<AdminWalletPayment />} />
              <Route path="users" element={<AdminUserList />} />
              <Route path="users/create" element={<AdminUserCreate />} />
              <Route path="users/:id" element={<AdminUserDetails />} />
              <Route path="users/delete-requests" element={<AdminDeleteRequestUsers />} />
              <Route path="users/bulk-upload" element={<AdminUserBulkUpload />} />
              <Route path="users/subscriptions" element={<AdminUserSubscriptions />} />
              <Route path="users/subscriptions/create" element={<AdminUserSubscriptionCreate />} />
              <Route path="drivers" element={<AdminDriverList />} />
              <Route path="drivers/create" element={<AdminDriverCreate />} />
              <Route path="drivers/pending" element={<AdminPendingDrivers />} />
              <Route path="drivers/subscriptions" element={<AdminDriverSubscriptions />} />
              <Route path="drivers/subscriptions/create" element={<AdminDriverSubscriptionCreate />} />
              <Route path="drivers/ratings" element={<AdminDriverRatings />} />
              <Route path="drivers/ratings/:id" element={<AdminDriverRatingDetail />} />
              <Route path="drivers/wallet" element={<AdminDriverWallet />} />
              <Route path="drivers/negative-balance" element={<AdminNegativeBalanceDrivers />} />
              <Route path="drivers/withdrawals" element={<AdminWithdrawalRequestDrivers />} />
              <Route path="drivers/withdrawals/:id" element={<AdminWithdrawalRequestDetail />} />
              <Route path="drivers/delete-requests" element={<AdminDriverDeleteRequests />} />
              <Route path="drivers/global-documents" element={<AdminGlobalDocuments />} />
              <Route path="drivers/global-documents/create" element={<AdminDriverDocumentForm />} />
              <Route path="drivers/global-documents/edit/:id" element={<AdminDriverDocumentForm />} />
              <Route path="drivers/bulk-upload" element={<AdminDriverBulkUpload />} />
              <Route path="drivers/audit" element={<AdminDriverAudit />} />
              <Route path="drivers/payment-methods" element={<AdminPaymentMethods />} />
              <Route path="drivers/edit/:id" element={<AdminDriverEdit />} />
              <Route path="drivers/:id" element={<AdminDriverDetails />} />
              <Route path="owners" element={<AdminOwnerDashboard />} />
              <Route path="owners/manage" element={<AdminManageOwners />} />
              <Route path="owners/pending" element={<AdminPendingOwners />} />
              <Route path="owners/details/:id" element={<AdminOwnerDetails />} />
              <Route path="owners/create" element={<AdminOwnerCreate />} />
              <Route path="owners/password-update/:id" element={<AdminOwnerPasswordUpdate />} />
              <Route path="owners/needed-documents" element={<AdminOwnerNeededDocuments />} />
              <Route path="owners/needed-documents/create" element={<AdminOwnerNeededDocumentsCreate />} />
              <Route path="owners/needed-documents/edit/:id" element={<AdminOwnerNeededDocumentsCreate />} />
              <Route path="owners/manage-fleet" element={<AdminManageFleet />} />
              <Route path="owners/manage-fleet/create" element={<AdminManageFleetCreate />} />
              <Route path="owners/manage-fleet/edit/:id" element={<AdminManageFleetCreate />} />
              <Route path="owners/fleet-drivers" element={<AdminFleetDrivers />} />
              <Route path="owners/fleet-drivers/create" element={<AdminFleetDriverCreate />} />
              <Route path="owners/fleet-drivers/edit/:id" element={<AdminFleetDriverCreate />} />
              <Route path="owners/blocked-fleet-drivers" element={<AdminBlockedFleetDrivers />} />
              <Route path="owners/fleet-needed-documents" element={<AdminFleetNeededDocuments />} />
              <Route path="owners/fleet-needed-documents/create" element={<AdminFleetNeededDocumentsCreate />} />
              <Route path="owners/fleet-needed-documents/edit/:id" element={<AdminFleetNeededDocumentsCreate />} />
              <Route path="owners/withdrawals" element={<AdminWithdrawalRequestOwners />} />
              <Route path="owners/withdrawals/:id" element={<AdminWithdrawalRequestOwnerDetail />} />
              <Route path="owners/deleted" element={<AdminDeletedOwners />} />
              <Route path="owners/bookings" element={<AdminOwnerBookings />} />
              <Route path="referrals" element={<AdminReferralDashboard />} />
              <Route path="referrals/user-settings" element={<AdminUserReferralSettings />} />
              <Route path="referrals/driver-settings" element={<AdminDriverReferralSettings />} />
              <Route path="referrals/translations" element={<AdminReferralTranslation />} />
              <Route path="promos" element={<AdminPromoCodes />} />
              <Route path="promotions/send-notification" element={<AdminSendNotification />} />
              <Route path="promotions/banner" element={<AdminBannerImage />} />
              <Route path="price-management/service-locations" element={<AdminServiceLocation />} />
              <Route path="price-management/service-stores" element={<AdminServiceStores />} />
              <Route path="price-management/pending-service-stores" element={<AdminPendingServiceStores />} />
              <Route path="price-management/pending-service-staff" element={<AdminPendingServiceStaff />} />
              <Route path="price-management/zones" element={<AdminZoneManagement />} />
              <Route path="price-management/zones/create" element={<AdminZoneManagement mode="create" />} />
              <Route path="price-management/zones/edit/:id" element={<AdminZoneManagement mode="edit" />} />
              <Route path="price-management/airport" element={<AdminAirportManagement />} />
              <Route path="price-management/set-prices" element={<AdminSetPrices />} />
              <Route path="price-management/set-package-prices" element={<AdminSetPackagePrices />} />
              <Route path="price-management/create-package-price" element={<AdminCreatePackagePrice />} />
              <Route path="price-management/driver-incentives" element={<AdminDriverIncentive />} />
              <Route path="price-management/surge-pricing" element={<AdminSurgePricing />} />
              <Route path="price-management/vehicle-types" element={<AdminVehicleType />} />
              <Route path="price-management/vehicle-types/create" element={<AdminVehicleType mode="create" />} />
              <Route path="price-management/vehicle-types/edit/:id" element={<AdminVehicleType mode="edit" />} />
              <Route path="price-management/rental-vehicle-types" element={<AdminRentalVehicleTypes />} />
              <Route path="price-management/rental-commission" element={<AdminRentalCommissionManager />} />
              <Route path="price-management/rental-tracking" element={<AdminRentalTracking />} />
              <Route path="price-management/rental-tracking/:id" element={<AdminRentalTrackingDetail />} />
              <Route path="price-management/rental-bookings" element={<AdminRentalBookingRequests />} />
              <Route path="price-management/rental-quotes" element={<AdminRentalQuoteRequests />} />
              <Route path="price-management/rental-package-types" element={<AdminRentalPackageTypes />} />
              <Route path="price-management/goods-types" element={<AdminGoodsTypes />} />
              <Route path="geo/fencing" element={<AdminGeoFencing />} />
              <Route path="geo/heatmap" element={<AdminHeatMap />} />
              <Route path="geo/godseye" element={<AdminGodsEye />} />
              <Route path="finance" element={<AdminFinance />} />
              <Route path="finance/fare-config" element={<AdminFareConfig />} />
              <Route path="safety" element={<AdminSafetyCenter />} />
              <Route path="cms/builder" element={<AdminCMSBuilder />} />
              <Route path="cms/header-footer" element={<AdminHeaderFooter />} />
              <Route path="settings/global" element={<AdminGlobalSettings />} />
              <Route path="settings/general" element={<AdminGeneralSettings />} />
              <Route path="settings/customization" element={<AdminCustomizationSettings />} />
              <Route path="settings/transport" element={<AdminTransportRideSettings />} />
              <Route path="settings/bid" element={<AdminBidRideSettings />} />
              <Route path="settings/wallet" element={<AdminWalletSettings />} />
              <Route path="settings/tip" element={<AdminTipSettings />} />
              <Route path="settings/app-modules/create" element={<AdminAppModules />} />
              <Route path="settings/app-modules/edit/:id" element={<AdminAppModules />} />
              <Route path="settings/app-modules" element={<AdminAppModules />} />
              <Route path="settings/onboarding" element={<AdminOnboardingScreens />} />
              <Route path="settings/notifications" element={<AdminNotificationChannels />} />
              <Route path="settings/dispatcher" element={<AdminDispatcherAddons />} />
              <Route path="masters/countries" element={<AdminCountryManagement />} />
              <Route path="support/ticket-title" element={<AdminSupportTicketTitle />} />
              <Route path="support/tickets" element={<AdminSupportTickets />} />
              <Route path="reports/users" element={<AdminUserReport />} />
              <Route path="reports/drivers" element={<AdminDriverReport />} />
              <Route path="reports/driver-duty" element={<AdminDriverDutyReport />} />
              <Route path="reports/owners" element={<AdminOwnerReport />} />
              <Route path="reports/finance" element={<AdminFinanceReport />} />
              <Route path="reports/fleet-finance" element={<AdminFleetFinanceReport />} />
              <Route path="masters/languages" element={<AdminLanguages />} />
              <Route path="masters/preferences" element={<AdminPreferences />} />
              <Route path="management/admins" element={<AdminAdmins />} />
              <Route path="management/admins/create" element={<AdminAdminCreate />} />
            </Route>

            {/* Wildcard fallback to Landing */}
            <Route path="*" element={<LandingPage />} />
          </Routes>
        </Suspense>
      </MainLayout>
    </SettingsProvider>
  );
}
