import { Page, expect } from '@playwright/test'

const required = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required test setting: ${name}`)
  return value
}

export const ADMIN_EMAIL = required('E2E_ADMIN_EMAIL')
export const ADMIN_PASSWORD = required('E2E_ADMIN_PASSWORD')
export const ADMIN_OTP = required('E2E_OTP_CODE')

export async function login(page: Page) {
  await page.goto('/login')
  await page.locator('#email').waitFor()
  await page.locator('#email').fill(ADMIN_EMAIL)
  await page.locator('#password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Giriş Yap' }).click()

  await page.waitForFunction(
    () => !window.location.pathname.startsWith('/login') || window.location.pathname === '/login/otp',
    { timeout: 15000 },
  ).catch(() => { /* aşağıdaki url kontrolü zaten hata verecek, burada sessiz geç */ })

  if (/\/login\/otp/.test(page.url())) {
    const otpInputs = page.locator('input[inputmode="numeric"]')
    await otpInputs.first().waitFor()
    const count = await otpInputs.count()
    for (let i = 0; i < Math.min(6, count); i++) {
      await otpInputs.nth(i).fill(ADMIN_OTP[i])
    }

    await page.getByRole('button', { name: /Doğrula/ }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 })
  }

  await expect(page).not.toHaveURL(/\/login/)
}
