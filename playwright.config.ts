import { defineConfig } from '@playwright/test';
const previewPort = process.env.E2E_PREVIEW_PORT ?? '4173';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 12000 },
  reporter: [['list']],
  outputDir: 'test-artifacts/browser',
  use: {
    baseURL: `http://127.0.0.1:${previewPort}`,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'allow',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/test-preview.mjs',
    url: `http://127.0.0.1:${previewPort}`,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
