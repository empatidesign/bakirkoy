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
  timeout: 40000,
  expect: { timeout: 8000 },
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 12000,
    navigationTimeout: 25000,
    locale: 'tr-TR',
    launchOptions: process.env.E2E_SLOWMO ? { slowMo: Number(process.env.E2E_SLOWMO) } : undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60000,
  },
})
