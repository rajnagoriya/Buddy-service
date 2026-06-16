/**
 * Helpers shared by the unified auth flow and the one-time backfill script.
 *
 * Phone numbers across the platform are stored inconsistently:
 *   - FoodUser           → raw, often "+91XXXXXXXXXX" or "XXXXXXXXXX"
 *   - TaxiUser           → raw
 *   - FoodDeliveryPartner → 10 digits or "91XXXXXXXXXX"
 *   - Driver             → 10 digits
 *
 * `normalizePhone` collapses any of these to last-10 digits. Use this as the
 * canonical key when looking up / upserting BuddyIdentity. Country code is
 * stored separately on BuddyIdentity (default '+91').
 */
export const normalizePhone = (rawPhone) => {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
};

export const buildPhoneCandidates = (rawPhone) => {
  const last10 = normalizePhone(rawPhone);
  if (!last10) return [];
  return [...new Set([rawPhone, last10, `91${last10}`, `+91${last10}`].filter(Boolean))];
};

/**
 * Translates the role string used by clients (sometimes lowercase, sometimes
 * with hyphens) into the canonical uppercase enum stored on BuddyIdentity.
 */
export const normalizeRoleKey = (role) => {
  const normalized = String(role || '').toUpperCase().replace(/-/g, '_');
  if (['USER', 'DRIVER', 'RESTAURANT', 'ADMIN'].includes(normalized)) return normalized;
  if (normalized === 'CUSTOMER') return 'USER';
  if (normalized === 'DELIVERY_PARTNER') return 'DRIVER';
  return 'USER';
};
