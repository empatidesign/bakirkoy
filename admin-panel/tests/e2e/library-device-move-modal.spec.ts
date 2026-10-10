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

async function createLibrary(token: string, managerId: string, name: string, district: string) {
  const serviceFacility = await apiRequest<CreatedEntity>('POST', '/service-facilities', token, {
    name: `${name} Tesisi`,
    type: 'library',
    locationType: 'Indoor',
    city: 'İstanbul',
    district,
    address: `${name} Mah. No:1`,
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
    name,
    description: 'Cihaz taşıma modalı testi',
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
  return { libraryId: library.id, serviceFacilityId: serviceFacility.id }
}

async function openEditDrawer(page: Page, libraryName: string) {
  await page.goto('/library')
  await page.getByRole('button', { name: 'Yönet', exact: true }).click()
  await expect(page.getByText('Kütüphane Yönetimi')).toBeVisible({ timeout: 20000 })
  await page.getByPlaceholder(/Kütüphane ara/).fill(libraryName)
  const row = page.locator('tr', { hasText: libraryName }).first()
  await expect(row).toBeVisible({ timeout: 20000 })
  await row.locator('button[title="Düzenle"], button[aria-label="Düzenle"]').first().click()
  await expect(page.getByText('Kütüphane Düzenle').first()).toBeVisible({ timeout: 15000 })
}

test.describe('Cihaz taşıma modalı — arama + tasarım', () => {
  test('cihaz gerçek arama ile bulunan kütüphaneye taşınır', async ({ page }) => {
    test.setTimeout(180000)
    const token = await apiToken()
    const managerId = await resolveManagerId(token)
    const tag = uniq('E2E DeviceMove')
    const sourceName = `${tag} Kaynak`
    const targetName = `${tag} Hedef Arama Testi`
    const source = await createLibrary(token, managerId, sourceName, 'Sultangazi')
    const target = await createLibrary(token, managerId, targetName, 'Bağcılar')

    try {
      await login(page)
      await openEditDrawer(page, sourceName)

      await page.getByRole('button', { name: /Cihaz Ekle/ }).click()
      const deviceName = `${tag} Cihaz`
      await page.getByPlaceholder('Örn: Ana Giriş Turnikesi').fill(deviceName)
      await page.getByRole('button', { name: 'Cihazı Oluştur' }).click()
      await expect(page.getByText('Cihaz oluşturuldu.')).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(deviceName)).toBeVisible({ timeout: 15000 })

      await page.locator('button[aria-label="Başka kütüphaneye taşı"]').first().click()
      await expect(page.getByText('Cihazı Başka Kütüphaneye Taşı')).toBeVisible({ timeout: 10000 })

      await expect(page.getByText('Henüz seçilmedi')).toBeVisible()

      await page.getByPlaceholder('Kütüphane seçiniz...').click()
      const searchBox = page.getByPlaceholder('Kütüphane, ilçe veya il ara...')
      await searchBox.click()
      await searchBox.fill(tag)
      const popover = page.locator('[data-ds-popover]')
      await expect(popover.getByText(targetName, { exact: false }).first()).toBeVisible({ timeout: 10000 })
      await popover.getByText(targetName, { exact: false }).first().click()

      const moveModal = page.locator('.rounded-panel', { has: page.getByText('Cihazı Başka Kütüphaneye Taşı') })
      await expect(moveModal.locator('p').filter({ hasText: targetName }).first()).toBeVisible()
      await expect(moveModal.getByText('Bağcılar', { exact: false })).toBeVisible()

      await page.getByRole('button', { name: /^Taşı$/ }).click()
      await expect(page.getByText('Cihaz başka kütüphaneye taşındı.', { exact: false })).toBeVisible({ timeout: 15000 })

      await expect(page.getByText(deviceName)).not.toBeVisible({ timeout: 10000 })

      await page.keyboard.press('Escape')
      await openEditDrawer(page, targetName)
      await expect(page.getByText(deviceName)).toBeVisible({ timeout: 15000 })
    } finally {
      // NOT (2026-09-05, gerçek testte bulunan bug): Bu dosyada HİÇ cleanup yoktu —
      // her koşu 2 library + 2 service-facility orphan bırakıyordu (17 orphan
      // library bu oturumda birikmiş bulundu ve manuel temizlendi). Cleanup eklendi.
      const freshToken = await apiToken().catch(() => token)
      await apiRequest('DELETE', `/libraries/${source.libraryId}`, freshToken).catch(() => {})
      await apiRequest('DELETE', `/libraries/${target.libraryId}`, freshToken).catch(() => {})
      await apiRequest('DELETE', `/service-facilities/${source.serviceFacilityId}`, freshToken).catch(() => {})
      await apiRequest('DELETE', `/service-facilities/${target.serviceFacilityId}`, freshToken).catch(() => {})
    }
  })
})
