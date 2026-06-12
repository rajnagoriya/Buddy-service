import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';

// Providers
import { AuthProvider } from './core/context/AuthContext';
import { SettingsProvider } from './core/context/SettingsContext';
import { SupportUnreadProvider } from './core/context/SupportUnreadContext';
import { ToastProvider } from './shared/components/ui/Toast';
import { WishlistProvider } from './modules/customer/context/WishlistContext';
import { CartProvider } from './modules/customer/context/CartContext';
import { CartAnimationProvider } from './modules/customer/context/CartAnimationContext';
import { ProductDetailProvider } from './modules/customer/context/ProductDetailContext';
import { LocationProvider } from './modules/customer/context/LocationContext';

// Guards
import ProtectedRoute from './core/guards/ProtectedRoute';
import RoleGuard from './core/guards/RoleGuard';
import { UserRole } from './core/constants/roles';

// Layout
import CustomerLayout from './modules/customer/components/layout/CustomerLayout';
import ScrollToTop from './modules/customer/components/shared/ScrollToTop';

// CSS
import './styles/qc-global.css';

// Lazy load modules
const CustomerAuth = lazy(() => import('./modules/customer/pages/CustomerAuth'));
const Auth = lazy(() => import('./modules/seller/pages/Auth'));
const ApplicationPending = lazy(() => import('./modules/seller/pages/ApplicationPending'));
const AdminAuth = lazy(() => import('./modules/admin/pages/AdminAuth'));
const DeliveryAuth = lazy(() => import('./modules/delivery/pages/DeliveryAuth'));

// Customer Pages
const Home = lazy(() => import('./modules/customer/pages/Home'));
const CategoriesPage = lazy(() => import('./modules/customer/pages/CategoriesPage'));
const CategoryProductsPage = lazy(() => import('./modules/customer/pages/CategoryProductsPage'));
const ProductDetailPage = lazy(() => import('./modules/customer/pages/ProductDetailPage'));
const CartPage = lazy(() => import('./modules/customer/pages/CartPage'));
const CheckoutPage = lazy(() => import('./modules/customer/pages/CheckoutPage'));
const OrdersPage = lazy(() => import('./modules/customer/pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('./modules/customer/pages/OrderDetailPage'));
const ProfilePage = lazy(() => import('./modules/customer/pages/ProfilePage'));
const WishlistPage = lazy(() => import('./modules/customer/pages/WishlistPage'));
const SearchPage = lazy(() => import('./modules/customer/pages/SearchPage'));
const AddressesPage = lazy(() => import('./modules/customer/pages/AddressesPage'));
const WalletPage = lazy(() => import('./modules/customer/pages/WalletPage'));
const SupportPage = lazy(() => import('./modules/customer/pages/SupportPage'));
const PrivacyPage = lazy(() => import('./modules/customer/pages/PrivacyPage'));
const TermsPage = lazy(() => import('./modules/customer/pages/TermsPage'));
const AboutPage = lazy(() => import('./modules/customer/pages/AboutPage'));
const OrderTransactionsPage = lazy(() => import('./modules/customer/pages/OrderTransactionsPage'));
const PaymentStatusPage = lazy(() => import('./modules/customer/pages/PaymentStatusPage'));
const EditProfilePage = lazy(() => import('./modules/customer/pages/EditProfilePage'));
const ShopByStorePage = lazy(() => import('./modules/customer/pages/ShopByStorePage'));
const ChatPage = lazy(() => import('./modules/customer/pages/ChatPage'));

// Module Routes
const SellerModule = lazy(() => import('./modules/seller/routes/index'));
const AdminModule = lazy(() => import('./modules/admin/routes/index'));
const DeliveryModule = lazy(() => import('./modules/delivery/routes/index'));

const CustomerLayoutWrapper = () => (
    <LocationProvider>
        <WishlistProvider>
            <CartProvider>
                <CartAnimationProvider>
                    <ProductDetailProvider>
                        <ScrollToTop />
                        <CustomerLayout>
                            <Suspense fallback={<div className="flex h-screen items-center justify-center text-primary font-bold">Loading QC...</div>}>
                                <Outlet />
                            </Suspense>
                        </CustomerLayout>
                    </ProductDetailProvider>
                </CartAnimationProvider>
            </CartProvider>
        </WishlistProvider>
    </LocationProvider>
);

const QuickCommerceModule = () => {
    return (
        <AuthProvider>
            <SettingsProvider>
                <SupportUnreadProvider>
                    <ToastProvider>
                        <div className="qc-module-root font-sans antialiased text-slate-900">
                            <Routes>
                                {/* Customer Routes */}
                                <Route element={<CustomerLayoutWrapper />}>
                                    <Route index element={<Home />} />
                                    <Route path="categories" element={<CategoriesPage />} />
                                    <Route path="category/:categoryName" element={<CategoryProductsPage />} />
                                    <Route path="product/:id" element={<ProductDetailPage />} />
                                    <Route path="search" element={<SearchPage />} />
                                    <Route path="store/:slug" element={<ShopByStorePage />} />
                                    
                                    {/* Auth required customer routes */}
                                    <Route element={<ProtectedRoute />}>
                                        <Route path="cart" element={<CartPage />} />
                                        <Route path="checkout" element={<CheckoutPage />} />
                                        <Route path="orders" element={<OrdersPage />} />
                                        <Route path="orders/:orderId" element={<OrderDetailPage />} />
                                        <Route path="transactions" element={<OrderTransactionsPage />} />
                                        <Route path="profile" element={<Navigate to="/food/user/profile" replace />} />
                                        <Route path="profile/edit" element={<Navigate to="/food/user/profile" replace />} />
                                        <Route path="wishlist" element={<WishlistPage />} />
                                        <Route path="addresses" element={<AddressesPage />} />
                                        <Route path="wallet" element={<WalletPage />} />
                                        <Route path="support" element={<SupportPage />} />
                                        <Route path="chat" element={<ChatPage />} />
                                        <Route path="payment-status" element={<PaymentStatusPage />} />
                                    </Route>
                                </Route>

                                {/* Public Pages */}
                                <Route path="login" element={<CustomerAuth />} />
                                <Route path="privacy" element={<PrivacyPage />} />
                                <Route path="terms" element={<TermsPage />} />
                                <Route path="about" element={<AboutPage />} />

                                {/* Auth Portals */}
                                <Route path="seller/auth" element={<Auth />} />
                                <Route path="seller/pending-approval" element={<ApplicationPending />} />
                                <Route path="admin/auth" element={<AdminAuth />} />
                                <Route path="delivery/auth" element={<DeliveryAuth />} />

                                {/* Protected Portals */}
                                <Route path="seller/*" element={
                                    <ProtectedRoute>
                                        <RoleGuard allowedRoles={[UserRole.SELLER]}>
                                            <SellerModule />
                                        </RoleGuard>
                                    </ProtectedRoute>
                                } />
                                <Route path="admin/*" element={
                                    <ProtectedRoute>
                                        <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                                            <AdminModule />
                                        </RoleGuard>
                                    </ProtectedRoute>
                                } />
                                <Route path="delivery/*" element={
                                    <ProtectedRoute>
                                        <RoleGuard allowedRoles={[UserRole.DELIVERY_BOY]}>
                                            <DeliveryModule />
                                        </RoleGuard>
                                    </ProtectedRoute>
                                } />

                                <Route path="*" element={<Navigate to="./" replace />} />
                            </Routes>
                        </div>
                    </ToastProvider>
                </SupportUnreadProvider>
            </SettingsProvider>
        </AuthProvider>
    );
};

export default QuickCommerceModule;
