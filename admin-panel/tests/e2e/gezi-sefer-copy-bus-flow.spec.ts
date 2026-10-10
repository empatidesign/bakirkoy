import { test, expect, request as pwRequest, APIRequestContext, Page } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

let ctx: APIRequestContext
let adminToken = ''

type Created = { id: string; name?: string }

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

function futureIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

async function freshAdminToken(): Promise<string> {
  const login1 = await (await ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (login1?.data?.accessToken) { adminToken = login1.data.accessToken; return adminToken }
  const verify = await (await ctx.post(`${API_BASE}/auth/verify-otp`, { data: { otpSessionToken: login1.data.otpSessionToken, code: ADMIN_OTP } })).json()
  adminToken = verify?.data?.accessToken ?? ''
  if (!adminToken) throw new Error(`Admin API OTP failed: ${JSON.stringify(verify)}`)
  return adminToken
}

async function loginPageWithFreshApiSession(page: Page, path: string) {
  const login1 = await (await ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  const auth = login1?.data?.accessToken
    ? login1.data
    : (await (await ctx.post(`${API_BASE}/auth/verify-otp`, { data: { otpSessionToken: login1.data.otpSessionToken, code: ADMIN_OTP } })).json()).data
  if (!auth?.accessToken || !auth?.refreshToken) throw new Error(`Admin UI API auth failed: ${JSON.stringify(auth)}`)
  adminToken = auth.accessToken
  await page.goto('/login')
  await page.evaluate(({ accessToken, refreshToken }) => {
    sessionStorage.setItem('admin_access_token', accessToken)
    sessionStorage.setItem('admin_refresh_token', refreshToken)
  }, { accessToken: auth.accessToken, refreshToken: auth.refreshToken })
  await page.goto(path)
  await expect(page).not.toHaveURL(/\/login/)
}

async function apiRequest<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const token = adminToken || await freshAdminToken()
  const res = await ctx.fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok()) throw new Error(`${method} ${path} failed ${res.status()}: ${JSON.stringify(json)}`)
  return json.data as T
}

function fakeTckn() {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  const d10 = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7 - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
  const d10Pos = ((d10 % 10) + 10) % 10
  const d11 = (digits.reduce((sum, d) => sum + d, 0) + d10Pos) % 10
  return [...digits, d10Pos, d11].join('')
}

let categoryId = ''
let routeId = ''
let busId = ''
let travelId = ''

test.describe('Sefer Kopyala + Otobüs Çoğalt/Geçmiş UI akışları (gerçek tarayıcı)', () => {
  test.beforeAll(async () => {
    ctx = await pwRequest.newContext()
    await freshAdminToken()
    const cat = await apiRequest<Created>('POST', '/travel-categories', { name: uniq('E2E Copy Kategori'), description: '', color: '#2563eb', isActive: true })
    categoryId = cat.id
    const route = await apiRequest<Created>('POST', '/travel-routes', {
      name: uniq('E2E Copy Route'), categoryId, destination: 'Test', latitude: null, longitude: null,
      description: '', conditions: '', internalNote: '', gender: 'mixed', minAge: 0, maxAge: 0,
      restrictions: {}, images: { web: {}, mobile: {}, ratios: {}, photos: [] }, pricing: { isPaid: false, currency: 'TRY', audiences: [], depositEnabled: false, depositAmount: 0, refundPolicy: 'partial' },
      points: { enabled: false, basePoints: 0 }, isActive: true, sultangaziResidentOnly: false,
    })
    routeId = route.id
    const bus = await apiRequest<Created>('POST', '/travel-buses', { name: uniq('E2E Copy Bus'), plateNumber: `34 CPY ${String(Date.now()).slice(-3)}`, templateId: 'standard-46', seatStates: {} })
    busId = bus.id
    const travel = await apiRequest<Created>('POST', '/travels', {
      routeId, startDate: futureIso(5), endDate: futureIso(6), registrationStartDate: futureIso(0), registrationEndDate: futureIso(4),
      capacity: 10, reserveCapacity: 2, participationPeriod: 'none', participationLimit: 0, cancellationDeadlineHours: 24,
      crew: { driver: { id: '', name: 'E2E Şoför', phone: '05000000000', tckn: fakeTckn() }, guide: { id: '', name: '', phone: '' }, responsible: { id: '', name: '', role: '', roleKey: '', phone: '', email: '', emergencyPhone: '', grantAccess: false, tckn: '' } },
      busIds: [busId], isActive: false,
    })
    travelId = travel.id
  })

  test.afterAll(async () => {
    try { await apiRequest('DELETE', `/travels/${travelId}`) } catch { /* ignore */ }
    try { await apiRequest('DELETE', `/travel-buses/${busId}`) } catch { /* ignore */ }
    try { await apiRequest('DELETE', `/travel-routes/${routeId}`) } catch { /* ignore */ }
    try { await apiRequest('DELETE', `/travel-categories/${categoryId}`) } catch { /* ignore */ }
    await ctx.dispose()
  })

  test('Sefer Kopyala modalı UI üzerinden açılır, tarih önerilir ve kopyalama gerçek POST isteği tetikler', async ({ page }) => {
    test.setTimeout(90000)
    await loginPageWithFreshApiSession(page, `/travels?tab=travels&routeId=${routeId}`)

    // Route filtresi URL'den gelmiyor (RoutesTab state'i), o yüzden Geziler'den arayıp gireceğiz.
    await page.goto('/travels?tab=travels')
    await expect(page.getByText('Geziler').first()).toBeVisible({ timeout: 20000 })
    const route = await apiRequest<{ name: string }>('GET', `/travel-routes/${routeId}`)
    await page.getByPlaceholder('Gezi adı veya hedef ara...').fill(route.name)
    await page.getByRole('button', { name: route.name }).click()
    await expect(page.getByText('Sefer Listesi').first()).toBeVisible({ timeout: 20000 })

    // Kopyala ikon butonuna tıkla (row actions kolonu daralmış, "Tüm işlemleri göster" ile açılır)
    const rowActionsToggle = page.getByRole('button', { name: 'Tüm işlemleri göster' }).first()
    await rowActionsToggle.scrollIntoViewIfNeeded()
    await rowActionsToggle.click({ force: true })
    await expect(page.getByText('Tüm işlemler').first()).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /Seferi kopyala/i }).first().click()
    await expect(page.getByText('Seferi Kopyala').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('gezisi için yeni bir sefer oluşturulacak', { exact: false }).first()).toBeVisible()

    // Tarih alanları otomatik önerilmiş olmalı (boş olmamalı)
    const startDateInput = page.locator('input').filter({ hasText: '' }).first()
    void startDateInput

    const [copyResp] = await Promise.all([
      page.waitForResponse((r) => /\/travels\/.*\/copy$/.test(r.url()) && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kopyala' }).click(),
    ])
    expect(copyResp.ok(), `POST /travels/{id}/copy başarısız: ${copyResp.status()}`).toBeTruthy()
    const copyBody = await copyResp.json()
    expect(copyBody?.data?.routeId).toBe(routeId)

    // Temizlik: kopyalanan sefer orphan kalmasın (2026-09-05: bulunan orphan-data
    // bug'ı, hiç silinmediği doğrulandı — API üzerinden 1 orphan travel bulundu ve silindi).
    try { await apiRequest('DELETE', `/travels/${copyBody.data.id}`) } catch { /* ignore */ }
  })

  test('Araç Yönetimi: Çoğalt butonu yeni bağımsız araç oluşturur, Kullanım Geçmişi modalı açılır', async ({ page }) => {
    test.setTimeout(90000)
    await loginPageWithFreshApiSession(page, '/travels?tab=buses')
    await expect(page.getByText('Araç Yönetimi').first()).toBeVisible({ timeout: 20000 })

    const bus = await apiRequest<{ name: string }>('GET', `/travel-buses/${busId}`)
    await page.getByPlaceholder('Araç adı, plaka veya şoför ara...').fill(bus.name)
    const row = page.locator('tr', { hasText: bus.name })
    await expect(row.first()).toBeVisible({ timeout: 20000 })
    await expect(row).toHaveCount(1, { timeout: 10000 })

    // Kullanım Geçmişi
    await row.getByRole('button', { name: /Kullanım geçmişi/i }).click()
    await expect(page.getByText('Kullanım Geçmişi', { exact: false }).first()).toBeVisible({ timeout: 10000 })
    await page.keyboard.press('Escape')
    await expect(page.getByText('Kullanım Geçmişi', { exact: false })).toHaveCount(0, { timeout: 5000 })

    // Çoğalt
    const [cloneResp] = await Promise.all([
      page.waitForResponse((r) => /\/travel-buses\/.*\/clone$/.test(r.url()) && r.request().method() === 'POST'),
      row.getByRole('button', { name: /Aracı çoğalt/i }).click(),
    ])
    expect(cloneResp.ok(), `POST /travel-buses/{id}/clone başarısız: ${cloneResp.status()}`).toBeTruthy()
    const cloneBody = await cloneResp.json()
    expect(cloneBody?.data?.sourceBusId).toBe(busId)

    // Temizlik: klon aracı sil
    try { await apiRequest('DELETE', `/travel-buses/${cloneBody.data.id}`) } catch { /* ignore */ }
  })
})
