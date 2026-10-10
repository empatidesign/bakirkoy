import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-results.json' }],
  ],
  timeout: 30000,
  expect: {
    timeout: 7000,
    // QA gap #43 — visual regression tolerance: font rendering/anti-aliasing gibi
    // piksel-altı farklardan gereksiz fail'i önler ama metin değişikliği, yer
    // değiştiren component, kaybolan içerik gibi gerçek sorunları hâlâ yakalar.
    // 0.02 (%2) DENENDİ ve YETERSİZ bulundu: küçük bir başlık metni eklemesi
    // (~%1.19 piksel farkı) bu eşiğin altında kalıp sessizce geçiyordu — gerçek
    // bir regresyon testinde yakalanması gereken bir değişiklik. 0.005 (%0.5)
    // ile aynı senaryo elle doğrulandı (bkz. commit günlüğü, 2026-09-04).
    toHaveScreenshot: { maxDiffPixelRatio: 0.005, animations: 'disabled' },
  },
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10000,
    navigationTimeout: 20000,
    locale: 'tr-TR',
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 3200 --strictPort',
    url: 'http://localhost:3200',
    reuseExistingServer: true,
    timeout: 60000,
  },
})
