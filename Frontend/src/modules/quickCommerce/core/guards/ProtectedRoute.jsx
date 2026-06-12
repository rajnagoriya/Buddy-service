import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        if (location.pathname.includes('/admin')) {
            return <Navigate to="/qc/admin/auth" state={{ from: location }} replace />;
        }
        if (location.pathname.includes('/seller')) {
            return <Navigate to="/qc/seller/auth" state={{ from: location }} replace />;
        }
        if (location.pathname.includes('/delivery')) {
            return <Navigate to="/qc/delivery/auth" state={{ from: location }} replace />;
        }
        return <Navigate to="/user/auth/login" state={{ from: location }} replace />;
    }

    if (location.pathname.startsWith('/seller')) {
        const applicationStatus =
            user?.applicationStatus || (user?.isVerified ? 'approved' : 'pending');
        const isApprovedSeller =
            Boolean(user) &&
            user.isVerified === true &&
            user.isActive === true &&
            applicationStatus === 'approved';

        if (!isApprovedSeller) {
            return (
                <Navigate
                    to="/seller/pending-approval"
                    state={{
                        approvalRequired: true,
                        applicationStatus,
                        rejectionReason: user?.rejectionReason || '',
                    }}
                    replace
                />
            );
        }
    }

    return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
