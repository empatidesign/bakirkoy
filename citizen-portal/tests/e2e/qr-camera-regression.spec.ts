import { test, expect, chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { login } from './helpers/auth'

// Bu spec sahte kamera aygıtı için kendi tarayıcısını açar; bu yüzden baseURL'i
// playwright.config.ts'ten MİRAS ALMAZ. Portu burada elle yazmak sessiz kırılma
// kaynağıydı (3100 yazılmıştı, config 3110 kullanıyor) — login sayfası hiç açılmadan
// placeholder timeout'u veriyordu. Tek kaynak olarak config'in kullandığı değeri kullan.
const BASE_URL = process.env.BASE_URL || 'http://localhost:3110'

test.describe('QR kamera tarayıcı — StrictMode çift-mount yarışı regresyon testi', () => {
  let browser: Browser
  let context: BrowserContext

  test.beforeAll(async () => {
    browser = await chromium.launch({
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    })
    context = await browser.newContext({
      permissions: ['camera'],
      viewport: { width: 430, height: 932 },
      baseURL: BASE_URL,
      locale: 'tr-TR',
    })
  })

  test.afterAll(async () => {
    await context.close()
    await browser.close()
  })

  test('QR Oku sekmesi açıldığında kamera video akışı gerçekten başlıyor ve StrictMode play()-interrupted hatası oluşmuyor', async () => {
    const page: Page = await context.newPage()
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    await login(page)
    await page.goto('/qr')
    await page.waitForLoadState('networkidle').catch(() => {})

    await page.getByRole('button', { name: 'QR Oku' }).click({ timeout: 15000 })

    const video = page.locator('#company-qr-scanner-region video')
    await expect(video).toBeVisible({ timeout: 10000 })
    await expect
      .poll(async () => video.evaluate((el: HTMLVideoElement) => el.readyState), { timeout: 10000 })
      .toBeGreaterThanOrEqual(2) // HAVE_CURRENT_DATA veya üzeri: gerçek video karesi geldi

    const dims = await video.evaluate((el: HTMLVideoElement) => ({ w: el.videoWidth, h: el.videoHeight }))
    expect(dims.w, 'video genişliği 0 olmamalı — kamera akışı gerçekten bağlanmış olmalı').toBeGreaterThan(0)
    expect(dims.h, 'video yüksekliği 0 olmamalı — kamera akışı gerçekten bağlanmış olmalı').toBeGreaterThan(0)

    await expect(page.getByText('Kameraya erişilemedi')).toHaveCount(0)

    const raceError = pageErrors.find((m) => /play\(\) request was interrupted/i.test(m))
    expect(raceError, `StrictMode çift-mount yarışı tekrar etti: ${raceError}`).toBeUndefined()

    await page.close()
  })
})
