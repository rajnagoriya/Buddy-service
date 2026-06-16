import { useState, useEffect } from 'react';
import { getCachedSettings, loadBusinessSettings } from '@food/utils/businessSettings';

/**
 * Shared hook for business branding (logo URL, company name).
 * Uses cache first; fetches at most once per TTL window across the app.
 */
export function useBusinessSettings() {
  const [settings, setSettings] = useState(() => getCachedSettings());

  useEffect(() => {
    let cancelled = false;

    const applySettings = (next) => {
      if (!cancelled && next) {
        setSettings(next);
      }
    };

    const cached = getCachedSettings();
    if (cached) {
      applySettings(cached);
    } else {
      loadBusinessSettings().then(applySettings);
    }

    const handleSettingsUpdate = () => {
      applySettings(getCachedSettings());
    };

    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate);
    };
  }, []);

  return {
    settings,
    logoUrl: settings?.logo?.url || null,
    companyName: settings?.companyName || null,
  };
}

export default useBusinessSettings;
