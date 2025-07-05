import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'electron',
        'electron-store',
        'electron-updater',
        '@sentry/electron',
        'auto-launch',
        'sharp',
        'openai',
        'chokidar',
        'framer-motion',
        'path',
        'fs',
        'os',
        'crypto',
        'stream',
        'util',
        'events',
        'child_process',
        'url',
        'http',
        'https',
        'zlib',
        'net',
        'tls',
        'dns'
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@main': resolve(__dirname, './src/main'),
      '@renderer': resolve(__dirname, './src/renderer'),
      '@shared': resolve(__dirname, './src/shared')
    }
  }
});