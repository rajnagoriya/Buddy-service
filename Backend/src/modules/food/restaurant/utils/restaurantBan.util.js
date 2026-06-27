const LEGACY_BAN_REASON = 'Disabled by admin';

export const isRestaurantBanned = (doc = {}) => {
    if (!doc) return false;
    if (doc.bannedAt) return true;
    const status = String(doc.status || '').trim().toLowerCase();
    if (status === 'banned') return true;
    if (
        status === 'rejected' &&
        String(doc.rejectionReason || '').trim() === LEGACY_BAN_REASON
    ) {
        return true;
    }
    if (
        status === 'rejected' &&
        doc.isActive === false &&
        String(doc.onboardingStatus || '').toUpperCase() === 'APPROVED'
    ) {
        return true;
    }
    return false;
};

export const LEGACY_ADMIN_BAN_REASON = LEGACY_BAN_REASON;
