import { test, expect } from '@playwright/test'

test.describe('Firma Girişi — public', () => {
  test('firma giriş sayfası açılıyor', async ({ page }) => {
    const resp = await page.goto('/firma/login')
    expect(resp?.status()).toBeLessThan(400)
    await expect(page.getByText('Firma Girişi')).toBeVisible()
    await expect(page.locator('input').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Giriş Yap' })).toBeVisible()
  })

  test('konsol hatası / sayfa çökmesi yok', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/firma/login')
    await page.waitForLoadState('networkidle')
    expect(errors, errors.join('\n')).toHaveLength(0)
  })

  test('geçersiz e-posta ile giriş OTP sayfasına geçmez', async ({ page }) => {
    await page.goto('/firma/login')
    await page.locator('input').first().fill('gecersiz-eposta')
    await page.getByPlaceholder('Şifreniz').fill('Sifre1234')
    await page.getByRole('button', { name: 'Giriş Yap' }).click()
    await page.waitForTimeout(500)
    await expect(page).not.toHaveURL(/\/otp/)
  })

  test('firma kayıt linki çalışıyor', async ({ page }) => {
    await page.goto('/firma/login')
    await page.getByRole('link', { name: 'Kayıt olun' }).click()
    await expect(page).toHaveURL(/\/firma\/register/)
  })

  test('firma şifremi unuttum linki çalışıyor', async ({ page }) => {
    await page.goto('/firma/login')
    await page.getByRole('link', { name: 'Şifremi unuttum' }).click()
    await expect(page).toHaveURL(/\/firma\/forgot-password/)
  })
})
