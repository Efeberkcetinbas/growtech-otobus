import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// Testler production build üzerinde, GitHub Pages ile aynı alt dizinde çalışır.
const BASE = `http://localhost:${PORT}/growtech-otobus/`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  use: {
    baseURL: BASE,
    locale: 'tr-TR',
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'android-chrome', use: { ...devices['Pixel 7'] } },
    {
      name: 'narrow-320',
      use: { ...devices['Pixel 7'], viewport: { width: 320, height: 640 } },
      testMatch: /layout\.spec\.ts/,
    },
    {
      name: 'iphone-webkit',
      use: { ...devices['iPhone 13'] },
      testMatch: /(core|layout)\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
