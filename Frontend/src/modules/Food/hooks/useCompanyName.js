import { useState, useEffect } from 'react';
import { loadBusinessSettings, getCachedSettings, getCompanyName } from '@food/utils/businessSettings';

/**
 * Custom hook to get company name from business settings
 * @returns {string} Company name with fallback to "Foodelo Food"
 */
export const useCompanyName = () => {
  const [companyName, setCompanyName] = useState(() => {
    // Initialize with cached value if available
    const cached = getCachedSettings();
    return cached?.companyName || 'Foodelo Food';
  });

  useEffect(() => {
    const loadCompanyName = async () => {
      try {
        const cached = getCachedSettings();
        if (cached?.companyName) {
          setCompanyName(cached.companyName);
          return;
        }
        const settings = await loadBusinessSettings();
        if (settings?.companyName) {
          setCompanyName(settings.companyName);
        }
      } catch (error) {
        console.warn('Failed to load company name:', error);
      }
    };

    loadCompanyName();

    // Listen for business settings updates
    const handleSettingsUpdate = () => {
      const updated = getCachedSettings();
      if (updated?.companyName) {
        setCompanyName(updated.companyName);
      }
    };

    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate);
    };
  }, []);

  return companyName;
};
