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
  server: { host: true, port: 3000 },
  preview: { host: true, port: 3000 },
});
