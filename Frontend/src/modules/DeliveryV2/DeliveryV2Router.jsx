import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Loader from "@food/components/Loader";
import { deliveryAPI } from '@food/api';

// Import Taxi Providers & Components
import { SettingsProvider } from '../taxi/shared_core/context/SettingsContext';
import DriverLayout from '../taxi/driver/components/DriverLayout';

// Auth Pages (Lazy loaded)
const Welcome = lazy(() => import("./pages/auth/Welcome"))
const SignIn = lazy(() => import("./pages/auth/SignIn"))
const OTP = lazy(() => import("./pages/auth/OTP"))
const SignupStep1 = lazy(() => import("./pages/auth/SignupStep1"))
const SignupStep2 = lazy(() => import("./pages/auth/SignupStep2"))

// V2 Pages
import DeliveryHomeV2 from './pages/DeliveryHomeV2';
import { PayoutV2 } from './pages/pocket/PayoutV2';
import { PocketStatementV2 } from './pages/pocket/PocketStatementV2';
import { DeductionStatementV2 } from './pages/pocket/DeductionStatementV2';
import { LimitSettlementV2 } from './pages/pocket/LimitSettlementV2';
import { PocketBalanceV2 } from './pages/pocket/PocketBalanceV2';
import { CashLimitInfoV2 } from './pages/pocket/CashLimitInfoV2';
import { ProfileBankV2 } from './pages/profile/ProfileBankV2';
import { ProfileDocsV2 } from './pages/profile/ProfileDocsV2';
import { SupportTicketsV2 } from './pages/help/SupportTicketsV2';
import { CreateSupportTicketV2 } from './pages/help/CreateSupportTicketV2';
import { ViewSupportTicketV2 } from './pages/help/ViewSupportTicketV2';
import ShowIdCardV2 from './pages/help/ShowIdCardV2';
import { PocketDetailsV2 } from './pages/pocket/PocketDetailsV2';
import { ProfileDetailsV2 } from './pages/profile/ProfileDetailsV2';
import TermsAndConditionsV2 from './pages/TermsAndConditionsV2';
import PrivacyPolicyV2 from './pages/PrivacyPolicyV2';
import NotificationsV2 from './pages/NotificationsV2';

// Taxi Driver Pages (Lazy loaded to avoid duplication)
const PhoneRegistration = lazy(() => import("../taxi/driver/pages/registration/PhoneRegistration"));
const OTPVerification = lazy(() => import("../taxi/driver/pages/registration/OTPVerification"));
const RoleSelection = lazy(() => import("../taxi/driver/pages/registration/RoleSelection"));
const RegistrationStatus = lazy(() => import("../taxi/driver/pages/registration/RegistrationStatus"));
const StepPersonal = lazy(() => import("../taxi/driver/pages/registration/StepPersonal"));
const StepReferral = lazy(() => import("../taxi/driver/pages/registration/StepReferral"));
const StepVehicle = lazy(() => import("../taxi/driver/pages/registration/StepVehicle"));
const StepDocuments = lazy(() => import("../taxi/driver/pages/registration/StepDocuments"));
const RoleSpecificOnboarding = lazy(() => import("../taxi/driver/pages/registration/RoleSpecificOnboarding"));
const ApplicationStatus = lazy(() => import("../taxi/driver/pages/registration/ApplicationStatus"));
const DriverHome = lazy(() => import("../taxi/driver/pages/DriverHome"));
const OwnerDashboard = lazy(() => import("../taxi/driver/pages/OwnerDashboard"));
const OwnerBusServicePage = lazy(() => import("../taxi/driver/pages/OwnerBusServicePage"));
const OwnerBusBookingsPage = lazy(() => import("../taxi/driver/pages/OwnerBusBookingsPage"));
const OwnerPoolingVehicleForm = lazy(() => import("../taxi/driver/pages/OwnerPoolingVehicleForm"));
const ActiveTrip = lazy(() => import("../taxi/driver/pages/ActiveTrip"));
const DriverWallet = lazy(() => import("../taxi/driver/pages/DriverWallet"));
const DriverProfile = lazy(() => import("../taxi/driver/pages/DriverProfile"));
const DriverBankDetailsPage = lazy(() => import("../taxi/driver/pages/DriverBankDetailsPage"));
const ServiceCenterDashboard = lazy(() => import("../taxi/driver/pages/ServiceCenterDashboard"));
const ServiceCenterVehicleDetails = lazy(() => import("../taxi/driver/pages/ServiceCenterVehicleDetails"));
const RideRequests = lazy(() => import("../taxi/driver/pages/RideRequests"));
const DriverIncentives = lazy(() => import("../taxi/driver/pages/DriverIncentives"));
const BusDriverHome = lazy(() => import("../taxi/driver/pages/BusDriverHome"));
const BusDriverLiveRoute = lazy(() => import("../taxi/driver/pages/BusDriverLiveRoute"));
const PoolingDriverDashboard = lazy(() => import("../taxi/driver/pages/PoolingDriverDashboard"));
const PoolingDriverOnboarding = lazy(() => import("../taxi/driver/pages/pooling/PoolingDriverOnboarding"));
const PoolingDriverPendingStatus = lazy(() => import("../taxi/driver/pages/pooling/PoolingDriverPendingStatus"));
const PoolingDriverBookings = lazy(() => import("../taxi/driver/pages/pooling/PoolingDriverBookings"));
const PortalSupportPage = lazy(() => import("../taxi/driver/pages/PortalSupportPage"));
const EditProfile = lazy(() => import("../taxi/driver/pages/settings/EditProfile"));
const DriverDocuments = lazy(() => import("../taxi/driver/pages/settings/DriverDocuments"));
const Notifications = lazy(() => import("../taxi/driver/pages/settings/Notifications"));
const PayoutMethods = lazy(() => import("../taxi/driver/pages/settings/PayoutMethods"));
const Referral = lazy(() => import("../taxi/driver/pages/settings/Referral"));
const DriverDeleteAccount = lazy(() => import("../taxi/driver/pages/settings/DeleteAccount"));
const SecuritySOS = lazy(() => import("../taxi/driver/pages/settings/SecuritySOS"));
const DriverSupport = lazy(() => import("../taxi/driver/pages/settings/Support"));
const DriverHelpSupportOptions = lazy(() => import("../taxi/driver/pages/settings/HelpSupportOptions"));
const DriverSupportChat = lazy(() => import("../taxi/driver/pages/settings/SupportChat"));
const VehicleFleet = lazy(() => import("../taxi/driver/pages/settings/VehicleFleet"));
const OwnerVehicleFleet = lazy(() => import("../taxi/driver/pages/settings/OwnerVehicleFleet"));
const AddVehicle = lazy(() => import("../taxi/driver/pages/settings/AddVehicle"));
const ManageDrivers = lazy(() => import("../taxi/driver/pages/settings/ManageDrivers"));
const AddDriver = lazy(() => import("../taxi/driver/pages/settings/AddDriver"));
const LegalPage = lazy(() => import("../taxi/shared/pages/LegalPage"));

// Helper functions from Taxi module
const getLocalDriverToken = () => {
  return localStorage.getItem('driverToken') || localStorage.getItem('taxiDriverToken');
};
const getAuthenticatedDriverRole = () => {
  try {
    const driverInfo = localStorage.getItem('driverInfo');
    if (driverInfo) {
      const parsed = JSON.parse(driverInfo);
      console.log("DeliveryV2Router getAuthenticatedDriverRole driverInfo.role:", parsed.role);
      return parsed.role || 'driver';
    }
  } catch {}
  console.log("localStorage role", localStorage.getItem("role"));
  console.log("localStorage driverRole", localStorage.getItem("driverRole"));
  return 'driver';
};
const getTaxiDashboardPath = (role) => {
  if (role === 'owner') return '/food/delivery/taxi/owner-dashboard';
  if (role === 'service_center' || role === 'service_center_staff') {
    return '/food/delivery/taxi/service-center';
  }
  if (role === 'bus_driver') return '/food/delivery/taxi/bus-home';
  if (role === 'pooling_driver') return '/food/delivery/taxi/pooling';
  return '/food/delivery/taxi/home';
};

const DriverEntryRedirect = () => {
  const [driverToken, setDriverToken] = useState(() => getLocalDriverToken());
  const [isBootstrapping, setIsBootstrapping] = useState(() => {
    const deliveryAccessToken = localStorage.getItem('delivery_accessToken');
    return Boolean(deliveryAccessToken) && !getLocalDriverToken();
  });
  const [bootstrapError, setBootstrapError] = useState(false);
  const role = String(getAuthenticatedDriverRole() || 'driver').toLowerCase();

  useEffect(() => {
    const deliveryAccessToken = localStorage.getItem('delivery_accessToken');
    const existingDriverToken = getLocalDriverToken();

    if (existingDriverToken) {
      setDriverToken(existingDriverToken);
      setIsBootstrapping(false);
      return;
    }

    if (!deliveryAccessToken) {
      setIsBootstrapping(false);
      return;
    }

    let cancelled = false;

    const checkOrCreateTaxiProfile = () => {
      deliveryAPI.createTaxiProfile()
        .then((response) => {
          if (cancelled) return;

          const token =
            response?.data?.data?.token ||
            response?.data?.token ||
            null;

          if (!token) {
            setBootstrapError(true);
            setIsBootstrapping(false);
            return;
          }

          localStorage.setItem('driverToken', token);
          setDriverToken(token);
          setIsBootstrapping(false);
        })
        .catch(() => {
          if (cancelled) return;
          setBootstrapError(true);
          setIsBootstrapping(false);
        });
    };

    checkOrCreateTaxiProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    console.log("ENTRY_ROLE", role);
    if (driverToken) {
      import('../taxi/driver/services/registrationService').then(({ getCurrentDriver }) => {
        getCurrentDriver()
          .then((response) => {
            const data = response?.data?.data || response?.data || response;
            console.log("ME_RESPONSE", data);
          })
          .catch((err) => {
            console.error("ME_RESPONSE error", err);
          });
      });
    }
  }, [driverToken, role]);

  if (isBootstrapping) {
    return <div className="min-h-screen flex items-center justify-center bg-white">Loading Taxi Session...</div>;
  }

  if (!driverToken) {
    return <Navigate to="/food/delivery/taxi/login" replace />;
  }

  return (
    <Navigate
      to={
        role === 'owner'
          ? '/food/delivery/taxi/owner-dashboard'
          : role === 'service_center' || role === 'service_center_staff'
            ? '/food/delivery/taxi/service-center'
            : role === 'bus_driver'
              ? '/food/delivery/taxi/bus-home'
              : role === 'pooling_driver'
                ? '/food/delivery/taxi/pooling'
                : '/food/delivery/taxi/home'
      }
      replace
    />
  );
};

const DeliveryV2Router = () => {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Auth routes */}
        <Route path="welcome" element={<Welcome />} />
        <Route path="login" element={<SignIn />} />
        <Route path="otp" element={<OTP />} />
        <Route path="signup" element={<Navigate to="/food/delivery/login" replace />} />
        <Route path="signup/details" element={<SignupStep1 />} />
        <Route path="signup/documents" element={<SignupStep2 />} />
        <Route path="terms" element={<TermsAndConditionsV2 />} />

        {/* Protected Core Routes */}
        <Route path="/" element={<ProtectedRoute><DeliveryHomeV2 tab="feed" /></ProtectedRoute>} />
        <Route path="/feed" element={<ProtectedRoute><DeliveryHomeV2 tab="feed" /></ProtectedRoute>} />
        <Route path="/pocket" element={<ProtectedRoute><DeliveryHomeV2 tab="pocket" /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><DeliveryHomeV2 tab="history" /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><DeliveryHomeV2 tab="profile" /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsV2 /></ProtectedRoute>} />
        <Route path="/profile/details" element={<ProtectedRoute><ProfileDetailsV2 /></ProtectedRoute>} />
        <Route path="/profile/bank" element={<ProtectedRoute><ProfileBankV2 /></ProtectedRoute>} />
        <Route path="/profile/documents" element={<ProtectedRoute><ProfileDocsV2 /></ProtectedRoute>} />
        
        {/* Support Systems */}
        <Route path="/help/tickets" element={<ProtectedRoute><SupportTicketsV2 /></ProtectedRoute>} />
        <Route path="/help/tickets/create" element={<ProtectedRoute><CreateSupportTicketV2 /></ProtectedRoute>} />
        <Route path="/help/tickets/:ticketId" element={<ProtectedRoute><ViewSupportTicketV2 /></ProtectedRoute>} />
        <Route path="/help/id-card" element={<ProtectedRoute><ShowIdCardV2 /></ProtectedRoute>} />
        <Route path="/profile/terms" element={<ProtectedRoute><TermsAndConditionsV2 /></ProtectedRoute>} />
        <Route path="/profile/privacy" element={<ProtectedRoute><PrivacyPolicyV2 /></ProtectedRoute>} />
        
        {/* Financial Deep-Pages */}
        <Route path="/pocket/payout" element={<ProtectedRoute><PayoutV2 /></ProtectedRoute>} />
        <Route path="/pocket/statement" element={<ProtectedRoute><PocketStatementV2 /></ProtectedRoute>} />
        <Route path="/pocket/deductions" element={<ProtectedRoute><DeductionStatementV2 /></ProtectedRoute>} />
        <Route path="/pocket/limit-settlement" element={<ProtectedRoute><LimitSettlementV2 /></ProtectedRoute>} />
        <Route path="/pocket/balance" element={<ProtectedRoute><PocketBalanceV2 /></ProtectedRoute>} />
        <Route path="/pocket/cash-limit" element={<ProtectedRoute><CashLimitInfoV2 /></ProtectedRoute>} />
        <Route path="/pocket/details" element={<ProtectedRoute><PocketDetailsV2 /></ProtectedRoute>} />

        <Route path="/taxi" element={
          <ProtectedRoute>
            <SettingsProvider>
              <DriverLayout />
            </SettingsProvider>
          </ProtectedRoute>
        }>
          <Route index element={<DriverEntryRedirect />} />
          <Route path="login" element={<PhoneRegistration />} />
          <Route path="terms" element={<LegalPage />} />
          <Route path="privacy" element={<LegalPage />} />
          <Route path="otp-verify" element={<OTPVerification />} />
          <Route path="select-role" element={<RoleSelection />} />
          <Route path="step-personal" element={<StepPersonal />} />
          <Route path="role-signup" element={<RoleSpecificOnboarding />} />
          <Route path="step-referral" element={<StepReferral />} />
          <Route path="step-vehicle" element={<StepVehicle />} />
          <Route path="step-documents" element={<StepDocuments />} />
          <Route path="registration-status" element={<RegistrationStatus />} />
          <Route path="status" element={<ApplicationStatus />} />
          <Route path="home" element={<DriverHome />} />
          <Route path="bus-home" element={<BusDriverHome />} />
          <Route path="bus-home/live-route" element={<BusDriverLiveRoute />} />
          <Route path="pooling" element={<PoolingDriverDashboard />} />
          <Route path="pooling/onboarding" element={<PoolingDriverOnboarding />} />
          <Route path="pooling/status" element={<PoolingDriverPendingStatus />} />
          <Route path="pooling/bookings" element={<PoolingDriverBookings />} />
          <Route path="owner-dashboard" element={<OwnerDashboard />} />
          <Route path="active-trip" element={<ActiveTrip />} />
          <Route path="wallet" element={<DriverWallet />} />
          <Route path="profile" element={<DriverProfile />} />
          <Route path="profile/bank-details" element={<DriverBankDetailsPage />} />
          <Route path="service-center" element={<ServiceCenterDashboard />} />
          <Route path="service-center/vehicles/new" element={<ServiceCenterVehicleDetails />} />
          <Route path="service-center/vehicles/:vehicleId" element={<ServiceCenterVehicleDetails />} />
          <Route path="history" element={<RideRequests />} />
          <Route path="incentives" element={<DriverIncentives />} />
          <Route path="support" element={<PortalSupportPage />} />
          <Route path="settings/profile" element={<EditProfile />} />
          <Route path="settings/documents" element={<DriverDocuments />} />
          <Route path="settings/notifications" element={<Notifications />} />
          <Route path="settings/payouts" element={<PayoutMethods />} />
          <Route path="settings/referral" element={<Referral />} />
          <Route path="settings/delete-account" element={<DriverDeleteAccount />} />
          <Route path="settings/sos" element={<SecuritySOS />} />
          <Route path="settings/support" element={<DriverSupport />} />
          <Route path="settings/support-options" element={<DriverHelpSupportOptions />} />
          <Route path="settings/support-chat" element={<DriverSupportChat />} />
          <Route path="settings/vehicles" element={<VehicleFleet />} />
          <Route path="settings/owner-vehicles" element={<OwnerVehicleFleet />} />
          <Route path="settings/vehicles/add" element={<AddVehicle />} />
          <Route path="settings/drivers" element={<ManageDrivers />} />
          <Route path="settings/drivers/add" element={<AddDriver />} />
          <Route path="owner/bus-service" element={<OwnerBusServicePage />} />
          <Route path="owner/bus-bookings" element={<OwnerBusBookingsPage />} />
          <Route path="owner/pooling-vehicle" element={<OwnerPoolingVehicleForm />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/food/delivery" replace />} />
      </Routes>
    </Suspense>
  );
};

export default DeliveryV2Router;
