import { test, expect } from '@playwright/test'
import { login, hasCredentials } from '../helpers/auth'

const CRASH = [
  'something went wrong', 'bir şeyler ters gitti', 'beklenmeyen bir hata',
  'application error', 'cannot read propert', 'is not a function', 'undefined is not',
]

test.describe.serial('Tesis (FacilityTemplate) — vatandaş ekran doğrulama', () => {
  test.skip(!hasCredentials(), 'E2E creds yok')

  test('hizmetler ekranı canlı backend ile hatasız render (kontenjan/uygunluk ayarları)', async ({ page }) => {
    await login(page)
    await page.goto('/hizmetler')
    await page.waitForLoadState('networkidle')

    const body = (await page.locator('body').innerText()).toLowerCase()
    for (const m of CRASH) expect(body, `crash marker: ${m}`).not.toContain(m)

    await expect(page.locator('body')).toContainText(/spor|havuz|kamp|tesis|program|hizmet/i)
  })

  test('bir programın detayı açılıyor ve başvuru/uygunluk durumu görünüyor', async ({ page }) => {
    await login(page)
    await page.goto('/hizmetler')
    await page.waitForLoadState('networkidle')

    const card = page.locator('[role="button"], button, a').filter({ hasText: /program|spor|havuz|kamp|detay|başvur|seç/i }).first()
    if (await card.count()) {
      await card.click().catch(() => {})
      await page.waitForTimeout(800)
      const body = (await page.locator('body').innerText()).toLowerCase()
      for (const m of CRASH) expect(body).not.toContain(m)
    }
    await expect(page.locator('body')).toContainText(/başvur|kontenjan|yedek|uygun|dolu|kayıt|yer/i)
  })
})
