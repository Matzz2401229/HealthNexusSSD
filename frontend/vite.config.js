import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA via Workbox (vite-plugin-pwa wraps Workbox) — service worker + manifest.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'HealthNexus',
        short_name: 'HealthNexus',
        theme_color: '#0d6efd',
        icons: [],
      },
    }),
  ],
  server: {
    host: true,
    port: 3000,
    // Dev only: forward /api calls to the local backend (no CORS). In production
    // nginx does this routing. Strips /api since the backend serves /auth etc.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: { host: true, port: 3000 },
});
