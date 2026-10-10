import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test'
import { login } from './helpers/auth'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!
const MOCK_OTP = '111111'

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

function fakeTckn() {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  const d10 = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7
    - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
  const d10Pos = ((d10 % 10) + 10) % 10
  const d11 = (digits.reduce((sum, d) => sum + d, 0) + d10Pos) % 10
  return [...digits, d10Pos, d11].join('')
}

let ctx: APIRequestContext
let adminToken = ''

async function freshAdminToken(): Promise<string> {
  const login1 = await (await ctx.post(`${API_BASE}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })).json()
  if (login1?.data?.accessToken) { adminToken = login1.data.accessToken; return adminToken }
  const verify = await (await ctx.post(`${API_BASE}/auth/verify-otp`, {
    data: { otpSessionToken: login1.data.otpSessionToken, code: ADMIN_OTP },
  })).json()
  adminToken = verify?.data?.accessToken ?? ''
  if (!adminToken) throw new Error(`Admin API OTP failed: ${JSON.stringify(verify)}`)
  return adminToken
}

async function apiAdminToken(): Promise<string> {
  if (adminToken) return adminToken
  return freshAdminToken()
}

async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown, _retried = false): Promise<T> {
  const t = await apiAdminToken()
  const res = await ctx.fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    data: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status() === 401 && !_retried) {
    await freshAdminToken()
    return apiRequest(method, path, body, true)
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok()) throw new Error(`${method} ${path} failed ${res.status()}: ${JSON.stringify(json)}`)
  return json.data as T
}

async function findGiftIdByName(name: string): Promise<string> {
  const result = await apiRequest<{ items: Array<{ id: string; name: string }> }>(
    'GET', `/gifts?page=1&limit=10&search=${encodeURIComponent(name)}`,
  )
  const gift = result.items.find((item) => item.name === name)
  if (!gift) throw new Error(`UI ile oluşturulan hediye API listesinde bulunamadı: ${name}`)
  return gift.id
}

async function registerCitizen(tag: string): Promise<{ token: string; fullName: string; tckn: string }> {
  const tckn = fakeTckn()
  const email = `e2e.wheeladmin.${tag.replace(/\s+/g, '')}@example.com`.toLowerCase()
  const phone = `05${String(Date.now()).slice(-9)}`
  const reg = await (await ctx.post(`${API_BASE}/auth/citizen/register`, {
    data: { tckn, birthDate: '2000-01-01', phone, email, password: 'E2eWheelAdmin2026!', guardianPhone: null, guardianEmail: null },
  })).json()
  const otpSessionToken = reg?.data?.otpSessionToken
  if (!otpSessionToken) throw new Error(`citizen register otp yok: ${JSON.stringify(reg)}`)
  const ver = await (await ctx.post(`${API_BASE}/auth/citizen/verify-otp`, {
    data: { otpSessionToken, code: MOCK_OTP },
  })).json()
  const token = ver?.data?.accessToken
  if (!token) throw new Error(`citizen accessToken yok: ${JSON.stringify(ver)}`)
  return { token, fullName: `${reg?.data?.fullName ?? ''}`.trim() || 'E2E Vatandaş', tckn }
}

async function setupGiftRequestFixture() {
  const tag = uniq('E2E UI Wheel')
  const gift = await apiRequest<{ id: string }>('POST', '/gifts', {
    name: `${tag} Hediyesi`, imageUrl: null, points: 0, stockLimit: 10, winnerPattern: null,
    description: 'Playwright wheel admin testi',
  })

  const citizen = await registerCitizen(tag)
  const applyRes = await ctx.post(`${API_BASE}/wheels/gifts/${gift.id}/apply`, {
    headers: { Authorization: `Bearer ${citizen.token}`, 'Content-Type': 'application/json' },
  })
  const applyJson = await applyRes.json()
  if (!applyRes.ok()) throw new Error(`gift apply failed: ${JSON.stringify(applyJson)}`)
  const requestId = applyJson.data?.id
  if (!requestId) throw new Error(`gift request id yok: ${JSON.stringify(applyJson)}`)

  return { giftId: gift.id, giftName: `${tag} Hediyesi`, requestId, citizenFullName: citizen.fullName, citizenTckn: citizen.tckn }
}

async function createGiftRequestForGift(giftId: string, tag: string) {
  const citizen = await registerCitizen(tag)
  const applyRes = await ctx.post(`${API_BASE}/wheels/gifts/${giftId}/apply`, {
    headers: { Authorization: `Bearer ${citizen.token}`, 'Content-Type': 'application/json' },
  })
  const applyJson = await applyRes.json()
  if (!applyRes.ok()) throw new Error(`gift apply failed: ${JSON.stringify(applyJson)}`)
  const requestId = applyJson.data?.id
  if (!requestId) throw new Error(`gift request id yok: ${JSON.stringify(applyJson)}`)
  return { requestId, citizenFullName: citizen.fullName, citizenTckn: citizen.tckn }
}

test.describe('Wheel admin panel — hediye talebi onay/red', () => {
  test.beforeAll(async () => {
    ctx = await pwRequest.newContext()
  })
  test.afterAll(async () => {
    await ctx.dispose()
  })

  test('UI üzerinden çark ve hediye oluşturur, API fixture talebini admin panelden onaylar', async ({ page }) => {
    test.setTimeout(120000)
    await page.setViewportSize({ width: 1600, height: 900 })
    const tag = uniq('E2E UI Wheel')
    const wheelTitle = `${tag} Çarkı`
    const giftName = `${tag} Hediyesi`

    await login(page)
    adminToken = await page.evaluate(() => localStorage.getItem('admin_access_token') ?? sessionStorage.getItem('admin_access_token')) ?? ''
    await page.goto('/wheel?tab=cark')
    await expect(page.getByText('Çarklar').first()).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Çark' }).click()
    await expect(page.getByRole('heading', { name: /Yeni Çark/ })).toBeVisible()
    await page.getByPlaceholder('Örn. Haftalık Puan Çarkı').fill(wheelTitle)

    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/wheels') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kaydet' }).click(),
    ])
    expect(createResponse.ok(), `POST /wheels başarısız: ${await createResponse.text()}`).toBeTruthy()

    await page.getByPlaceholder('Çark başlığı ara...').fill(wheelTitle)
    await expect(page.getByText(wheelTitle).first()).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: /Hediye Yönetimi/ }).click()
    await expect(page.getByText('Hediyeler').first()).toBeVisible({ timeout: 20000 })
    await page.getByRole('button', { name: 'Yeni Hediye' }).click()
    await expect(page.getByRole('heading', { name: /Yeni Hediye/ })).toBeVisible()
    await page.getByPlaceholder('Örn. Sultangazi Termos').fill(giftName)
    await page.getByPlaceholder('Örn. 500').fill('0')
    await page.getByPlaceholder('Örn. 50', { exact: true }).fill('10')
    await page.getByPlaceholder('Hediye hakkında not').fill('Playwright wheel admin UI hediyesi')
    const [giftCreateResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/gifts') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kaydet' }).click(),
    ])
    expect(giftCreateResponse.ok(), `POST /gifts başarısız: ${await giftCreateResponse.text()}`).toBeTruthy()
    await page.getByPlaceholder('Hediye adı ara...').fill(giftName)
    await expect(page.getByText(giftName).first()).toBeVisible({ timeout: 20000 })

    const giftId = await findGiftIdByName(giftName)
    const request = await createGiftRequestForGift(giftId, tag)

    await page.getByRole('button', { name: /Hediye Talepleri/ }).click()
    await expect(page.getByText('Hediye Talepleri').first()).toBeVisible({ timeout: 20000 })
    await page.getByPlaceholder('Ad, soyad, TC veya telefon ara...').fill(request.citizenTckn)
    const row = page.locator('tr', { hasText: giftName }).first()
    await expect(row).toBeVisible({ timeout: 20000 })

    await row.locator('button[aria-label="Onayla"]').click()
    const approveModal = page.locator('div.fixed.inset-0.z-50').filter({ hasText: /Onayla/ }).last()
    await expect(approveModal.getByRole('heading', { name: /Onayla/ })).toBeVisible({ timeout: 10000 })
    const [approveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/gift-requests/${request.requestId}/approve`)),
      approveModal.getByRole('button', { name: 'Onayla' }).click(),
    ])
    expect(approveResponse.ok()).toBeTruthy()
    await expect(row.getByText(/[Oo]naylandı/).first()).toBeVisible({ timeout: 20000 })

    const detail = await apiRequest<{ status: string }>('GET', `/gift-requests/${request.requestId}`)
    expect(detail.status).toBe('approved')
  })

  test('Hediye talebini admin panelden onaylar, durumu UI ve API üzerinden doğrular', async ({ page }) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width: 1600, height: 900 })
    const fx = await setupGiftRequestFixture()

    await login(page)
    await page.goto('/wheel?tab=talepler')
    await expect(page.getByText('Hediye Talepleri').first()).toBeVisible({ timeout: 20000 })

    await page.getByPlaceholder('Ad, soyad, TC veya telefon ara...').fill(fx.citizenTckn)
    const row = page.locator('tr', { hasText: fx.giftName }).first()
    await expect(row).toBeVisible({ timeout: 20000 })

    await row.locator('button[aria-label="Onayla"]').click()
    const approveModal = page.locator('div.fixed.inset-0.z-50').filter({ hasText: /Onayla/ }).last()
    await expect(approveModal.getByRole('heading', { name: /Onayla/ })).toBeVisible({ timeout: 10000 })
    const [approveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/gift-requests/${fx.requestId}/approve`)),
      approveModal.getByRole('button', { name: 'Onayla' }).click(),
    ])
    expect(approveResponse.ok()).toBeTruthy()
    await expect(row.getByText(/[Oo]naylandı/).first()).toBeVisible({ timeout: 20000 })

    const detail = await apiRequest<{ status: string }>('GET', `/gift-requests/${fx.requestId}`)
    expect(detail.status).toBe('approved')
  })

  test('Hediye talebini admin panelden reddeder, sebep API üzerinden doğrulanır', async ({ page }) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width: 1600, height: 900 })
    const fx = await setupGiftRequestFixture()
    const rejectReason = 'Playwright üzerinden test reddi'

    await login(page)
    await page.goto('/wheel?tab=talepler')
    await expect(page.getByText('Hediye Talepleri').first()).toBeVisible({ timeout: 20000 })

    await page.getByPlaceholder('Ad, soyad, TC veya telefon ara...').fill(fx.citizenTckn)
    const row = page.locator('tr', { hasText: fx.giftName }).first()
    await expect(row).toBeVisible({ timeout: 20000 })

    await row.locator('button[aria-label="Reddet"]').click()
    await expect(page.getByRole('heading', { name: 'Talebi Reddet' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('textbox').last().fill(rejectReason)
    const [rejectResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/gift-requests/${fx.requestId}/reject`)),
      page.getByRole('button', { name: /Reddet/ }).last().click(),
    ])
    expect(rejectResponse.ok()).toBeTruthy()
    await expect(row.getByText(/[Rr]eddedildi/).first()).toBeVisible({ timeout: 20000 })

    const detail = await apiRequest<{ status: string; rejectReason: string | null }>(
      'GET', `/gift-requests/${fx.requestId}`,
    )
    expect(detail.status).toBe('rejected')
    expect(detail.rejectReason).toBe(rejectReason)
  })
})
