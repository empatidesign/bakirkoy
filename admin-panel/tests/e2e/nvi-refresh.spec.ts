import { test, expect } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_OTP, login as loginUi } from './helpers/auth'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'

type Json = Record<string, unknown> & { data?: any; errorCode?: string; message?: string }

async function apiToken(): Promise<string> {
  const login = await (await fetch(`${API_BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })).json() as Json
  if (login?.data?.accessToken) return login.data.accessToken
  const verify = await (await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otpSessionToken: login.data.otpSessionToken, code: ADMIN_OTP }),
  })).json() as Json
  if (!verify?.data?.accessToken) throw new Error(`OTP failed: ${JSON.stringify(verify)}`)
  return verify.data.accessToken
}

test.describe.configure({ mode: 'serial' })

test('NVİ yenileme ucu canlıda çalışıyor', async () => {
  const token = await apiToken()
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const list = await (await fetch(`${API_BASE}/participants?page=1&limit=1`, { headers: auth })).json() as Json
  const target = list?.data?.items?.[0]
  expect(target, 'en az bir katılımcı olmalı').toBeTruthy()

  const res = await fetch(`${API_BASE}/participants/${target.id}/nvi-refresh`, { method: 'POST', headers: auth })
  const body = await res.json() as Json

  console.log('NVI refresh status:', res.status, 'errorCode:', body.errorCode, 'message:', body.message)

  expect(res.status, `NVİ yenileme başarısız: ${JSON.stringify(body)}`).toBe(200)
  expect(body?.data?.id).toBe(target.id)
})

test('Katılımcı listesinde NVİ yenileme butonu görünüyor', async ({ page }) => {
  await loginUi(page)

  await page.goto('/participants')
  await page.waitForSelector('table tbody tr', { timeout: 20000 })

  const nviButton = page.locator('button[title*="NVİ"], button[title*="NVI"]').first()
  await expect(nviButton).toBeVisible({ timeout: 10000 })
})
