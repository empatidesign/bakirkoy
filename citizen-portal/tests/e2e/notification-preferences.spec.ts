import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test'
import { TEST_TCKN, TEST_PASSWORD, TEST_OTP, hasCredentials } from './helpers/auth'

const API = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')
const CATEGORIES = ['event', 'travel', 'facility', 'campaign', 'library', 'general']

let ctx: APIRequestContext
let token = ''

async function citizenLogin(): Promise<string> {
  const l = await (await ctx.post(`${API}/api/v1/auth/citizen/login`, { data: { identifier: TEST_TCKN, password: TEST_PASSWORD } })).json()
  if (l.data?.accessToken) return l.data.accessToken
  const v = await (await ctx.post(`${API}/api/v1/auth/citizen/verify-otp`, { data: { otpSessionToken: l.data.otpSessionToken, code: TEST_OTP } })).json()
  return v.data.accessToken
}

const auth = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })
const get = async (path: string) => {
  const res = await ctx.get(`${API}${path}`, { headers: auth() })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), ok: res.ok(), data: json?.data }
}
const put = async (path: string, body: unknown) => {
  const res = await ctx.put(`${API}${path}`, { headers: auth(), data: body })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), ok: res.ok(), code: json?.errorCode, data: json?.data }
}
const post = async (path: string, body: unknown = {}) => {
  const res = await ctx.post(`${API}${path}`, { headers: auth(), data: body })
  const json = await res.json().catch(() => ({}))
  return { httpStatus: res.status(), status: json?.statusCode ?? res.status(), ok: res.ok() }
}

interface Pref {
  category: string
  pushEnabled: boolean
  smsEnabled: boolean
  emailEnabled: boolean
  inAppEnabled: boolean
}

test.describe.serial('Bildirim tercihleri — CRUD + opt-out-all (API)', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  let originalPrefs: Pref[] = []

  test.beforeAll(async () => {
    ctx = await pwRequest.newContext()
    token = await citizenLogin()
    expect(token, 'citizen token alınmalı').toBeTruthy()
    const r = await get('/api/v1/me/notification-preferences')
    originalPrefs = r.data ?? []
  })

  test.afterAll(async () => {
    for (const cat of CATEGORIES) {
      const existing = originalPrefs.find((p) => p.category === cat)
      await put('/api/v1/me/notification-preferences', existing ?? {
        category: cat, pushEnabled: true, smsEnabled: true, emailEnabled: true, inAppEnabled: true,
      })
    }
    await ctx.dispose()
  })

  test('GET: 6 sabit kategori dönmeli (event/travel/facility/campaign/library/general)', async () => {
    const r = await get('/api/v1/me/notification-preferences')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data)).toBeTruthy()
    const categories = r.data.map((p: Pref) => p.category)
    for (const cat of CATEGORIES) expect(categories).toContain(cat)
  })

  test('PUT: event kategorisinde push kapatılır, kalıcı olarak GET ile doğrulanır', async () => {
    const upsert = await put('/api/v1/me/notification-preferences', {
      category: 'event', pushEnabled: false, smsEnabled: true, emailEnabled: true, inAppEnabled: true,
    })
    expect(upsert.status).toBe(200)
    expect(upsert.data.pushEnabled).toBe(false)

    const r = await get('/api/v1/me/notification-preferences')
    const event = r.data.find((p: Pref) => p.category === 'event')
    expect(event.pushEnabled, 'değişiklik kalıcı olmalı').toBe(false)
    expect(event.smsEnabled).toBe(true)
  })

  test('PUT: geçersiz kategori -> 409 INVALID_CATEGORY', async () => {
    const r = await put('/api/v1/me/notification-preferences', {
      category: 'invalid-cat', pushEnabled: true, smsEnabled: true, emailEnabled: true, inAppEnabled: true,
    })
    expect(r.ok).toBeFalsy()
    expect(r.status).toBe(409)
    expect(r.code).toBe('INVALID_CATEGORY')
  })

  test('opt-out-all: tüm kategorilerin tüm kanalları false olur', async () => {
    const before = await get('/api/v1/me/notification-preferences')
    const anyEnabledBefore = before.data.some((p: Pref) =>
      p.pushEnabled || p.smsEnabled || p.emailEnabled || p.inAppEnabled)
    expect(anyEnabledBefore, 'test öncesi en az bir kanal açık olmalı (aksi halde test anlamsız)').toBeTruthy()

    const optOut = await post('/api/v1/me/notification-preferences/opt-out-all')
    expect(optOut.status).toBe(204)

    const after = await get('/api/v1/me/notification-preferences')
    for (const pref of after.data as Pref[]) {
      expect(pref.pushEnabled, `${pref.category} push kapalı olmalı`).toBe(false)
      expect(pref.smsEnabled, `${pref.category} sms kapalı olmalı`).toBe(false)
      expect(pref.emailEnabled, `${pref.category} email kapalı olmalı`).toBe(false)
      expect(pref.inAppEnabled, `${pref.category} inApp kapalı olmalı`).toBe(false)
    }
  })

  test('auth guard: token yoksa 401', async () => {
    const anon = await pwRequest.newContext()
    const res = await anon.get(`${API}/api/v1/me/notification-preferences`)
    expect(res.status()).toBe(401)
    await anon.dispose()
  })
})
