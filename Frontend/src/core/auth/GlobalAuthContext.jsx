import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import axios from 'axios';

// Unified Context for the entire Buddy Service ecosystem
const GlobalAuthContext = createContext(undefined);

// Standardized storage keys
export const AUTH_KEYS = {
    TOKEN: 'buddy_auth_token',
    USER: 'buddy_user_profile',
    ROLE: 'buddy_user_role'
};

// Legacy keys for bridging
const LEGACY_KEYS = {
    FOOD_USER: 'user_accessToken',
    QC_CUSTOMER: 'auth_customer',
    ADMIN: 'admin_accessToken',
    QC_ADMIN: 'auth_admin'
};

export const GlobalAuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => {
        // Initialization: Check for unified token first
        const unifiedToken = localStorage.getItem(AUTH_KEYS.TOKEN);
        if (unifiedToken) return unifiedToken;

        // Bridge: Fallback to module-specific tokens
        const foodToken = localStorage.getItem(LEGACY_KEYS.FOOD_USER);
        const qcToken = localStorage.getItem(LEGACY_KEYS.QC_CUSTOMER);
        const adminToken = localStorage.getItem(LEGACY_KEYS.ADMIN) || localStorage.getItem(LEGACY_KEYS.QC_ADMIN);

        const foundToken = foodToken || qcToken || adminToken;
        if (foundToken) {
            localStorage.setItem(AUTH_KEYS.TOKEN, foundToken);
        }
        return foundToken;
    });

    const [user, setUser] = useState(() => {
        try {
            const storedUser = localStorage.getItem(AUTH_KEYS.USER);
            if (!storedUser || storedUser === 'undefined') return null;
            return JSON.parse(storedUser);
        } catch (e) {
            console.error('Failed to parse global user:', e);
            return null;
        }
    });

    const [isLoading, setIsLoading] = useState(true);

    const isAuthenticated = !!token;

    // Sync profile on mount or token change
    useEffect(() => {
        const fetchProfile = async () => {
            if (!token) {
                setUser(null);
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                // We attempt to fetch from QC first as it has a robust profile endpoint, 
                // but this would be unified on the backend later.
                const response = await axios.get('/api/qc/customer/profile', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                const profile = response.data.result;
                setUser(profile);
                localStorage.setItem(AUTH_KEYS.USER, JSON.stringify(profile));
            } catch (error) {
                console.error('Global profile fetch failed:', error);
                // If token is invalid, we might want to logout, but we'll be cautious
                if (error.response?.status === 401) {
                    logout();
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [token]);

    const login = (data) => {
        const { token, user } = data;
        if (!token) return;

        setToken(token);
        setUser(user || null);
        localStorage.setItem(AUTH_KEYS.TOKEN, token);
        if (user) {
            localStorage.setItem(AUTH_KEYS.USER, JSON.stringify(user));
        } else {
            localStorage.removeItem(AUTH_KEYS.USER);
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        Object.values(AUTH_KEYS).forEach(key => localStorage.removeItem(key));
        // Also clear legacy keys to ensure clean logout
        Object.values(LEGACY_KEYS).forEach(key => localStorage.removeItem(key));
    };

    const value = useMemo(() => ({
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        logout,
        updateUser: (newData) => setUser(prev => ({ ...prev, ...newData }))
    }), [user, token, isAuthenticated, isLoading]);

    return (
        <GlobalAuthContext.Provider value={value}>
            {children}
        </GlobalAuthContext.Provider>
    );
};

export const useGlobalAuth = () => {
    const context = useContext(GlobalAuthContext);
    if (context === undefined) {
        throw new Error('useGlobalAuth must be used within a GlobalAuthProvider');
    }
    return context;
};
