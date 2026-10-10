import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test'
import { TEST_TCKN, TEST_PASSWORD, TEST_OTP, hasCredentials } from './helpers/auth'

const API = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

let ctx: APIRequestContext
let token = ''
let adminToken = ''
let fixtureLibraryId = ''
let fixtureLibraryName = ''

async function citizenLogin(): Promise<string> {
  const l = await (await ctx.post(`${API}/api/v1/auth/citizen/login`, { data: { identifier: TEST_TCKN, password: TEST_PASSWORD } })).json()
  if (l.data?.accessToken) return l.data.accessToken
  const v = await (await ctx.post(`${API}/api/v1/auth/citizen/verify-otp`, { data: { otpSessionToken: l.data.otpSessionToken, code: TEST_OTP } })).json()
  return v.data.accessToken
}

async function adminLogin(): Promise<string> {
  const l = await (await ctx.post(`${API}/api/v1/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (l.data?.accessToken) return l.data.accessToken
  const v = await (await ctx.post(`${API}/api/v1/auth/verify-otp`, { data: { otpSessionToken: l.data.otpSessionToken, code: ADMIN_OTP } })).json()
  return v.data.accessToken
}

const auth = () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })
const adminAuth = () => ({ Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' })
const getJson = async (path: string) => (await (await ctx.get(`${API}${path}`, { headers: auth() })).json()).data
const post = async (path: string, body: unknown = {}) => {
  const res = await ctx.post(`${API}${path}`, { headers: auth(), data: body })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), ok: res.ok(), body: json, message: json?.message, code: json?.errorCode, data: json?.data }
}

async function firstFreeSeat(libId: string): Promise<string | null> {
  const plan = await getJson(`/api/v1/me/libraries/${libId}/seat-plan?date=${new Date().toISOString()}`)
  for (const f of (plan?.floors ?? [])) {
    const s = (f.seats || []).find((x: { status: string }) => x.status === 'free')
    if (s) return s.key
  }
  return null
}

async function ensureNoSession() {
  const s = await getJson('/api/v1/me/libraries/session')
  if (s) await post('/api/v1/me/libraries/exit', {})
}

async function createLibraryFixture(): Promise<{ id: string; name: string }> {
  const me = await (await ctx.get(`${API}/api/v1/auth/me`, { headers: adminAuth() })).json()
  const managerId = me?.data?.me?.id
  const tag = `E2E LibSession ${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  const sfRes = await ctx.post(`${API}/api/v1/service-facilities`, {
    headers: adminAuth(),
    data: {
      name: `${tag} Hizmet`, type: 'library', locationType: 'Indoor',
      city: 'İstanbul', district: 'Sultangazi', address: 'E2E No:1', latitude: 41.1039, longitude: 28.8674, managerId,
      weekdayOpen: '08:00', weekdayClose: '22:00', weekendOpen: '09:00', weekendClose: '20:00',
      parkingCapacity: 0, parkingType: 'Free', capacity: 100,
    },
  })
  const sf = (await sfRes.json()).data
  const libRes = await ctx.post(`${API}/api/v1/libraries`, {
    headers: adminAuth(),
    data: {
      name: `${tag} Kıraathane`, description: 'E2E oturum testi', serviceFacilityId: sf.id,
      seatingMode: 'masali', isMultiFloor: false,
      floors: [{ id: 'floor-1', name: 'Zemin Kat', capacity: 10, active: true, autoOpenWhenPreviousFull: false, sections: [{ id: 'sec-1', name: 'A', type: 'table', color: '#2563eb', tables: [{ id: 'tbl-1', name: 'Masa 1', seatCount: 4 }] }] }],
      amenities: null, queueEnabled: false, reservationEnabled: false,
      entryControlMode: 'manual', exitControlMode: 'manual', autoCheckOutAfterMinutes: 240,
      useCustomBreakSettings: false, breakDurationMinutes: 15, maxDailyBreaks: 3,
      longBreakDurationMinutes: 45, maxStudyHoursPerDay: 10, requireBreakAfterHours: 3,
      ipRestrictionEnabled: false, allowedIps: null, isActive: true, grantAccess: false,
      geofenceEnabled: false, geofenceLatitude: null, geofenceLongitude: null, geofenceRadiusMeters: 150,
    },
  })
  const lib = (await libRes.json()).data
  expect(lib?.id, `kütüphane fixture'ı oluşturulamadı: ${JSON.stringify(lib)}`).toBeTruthy()
  return { id: lib.id, name: lib.name }
}

async function checkInSomewhere(): Promise<{ libId: string; libName: string }> {
  if (fixtureLibraryId) {
    const seat = await firstFreeSeat(fixtureLibraryId)
    const wi = await post(`/api/v1/me/libraries/${fixtureLibraryId}/walk-in`, { seat })
    if (wi.ok) {
      const ci = await post(`/api/v1/me/libraries/${fixtureLibraryId}/check-in`, {})
      if (ci.ok) return { libId: fixtureLibraryId, libName: fixtureLibraryName || fixtureLibraryId }
      await post('/api/v1/me/libraries/exit', {})
    }
  }
  const libs = await getJson('/api/v1/me/libraries?Page=1&Limit=10')
  for (const lib of libs.items) {
    if (lib.id === fixtureLibraryId) continue
    const seat = await firstFreeSeat(lib.id)
    const wi = await post(`/api/v1/me/libraries/${lib.id}/walk-in`, { seat })
    if (!wi.ok) continue
    const ci = await post(`/api/v1/me/libraries/${lib.id}/check-in`, {})
    if (ci.ok) return { libId: lib.id, libName: lib.name }
    await post('/api/v1/me/libraries/exit', {})
  }
  throw new Error('Giriş yapılabilecek boş kütüphane bulunamadı')
}

test.describe.serial('Kütüphane — oturum & mola iş kuralları (API)', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  let originalSettings: Record<string, unknown> | null = null
  let targetLibraryId = ''

  test.beforeAll(async () => {
    ctx = await pwRequest.newContext()
    token = await citizenLogin()
    expect(token, 'citizen token alınmalı').toBeTruthy()
    adminToken = await adminLogin()
    expect(adminToken, 'admin token alınmalı').toBeTruthy()

    const fixture = await createLibraryFixture()
    fixtureLibraryId = fixture.id
    fixtureLibraryName = fixture.name
    targetLibraryId = fixtureLibraryId

    const getRes = await ctx.get(`${API}/api/v1/library-settings?libraryId=${targetLibraryId}`, { headers: adminAuth() })
    const current = (await getRes.json()).data
    originalSettings = current
    await ctx.put(`${API}/api/v1/library-settings?libraryId=${targetLibraryId}`, {
      headers: adminAuth(),
      data: { ...current, dailyVisitCap: 0, breakSystemEnabled: true, minEntryBeforeBreakMinutes: 30 },
    })

    await ensureNoSession()
  })

  test.afterAll(async () => {
    await ensureNoSession().catch(() => {})
    if (originalSettings && targetLibraryId) {
      await ctx.put(`${API}/api/v1/library-settings?libraryId=${targetLibraryId}`, { headers: adminAuth(), data: originalSettings }).catch(() => {})
    }
    await ctx.dispose()
  })

  test('walk-in → check-in → tam oturum başlar (inside)', async () => {
    const { libName } = await checkInSomewhere()
    const s = await getJson('/api/v1/me/libraries/session')
    expect(s, 'aktif oturum dönmeli').toBeTruthy()
    expect(s.status).toBe('inside')
    expect(s.libraryName).toBe(libName)
    expect(s.entryTime).toBeTruthy()
    expect(s.estimatedExitAt, 'tahmini çıkış hesaplanmalı').toBeTruthy()
    expect(s.remainingMinutes, 'kalan süre pozitif').toBeGreaterThan(0)
  })

  test('kısa mola girişten 30 dk geçmeden reddedilir (kalan dk mesajı)', async () => {
    const r = await post('/api/v1/me/libraries/break', { type: 'short' })
    expect(r.ok, 'kısa mola hemen reddedilmeli').toBeFalsy()
    expect(r.code).toBe('TOO_SOON_FOR_BREAK')
    expect(r.message).toMatch(/30 dakika|dakika sonra/i)
  })

  test('uzun mola limitsiz (maxDailyLongBreaks=0) → başlar; süre duraklar', async () => {
    const before = await getJson('/api/v1/me/libraries/session')
    const lb = await post('/api/v1/me/libraries/break', { type: 'long' })
    expect(lb.ok, 'uzun mola başlamalı').toBeTruthy()
    const onBreak = await getJson('/api/v1/me/libraries/session')
    expect(onBreak.status, 'uzun molada status on_break_long').toBe('on_break_long')
    expect(onBreak.breakType).toBe('long')
    expect(onBreak.breakRemainingMinutes, 'mola geri sayacı').toBeGreaterThan(0)
    expect(onBreak.remainingMinutes, 'mola başında kalan süre korunur (duraklar)').toBe(before.remainingMinutes)
  })

  test('molada iken yeni mola reddedilir (inside değil)', async () => {
    const r = await post('/api/v1/me/libraries/break', { type: 'short' })
    expect(r.ok).toBeFalsy()
    expect(r.code, 'molada yeni mola engellenir').toMatch(/NOT_INSIDE|ALREADY_ON_BREAK|BREAK/i)
  })

  test('moladan dön → tekrar inside', async () => {
    const eb = await post('/api/v1/me/libraries/break/end', {})
    expect(eb.ok).toBeTruthy()
    const s = await getJson('/api/v1/me/libraries/session')
    expect(s.status).toBe('inside')
  })

  test('history: entry → break_start → break_end kronolojik', async () => {
    const h = await getJson('/api/v1/me/libraries/history')
    const kinds = (h.items ?? []).map((m: { kind: string }) => m.kind)
    expect(kinds).toContain('entry')
    expect(kinds).toContain('break_start')
    expect(kinds).toContain('break_end')
    const times = (h.items ?? []).map((m: { at: string }) => new Date(m.at).getTime())
    const sorted = [...times].sort((a, b) => a - b)
    expect(times).toEqual(sorted)
  })

  test('başka kütüphaneye ikinci giriş reddedilir (tek aktif oturum)', async () => {
    const libs = await getJson('/api/v1/me/libraries?Page=1&Limit=10')
    const current = await getJson('/api/v1/me/libraries/session')
    const other = libs.items.find((l: { id: string; accessType?: string }) => l.id !== current.libraryId && l.accessType !== 'open')
    expect(other, 'oturum kısıtına tabi (open olmayan) ikinci bir kütüphane bulunmalı').toBeTruthy()
    const seat = await firstFreeSeat(other.id)
    const wi = await post(`/api/v1/me/libraries/${other.id}/walk-in`, { seat })
    const ci = wi.ok ? await post(`/api/v1/me/libraries/${other.id}/check-in`, {}) : wi
    expect(ci.ok, 'ikinci giriş engellenmeli').toBeFalsy()
    expect(ci.code).toMatch(/ACTIVE_SESSION_EXISTS|RESERV/)
  })

  test('exit → oturum kapanır (session null)', async () => {
    const ex = await post('/api/v1/me/libraries/exit', {})
    expect(ex.status).toBe(200)
    const s = await getJson('/api/v1/me/libraries/session')
    expect(s).toBeNull()
    const h = await getJson('/api/v1/me/libraries/history')
    expect((h.items ?? []).map((m: { kind: string }) => m.kind)).toContain('exit')
  })

  test('aynı kütüphaneye tekrar giriş yapılabilir (günlük giriş limiti YOK)', async () => {
    const first = await checkInSomewhere()
    await post('/api/v1/me/libraries/exit', {})
    const seat = await firstFreeSeat(first.libId)
    const wi = await post(`/api/v1/me/libraries/${first.libId}/walk-in`, { seat })
    const ci = wi.ok ? await post(`/api/v1/me/libraries/${first.libId}/check-in`, {}) : wi
    expect(ci.ok, 'ikinci giriş DAILY_LIMIT vermemeli').toBeTruthy()
    expect(ci.code).not.toBe('DAILY_LIMIT_REACHED')
    await post('/api/v1/me/libraries/exit', {})
  })

  test('KRİTİK: session yanıtı gerçek breakDurationMinutes/longBreakDurationMinutes döndürüyor (admin panel değerini yansıtır, hardcoded değil)', async () => {
    await checkInSomewhere()
    const s = await getJson('/api/v1/me/libraries/session')
    expect(s, 'aktif oturum dönmeli').toBeTruthy()
    expect(typeof s.breakDurationMinutes).toBe('number')
    expect(typeof s.longBreakDurationMinutes).toBe('number')
    expect(s.breakDurationMinutes, 'kısa mola süresi kütüphane ayarındaki değerle eşleşmeli').toBe((originalSettings as { breakDurationMinutes: number }).breakDurationMinutes)
    expect(s.longBreakDurationMinutes, 'uzun mola süresi kütüphane ayarındaki değerle eşleşmeli').toBe((originalSettings as { longBreakDurationMinutes: number }).longBreakDurationMinutes)
    expect(typeof s.breakSystemEnabled).toBe('boolean')
    await post('/api/v1/me/libraries/exit', {})
  })

  test('KRİTİK: session yanıtı mutlak bitiş zamanı (estimatedExitAt) döndürüyor — client canlı geri sayım hesaplayabilir', async () => {
    await checkInSomewhere()
    const s = await getJson('/api/v1/me/libraries/session')
    expect(s.estimatedExitAt, 'mutlak bitiş zamanı olmalı (client bunu her saniye "now" ile karşılaştırıp geri sayım üretir)').toBeTruthy()
    const deadline = new Date(s.estimatedExitAt).getTime()
    const now = Date.now()
    expect(deadline, 'bitiş zamanı gelecekte olmalı (henüz süre dolmamış)').toBeGreaterThan(now)
    await post('/api/v1/me/libraries/exit', {})
  })

  test('KRİTİK: session yanıtı moladayken breakEndsAt (mutlak zaman) döndürüyor', async () => {
    await checkInSomewhere()
    const brk = await post('/api/v1/me/libraries/break', { type: 'long' });
    if (brk.ok) {
      const s = await getJson('/api/v1/me/libraries/session')
      expect(s.status).toBe('on_break_long')
      expect(s.breakEndsAt, 'moladayken mutlak mola bitiş zamanı dönmeli').toBeTruthy()
      const deadline = new Date(s.breakEndsAt).getTime()
      expect(deadline, 'mola bitiş zamanı gelecekte olmalı').toBeGreaterThan(Date.now())
    }
    await post('/api/v1/me/libraries/exit', {})
  })
})

