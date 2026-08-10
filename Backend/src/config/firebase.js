import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

let db = null;
let messaging = null;
let cachedServiceAccount = null;

const sanitizeString = (value) => String(value ?? '').trim();

const getServiceAccountFromEnv = () => {
    if (cachedServiceAccount) return cachedServiceAccount;

    const rawJson = sanitizeString(config.firebaseServiceAccount);
    if (rawJson) {
        try {
            cachedServiceAccount = JSON.parse(rawJson);
            return cachedServiceAccount;
        } catch (err) {
            logger.error('Error parsing FIREBASE_SERVICE_ACCOUNT JSON:', err.message);
        }
    }

    const pathValue = sanitizeString(config.firebaseServiceAccountPath);
    if (pathValue) {
        const filePath = resolve(process.cwd(), pathValue);
        if (existsSync(filePath)) {
            try {
                cachedServiceAccount = JSON.parse(readFileSync(filePath, 'utf8'));
                return cachedServiceAccount;
            } catch (err) {
                logger.error(`Error reading or parsing firebase service account file at ${filePath}:`, err.message);
            }
        }
    }

    return null;
};

/**
 * Initializes Firebase Admin SDK with Service Account.
 * Supports both FCM and Realtime Database.
 */
export const initializeFirebaseRealtime = () => {
    try {
        const databaseURL = config.firebaseDatabaseUrl;

        if (admin.apps.length === 0) {
            const serviceAccount = getServiceAccountFromEnv();
            if (!serviceAccount) {
                logger.error(
                    '❌ Firebase service account not configured — PUSH NOTIFICATIONS ARE DISABLED. ' +
                    'Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH.',
                );
                return null;
            }
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: databaseURL || undefined,
            });
        }

        // Messaging is initialised FIRST and independently of the Realtime Database.
        //
        // These used to be initialised together inside one try block, so a missing or invalid
        // databaseURL made `admin.database()` throw and left `messaging` null — silently
        // disabling every push notification because of an unrelated RTDB misconfiguration.
        messaging = admin.messaging();
        logger.info('✅ Firebase Messaging initialized');

        if (databaseURL) {
            try {
                db = admin.database();
                logger.info('✅ Firebase Realtime Database initialized');
            } catch (dbErr) {
                logger.warn(`Firebase Realtime Database unavailable (push still works): ${dbErr.message}`);
            }
        } else {
            logger.info('Firebase Realtime Database URL not set — skipping RTDB (push unaffected)');
        }

        return { db, messaging };
    } catch (error) {
        logger.error(`❌ Firebase Initialization Error: ${error.message}`);
        return null;
    }
};

/**
 * Returns the initialized Firebase Realtime Database instance.
 * @returns {admin.database.Database}
 * @throws Error if not initialized
 */
export const getFirebaseDB = () => {
    if (!db) {
        throw new Error('⚠️ Firebase Realtime Database not initialized. Call initializeFirebaseRealtime() first.');
    }
    return db;
};

/**
 * Returns the initialized Firebase Messaging instance.
 * @returns {admin.messaging.Messaging}
 * @throws Error if not initialized
 */
export const getFirebaseMessaging = () => {
    if (!messaging) {
        throw new Error('⚠️ Firebase Messaging not initialized. Call initializeFirebaseRealtime() first.');
    }
    return messaging;
};

export const getFirebaseDatabase = () => {
    return admin.database();
};

export const firebaseServerTimestamp = () => {
    return admin.database.ServerValue.TIMESTAMP;
};

export default admin;
