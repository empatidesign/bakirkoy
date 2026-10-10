import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test'
import { TEST_TCKN, TEST_PASSWORD, TEST_OTP, hasCredentials } from './helpers/auth'

const API = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ''
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ''
const ADMIN_OTP = process.env.E2E_ADMIN_OTP || process.env.E2E_OTP_CODE || ''
const FAKE_TCKN = '10000000146'

type DeviceReply = Record<string, unknown> & { Clear_Screen?: string; Trigger_Relay?: unknown; Draw_Text?: unknown[] }

let ctx: APIRequestContext
let adminToken = ''
let citizenToken = ''
let libraryId = ''
let facilityId = ''
let deviceDbId = ''
let deviceSerial = ''
let deviceKey = ''

const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` })
const citizenAuth = () => ({ Authorization: `Bearer ${citizenToken}` })

async function adminLogin(): Promise<string> {
  const l = await (await ctx.post(`${API}/api/v1/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (l.data?.accessToken) return l.data.accessToken
  const v = await (await ctx.post(`${API}/api/v1/auth/verify-otp`, { data: { otpSessionToken: l.data?.otpSessionToken, code: ADMIN_OTP } })).json()
  return v.data?.accessToken ?? ''
}

async function citizenLogin(): Promise<string> {
  const l = await (await ctx.post(`${API}/api/v1/auth/citizen/login`, { data: { identifier: TEST_TCKN, password: TEST_PASSWORD } })).json()
  if (l.data?.accessToken) return l.data.accessToken
  const v = await (await ctx.post(`${API}/api/v1/auth/citizen/verify-otp`, { data: { otpSessionToken: l.data?.otpSessionToken, code: TEST_OTP } })).json()
  return v.data?.accessToken ?? ''
}

async function identityQr(): Promise<{ token: string; shortCode: string }> {
  const res = await ctx.get(`${API}/api/v1/me/identity-qr`, { headers: citizenAuth() })
  expect(res.ok(), `identity-qr ${res.status()}`).toBeTruthy()
  return (await res.json()).data
}

async function staffScan(token: string, action: string) {
  const res = await ctx.post(`${API}/api/v1/libraries/${libraryId}/scan`, { headers: adminAuth(), data: { token, action } })
  const body = await res.json().catch(() => ({}))
  return { status: res.status(), code: body?.errorCode as string | undefined, data: body?.data }
}

async function deviceSend(data: string, key: string | null = deviceKey): Promise<DeviceReply> {
  const headers: Record<string, string> = {}
  if (key !== null) headers['X-Device-Key'] = key
  const res = await ctx.post(`${API}/api/v1/library-device/webaccess`, {
    headers,
    form: { Device_Id: deviceSerial, Session_Id: `s${Date.now()}`, Message_Type: '1', Data: data },
  })
  expect(res.status(), 'webaccess HTTP durumu').toBe(200)
  return res.json()
}

const isApproved = (r: DeviceReply) => r.Trigger_Relay !== undefined && r.Clear_Screen === '1A8A52'
const isDenied = (r: DeviceReply) => r.Clear_Screen === 'C8412F'
const screenText = (r: DeviceReply) => String(r.Draw_Text?.[2] ?? '')

async function mySession() {
  const res = await ctx.get(`${API}/api/v1/me/libraries/session`, { headers: citizenAuth() })
  return (await res.json()).data
}

async function ensureNoSession() {
  if (await mySession()) await ctx.post(`${API}/api/v1/me/libraries/exit`, { headers: citizenAuth(), data: {} })
}

test.describe.serial('Kütüphane QR okuma yolları — dönen kimlik QR (TC içermez)', () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD verilmedi')

  test.beforeAll(async () => {
    ctx = await pwRequest.newContext()
    adminToken = await adminLogin()
    expect(adminToken, 'admin token alınmalı').toBeTruthy()

    const me = await (await ctx.get(`${API}/api/v1/auth/me`, { headers: adminAuth() })).json()
    const tag = `E2E QrPath ${Date.now()}`
    const sf = (await (await ctx.post(`${API}/api/v1/service-facilities`, {
      headers: adminAuth(),
      data: {
        name: `${tag} Hizmet`, type: 'library', locationType: 'Indoor',
        city: 'İstanbul', district: 'Sultangazi', address: 'E2E No:1', managerId: me?.data?.me?.id,
        weekdayOpen: '00:00', weekdayClose: '23:59', weekendOpen: '00:00', weekendClose: '23:59',
        parkingCapacity: 0, parkingType: 'Free', capacity: 100, latitude: 41.1, longitude: 28.87,
      },
    })).json()).data
    expect(sf?.id, 'hizmet tesisi fixture\'ı').toBeTruthy()
    facilityId = sf.id
    const libBody = await (await ctx.post(`${API}/api/v1/libraries`, {
      headers: adminAuth(),
      data: {
        name: `${tag} Kıraathane`, description: 'E2E QR okuma yolu testi', serviceFacilityId: sf?.id,
        seatingMode: 'sirali', isMultiFloor: false, accessType: 'device', deviceKind: 'qr',
        floors: [{ id: 'floor-1', name: 'Zemin Kat', capacity: 10, active: true, autoOpenWhenPreviousFull: false, sections: [{ id: 'sec-1', name: 'A', type: 'table', color: '#2563eb', tables: [{ id: 'tbl-1', name: 'Masa 1', seatCount: 4 }] }] }],
        amenities: null, queueEnabled: false, reservationEnabled: false,
        entryControlMode: 'manual', exitControlMode: 'manual', autoCheckOutAfterMinutes: 240,
        useCustomBreakSettings: false, breakDurationMinutes: 15, maxDailyBreaks: 3,
        longBreakDurationMinutes: 45, maxStudyHoursPerDay: 10, requireBreakAfterHours: 3,
        ipRestrictionEnabled: false, allowedIps: null, isActive: true, grantAccess: false,
        geofenceEnabled: false, geofenceLatitude: null, geofenceLongitude: null, geofenceRadiusMeters: 150,
      },
    })).json()
    const lib = libBody.data
    expect(lib?.id, `kütüphane fixture'ı: ${JSON.stringify(libBody)}`).toBeTruthy()
    libraryId = lib.id

    const settings = (await (await ctx.get(`${API}/api/v1/library-settings?libraryId=${libraryId}`, { headers: adminAuth() })).json()).data
    await ctx.put(`${API}/api/v1/library-settings?libraryId=${libraryId}`, { headers: adminAuth(), data: { ...settings, dailyVisitCap: 0, blockEntryOnOverdue: false } })

    deviceSerial = String(9_000_000_000 + Math.floor(Math.random() * 999_999_999))
    const devRes = await ctx.post(`${API}/api/v1/libraries/${libraryId}/devices`, {
      headers: adminAuth(),
      data: {
        name: `${tag} Turnike`, direction: 'entry', deviceId: deviceSerial, ipAddress: null, port: null,
        username: null, password: null, relayNo: 1, relayMs: 500, workMode: 'online', httpPath: null,
        triggerLockOnSuccess: true, operationMode: 'toggle', toggleCooldownMinutes: 1,
      },
    })
    const dev = (await devRes.json()).data
    expect(dev?.id, `cihaz fixture'ı: ${JSON.stringify(dev)}`).toBeTruthy()
    deviceDbId = dev.id
    deviceKey = (await (await ctx.get(`${API}/api/v1/library-devices/${deviceDbId}/api-key`, { headers: adminAuth() })).json()).data?.apiKey
    expect(deviceKey, 'cihaz API anahtarı').toBeTruthy()

    if (hasCredentials()) {
      citizenToken = await citizenLogin()
      expect(citizenToken, 'vatandaş token alınmalı').toBeTruthy()
      await ensureNoSession()
    }
  })

  test.afterAll(async () => {
    if (citizenToken) await ensureNoSession().catch(() => {})
    if (deviceDbId) await ctx.delete(`${API}/api/v1/library-devices/${deviceDbId}`, { headers: adminAuth() }).catch(() => {})
    if (libraryId) await ctx.delete(`${API}/api/v1/libraries/${libraryId}`, { headers: adminAuth() }).catch(() => {})
    if (facilityId) await ctx.delete(`${API}/api/v1/service-facilities/${facilityId}`, { headers: adminAuth() }).catch(() => {})
    await ctx?.dispose()
  })

  test('webaccess ucu ayakta (GET sağlık)', async () => {
    const res = await ctx.get(`${API}/api/v1/library-device/webaccess`)
    expect(res.status()).toBe(200)
    expect((await res.json()).status).toBe('ok')
  })

  test('görevli okutma: çıplak TC ve rastgele metin INVALID_QR ile reddedilir', async () => {
    const tc = await staffScan(FAKE_TCKN, 'entry')
    expect(tc.status).toBe(409)
    expect(tc.code).toBe('INVALID_QR')
    const junk = await staffScan('nxr-cid_AAAA.BBBB', 'entry')
    expect(junk.code).toBe('INVALID_QR')
  })

  test('turnike: yanlış anahtar ve anahtarsız istek reddedilir', async () => {
    const wrong = await deviceSend('nxr-cid_x.y\r', 'yanlis-anahtar')
    expect(isDenied(wrong)).toBeTruthy()
    expect(screenText(wrong)).toContain('yetkisi')
    const none = await deviceSend('nxr-cid_x.y\r', null)
    expect(isDenied(none)).toBeTruthy()
  })

  test('turnike: çıplak TC okutulunca kapı açılmaz', async () => {
    const r = await deviceSend(`${FAKE_TCKN}\r`)
    expect(isDenied(r)).toBeTruthy()
    expect(isApproved(r)).toBeFalsy()
  })

  test.describe('vatandaş QR ile uçtan uca', () => {
    test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

    test('kimlik QR içeriğinde TC yok, katılımcıya çözülebilir imzalı kod', async () => {
      const qr = await identityQr()
      expect(qr.token.startsWith('nxr-cid_')).toBeTruthy()
      expect(qr.shortCode).toMatch(/^[2-9A-HJ-NP-Z]{10}$/)
      const payloadB64 = qr.token.slice('nxr-cid_'.length).split('.')[0]
      const payload = Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
      expect(payload).not.toContain(TEST_TCKN)
      expect(qr.token).not.toContain(TEST_TCKN)
    })

    test('turnike: parçalı gelen dönen token birleşir, giriş yapılır, kapı açılır', async () => {
      const { token } = await identityQr()
      const half = Math.floor(token.length / 2)
      const first = await deviceSend(token.slice(0, half))
      expect(isApproved(first) || isDenied(first), 'ilk parça yalnız ACK olmalı').toBeFalsy()
      const second = await deviceSend(`${token.slice(half)}\r`)
      expect(isApproved(second), `beklenen onay, gelen: ${screenText(second)}`).toBeTruthy()
      const s = await mySession()
      expect(s?.libraryId).toBe(libraryId)
    })

    test('görevli okutma: yeni token ile çıkış verilir', async () => {
      const { token } = await identityQr()
      const r = await staffScan(token, 'exit')
      expect(r.status, `scan exit: ${r.code}`).toBe(200)
      expect(r.data?.action).toBe('checkout')
      expect(await mySession()).toBeFalsy()
    })

    test('kısa kod: bir kez geçer, ikinci kullanım INVALID_QR', async () => {
      const { shortCode } = await identityQr()
      const r = await deviceSend(`${shortCode}\r`)
      expect(isApproved(r), `kısa kod onayı, gelen: ${screenText(r)}`).toBeTruthy()
      const again = await staffScan(shortCode, 'exit')
      expect(again.code).toBe('INVALID_QR')
    })
  })
})
