import { Page, expect, request as pwRequest } from '@playwright/test'

const required = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required test setting: ${name}`)
  return value
}

export const TEST_COMPANY_EMAIL = required('E2E_COMPANY_EMAIL')
export const TEST_COMPANY_PASSWORD = required('E2E_COMPANY_PASSWORD')
export const TEST_COMPANY_OTP = required('E2E_OTP_CODE')

export const hasCompanyCredentials = () => TEST_COMPANY_EMAIL.length > 0 && TEST_COMPANY_PASSWORD.length > 0

const API_BASE = required('E2E_API_URL').replace(/\/$/, '')
const ADMIN_EMAIL = required('E2E_ADMIN_EMAIL')
const ADMIN_PASSWORD = required('E2E_ADMIN_PASSWORD')
const ADMIN_OTP = required('E2E_OTP_CODE')

let ensured = false

async function adminToken(): Promise<string> {
  const ctx = await pwRequest.newContext()
  try {
    const login = await ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } }).then((r) => r.json())
    if (login?.data?.accessToken) return login.data.accessToken
    const verify = await ctx.post(`${API_BASE}/auth/verify-otp`, { data: { otpSessionToken: login.data.otpSessionToken, code: ADMIN_OTP } }).then((r) => r.json())
    if (!verify?.data?.accessToken) throw new Error(`Admin login başarısız: ${JSON.stringify(verify)}`)
    return verify.data.accessToken
  } finally {
    await ctx.dispose()
  }
}

async function resolveServiceCategoryId(ctx: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await ctx.get(`${API_BASE}/auth/company/service-categories`).then((r) => r.json())
  const first = res?.data?.[0]?.id
  if (!first) throw new Error(`Hizmet kategorisi bulunamadı: ${JSON.stringify(res)}`)
  return first
}

export async function ensureCompanyFixture() {
  if (ensured) return
  const ctx = await pwRequest.newContext()
  try {
    const loginRes = await ctx.post(`${API_BASE}/auth/company/login`, {
      data: { identifier: TEST_COMPANY_EMAIL, password: TEST_COMPANY_PASSWORD },
    })
    const loginJson = await loginRes.json().catch(() => ({}))
    if (loginRes.ok() || loginJson?.data?.requiresOtp) {
      ensured = true
      return
    }

    const registerRes = await ctx.post(`${API_BASE}/auth/company/register`, {
      data: {
        name: 'E2E Test Firma', taxNumber: `${Date.now()}`.slice(0, 10),
        phone: `055${String(Date.now()).slice(-8)}`,
        email: TEST_COMPANY_EMAIL, address: 'E2E test adresi', district: 'Sultangazi',
        password: TEST_COMPANY_PASSWORD, serviceCategoryId: await resolveServiceCategoryId(ctx),
      },
    })
    if (!registerRes.ok()) {
      const j = await registerRes.json().catch(() => ({}))
      if (j?.errorCode !== 'DUPLICATE_EMAIL') throw new Error(`Firma kaydı başarısız: ${JSON.stringify(j)}`)
    }

    const token = await adminToken()
    const list = await ctx.get(`${API_BASE}/companies?page=1&limit=100&search=${encodeURIComponent(TEST_COMPANY_EMAIL)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json())
    const company = (list?.data?.items ?? []).find((c: { email: string }) => c.email === TEST_COMPANY_EMAIL)
    if (!company) throw new Error(`Firma bulunamadı: ${JSON.stringify(list)}`)
    if (company.status !== 'Approved') {
      const approve = await ctx.patch(`${API_BASE}/companies/${company.id}/approve`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!approve.ok()) throw new Error(`Firma onaylanamadı: ${await approve.text()}`)
    }
    ensured = true
  } finally {
    await ctx.dispose()
  }
}

export async function loginCompany(page: Page) {
  await ensureCompanyFixture()
  await page.goto('/firma/login')
  await page.getByText('Firma Girişi').waitFor()

  await page.getByPlaceholder('Telefon numarası veya e-posta adresiniz').fill(TEST_COMPANY_EMAIL)
  await page.getByPlaceholder('Şifreniz').fill(TEST_COMPANY_PASSWORD)

  // Kullanıcı isteği (2026-08-02): KVKK/Bildirim izni onayı artık girişten önce, iki ayrı
  // checkbox ile zorunlu alınıyor.
  const kvkkBox = page.locator('#company-login-kvkk')
  if (await kvkkBox.isVisible().catch(() => false)) await kvkkBox.check()
  const notifBox = page.locator('#company-login-notif')
  if (await notifBox.isVisible().catch(() => false)) await notifBox.check()

  await page.getByRole('button', { name: 'Giriş Yap' }).click()

  await page.waitForURL('**/firma/login/otp', { timeout: 15000 })

  const otpInputs = page.locator('input[inputmode="numeric"], input[maxlength="1"]')
  const count = await otpInputs.count()
  if (count >= 6) {
    for (let i = 0; i < 6; i++) await otpInputs.nth(i).fill(TEST_COMPANY_OTP[i])
  } else {
    await page.locator('input').first().fill(TEST_COMPANY_OTP)
  }

  await page.getByRole('button', { name: 'Doğrula' }).click()
  await page.waitForURL((url) => url.pathname === '/firma', { timeout: 15000 })
  await expect(page).toHaveURL(/\/firma$/)
  await dismissCompanyOnboarding(page)
}

export async function dismissCompanyOnboarding(page: Page) {
  const skip = page.getByRole('button', { name: 'Atla' })
  for (let i = 0; i < 3; i++) {
    if (await skip.isVisible().catch(() => false)) {
      await skip.click().catch(() => {})
      await page.waitForTimeout(300)
    } else break
  }
}
