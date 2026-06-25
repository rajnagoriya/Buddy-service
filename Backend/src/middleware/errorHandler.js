import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const DUPLICATE_KEY_CODE = 11000;

const DUPLICATE_FIELD_MESSAGES = {
    phone: 'This phone number is already registered',
    ownerPhone: 'This phone number is already registered',
    ownerPhoneLast10: 'Restaurant already exists with this phone number',
    ownerEmail: 'Restaurant already exists with this email',
    vehicleNumber: 'This vehicle number is already registered',
    email: 'This email is already registered',
};

const formatDuplicateKeyError = (err) => {
    const field = err?.keyValue ? Object.keys(err.keyValue)[0] : null;
    const value = field && err?.keyValue ? err.keyValue[field] : null;
    const base =
        field && DUPLICATE_FIELD_MESSAGES[field]
            ? DUPLICATE_FIELD_MESSAGES[field]
            : 'A record with this value already exists';
    return value ? `${base} (${value})` : base;
};

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Server Error';
    const requestId = req.requestId || '-';

    if (err.code === DUPLICATE_KEY_CODE) {
        statusCode = 409;
        message = formatDuplicateKeyError(err);
    } else if (err.name === 'ValidationError' && err.errors) {
        statusCode = 400;
        message = Object.values(err.errors)
            .map((entry) => entry.message)
            .join(', ');
    }

    logger.error(
        `[${requestId}] ${req.method} ${req.originalUrl} ${statusCode} - ${err.name || 'Error'} - ${message}`
    );
    if (config.nodeEnv === 'development' && err.stack) {
        logger.error(`[${requestId}] ${err.stack}`);
    }

    res.status(statusCode).json({
        success: false,
        error: message,
        message,
    });
};

export default errorHandler;
