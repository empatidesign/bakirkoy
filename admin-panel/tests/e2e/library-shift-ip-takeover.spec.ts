import { test, expect } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!
const MOCK_GENERATED_PASSWORD = 'sultangazi'

type ApiResponse<T> = { data?: T; errorCode?: string; message?: string }
type CreatedEntity = { id: string }
type RoleOption = { key: string; name: string }

let cachedSuperAdminToken = ''
let cachedSuperAdminId = ''

async function apiRequest<T>(
  method: string,
  path: string,
  token: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ ok: boolean; status: number; data?: T; errorCode?: string; message?: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({})) as ApiResponse<T>
  return { ok: res.ok, status: res.status, data: json.data, errorCode: json.errorCode, message: json.message }
}

async function superAdminToken(): Promise<string> {
  if (cachedSuperAdminToken) return cachedSuperAdminToken

  const loginRes = await apiRequest<{ accessToken?: string; otpSessionToken?: string }>(
    'POST', '/auth/login', '', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  )
  if (loginRes.data?.accessToken) { cachedSuperAdminToken = loginRes.data.accessToken; return cachedSuperAdminToken }
  const otpSessionToken = loginRes.data?.otpSessionToken
  if (!otpSessionToken) throw new Error(`Süper admin login başarısız: ${JSON.stringify(loginRes)}`)

  const verifyRes = await apiRequest<{ accessToken?: string }>(
    'POST', '/auth/verify-otp', '', { otpSessionToken, code: ADMIN_OTP },
  )
  cachedSuperAdminToken = verifyRes.data?.accessToken ?? ''
  if (!cachedSuperAdminToken) throw new Error(`Süper admin OTP doğrulama başarısız: ${JSON.stringify(verifyRes)}`)
  return cachedSuperAdminToken
}

async function superAdminId(): Promise<string> {
  if (cachedSuperAdminId) return cachedSuperAdminId
  const token = await superAdminToken()
  const me = await apiRequest<{ me: { id: string } }>('GET', '/auth/me', token)
  cachedSuperAdminId = me.data?.me?.id ?? ''
  if (!cachedSuperAdminId) throw new Error(`Süper admin id alınamadı: ${JSON.stringify(me)}`)
  return cachedSuperAdminId
}

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

async function createLoggedInAdminUser(tag: string): Promise<{ adminUserId: string; token: string; email: string }> {
  const superToken = await superAdminToken()

  const roleOptions = await apiRequest<RoleOption[]>('GET', '/roles/options', superToken)
  const role = roleOptions.data?.find((r) => r.key !== 'SuperAdmin') ?? roleOptions.data?.[0]
  expect(role?.key, 'personel rolü bulunmalı').toBeTruthy()

  const email = `e2e.ipshift.${Date.now()}.${Math.random().toString(16).slice(2, 6)}@nexora.local`
  const phone = `5${String(Date.now()).slice(-9)}`

  const created = await apiRequest<{ id: string }>('POST', '/admins', superToken, {
    fullName: tag, email, phone, role: role!.key, deliveryChannel: 'Email',
  })
  expect(created.ok, `personel adayı oluşturulamadı: ${JSON.stringify(created)}`).toBeTruthy()
  const adminUserId = created.data!.id

  const loginRes = await apiRequest<{ accessToken?: string; otpSessionToken?: string }>(
    'POST', '/auth/login', '', { email, password: MOCK_GENERATED_PASSWORD },
  )
  const otpSessionToken = loginRes.data?.otpSessionToken
  expect(otpSessionToken, `ilk giriş OTP akışı başlamalı: ${JSON.stringify(loginRes)}`).toBeTruthy()

  const verifyRes = await apiRequest<{ accessToken?: string }>(
    'POST', '/auth/verify-otp', '', { otpSessionToken, code: ADMIN_OTP },
  )
  let token = verifyRes.data?.accessToken ?? ''
  expect(token, `ilk giriş OTP doğrulanmalı: ${JSON.stringify(verifyRes)}`).toBeTruthy()

  const newPassword = `E2eIpShift${Date.now()}!Aa`
  await apiRequest('POST', '/auth/change-initial-password', token, { newPassword })

  return { adminUserId, token, email }
}

test.describe.serial('Kütüphane mesai — aynı terminalden (IP) çakışan self mesai otomatik devralınır', () => {
  let libraryId = ''
  let serviceFacilityId = ''
  let staffAId = ''
  let staffBId = ''
  let adminAId = ''
  let adminBId = ''
  let tokenA = ''
  let tokenB = ''

  const SHARED_TERMINAL_IP = `10.77.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`

  test.beforeAll(async () => {
    test.setTimeout(60000)
    const superToken = await superAdminToken()
    const tag = uniq('E2E IpShift Lib')

    const sf = await apiRequest<CreatedEntity>('POST', '/service-facilities', superToken, {
      name: `${tag} Tesisi`, type: 'library', locationType: 'Indoor',
      city: 'İstanbul', district: 'Sultangazi', address: 'E2E IpShift Mah. No:1', latitude: 41.1039, longitude: 28.8674,
      managerId: await superAdminId(), weekdayOpen: '08:00', weekdayClose: '22:00',
      weekendOpen: '09:00', weekendClose: '20:00', parkingCapacity: 0, parkingType: 'Free', capacity: 100,
    })
    expect(sf.ok, `service-facility oluşturulamadı: ${JSON.stringify(sf)}`).toBeTruthy()
    serviceFacilityId = sf.data!.id

    const lib = await apiRequest<CreatedEntity>('POST', '/libraries', superToken, {
      name: `${tag} Kıraathane`, description: 'E2E terminal/IP devralma testi',
      serviceFacilityId: sf.data!.id, seatingMode: 'masali', isMultiFloor: false,
      floors: [{ id: 'floor-1', name: 'Zemin Kat', capacity: 4, active: true, autoOpenWhenPreviousFull: false, sections: [{ id: 'sec-1', name: 'A', seats: ['A1'] }] }],
      amenities: null, queueEnabled: false, reservationEnabled: false,
      entryControlMode: 'manual', exitControlMode: 'manual', autoCheckOutAfterMinutes: 240,
      useCustomBreakSettings: false, breakDurationMinutes: 15, maxDailyBreaks: 3,
      longBreakDurationMinutes: 45, maxStudyHoursPerDay: 10, requireBreakAfterHours: 3,
      ipRestrictionEnabled: false, allowedIps: null, isActive: true, grantAccess: false,
      geofenceEnabled: false, geofenceLatitude: null, geofenceLongitude: null, geofenceRadiusMeters: 150,
    })
    expect(lib.ok, `library oluşturulamadı: ${JSON.stringify(lib)}`).toBeTruthy()
    libraryId = lib.data!.id

    const a = await createLoggedInAdminUser(uniq('E2E IpShift Personel A'))
    const b = await createLoggedInAdminUser(uniq('E2E IpShift Personel B'))
    adminAId = a.adminUserId; tokenA = a.token
    adminBId = b.adminUserId; tokenB = b.token

    const staffA = await apiRequest<CreatedEntity>('POST', '/library-staff', superToken, {
      adminUserId: adminAId, workingLibraryIds: [libraryId],
    })
    expect(staffA.ok, `staff A ataması yapılamadı: ${JSON.stringify(staffA)}`).toBeTruthy()
    staffAId = staffA.data!.id

    const staffB = await apiRequest<CreatedEntity>('POST', '/library-staff', superToken, {
      adminUserId: adminBId, workingLibraryIds: [libraryId],
    })
    expect(staffB.ok, `staff B ataması yapılamadı: ${JSON.stringify(staffB)}`).toBeTruthy()
    staffBId = staffB.data!.id
  })

  test.afterAll(async () => {
    const superToken = await superAdminToken()
    await apiRequest('POST', `/libraries/${libraryId}/shifts/me/end`, tokenA, undefined, { 'X-Forwarded-For': SHARED_TERMINAL_IP }).catch(() => {})
    await apiRequest('POST', `/libraries/${libraryId}/shifts/me/end`, tokenB, undefined, { 'X-Forwarded-For': SHARED_TERMINAL_IP }).catch(() => {})
    if (staffAId) await apiRequest('DELETE', `/library-staff/${staffAId}`, superToken).catch(() => {})
    if (staffBId) await apiRequest('DELETE', `/library-staff/${staffBId}`, superToken).catch(() => {})
    if (adminAId) await apiRequest('DELETE', `/admins/${adminAId}`, superToken).catch(() => {})
    if (adminBId) await apiRequest('DELETE', `/admins/${adminBId}`, superToken).catch(() => {})
    // NOT (2026-09-05, gerçek testte bulunan bug): Bu afterAll library/service-facility'yi
    // HİÇ silmiyordu (orphan bulundu, manuel temizlendi).
    if (libraryId) await apiRequest('DELETE', `/libraries/${libraryId}`, superToken).catch(() => {})
    if (serviceFacilityId) await apiRequest('DELETE', `/service-facilities/${serviceFacilityId}`, superToken).catch(() => {})
  })

  test('Personel A aynı terminalden (IP) self mesai başlatır — aktif olur', async () => {
    const res = await apiRequest<{ status: string; initiationType: string }>(
      'POST', `/libraries/${libraryId}/shifts/me/start`, tokenA,
      { location: null, notes: null },
      { 'X-Forwarded-For': SHARED_TERMINAL_IP },
    )
    expect(res.ok, `Personel A mesaisi başlamalı: ${JSON.stringify(res)}`).toBeTruthy()
    expect(res.data!.status).toBe('active')
  })

  test('Personel B AYNI terminalden (aynı IP) self mesai başlatınca, Personel A\'nın mesaisi otomatik sonlanır', async () => {
    const beforeMine = await apiRequest<{ activeShift: { id: string; status: string } | null }>(
      'GET', `/libraries/${libraryId}/shifts/me`, tokenA,
    )
    expect(beforeMine.data?.activeShift?.status, 'B girmeden önce A aktif olmalı').toBe('active')

    const startB = await apiRequest<{ status: string; initiationType: string }>(
      'POST', `/libraries/${libraryId}/shifts/me/start`, tokenB,
      { location: null, notes: null },
      { 'X-Forwarded-For': SHARED_TERMINAL_IP },
    )
    expect(startB.ok, `Personel B mesaisi başlamalı: ${JSON.stringify(startB)}`).toBeTruthy()
    expect(startB.data!.status).toBe('active')

    const afterMineA = await apiRequest<{ activeShift: { status: string } | null }>(
      'GET', `/libraries/${libraryId}/shifts/me`, tokenA,
    )
    expect(afterMineA.data?.activeShift, 'B girince A\'nın aktif mesaisi kalmamalı').toBeNull()

    const afterMineB = await apiRequest<{ activeShift: { status: string } | null }>(
      'GET', `/libraries/${libraryId}/shifts/me`, tokenB,
    )
    expect(afterMineB.data?.activeShift?.status, 'B aktif kalmalı').toBe('active')
  })

  test('Devralınan mesai geçmişte EndedByIpTakeover=true olarak işaretli görünür', async () => {
    const superToken = await superAdminToken()
    const staffAShifts = await apiRequest<Array<{ status: string; endedByIpTakeover: boolean }>>(
      'GET', `/library-staff/${staffAId}/shifts`, superToken,
    )
    expect(staffAShifts.ok, `A'nın mesai geçmişi alınamadı: ${JSON.stringify(staffAShifts)}`).toBeTruthy()
    const lastShift = staffAShifts.data?.[0]
    expect(lastShift?.status).toBe('ended')
    expect(lastShift?.endedByIpTakeover, 'terminal devralma bayrağı işaretli olmalı').toBe(true)
  })

  test('Farklı terminalden (farklı IP) self mesai başlatmak diğerini ETKİLEMEZ', async () => {
    const otherIp = `10.88.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`

    const startA2 = await apiRequest<{ status: string }>(
      'POST', `/libraries/${libraryId}/shifts/me/start`, tokenA,
      { location: null, notes: null },
      { 'X-Forwarded-For': otherIp },
    )
    expect(startA2.ok, `A farklı terminalden tekrar başlayabilmeli: ${JSON.stringify(startA2)}`).toBeTruthy()
    expect(startA2.data!.status).toBe('active')

    const mineB = await apiRequest<{ activeShift: { status: string } | null }>(
      'GET', `/libraries/${libraryId}/shifts/me`, tokenB,
    )
    expect(mineB.data?.activeShift?.status, 'farklı IP\'den A girişi B\'yi etkilememeli').toBe('active')

    await apiRequest('POST', `/libraries/${libraryId}/shifts/me/end`, tokenA, undefined, { 'X-Forwarded-For': otherIp })
  })
})
