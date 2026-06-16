import { useState, useEffect } from 'react';
import { publicGetOnce } from '@food/api';

const CACHE_KEY = 'food_landing_settings_public';
const TTL_MS = 5 * 60 * 1000;

let cachedSettings = null;
let lastFetchedAt = 0;
let inFlightPromise = null;

function readStorage() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

if (!cachedSettings) {
  cachedSettings = readStorage();
}

export function getCachedLandingSettings() {
  return cachedSettings || readStorage();
}

export async function loadLandingSettings(options = {}) {
  const { forceRefresh = false } = options;

  const isFresh =
    !forceRefresh &&
    cachedSettings &&
    lastFetchedAt > 0 &&
    Date.now() - lastFetchedAt < TTL_MS;

  if (isFresh) {
    return cachedSettings;
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = publicGetOnce('/food/landing/settings/public')
    .then((res) => {
      const settings = res?.data?.data || {};
      cachedSettings = settings;
      lastFetchedAt = Date.now();
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
      } catch {
        /* ignore */
      }
      return settings;
    })
    .catch(() => cachedSettings || {})
    .finally(() => {
      inFlightPromise = null;
    });

  return inFlightPromise;
}

/**
 * Shared landing-page public settings (deduped across navbars and Home).
 */
export function useLandingSettings() {
  const [settings, setSettings] = useState(() => getCachedLandingSettings() || {});

  useEffect(() => {
    let cancelled = false;

    const apply = (next) => {
      if (!cancelled && next && typeof next === 'object') {
        setSettings(next);
      }
    };

    const cached = getCachedLandingSettings();
    if (cached) {
      apply(cached);
    }

    loadLandingSettings().then(apply);

    return () => {
      cancelled = true;
    };
  }, []);

  const under250PriceLimit = Number(settings?.under250PriceLimit) || 250;

  return {
    settings,
    under250PriceLimit,
    loading: !settings || Object.keys(settings).length === 0,
  };
}

export default useLandingSettings;
