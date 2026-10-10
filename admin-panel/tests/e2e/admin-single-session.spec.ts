import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

let ctx: APIRequestContext

async function loginFull(): Promise<{ token: string; hasActiveSessions: boolean }> {
  const loginRes = await (await ctx.post(`${API_BASE}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })).json()
  const hasActiveSessions = Boolean(loginRes?.data?.hasActiveSessions)
  const otpSessionToken = loginRes?.data?.otpSessionToken
  if (!otpSessionToken) throw new Error(`Login başarısız: ${JSON.stringify(loginRes)}`)

  const verifyRes = await (await ctx.post(`${API_BASE}/auth/verify-otp`, {
    data: { otpSessionToken, code: ADMIN_OTP },
  })).json()
  const token = verifyRes?.data?.accessToken
  if (!token) throw new Error(`OTP doğrulama başarısız: ${JSON.stringify(verifyRes)}`)
  return { token, hasActiveSessions }
}

async function whoAmI(token: string): Promise<number> {
  const res = await ctx.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
  return res.status()
}

test.describe('Admin — tek aktif oturum zorlaması (single active session)', () => {
  test.beforeAll(async () => {
    ctx = await pwRequest.newContext()
  })
  test.afterAll(async () => {
    await ctx.dispose()
  })

  test('İkinci cihazdan giriş yapılınca ilk oturumun token\'ı geçersiz kalır, ikincisi geçerli kalır', async () => {
    test.setTimeout(30000)

    const session1 = await loginFull()
    expect(await whoAmI(session1.token), 'ilk oturum başta geçerli olmalı').toBe(200)

    const session2 = await loginFull()
    expect(session2.hasActiveSessions, 'ikinci login öncesi aktif oturum tespit edilmeli').toBe(true)

    expect(await whoAmI(session1.token), 'önceki oturum otomatik sonlanmalı (401)').toBe(401)
    expect(await whoAmI(session2.token), 'yeni oturum geçerli kalmalı (200)').toBe(200)
  })

  test('Üçüncü cihazdan giriş, ikinciyi de geçersiz kılar (zincirleme tek-oturum)', async () => {
    test.setTimeout(30000)

    const session1 = await loginFull()
    const session2 = await loginFull()
    expect(await whoAmI(session1.token)).toBe(401)
    expect(await whoAmI(session2.token)).toBe(200)

    const session3 = await loginFull()
    expect(await whoAmI(session2.token), 'ikinci oturum da üçüncü girişle sonlanmalı').toBe(401)
    expect(await whoAmI(session3.token)).toBe(200)
  })
})
