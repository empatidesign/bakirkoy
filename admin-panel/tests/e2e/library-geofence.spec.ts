import { test, expect } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

type ApiResponse<T> = { data?: T; errorCode?: string; message?: string }
type CreatedEntity = { id: string }

let cachedToken = ''

async function apiToken(): Promise<string> {
  if (cachedToken) return cachedToken
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  }).then((r) => r.json())

  if (loginRes?.data?.accessToken) { cachedToken = loginRes.data.accessToken; return cachedToken }
  const otpSessionToken = loginRes?.data?.otpSessionToken
  if (!otpSessionToken) throw new Error(`API login failed: ${JSON.stringify(loginRes)}`)

  const verifyRes = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otpSessionToken, code: ADMIN_OTP }),
  }).then((r) => r.json())

  cachedToken = verifyRes?.data?.accessToken
  if (!cachedToken) throw new Error(`API OTP failed: ${JSON.stringify(verifyRes)}`)
  return cachedToken
}

async function apiRequest<T>(method: string, path: string, token: string, body?: unknown): Promise<{ ok: boolean; status: number; data?: T; errorCode?: string; message?: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({})) as ApiResponse<T>
  return { ok: res.ok, status: res.status, data: json.data, errorCode: json.errorCode, message: json.message }
}

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

const LIBRARY_COORDS = { lat: 41.1039, lng: 28.8674 }
const FAR_COORDS = { lat: 39.9334, lng: 32.8597 }
const NEAR_COORDS = { lat: 41.1040, lng: 28.8675 }

test.describe.serial('Kütüphane mesai — GPS geofence doğrulaması', () => {
  let libraryId = ''
  let serviceFacilityId = ''
  let staffId = ''
  let adminUserId = ''

  test.beforeAll(async () => {
    const token = await apiToken()
    const tag = uniq('E2E Geofence Lib')

    const me = await apiRequest<{ me: { id: string } }>('GET', '/auth/me', token)
    adminUserId = me.data?.me?.id ?? ''
    expect(adminUserId, 'admin user id alınmalı').toBeTruthy()

    const sf = await apiRequest<CreatedEntity>('POST', '/service-facilities', token, {
      name: `${tag} Tesisi`, type: 'library', locationType: 'Indoor',
      city: 'İstanbul', district: 'Sultangazi', address: 'E2E Geofence Mah. No:1',
      managerId: adminUserId, weekdayOpen: '08:00', weekdayClose: '22:00',
      weekendOpen: '09:00', weekendClose: '20:00', parkingCapacity: 0, parkingType: 'Free', capacity: 100,
    })
    expect(sf.ok, `service-facility oluşturulamadı: ${JSON.stringify(sf)}`).toBeTruthy()
    serviceFacilityId = sf.data!.id

    const lib = await apiRequest<CreatedEntity>('POST', '/libraries', token, {
      name: `${tag} Kıraathane`, description: 'E2E geofence testi',
      serviceFacilityId: sf.data!.id, seatingMode: 'masali', isMultiFloor: false,
      floors: [{ id: 'floor-1', name: 'Zemin Kat', capacity: 4, active: true, autoOpenWhenPreviousFull: false, sections: [{ id: 'sec-1', name: 'A', seats: ['A1'] }] }],
      amenities: null, queueEnabled: false, reservationEnabled: false,
      entryControlMode: 'manual', exitControlMode: 'manual', autoCheckOutAfterMinutes: 240,
      useCustomBreakSettings: false, breakDurationMinutes: 15, maxDailyBreaks: 3,
      longBreakDurationMinutes: 45, maxStudyHoursPerDay: 10, requireBreakAfterHours: 3,
      ipRestrictionEnabled: false, allowedIps: null, isActive: true, grantAccess: false,
      geofenceEnabled: true, geofenceLatitude: LIBRARY_COORDS.lat, geofenceLongitude: LIBRARY_COORDS.lng,
      geofenceRadiusMeters: 150,
    })
    expect(lib.ok, `library oluşturulamadı: ${JSON.stringify(lib)}`).toBeTruthy()
    libraryId = lib.data!.id

    const staff = await apiRequest<CreatedEntity>('POST', '/library-staff', token, {
      adminUserId, workingLibraryIds: [libraryId],
    })
    expect(staff.ok, `staff ataması yapılamadı: ${JSON.stringify(staff)}`).toBeTruthy()
    staffId = staff.data!.id
  })

  test.afterAll(async () => {
    const token = await apiToken()
    await apiRequest('POST', `/libraries/${libraryId}/shifts/me/end`, token).catch(() => {})
    if (staffId) await apiRequest('DELETE', `/library-staff/${staffId}`, token).catch(() => {})
    // NOT (2026-09-05, gerçek testte bulunan bug): Bu afterAll library/service-facility'yi
    // HİÇ silmiyordu — sadece staff/shift temizleniyordu (orphan bulundu, manuel temizlendi).
    if (libraryId) await apiRequest('DELETE', `/libraries/${libraryId}`, token).catch(() => {})
    if (serviceFacilityId) await apiRequest('DELETE', `/service-facilities/${serviceFacilityId}`, token).catch(() => {})
  })

  test('GET /libraries/:id: oluşturulan geofence alanları API üzerinden doğru dönüyor', async () => {
    const token = await apiToken()
    const res = await apiRequest<{ geofenceEnabled: boolean; geofenceLatitude: number; geofenceLongitude: number; geofenceRadiusMeters: number }>(
      'GET', `/libraries/${libraryId}`, token,
    )
    expect(res.ok).toBeTruthy()
    expect(res.data!.geofenceEnabled).toBe(true)
    expect(res.data!.geofenceLatitude).toBeCloseTo(LIBRARY_COORDS.lat, 3)
    expect(res.data!.geofenceLongitude).toBeCloseTo(LIBRARY_COORDS.lng, 3)
    expect(res.data!.geofenceRadiusMeters).toBe(150)
  })

  test('self mesai: konum gönderilmezse LOCATION_REQUIRED ile reddedilir', async () => {
    const token = await apiToken()
    const res = await apiRequest('POST', `/libraries/${libraryId}/shifts/me/start`, token, {
      location: null, notes: null,
    })
    expect(res.ok).toBeFalsy()
    expect(res.status).toBe(409)
    expect(res.errorCode).toBe('LOCATION_REQUIRED')
  })

  test('self mesai: kütüphaneden ~350km uzak konum OUTSIDE_GEOFENCE ile reddedilir (gerçek Haversine mesafesi)', async () => {
    const token = await apiToken()
    const res = await apiRequest('POST', `/libraries/${libraryId}/shifts/me/start`, token, {
      location: null, notes: null, latitude: FAR_COORDS.lat, longitude: FAR_COORDS.lng,
    })
    expect(res.ok).toBeFalsy()
    expect(res.status).toBe(409)
    expect(res.errorCode).toBe('OUTSIDE_GEOFENCE')
    expect(res.message).toContain('150m')
  })

  test('self mesai: kütüphaneye ~15m yakın konum kabul edilir (yarıçap 150m içinde)', async () => {
    const token = await apiToken()
    const res = await apiRequest<{ status: string; initiationType: string }>(
      'POST', `/libraries/${libraryId}/shifts/me/start`, token,
      { location: null, notes: null, latitude: NEAR_COORDS.lat, longitude: NEAR_COORDS.lng },
    )
    expect(res.ok, `mesai başlamalı: ${JSON.stringify(res)}`).toBeTruthy()
    expect(res.data!.status).toBe('active')
    expect(res.data!.initiationType).toBe('self')

    await apiRequest('POST', `/libraries/${libraryId}/shifts/me/end`, token)
  })

  test('admin tarafından başlatılan mesai (initiationType=admin) geofence kontrolünden muaftır', async () => {
    const token = await apiToken()
    const res = await apiRequest<{ status: string; initiationType: string }>(
      'POST', `/libraries/${libraryId}/shifts`, token,
      { staffId, location: null, notes: 'admin manuel giriş' },
    )
    expect(res.ok, `admin mesai başlatabilmeli: ${JSON.stringify(res)}`).toBeTruthy()
    expect(res.data!.status).toBe('active')
    expect(res.data!.initiationType).toBe('admin')
  })
})
