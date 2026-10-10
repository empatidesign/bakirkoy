import { test, expect } from '@playwright/test'

test.describe('Genel — Uygulama ayağa kalkıyor', () => {
  test('login sayfası açılıyor ve form görünüyor', async ({ page }) => {
    const resp = await page.goto('/login')
    expect(resp?.status()).toBeLessThan(400)
    await expect(page.getByText('Telefon veya T.C. Kimlik').last()).toBeVisible()
    await expect(page.getByText('Şifre', { exact: false }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Giriş Yap' })).toBeVisible()
  })

  test('korumalı anasayfa girişe yönlendiriyor', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/login/)
  })

  test('konsol hatası ve sayfa çökmesi yok (login)', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    expect(errors, errors.join('\n')).toHaveLength(0)
  })
})

test.describe('Giriş — Form doğrulama (client-side)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByText('Telefon veya T.C. Kimlik').last().waitFor()
  })

  test('boş formla giriş denenince TC/telefon hatası çıkar', async ({ page }) => {
    await page.getByRole('button', { name: 'Giriş Yap' }).click()
    await expect(page.getByText('Telefon numarası veya T.C. kimlik numarası giriniz.')).toBeVisible()
  })

  test('kısa/geçersiz kimlik ile backend reddeder, OTP sayfasına gitmez', async ({ page }) => {
    await page.getByPlaceholder('Telefon veya T.C. kimlik numaranız').fill('123')
    await page.getByPlaceholder('Şifreniz').fill('Sifre1234')
    await page.getByRole('button', { name: 'Giriş Yap' }).click()
    await expect(page).not.toHaveURL(/\/login\/otp/, { timeout: 10000 })
  })

  test('şifremi unuttum linki çalışıyor', async ({ page }) => {
    await page.getByRole('link', { name: 'Şifremi unuttum' }).click()
    await expect(page).toHaveURL(/\/forgot-password/)
  })

  test('kayıt ol linki çalışıyor', async ({ page }) => {
    await page.getByRole('link', { name: 'Kayıt olun' }).click()
    await expect(page).toHaveURL(/\/register/)
  })
})

test.describe('Kayıt — Form doğrulama', () => {
  test('kayıt sayfası açılıyor', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByText('Kayıt Ol').first()).toBeVisible()
    await expect(page.getByText('T.C. Kimlik No').last()).toBeVisible()
  })

  test('ilk adımda NVI Doğrula butonu boşken pasif, sonraki adıma geçmez', async ({ page }) => {
    await page.goto('/register')
    await page.getByText('T.C. Kimlik No').last().waitFor()
    const verifyBtn = page.getByRole('button', { name: 'Bilgileri Doğrula' })
    await expect(verifyBtn).toBeVisible()
    await expect(verifyBtn).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Kayıt Ol' })).toHaveCount(0)
    await expect(page).toHaveURL(/\/register/)
  })
})

test.describe('Şifremi Unuttum', () => {
  test('sayfa açılıyor ve TC alanı var', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('input').first()).toBeVisible()
  })
})
