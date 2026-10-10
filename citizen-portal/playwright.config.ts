import { defineConfig, devices } from '@playwright/test'

const isolatedWorkers = Number(process.env.E2E_ISOLATED_AUTH_WORKERS || 0)
if (isolatedWorkers > 0 && !process.env.E2E_RUN_ID) process.env.E2E_RUN_ID = `task4-${Date.now().toString(36)}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: isolatedWorkers > 0,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: isolatedWorkers || 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-results.json' }],
  ],
  timeout: 30000,
  expect: { timeout: 7000 },
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3110',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'on',
    actionTimeout: 10000,
    navigationTimeout: 20000,
    viewport: { width: 430, height: 932 },
    locale: 'tr-TR',
  },
  projects: isolatedWorkers > 0
    ? [{ name: 'mobile-chrome', use: { ...devices['Pixel 7'] } }]
    : [
        { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
        { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
      ],
  webServer: {
    command: 'npm run dev -- --port 3110 --strictPort',
    url: 'http://localhost:3110',
    reuseExistingServer: true,
    timeout: 60000,
  },
})
