import mongoose from 'mongoose';
import dns from 'dns';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

// Override default DNS servers with Google DNS & Cloudflare DNS to ensure SRV record resolution
dns.setServers(['8.8.8.8', '1.1.1.1']);


export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(config.mongodbUri);
        logger.info(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        logger.error(`MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
};

/**
 * Close MongoDB connection (e.g. graceful shutdown).
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
};
