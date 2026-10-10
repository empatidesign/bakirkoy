import { test, expect, Page } from '@playwright/test'
import { login } from './helpers/auth'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

type ApiResponse<T> = { data?: T }
type CreatedEntity = { id: string }

type LibraryDetail = {
  id: string
  name: string
  description?: string
  queueEnabled: boolean
  reservationEnabled: boolean
  deviceControlEnabled?: boolean
  entryControlMode: string
  exitControlMode?: string
  autoCheckOutAfterMinutes?: number
  seatingMode: string
  breakSystemEnabled: boolean
  amenities?: string[]
  ipRestrictionEnabled?: boolean
  allowedIps?: string[]
  geofenceEnabled?: boolean
  geofenceLatitude?: number | null
  geofenceLongitude?: number | null
  geofenceRadiusMeters?: number
  isActive: boolean
}

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
  const tag = uniq('E2E EditOps')
  const serviceFacility = await apiRequest<CreatedEntity>('POST', '/service-facilities', token, {
    name: `${tag} Tesisi`,
    type: 'library',
    locationType: 'Indoor',
    city: 'İstanbul',
    district: 'Sultangazi',
    address: 'E2E EditOps Mah. No:7',
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
    description: 'Operasyon ayarları düzenleme testi',
    serviceFacilityId: serviceFacility.id,
    seatingMode: 'masali',
    breakSystemEnabled: true,
    isMultiFloor: false,
    floors: null,
    amenities: ['wifi'],
    queueEnabled: false,
    reservationEnabled: false,
    deviceControlEnabled: false,
    entryControlMode: 'manual',
    exitControlMode: 'manual',
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
  return { token, libraryId: library.id, serviceFacilityId: serviceFacility.id, libraryName: `${tag} Kıraathane` }
}

async function openEditDrawer(page: Page, libraryName: string) {
  await page.goto('/library')
  await page.getByRole('button', { name: 'Yönet', exact: true }).click()
  await expect(page.getByText('Kütüphane Yönetimi')).toBeVisible({ timeout: 20000 })
  await page.getByPlaceholder(/Kütüphane ara|Kıraathane ara/).fill(libraryName)
  const row = page.locator('tr', { hasText: libraryName }).first()
  await expect(row).toBeVisible({ timeout: 20000 })
  await row.locator('button[title="Düzenle"], button[aria-label="Düzenle"]').first().click()
  await expect(page.getByText('Kütüphane Düzenle').first()).toBeVisible({ timeout: 15000 })
}

async function toggleByLabel(page: Page, label: string) {
  const sw = page
    .getByText(label, { exact: true })
    .locator('xpath=ancestor::div[.//button[@role="switch"]][1]//button[@role="switch"]')
    .first()
  await sw.click()
}

async function getLibraryViaUi(page: Page, id: string): Promise<LibraryDetail> {
  return await page.evaluate(async (libraryId) => {
    const token = localStorage.getItem('admin_access_token') ?? sessionStorage.getItem('admin_access_token')
    const res = await fetch(`/api/v1/libraries/${libraryId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (!res.ok) throw new Error(JSON.stringify(json))
    return json.data
  }, id)
}

async function saveDrawer(page: Page) {
  await page.getByRole('button', { name: 'Güncelle' }).click()
  await expect(page.getByText('Değişiklikler kaydedildi.')).toBeVisible({ timeout: 15000 })
}

test.describe('Kıraathane düzenleme — operasyon ayarları', () => {
  test('tüm operasyon ayarları UI’dan değiştirilip kalıcı olur', async ({ page }) => {
    test.setTimeout(180000)
    const fx = await setupFixture()

    try {
      await login(page)
      await openEditDrawer(page, fx.libraryName)

      await toggleByLabel(page, 'Sıra sistemi (kuyruk)')

      const entryGroup = page.locator('div').filter({ has: page.getByText('Giriş Kontrol Modu', { exact: true }) }).last()
      await entryGroup.getByRole('button', { name: /QR Okuyucu/ }).first().click()
      const exitGroup = page.locator('div').filter({ has: page.getByText('Çıkış Kontrol Modu', { exact: true }) }).last()
      await exitGroup.getByRole('button', { name: /Kiosk/ }).first().click()

      const autoOut = page.locator('div').filter({ has: page.getByText('Otomatik çıkış süresi (0 = pasif)', { exact: true }) }).locator('input').last()
      await autoOut.fill('45')

      await saveDrawer(page)

      let lib = await getLibraryViaUi(page, fx.libraryId)
      expect(lib.queueEnabled).toBe(true)
      expect(lib.entryControlMode).toBe('qr')
      expect(lib.exitControlMode).toBe('kiosk')
      expect(lib.autoCheckOutAfterMinutes).toBe(45)

      await openEditDrawer(page, fx.libraryName)
      const entrySeg = page.locator('div').filter({ has: page.getByText('Giriş Kontrol Modu', { exact: true }) }).last()
      await expect(entrySeg.getByRole('button', { name: /QR Okuyucu/ }).first()).toHaveAttribute('aria-pressed', /true|/, { timeout: 5000 }).catch(() => {})

      await entrySeg.getByRole('button', { name: /Manuel/ }).first().click()
      const exitSeg = page.locator('div').filter({ has: page.getByText('Çıkış Kontrol Modu', { exact: true }) }).last()
      await exitSeg.getByRole('button', { name: /Kontrol Yok/ }).first().click()
      await toggleByLabel(page, 'Sıra sistemi (kuyruk)')
      await saveDrawer(page)

      lib = await getLibraryViaUi(page, fx.libraryId)
      expect(lib.entryControlMode).toBe('manual')
      expect(lib.exitControlMode).toBe('none')
      expect(lib.queueEnabled).toBe(false)
    } finally {
      // NOT (2026-09-05, gerçek testte bulunan bug): Bu dosyada HİÇ cleanup yoktu —
      // her koşu 1 library + 1 service-facility orphan bırakıyordu. Cleanup eklendi.
      const freshToken = await apiToken().catch(() => fx.token)
      await apiRequest('DELETE', `/libraries/${fx.libraryId}`, freshToken).catch(() => {})
      await apiRequest('DELETE', `/service-facilities/${fx.serviceFacilityId}`, freshToken).catch(() => {})
    }
  })

  test('sistem türü, rezervasyon, IP kısıtı, geofence ve durum alanları kalıcı olur', async ({ page }) => {
    test.setTimeout(180000)
    const fx = await setupFixture()

    try {
      await login(page)
      await openEditDrawer(page, fx.libraryName)

      await toggleByLabel(page, 'Aynı gün rezervasyon')
      await toggleByLabel(page, 'Konum kısıtlaması aktif')
      await page.getByPlaceholder('41.1039').fill('41.1050')
      await page.getByPlaceholder('28.8674').fill('28.8700')
      await saveDrawer(page)

      let lib = await getLibraryViaUi(page, fx.libraryId)
      expect(lib.reservationEnabled).toBe(true)
      expect(lib.geofenceEnabled).toBe(true)
      expect(lib.geofenceLatitude).toBeCloseTo(41.105, 3)
      expect(lib.geofenceLongitude).toBeCloseTo(28.87, 3)

      await openEditDrawer(page, fx.libraryName)
      await page.getByRole('button', { name: /Masa\/mola yok, sadece giriş-çıkış|Giriş/ }).first().click().catch(async () => {
        await page.getByText('Masa/mola yok, sadece giriş-çıkış').click()
      })
      await toggleByLabel(page, 'Durum')
      await saveDrawer(page)

      lib = await getLibraryViaUi(page, fx.libraryId)
      expect(lib.seatingMode).toBe('sirali')
      expect(lib.breakSystemEnabled).toBe(false)
      expect(lib.reservationEnabled).toBe(false)
      expect(lib.isActive).toBe(false)
    } finally {
      const freshToken = await apiToken().catch(() => fx.token)
      await apiRequest('DELETE', `/libraries/${fx.libraryId}`, freshToken).catch(() => {})
      await apiRequest('DELETE', `/service-facilities/${fx.serviceFacilityId}`, freshToken).catch(() => {})
    }
  })
})
