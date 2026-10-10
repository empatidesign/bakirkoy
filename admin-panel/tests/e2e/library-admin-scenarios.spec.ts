import { test, expect, Page } from '@playwright/test'
import { login } from './helpers/auth'
import { clickRowAction } from './helpers/rowActions'

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
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
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

function fakeTckn() {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  const d10 = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7 - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
  const d11 = (digits.reduce((sum, digit) => sum + digit, 0) + d10) % 10
  return [...digits, d10, d11].join('')
}

async function setupLibraryFixture() {
  const token = await apiToken()
  const managerId = await resolveManagerId(token)
  const tag = uniq('E2E UI Lib')

  const serviceFacility = await apiRequest<CreatedEntity>('POST', '/service-facilities', token, {
    name: `${tag} Tesisi`,
    type: 'library',
    locationType: 'Indoor',
    city: 'İstanbul',
    district: 'Sultangazi',
    address: 'E2E Library UI Mah. No:11',
    latitude: 41.1039,
    longitude: 28.8674,
    managerId,
    weekdayOpen: '08:00',
    weekdayClose: '22:00',
    weekendOpen: '09:00',
    weekendClose: '20:00',
    parkingCapacity: 0,
    parkingType: 'Free',
    capacity: 100,
  })

  const library = await apiRequest<CreatedEntity>('POST', '/libraries', token, {
    name: `${tag} Kıraathane`,
    description: 'Playwright library admin scenario fixture',
    serviceFacilityId: serviceFacility.id,
    seatingMode: 'masali',
    isMultiFloor: false,
    floors: [{
      id: 'floor-1',
      name: 'Zemin Kat',
      capacity: 4,
      active: true,
      autoOpenWhenPreviousFull: false,
      sections: [{ id: 'sec-1', name: 'A Bölümü', seats: ['A1', 'A2', 'A3', 'A4'] }],
    }],
    amenities: null,
    queueEnabled: false,
    reservationEnabled: false,
    entryControlMode: 'manual',
    exitControlMode: 'manual',
    autoCheckOutAfterMinutes: 240,
    useCustomBreakSettings: true,
    breakDurationMinutes: 15,
    maxDailyBreaks: 3,
    longBreakDurationMinutes: 45,
    maxStudyHoursPerDay: 10,
    requireBreakAfterHours: 3,
    ipRestrictionEnabled: false,
    allowedIps: null,
    isActive: true,
    grantAccess: false,
  })

  const ruleTitle = `${tag} Sessizlik Kuralı`
  const updatedRuleTitle = `${tag} Güncel Kural`
  await apiRequest<CreatedEntity>('POST', '/library-rules', token, {
    category: 'silent',
    title: ruleTitle,
    description: 'Okuma salonunda sessiz olunmalıdır.',
    icon: '📖',
    severity: 'warning',
    libraryId: library.id,
  })

  const participant = await apiRequest<CreatedEntity & { fullName: string }>('POST', '/participants', token, {
    tckn: fakeTckn(),
    birthDate: '1995-06-15',
    phone: `05${String(Date.now()).slice(-9)}`,
    email: `e2e.lib.ui.${Date.now()}@example.com`,
    deliveryChannel: 'Email',
  })

  await apiRequest('POST', `/libraries/${library.id}/check-in`, token, {
    participantId: participant.id,
    method: 'manual',
    seat: 'A1',
  })

  return {
    token,
    libraryId: library.id,
    serviceFacilityId: serviceFacility.id,
    libraryName: `${tag} Kıraathane`,
    ruleTitle,
    updatedRuleTitle,
    participantId: participant.id,
    participantFullName: participant.fullName,
  }
}

async function rowContaining(page: Page, text: string) {
  const row = page.locator('tr', { hasText: text }).first()
  await expect(row).toBeVisible({ timeout: 20000 })
  return row
}

test.describe('Library admin scenarios', () => {
  test('fixture kayıtlarını UI’da gösterir, kuralı UI’dan günceller ve oturum çıkışını doğrular', async ({ page }) => {
    test.setTimeout(90000)
    const fx = await setupLibraryFixture()

    try {
      await login(page)
      await page.goto(`/library?library=${fx.libraryId}&tab=inside`)
      await expect(page.getByText(fx.libraryName)).toBeVisible({ timeout: 20000 })
      await expect(page.getByText('İçeridekiler').first()).toBeVisible()
      await expect(page.getByText('A1').first()).toBeVisible({ timeout: 20000 })
      await expect(page.getByText('İçeride').first()).toBeVisible()

      await page.getByRole('button', { name: /Kurallar/ }).click()
      await expect(page.getByText('Kütüphane Kuralları')).toBeVisible()
      const ruleRow = await rowContaining(page, fx.ruleTitle)
      await clickRowAction(page, ruleRow, 'Düzenle')
      await expect(page.getByText('Kural Düzenle')).toBeVisible()
      await page.getByPlaceholder('Örn. Sessizlik Kuralı').fill(fx.updatedRuleTitle)
      await page.getByPlaceholder('Kuralın açıklaması').fill('Playwright üzerinden güncellenmiş kural açıklaması.')
      await page.getByRole('button', { name: 'Güncelle' }).click()
      await expect(page.getByText(fx.updatedRuleTitle)).toBeVisible({ timeout: 20000 })

      await page.getByRole('button', { name: /İçeridekiler/ }).click()
      const occupantRow = page.locator('tr', { hasText: 'A1' }).first()
      await expect(occupantRow).toBeVisible({ timeout: 20000 })
      await occupantRow.locator('button[aria-label*="Çıkış"]').click()
      await page.getByRole('button', { name: /Onayla|Çıkış/ }).last().click()
      await expect(page.getByText('A1').first()).toBeHidden({ timeout: 20000 })

      await page.getByRole('button', { name: /Çıkanlar/ }).click()
      await expect(page.getByText('Çıkanlar').first()).toBeVisible()
      await expect(page.getByText('Otomatik Çıkış').first()).toBeVisible({ timeout: 20000 })
    } finally {
      // NOT (2026-09-05, gerçek testte bulunan bug): Bu dosyada HİÇ cleanup yoktu —
      // her koşu 1 library + 1 service-facility + 1 participant orphan bırakıyordu.
      // Cleanup eklendi (participant silme endpoint'i yok/riskli olabileceğinden
      // sadece library + service-facility temizleniyor — katılımcı kaydı zararsız).
      const freshToken = await apiToken().catch(() => fx.token)
      await apiRequest('DELETE', `/libraries/${fx.libraryId}`, freshToken).catch(() => {})
      await apiRequest('DELETE', `/service-facilities/${fx.serviceFacilityId}`, freshToken).catch(() => {})
    }
  })
})
