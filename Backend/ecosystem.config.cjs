/**
 * PM2 production config for Buddy-service Backend.
 *
 * On VPS:
 *   cd /path/to/Buddy-service/Backend
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *
 * Requires .env with REDIS_ENABLED=true when using workers.
 */
module.exports = {
  apps: [
    {
      name: 'Buddy-service-backend',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'buddy-worker-order',
      script: 'src/queues/workers/order.worker.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'buddy-worker-tracking',
      script: 'src/queues/workers/tracking.worker.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
