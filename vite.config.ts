/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages alt dizini: https://efeberkcetinbas.github.io/growtech-otobus/
const base = process.env.BASE_PATH ?? '/growtech-otobus/';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base,
  define: {
    // APP_BUILD_TAG yalnızca güncelleme testinde farklı bir sürüm üretmek için kullanılır.
    __APP_VERSION__: JSON.stringify(pkg.version + (process.env.APP_BUILD_TAG ? `-${process.env.APP_BUILD_TAG}` : '')),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'GROWTECH 2026 – Otobüs Yolcu ve Yoklama',
        short_name: 'Growtech Otobüs',
        description: 'Aydın Ticaret Borsası Growtech 2026 otobüs yolcu listesi ve yoklama uygulaması',
        lang: 'tr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F5F7F6',
        theme_color: '#123B32',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // ttf: PDF için gömülü Türkçe yazı tipi (çevrimdışı PDF oluşturma)
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,ttf}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/local/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
