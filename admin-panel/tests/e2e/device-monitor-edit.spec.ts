import { test, expect, Page } from '@playwright/test'
import { login } from './helpers/auth'


const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

type ApiResponse<T> = { data?: T }
type CreatedEntity = { id: string }

async function apiToken(): Promise<string> {
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  }).then((r) => r.json())
  if (loginRes?.data?.accessToken) return loginRes.data.accessToken
  const otpSessionToken = loginRes?.data?.otpSessionToken
  if (!otpSessionToken) throw new Error(`API login failed: ${JSON.stringify(loginRes)}`)
  const verifyRes = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otpSessionToken, code: ADMIN_OTP }),
  }).then((r) => r.json())
  const token = verifyRes?.data?.accessToken
  if (!token) throw new Error(`API OTP failed: ${JSON.stringify(verifyRes)}`)
  return token
}

async function apiRequest<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({})) as ApiResponse<T>
  if (!res.ok) throw new Error(`${method} ${path} failed ${res.status}: ${JSON.stringify(json)}`)
  return json.data as T
}

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

async function resolveManagerId(token: string): Promise<string> {
  const me = await apiRequest<{ me: { id: string } }>('GET', '/auth/me', token)
  return me.me.id
}

async function setupFixture() {
  const token = await apiToken()
  const managerId = await resolveManagerId(token)
  const tag = uniq('E2E DeviceMonitorEdit')
  const serviceFacility = await apiRequest<CreatedEntity>('POST', '/service-facilities', token, {
    name: `${tag} Tesisi`,
    type: 'library',
    locationType: 'Indoor',
    city: 'İstanbul',
    district: 'Sultangazi',
    address: 'E2E Mah. No:1',
    latitude: 41.1039,
    longitude: 28.8674,
    managerId,
    weekdayOpen: '08:00',
    weekdayClose: '22:00',
    weekendOpen: '09:00',
    weekendClose: '20:00',
    parkingCapacity: 0,
    parkingType: 'Free',
    capacity: 50,
  })
  const library = await apiRequest<CreatedEntity>('POST', '/libraries', token, {
    name: `${tag} Kıraathane`,
    description: 'device monitor edit testi',
    serviceFacilityId: serviceFacility.id,
    seatingMode: 'sirali',
    breakSystemEnabled: false,
    isMultiFloor: false,
    floors: [{ id: 'f1', name: 'Zemin', capacity: 10, active: true, krokiUrl: null, sections: [] }],
    amenities: [],
    queueEnabled: false,
    reservationEnabled: false,
    deviceControlEnabled: false,
    entryControlMode: 'qr',
    exitControlMode: 'qr',
    autoCheckOutAfterMinutes: 0,
    useCustomBreakSettings: false,
    breakDurationMinutes: 30,
    maxDailyBreaks: 3,
    longBreakDurationMinutes: 60,
    maxStudyHoursPerDay: 9,
    requireBreakAfterHours: 3,
    ipRestrictionEnabled: false,
    allowedIps: null,
    isActive: true,
    grantAccess: false,
  })
  const device = await apiRequest<CreatedEntity>('POST', `/libraries/${library.id}/devices`, token, {
    name: `${tag} Cihaz`, direction: 'entry', deviceId: '', ipAddress: '', port: 80,
    username: '', password: '', relayNo: 1, relayMs: 3000, workMode: 'online', httpPath: '',
    triggerLockOnSuccess: true, operationMode: 'directional', toggleCooldownMinutes: 5,
  })
  return { token, deviceName: `${tag} Cihaz`, deviceId: device.id, libraryId: library.id, serviceFacilityId: serviceFacility.id }
}

async function openDeviceMonitor(page: Page) {
  await page.goto('/device-monitor')
  await expect(page.getByRole('heading', { name: /Cihaz Canlı Takip/ })).toBeVisible({ timeout: 20000 })
}

test.describe('Cihaz Canlı Takip — cihaz düzenleme', () => {
  test('cihaz izleme sayfasından cihaz ayarları değiştirilip kalıcı olur', async ({ page }) => {
    test.setTimeout(180000)
    const fx = await setupFixture()

    try {
      await login(page)
      await openDeviceMonitor(page)

      const deviceRow = page.locator('div', { hasText: fx.deviceName }).filter({ has: page.locator('button[aria-label="Cihazı düzenle"]') }).last()
      await expect(deviceRow).toBeVisible({ timeout: 20000 })

      await deviceRow.locator('button[aria-label="Cihazı düzenle"]').click()
      await expect(page.getByText('Cihaz Ayarlarını Düzenle')).toBeVisible({ timeout: 10000 })

      const newName = `${fx.deviceName} DÜZENLENDİ`
      const nameField = page.getByText('Cihaz Adı', { exact: true }).locator('xpath=following-sibling::*[1]//input')
      await nameField.fill(newName)

      const portField = page.getByText('Port', { exact: true }).locator('xpath=following-sibling::*[1]//input')
      await portField.fill('8080')

      await page.getByRole('button', { name: 'Kaydet' }).click()
      await expect(page.getByText('Cihaz ayarları güncellendi.')).toBeVisible({ timeout: 15000 })

      const token = await apiToken()
      const updated = await apiRequest<{ name: string; port: number }>('GET', `/library-devices/${fx.deviceId}`, token)
      expect(updated.name).toBe(newName)
      expect(updated.port).toBe(8080)
    } finally {
      // NOT (2026-09-05, gerçek testte bulunan bug): Bu dosyada HİÇ cleanup yoktu —
      // her koşu 1 library + 1 service-facility orphan bırakıyordu. Cleanup eklendi.
      const freshToken = await apiToken().catch(() => fx.token)
      await apiRequest('DELETE', `/libraries/${fx.libraryId}`, freshToken).catch(() => {})
      await apiRequest('DELETE', `/service-facilities/${fx.serviceFacilityId}`, freshToken).catch(() => {})
    }
  })
})
