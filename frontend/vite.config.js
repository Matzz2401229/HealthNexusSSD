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
    // Dev only: forward /api calls to the local backend so the browser sees
    // one origin (no CORS). In production nginx does this routing instead.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // backend serves /prescriptions (no /api prefix); strip it like nginx does
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: { host: true, port: 3000 },
});
