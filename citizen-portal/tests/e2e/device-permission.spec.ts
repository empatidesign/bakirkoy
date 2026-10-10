import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test'
import { TEST_TCKN, TEST_PASSWORD, TEST_OTP, hasCredentials } from './helpers/auth'

const API = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')

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

interface DevicePermission {
  locationStatus: string
  notificationStatus: string
  latitude: number | null
  longitude: number | null
  locationUpdatedAt: string | null
  hasPushToken: boolean
  devicePlatform: string | null
  respondedAt: string | null
  hasResponded: boolean
}

test.describe.serial('Cihaz izinleri (konum + bildirim) — mobil senkron ucu (API)', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  test.beforeAll(async () => {
    ctx = await pwRequest.newContext()
    token = await citizenLogin()
    expect(token, 'citizen token alınmalı').toBeTruthy()
  })

  test.afterAll(async () => {
    await put('/api/v1/me/device-permission', {
      locationStatus: 'not_asked', notificationStatus: 'not_asked',
      latitude: null, longitude: null, pushToken: null, devicePlatform: null,
    })
    await ctx.dispose()
  })

  test('GET: kayıt yoksa varsayılan not_asked döner', async () => {
    const r = await get('/api/v1/me/device-permission')
    expect(r.status).toBe(200)
    expect(typeof r.data.locationStatus).toBe('string')
    expect(typeof r.data.notificationStatus).toBe('string')
  })

  test('PUT: konum izni verilir (granted) + koordinat kalıcı olur, ilk kayıt (INSERT) oluşturulur', async () => {
    const r = await put('/api/v1/me/device-permission', {
      locationStatus: 'granted', notificationStatus: null,
      latitude: 41.1039, longitude: 28.8674, pushToken: null, devicePlatform: null,
    })
    expect(r.status, `PUT başarılı olmalı: ${JSON.stringify(r)}`).toBe(200)
    expect(r.data.locationStatus).toBe('granted')
    expect(r.data.latitude).toBeCloseTo(41.1039, 3)
    expect(r.data.longitude).toBeCloseTo(28.8674, 3)
    expect(r.data.hasResponded).toBe(true)

    const check = await get('/api/v1/me/device-permission')
    const d: DevicePermission = check.data
    expect(d.locationStatus, 'kalıcı olmalı').toBe('granted')
    expect(d.latitude).toBeCloseTo(41.1039, 3)
  })

  test('PUT: bildirim izni ayrı çağrıda verilir (push token ile), konum bilgisi BOZULMAZ (kısmi upsert)', async () => {
    const r = await put('/api/v1/me/device-permission', {
      locationStatus: null, notificationStatus: 'granted',
      latitude: null, longitude: null,
      pushToken: 'ExponentPushToken[e2e-test-token]', devicePlatform: 'ios',
    })
    expect(r.status).toBe(200)
    expect(r.data.notificationStatus).toBe('granted')
    expect(r.data.hasPushToken).toBe(true)
    expect(r.data.devicePlatform).toBe('ios')
    expect(r.data.locationStatus, 'önceki PUT ile ayarlanan konum durumu korunmalı').toBe('granted')
    expect(r.data.latitude).toBeCloseTo(41.1039, 3)
  })

  test('PUT: konum izni reddedilir (denied), koordinat set edilmez', async () => {
    const r = await put('/api/v1/me/device-permission', {
      locationStatus: 'denied', notificationStatus: null,
      latitude: 55.5, longitude: 55.5, pushToken: null, devicePlatform: null,
    })
    expect(r.status).toBe(200)
    expect(r.data.locationStatus).toBe('denied')
    expect(r.data.latitude, 'denied durumunda yeni koordinat kaydedilmemeli').not.toBe(55.5)
  })

  test('PUT: geçersiz izin durumu -> 400 VALIDATION_ERROR', async () => {
    const r = await put('/api/v1/me/device-permission', {
      locationStatus: 'sanane', notificationStatus: null,
      latitude: null, longitude: null, pushToken: null, devicePlatform: null,
    })
    expect(r.ok).toBeFalsy()
    expect(r.status).toBe(400)
    expect(r.code).toBe('VALIDATION_ERROR')
  })

  test('auth guard: token yoksa 401', async () => {
    const anon = await pwRequest.newContext()
    const res = await anon.get(`${API}/api/v1/me/device-permission`)
    expect(res.status()).toBe(401)
    await anon.dispose()
  })
})
