import { useEffect, useState } from 'react';
import {
  getModuleToken,
  getModuleRefreshToken,
  isTokenExpired,
} from '@food/utils/auth';
import { refreshModuleAccessToken } from '@food/api/axios';
import Loader from './Loader';

const AUTH_MODULES = ['user', 'restaurant', 'delivery', 'admin'];

/**
 * AuthInitializer - Recovers auth state from localStorage on app initialization.
 * Silently refreshes expired access tokens when a refresh token is still valid,
 * so restaurant/delivery sessions survive app close without forcing login again.
 */
export default function AuthInitializer({ children }) {
  const [isRehydrating, setIsRehydrating] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      try {
        await Promise.all(
          AUTH_MODULES.map(async (module) => {
            const accessToken = getModuleToken(module);
            const refreshToken = getModuleRefreshToken(module);

            if (accessToken && !isTokenExpired(accessToken)) {
              return;
            }

            if (!refreshToken) {
              return;
            }

            // Access missing/expired but refresh present → renew before routes render
            await refreshModuleAccessToken(module);
          }),
        );
      } catch (error) {
        console.warn('Auth initialization error:', error);
      } finally {
        if (!cancelled) {
          setIsRehydrating(false);
        }
      }
    };

    const timer = setTimeout(initializeAuth, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (isRehydrating) {
    return <Loader />;
  }

  return children;
}
