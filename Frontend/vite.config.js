import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const foodSrc = path.resolve(__dirname, './src/modules/Food')
const servicesApi = path.resolve(__dirname, './src/services/api')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@food/api/axios', replacement: path.resolve(servicesApi, 'axios.js') },
      { find: '@food/api/config', replacement: path.resolve(servicesApi, 'config.js') },
      { find: '@food/api', replacement: servicesApi },
      { find: '@food', replacement: foodSrc },
      { find: '@delivery', replacement: path.resolve(__dirname, './src/modules/DeliveryV2') },
      { find: '@qc', replacement: path.resolve(__dirname, './src/modules/quickCommerce') },
      { find: '@core', replacement: path.resolve(__dirname, './src/modules/quickCommerce/core') },
      { find: '@shared', replacement: path.resolve(__dirname, './src/modules/quickCommerce/shared') },
      { find: '@modules', replacement: path.resolve(__dirname, './src/modules/quickCommerce/modules') },
      { find: '@assets', replacement: path.resolve(__dirname, './src/modules/quickCommerce/assets') },
      { find: '@styles', replacement: path.resolve(__dirname, './src/modules/quickCommerce/styles') },
      { find: '@', replacement: path.resolve(__dirname, './src') },
      {
        find: /^((?:\.\.\/)+)assets\b/,
        replacement: '$1assets',
        customResolver(source, importer) {
          const normImporter = importer ? importer.replace(/\\/g, '/') : '';
          if (normImporter.includes('modules/taxi')) {
            const relativePath = source.replace(/^((?:\.\.\/)+)assets\/?/, '');
            const targetPath = path.resolve(__dirname, './src/assets', relativePath);
            const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif'];
            let resolvedPath = targetPath;
            if (!fs.existsSync(targetPath)) {
              for (const ext of extensions) {
                if (fs.existsSync(targetPath + ext)) {
                  resolvedPath = targetPath + ext;
                  break;
                }
              }
            }
            return resolvedPath ? resolvedPath.replace(/\\/g, '/') : null;
          }
          return null;
        }
      },
      {
        find: /^((?:\.\.\/)+)modules\b/,
        replacement: '$1modules',
        customResolver(source, importer) {
          const normImporter = importer ? importer.replace(/\\/g, '/') : '';
          if (normImporter.includes('modules/taxi')) {
            const relativePath = source.replace(/^((?:\.\.\/)+)modules\/?/, '');
            const targetPath = path.resolve(__dirname, './src/modules/taxi', relativePath);
            const extensions = ['.js', '.jsx', '.json', '.ts', '.tsx', '/index.js', '/index.jsx'];
            let resolvedPath = targetPath;
            if (!fs.existsSync(targetPath)) {
              for (const ext of extensions) {
                if (fs.existsSync(targetPath + ext)) {
                  resolvedPath = targetPath + ext;
                  break;
                }
              }
            }
            return resolvedPath ? resolvedPath.replace(/\\/g, '/') : null;
          }
          return null;
        }
      },
      {
        find: /^((?:\.\.\/|\.\/)+)shared\b/,
        replacement: '$1shared',
        customResolver(source, importer) {
          const normImporter = importer ? importer.replace(/\\/g, '/') : '';
          if (normImporter.includes('modules/taxi')) {
            const relativePath = source.replace(/^((?:\.\.\/|\.\/)+)shared\/?/, '');
            const targetPathCore = path.resolve(__dirname, './src/modules/taxi/shared_core', relativePath);
            const targetPathShared = path.resolve(__dirname, './src/modules/taxi/shared', relativePath);

            const resolveWithExtension = (basePath) => {
              const extensions = ['.js', '.jsx', '.json', '.ts', '.tsx', '/index.js', '/index.jsx'];
              try {
                if (fs.existsSync(basePath) && !fs.statSync(basePath).isDirectory()) {
                  return basePath;
                }
                for (const ext of extensions) {
                  const p = basePath.endsWith('/') && ext.startsWith('/') ? basePath + ext.slice(1) : basePath + ext;
                  if (fs.existsSync(p) && !fs.statSync(p).isDirectory()) {
                    return p;
                  }
                }
              } catch (e) {
                // Ignore errors
              }
              return null;
            };

            const resolvedCore = resolveWithExtension(targetPathCore);
            if (resolvedCore) {
              return resolvedCore.replace(/\\/g, '/');
            }

            const resolvedShared = resolveWithExtension(targetPathShared);
            if (resolvedShared) {
              return resolvedShared.replace(/\\/g, '/');
            }

            return targetPathCore.replace(/\\/g, '/');
          }
          return null;
        }
      }
    ],

    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  optimizeDeps: {
    include: [
      '@emotion/react',
      '@emotion/styled',
      '@mui/material',
      '@mui/x-date-pickers',
    ],
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/v1': {
        target: process.env.VITE_BACKEND_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
