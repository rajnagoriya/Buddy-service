/**
 * Business Settings Utility
 * Handles loading and updating business settings (favicon, title, logo)
 */

import apiClient from "@food/api/axios";
import { API_ENDPOINTS } from "@food/api/config";
import { getPublicBusinessSettingsOnce, invalidatePublicBusinessSettingsCache } from "@food/api";

const SETTINGS_KEY = 'food_business_settings';

// Initialize from localStorage immediately so it's available for components on mount
let cachedSettings = (() => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
})();

// Apply cached settings immediately on module load if they exist
if (cachedSettings) {
  setTimeout(() => {
    updateFavicon(cachedSettings.favicon?.url);
    updateTitle(cachedSettings.companyName);
  }, 0);
}

let inFlightSettingsPromise = null;
let lastFetchedAt = 0;

// Reuse cached settings across mounts (React StrictMode) and layout components.
const SETTINGS_TTL_MS = 5 * 60 * 1000;

/**
 * Load business settings from backend (public endpoint - no auth required)
 * @param {{ forceRefresh?: boolean }} [options]
 */
export const loadBusinessSettings = async (options = {}) => {
  const { forceRefresh = false } = options;

  try {
    const endpoint = API_ENDPOINTS.ADMIN.BUSINESS_SETTINGS_PUBLIC;
    if (!endpoint || (typeof endpoint === "string" && !endpoint.trim())) {
      return cachedSettings;
    }

    const isFresh =
      !forceRefresh &&
      cachedSettings &&
      lastFetchedAt > 0 &&
      Date.now() - lastFetchedAt < SETTINGS_TTL_MS;

    if (isFresh) {
      return cachedSettings;
    }

    if (inFlightSettingsPromise) {
      return await inFlightSettingsPromise;
    }

    inFlightSettingsPromise = (async () => {
      const response = await getPublicBusinessSettingsOnce(
        forceRefresh ? { noCache: true } : {},
      );
      const settings = response?.data?.data || response?.data;

      if (settings) {
        cachedSettings = settings;
        lastFetchedAt = Date.now();
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {}

        updateFavicon(settings.favicon?.url);
        updateTitle(settings.companyName);
        return settings;
      }
      return cachedSettings;
    })();

    return await inFlightSettingsPromise;
  } catch (error) {
    return cachedSettings;
  } finally {
    inFlightSettingsPromise = null;
  }
};

/**
 * Update favicon in document
 */
export const updateFavicon = (url) => {
  if (!url || typeof document === 'undefined') return;

  // Remove existing favicons
  const existingFavicons = document.querySelectorAll("link[rel*='icon']");
  existingFavicons.forEach(el => el.remove());

  // Add new favicon
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  link.href = url;
  // Prevent third-party cookie warning (Cloudinary)
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
};

/**
 * Update page title
 */
export const updateTitle = (companyName) => {
  if (companyName && typeof document !== 'undefined') {
    document.title = companyName;
  }
};

/**
 * Set cached settings manually (useful after update)
 */
export const setCachedSettings = (settings) => {
  if (settings) {
    cachedSettings = settings;
    lastFetchedAt = Date.now();
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {}

    updateFavicon(settings.favicon?.url);
    updateTitle(settings.companyName);
  }
};

/**
 * Clear cached settings (call after updating settings)
 */
export const clearCache = () => {
  cachedSettings = null;
  lastFetchedAt = 0;
  invalidatePublicBusinessSettingsCache();
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch (e) {}
};

/**
 * Get cached settings
 */
export const getCachedSettings = () => {
  return cachedSettings;
};

/**
 * Get company name from business settings with fallback
 * @returns {string} Company name or default "Foodelo Food"
 */
export const getCompanyName = () => {
  const settings = getCachedSettings();
  return settings?.companyName || "Foodelo";
};

/**
 * Get company name asynchronously (loads if not cached)
 * @returns {Promise<string>} Company name or default "Foodelo Food"
 */
export const getCompanyNameAsync = async () => {
  try {
    const settings = await loadBusinessSettings();
    return settings?.companyName || "Foodelo";
  } catch (error) {
    return "Foodelo";
  }
};
