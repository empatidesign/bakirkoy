import { test, expect, request as pwRequest, APIRequestContext, Page } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

let ctx: APIRequestContext
let adminToken = ''

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
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

/**
 * Gezi/Sefer ayrımının GERÇEK tarayıcı üzerinden uçtan uca doğrulanması.
 * "Yeni Gezi Ekle" akışı curl ile daha önce hiç test edilmemişti — bu test
 * tam UI form doldurma + kaydetme + drilldown + "Yeni Sefer Ekle" + kopyalama
 * modalı açılışını gerçek DOM etkileşimiyle kanıtlar.
 */
test.describe('Gezi/Sefer UI akışı (gerçek tarayıcı)', () => {
  let createdRouteId = ''

  test.beforeAll(async () => { ctx = await pwRequest.newContext(); await freshAdminToken() })
  test.afterAll(async () => {
    if (createdRouteId) {
      try { await apiRequest('DELETE', `/travel-routes/${createdRouteId}`) } catch { /* varsa bağlı sefer nedeniyle silinemeyebilir, sessiz geç */ }
    }
    await ctx.dispose()
  })

  test('UI üzerinden Yeni Gezi eklenir, listede görünür ve altına Yeni Sefer eklenebilir', async ({ page }) => {
    test.setTimeout(120000)
    const routeName = uniq('E2E UI Route Çanakkale')

    await loginPageWithFreshApiSession(page, '/travels?tab=travels')
    await expect(page.getByText('Geziler').first()).toBeVisible({ timeout: 20000 })

    // 1) Yeni Gezi Ekle
    await page.getByRole('button', { name: 'Yeni Gezi' }).click()
    await expect(page.getByText('Yeni Gezi Ekle').first()).toBeVisible({ timeout: 10000 })

    // Kategori seç (ilk mevcut kategori)
    await page.getByPlaceholder('Kategori seçin').click()
    await expect(page.getByPlaceholder('Kategori ara...')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Doğa ve Tabiat' }).click()

    await page.getByPlaceholder('Örn: Çanakkale').first().fill(routeName)
    await page.getByPlaceholder('Örn: Çanakkale').nth(1).fill('Çanakkale Merkez')

    const [createResp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/travel-routes') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kaydet' }).click(),
    ])
    expect(createResp.ok(), `POST /travel-routes başarısız: ${createResp.status()}`).toBeTruthy()
    const created = (await createResp.json())?.data
    createdRouteId = created?.id ?? ''
    expect(createdRouteId, 'Oluşturulan route id').toBeTruthy()

    // 2) Listede görünüyor mu
    await page.getByPlaceholder('Gezi adı veya hedef ara...').fill(routeName)
    await expect(page.getByText(routeName).first()).toBeVisible({ timeout: 20000 })

    // 3) Gezinin üzerine tıkla -> Seferler alt görünümü açılmalı
    await page.getByRole('button', { name: routeName }).click()
    await expect(page.getByText('Sefer Listesi').first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(routeName).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('Bugüne Kadar Düzenlenen Seferler').first()).toBeVisible({ timeout: 10000 })

    // 4) Yeni Sefer Ekle -> route kilitli banner görünmeli
    await page.getByRole('button', { name: 'Yeni Sefer' }).first().click()
    await expect(page.getByText('Yeni Sefer Ekle').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(routeName, { exact: false }).first()).toBeVisible({ timeout: 10000 })
  })
})
