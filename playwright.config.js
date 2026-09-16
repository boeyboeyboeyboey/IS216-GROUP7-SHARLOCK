import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop-chromium',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @sharlock/server start',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: false,
      timeout: 30000,
      env: { NODE_ENV: 'test', PORT: '3001', CLIENT_ORIGIN: 'http://localhost:5174' },
    },
    {
      command: 'pnpm dev:client',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 30000,
      env: { PORT: '3001', CLIENT_ORIGIN: 'http://localhost:5174' },
    },
  ],
})
