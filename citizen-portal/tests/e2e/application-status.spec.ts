import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

const trackErrors = (page: import('@playwright/test').Page) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

test.describe.serial('Başvuru durumu — ortak stepper + rozet', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test('Başvurularım sayfası açılıyor; durum filtreleri + rozetler render oluyor', async ({ page }) => {
    const errors = trackErrors(page)
    await login(page)
    await page.goto('/basvurularim')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)

    await expect(page.getByRole('button', { name: /Onaylananlar/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Bekleyenler/ })).toBeVisible()

    await page.getByRole('button', { name: /Onaylananlar/ }).click()
    await page.waitForTimeout(400)
    const anyBadge = page.getByText(/Onaylandı|Beklemede|Reddedildi|Yedek Liste|İnceleniyor/).first()
    await expect(anyBadge.or(page.getByText(/Onaylanmış başvuru yok/))).toBeVisible()

    expect(errors, errors.join('\n')).toHaveLength(0)
  })

  test('Spor program detayında başvuru varsa Başvuru Durumu + stepper görünür', async ({ page }) => {
    const errors = trackErrors(page)
    await login(page)
    await page.goto('/spor')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const firstCard = page.locator('[class*="cursor-pointer"]').filter({ hasText: /Kayıt Açık|Kontenjan Dolu/ }).first()
    if (!(await firstCard.count())) test.skip(true, 'Program kartı yok')
    await firstCard.click()
    await page.waitForTimeout(800)

    const durumBaslik = page.getByText('Başvuru Durumu', { exact: true })
    if (await durumBaslik.count()) {
      await expect(page.getByText('Başvuru Alındı')).toBeVisible()
      await expect(page.getByText('Değerlendirme')).toBeVisible()
    }
    expect(errors, errors.join('\n')).toHaveLength(0)
  })
})
