import { defineConfig, devices } from '@playwright/test';

/** Tracking events go to this fake Apps Script URL; tests intercept it with page.route. */
export const TRACKING_URL = 'https://tracking.test/macros/s/e2e/exec';
const PORT = 4174;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'he-IL',
    // Local runs use the installed Chrome; CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'mobile-360',
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 }, channel: process.env.CI ? undefined : 'chrome' },
    },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npm run build:all && npx vite preview --config scripts/preview.config.ts --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { VITE_TRACKING_URL: TRACKING_URL, BASE_PATH: '/' },
  },
});
