import { test, expect } from '@playwright/test'
import { TEST_TCKN, TEST_PASSWORD, TEST_OTP } from './helpers/auth'

test('güncel akış: kvkk/bildirim onayı verify-otp isteğinde birlikte gidiyor', async ({ page }) => {
  await page.goto('/login')
  const tcknInput = page.getByPlaceholder(/Telefon veya T\.C\. kimlik numaranız/i)
  await tcknInput.waitFor()
  await tcknInput.fill(TEST_TCKN)
  await page.getByPlaceholder(/Şifreniz/i).fill(TEST_PASSWORD)

  await page.locator('#login-kvkk').check()
  await page.locator('#login-notif').check()

  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  await page.waitForURL('**/login/otp', { timeout: 15000 })

  const otpInputs = page.locator('input[inputmode="numeric"], input[maxlength="1"]')
  const count = await otpInputs.count()
  if (count >= 6) {
    for (let i = 0; i < 6; i++) await otpInputs.nth(i).fill(TEST_OTP[i])
  } else {
    await page.locator('input').first().fill(TEST_OTP)
  }
  await page.getByRole('button', { name: 'Doğrula & Giriş Yap' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 })
  await expect(page).not.toHaveURL(/\/login/)

  await page.goto('/profil')
  await page.waitForTimeout(600)
  await expect(page.getByText(/KVKK: Onaylandı/)).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/Bildirim izni: Onaylandı/)).toBeVisible()
})
