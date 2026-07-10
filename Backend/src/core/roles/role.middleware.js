import { sendError } from '../../utils/response.js';

export const requireRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return sendError(res, 401, 'Not authenticated');
        }

        const userRole = String(req.user.role).toUpperCase();
        const allowedSet = new Set(allowedRoles.map((r) => String(r).toUpperCase()));
        // Unified identity login issues role=DRIVER; legacy food delivery uses DELIVERY_PARTNER.
        const roleMatches =
            allowedSet.has(userRole) ||
            (userRole === 'DRIVER' && allowedSet.has('DELIVERY_PARTNER'));
        if (!roleMatches) {
            return sendError(res, 403, 'Forbidden: insufficient permissions');
        }

        next();
    };
};

