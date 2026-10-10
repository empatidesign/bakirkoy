import { test, expect } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_OTP } from './helpers/auth'

async function loginTolerant(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.locator('#email').waitFor()
  await page.locator('#email').fill(ADMIN_EMAIL)
  await page.locator('#password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  await page.waitForURL((url) => /\/login\/otp/.test(url.pathname) || !url.pathname.startsWith('/login'), { timeout: 20000 })
  if (/\/login\/otp/.test(page.url())) {
    const otp = page.locator('input[inputmode="numeric"]')
    await otp.first().waitFor()
    const count = await otp.count()
    for (let i = 0; i < Math.min(6, count); i++) await otp.nth(i).fill(ADMIN_OTP[i])
    await page.getByRole('button', { name: /Doğrula/ }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 })
  }
}

test.describe('Raporlama & Analiz Paneli', () => {
  test('dashboard grafikleri gerçek veriyle render olur ve tarih filtresi çalışır', async ({ page }) => {
    test.setTimeout(90000)
    await loginTolerant(page)
    await page.goto('/dashboard')

    await expect(page.getByText('Dashboard').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Toplam Başvuru')).toBeVisible()
    await expect(page.getByText('Başvuru Trendi')).toBeVisible()
    await expect(page.getByText('Cinsiyet Dağılımı')).toBeVisible()
    await expect(page.getByText('Uyruk (Türk / Yabancı)')).toBeVisible()

    await expect(page.locator('.recharts-surface').first()).toBeVisible({ timeout: 15000 })
    expect(await page.locator('.recharts-surface').count()).toBeGreaterThan(3)

    // Denetimde bulundu (2026-10-01): DashboardPage pilot tasarıma geçtiğinde Select bileşeni
    // native <select> render ediyor (eski buton+popover değil). selectOption kullanılır.
    await page.locator('select').filter({ has: page.locator('option', { hasText: 'Bu Ay' }) }).first().selectOption({ label: 'Bu Yıl' })
    await expect(page).toHaveURL(/range=year/)
    await expect(page.locator('.recharts-surface').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Başvuru Trendi')).toBeVisible()
  })
})
