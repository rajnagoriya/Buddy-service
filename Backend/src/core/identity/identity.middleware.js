import { verifyAccessToken } from '../auth/token.util.js';
import { sendError } from '../../utils/response.js';
import { BuddyIdentity } from './buddyIdentity.model.js';
import { FoodUser } from '../users/user.model.js';
import { User as TaxiUser } from '../../modules/taxi/user/models/User.js';
import { FoodDeliveryPartner } from '../../modules/food/delivery/models/deliveryPartner.model.js';
import { Driver } from '../../modules/taxi/driver/models/Driver.js';

/**
 * Unified auth middleware.
 *
 * Reads the new identity-aware token shape produced by `verifyOtpUnified` and
 * attaches both `req.identity` and lazy capability resolvers to the request.
 * Works alongside the older food (`authMiddleware`) and taxi (`authenticate`)
 * middlewares — those continue to work on legacy tokens during the migration.
 *
 * Usage:
 *   router.get('/me', authenticateIdentity(),       handler)        // any role
 *   router.get('/me', authenticateIdentity({ roles: ['DRIVER'] }), handler)
 *   router.get('/me', authenticateIdentity({ allowOnboarding: true }), handler)
 *
 * The `allowOnboarding` flag is needed for the onboarding wizard, which
 * accepts tokens whose identity has `onboardingComplete: false`.
 */
export const authenticateIdentity = (options = {}) => async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return sendError(res, 401, 'Authentication token missing');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (_) {
      return sendError(res, 401, 'Invalid or expired token');
    }

    const identityId = payload.identityId || null;
    if (!identityId) {
      // Token predates the identity layer. Let the caller decide whether to
      // accept it (most identity-only routes simply 401 here).
      return sendError(res, 401, 'This endpoint requires the unified auth token');
    }

    const identity = await BuddyIdentity.findById(identityId);
    if (!identity) return sendError(res, 401, 'Identity not found');
    if (identity.isActive === false) {
      return sendError(res, 401, 'Account has been deactivated');
    }

    const role = String(payload.role || '').toUpperCase();
    const allowedRoles = (options.roles || []).map((r) => String(r).toUpperCase());
    if (allowedRoles.length && !allowedRoles.includes(role)) {
      return sendError(res, 403, 'Insufficient permissions');
    }

    if (
      role === 'DRIVER' &&
      !options.allowOnboarding &&
      identity.onboardingComplete === false
    ) {
      return sendError(res, 403, 'Driver onboarding is not complete');
    }

    req.identity = identity;
    req.identityRole = role;
    // Backwards-compat shape so existing controllers reading req.user / req.auth
    // can be migrated incrementally without touching every handler.
    req.user = {
      identityId: String(identity._id),
      userId: payload.userId || String(identity._id),
      role,
    };
    req.auth = {
      sub: payload.sub || payload.userId || String(identity._id),
      role: role.toLowerCase(),
      identityId: String(identity._id),
    };

    // Lazy resolvers — only hit Mongo when the controller actually asks.
    const cache = {};
    req.foodUser = async () =>
      cache.foodUser || (cache.foodUser = await FoodUser.findOne({ identityId: identity._id }));
    req.taxiUser = async () =>
      cache.taxiUser || (cache.taxiUser = await TaxiUser.findOne({ identityId: identity._id }));
    req.foodPartner = async () =>
      cache.foodPartner ||
      (cache.foodPartner = await FoodDeliveryPartner.findOne({ identityId: identity._id }));
    req.driver = async () =>
      cache.driver || (cache.driver = await Driver.findOne({ identityId: identity._id }));

    return next();
  } catch (error) {
    return sendError(res, 401, 'Authentication failed');
  }
};
