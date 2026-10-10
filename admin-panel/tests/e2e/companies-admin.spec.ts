import { test, expect, request as pwRequest, APIRequestContext, Page } from '@playwright/test'
import { login } from './helpers/auth'
import { clickRowAction } from './helpers/rowActions'
import { pickDsOption } from './helpers/designSystemControls'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

type Created = { id: string; name: string; status?: string }

let ctx: APIRequestContext
let adminToken = ''

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

function dateDigits(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}${m}${y}`
}

async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown, retried = false): Promise<T> {
  const token = adminToken || await freshAdminToken()
  const res = await ctx.fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status() === 401 && !retried) {
    await freshAdminToken()
    return apiRequest(method, path, body, true)
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok()) throw new Error(`${method} ${path} failed ${res.status()}: ${JSON.stringify(json)}`)
  return json.data as T
}

function exactText(text: string) {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?$`)
}

async function field(page: Page, label: string) {
  // Denetimde bulundu (2026-10-01): CompaniesPage pilot tasarıma geçtiğinde FilterBar artık
  // her zaman açık render oluyor (eski collapsible panel değil), bu yüzden "Hizmet Kategorisi"
  // etiketi hem liste filtresinde hem Yeni Firma formunda aynı anda DOM'da bulunabiliyor.
  // Form her zaman filtreden SONRA (drawer/modal portal'ı en sonda) render olduğundan .last()
  // doğru (görünür, üstteki) alanı seçer; arka plandaki filtre alanı artık ayrıca inert/
  // aria-hidden (bkz. useOverlayDismiss.ts) ile erişilebilirlik ağacından da çıkarılıyor.
  return page.locator('label').filter({ hasText: exactText(label) }).locator('xpath=ancestor::div[contains(@class, "space-y-1.5")][1]').last()
}

async function fillField(page: Page, label: string, value: string) {
  const input = (await field(page, label)).locator('input, textarea').first()
  // Denetimde bulundu (2026-10-01): pilot modda DatePicker native <input type="date">
  // render ediyor (eski elle basamak giren özel bileşen değil) — native date input'u
  // "fill" ISO (YYYY-MM-DD) formatı bekler, legacy bileşenin DDMMYYYY basamak dizisini değil.
  const isDateInput = (await input.getAttribute('type')) === 'date'
  if (isDateInput && /^\d{8}$/.test(value)) {
    const d = value.slice(0, 2), m = value.slice(2, 4), y = value.slice(4, 8)
    await input.fill(`${y}-${m}-${d}`)
    return
  }
  await input.fill(value)
}

async function selectCombobox(page: Page, label: string, option: string | RegExp) {
  const container = await field(page, label)
  const input = container.locator('input').first()
  await input.click()
  await page.locator('[data-ds-popover]').getByRole('button', { name: option }).click()
}

async function selectNative(page: Page, label: string, optionLabel: string) {
  await pickDsOption(page, await field(page, label), optionLabel)
}

async function searchFor(page: Page, placeholder: string, value: string) {
  await page.getByPlaceholder(placeholder).fill(value)
  await expect(page.locator('tr', { hasText: value }).first()).toBeVisible({ timeout: 20000 })
}

async function createServiceCategory(name = uniq('E2E Hizmet Kategori')) {
  return apiRequest<Created>('POST', '/service-categories', { name, description: 'E2E hizmet kategori fixture', color: '#2563eb' })
}

async function createApprovedCompany(categoryId: string, name = uniq('E2E Firma')) {
  const tag = `${Date.now()}${Math.random().toString(16).slice(2, 6)}`
  const company = await apiRequest<Created>('POST', '/companies', {
    name,
    taxNumber: String(Date.now()).slice(-10).padStart(10, '1'),
    phone: `05${String(Date.now()).slice(-9)}`,
    email: `e2e.company.${tag}@example.com`,
    address: 'E2E test adresi',
    district: 'Sultangazi',
    serviceCategoryId: categoryId,
    deliveryChannel: 'Email',
  })
  return apiRequest<Created>('PATCH', `/companies/${company.id}/approve`)
}

test.describe('Companies admin module money-critical flows', () => {
  test.beforeAll(async () => { ctx = await pwRequest.newContext(); await freshAdminToken() })
  test.afterAll(async () => { await ctx.dispose() })

  test('firma oluşturur ve bekleyen firmayı onaylar', async ({ page }) => {
    test.setTimeout(90000)
    const category = await createServiceCategory()
    const companyName = uniq('E2E Onay Firma')
    const tag = `${Date.now()}${Math.random().toString(16).slice(2, 6)}`
    let companyId = ''

    await login(page)
    await page.goto('/companies?tab=firmalar')
    await expect(page.getByText('Firmalar').first()).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Firma' }).click()
    await expect(page.getByText('Yeni Firma Ekle')).toBeVisible()
    await fillField(page, 'Firma Adı', companyName)
    await fillField(page, 'Vergi Numarası', String(Date.now()).slice(-10).padStart(10, '2'))
    await fillField(page, 'Telefon', `05${String(Date.now()).slice(-9)}`)
    await fillField(page, 'E-posta (opsiyonel)', `e2e.pending.${tag}@example.com`)
    await fillField(page, 'Adres', 'Playwright firma adresi')
    await selectCombobox(page, 'Hizmet Kategorisi', category.name)

    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/companies') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'E-posta ile Gönder' }).click(),
    ])
    expect(createResponse.ok(), `POST /companies başarısız: ${await createResponse.text()}`).toBeTruthy()
    companyId = ((await createResponse.json()).data as Created).id

    await searchFor(page, 'Firma adı, e-posta, telefon, vergi no ara...', companyName)
    const row = page.locator('tr', { hasText: companyName }).first()
    await expect(row).toContainText(/Beklemede|Pending/)
    await clickRowAction(page, row, 'Onayla')
    await expect(page.getByRole('heading', { name: 'Firmayı Onayla' })).toBeVisible()
    const [approveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/companies/${companyId}/approve`) && r.request().method() === 'PATCH'),
      page.locator('.fixed.inset-0.z-50').last().getByRole('button', { name: 'Onayla' }).click(),
    ])
    expect(approveResponse.ok(), `PATCH approve başarısız: ${await approveResponse.text()}`).toBeTruthy()
    await expect(row).toContainText(/Onaylandı|Onaylı|Approved/, { timeout: 20000 })
  })

  test('kampanya oluştururken indirim tipi, tarih ve kullanım limitlerini gönderir', async ({ page }) => {
    test.setTimeout(90000)
    const category = await createServiceCategory()
    const company = await createApprovedCompany(category.id)
    const campaignName = uniq('E2E Kampanya')
    const startDate = futureIso(3)
    const endDate = futureIso(17)

    await login(page)
    await page.goto('/companies?tab=kampanyalar')
    await expect(page.getByText('Kampanyalar').first()).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Kampanya' }).click()
    await expect(page.getByText('Yeni Kampanya Ekle')).toBeVisible()
    await selectCombobox(page, 'Firma', company.name)
    await fillField(page, 'Kampanya Adı', campaignName)
    await selectNative(page, 'Kategori', 'İndirim')
    await selectNative(page, 'İndirim Türü', 'Sabit Tutar (TL)')
    await fillField(page, 'İndirim (TL)', '75')
    await fillField(page, 'Kişi Başı Kullanım', '2')
    await fillField(page, 'Min. Harcama Tutarı', '250')
    await page.getByRole('switch').click()
    await fillField(page, 'Limit', '40')
    await fillField(page, 'Başlangıç Tarihi', dateDigits(startDate))
    await fillField(page, 'Bitiş Tarihi', dateDigits(endDate))
    await fillField(page, 'Açıklama', 'Playwright kampanya açıklaması')

    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/campaigns') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kaydet' }).click(),
    ])
    expect(createResponse.ok(), `POST /campaigns başarısız: ${await createResponse.text()}`).toBeTruthy()
    const created = (await createResponse.json()).data as { discountType: string; discountValue: number; perUserLimit: number; totalUsageLimit: number; minOrderAmount: number; startDate: string; endDate: string }
    expect(created.discountType).toBe('fixed')
    expect(created.discountValue).toBe(75)
    expect(created.perUserLimit).toBe(2)
    expect(created.totalUsageLimit).toBe(40)
    expect(created.minOrderAmount).toBe(250)
    expect(created.startDate.slice(0, 10)).toBe(startDate)
    expect(created.endDate.slice(0, 10)).toBe(endDate)
    await searchFor(page, 'Kampanya veya firma ara...', campaignName)
  })

  test('hizmet kategorisi oluşturur, günceller ve siler', async ({ page }) => {
    test.setTimeout(90000)
    const name = uniq('E2E Hizmet')
    const updated = `${name} Güncel`
    let categoryId = ''

    await login(page)
    await page.goto('/companies?tab=kategoriler')
    await expect(page.getByText('Hizmet Kategorileri').first()).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Kategori' }).click()
    await expect(page.getByText('Yeni Kategori Ekle')).toBeVisible()
    await page.getByPlaceholder('Örn. Restoran').fill(name)
    await page.getByPlaceholder('Kategori hakkında kısa açıklama').fill('Playwright hizmet açıklaması')
    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/service-categories') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kaydet' }).click(),
    ])
    expect(createResponse.ok(), `POST /service-categories başarısız: ${await createResponse.text()}`).toBeTruthy()
    categoryId = ((await createResponse.json()).data as Created).id
    await searchFor(page, 'Kategori adı veya açıklama ara...', name)

    const row = page.locator('tr', { hasText: name }).first()
    await clickRowAction(page, row, 'Düzenle')
    await expect(page.getByText('Kategori Düzenle')).toBeVisible()
    await page.getByPlaceholder('Örn. Restoran').fill(updated)
    await page.getByPlaceholder('Kategori hakkında kısa açıklama').fill('Playwright hizmet açıklaması güncel')
    const [updateResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/service-categories/${categoryId}`) && r.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Güncelle' }).click(),
    ])
    expect(updateResponse.ok(), `PUT /service-categories başarısız: ${await updateResponse.text()}`).toBeTruthy()
    await searchFor(page, 'Kategori adı veya açıklama ara...', updated)

    await clickRowAction(page, page.locator('tr', { hasText: updated }).first(), 'Sil')
    await expect(page.getByRole('heading', { name: 'Kategoriyi Sil' })).toBeVisible()
    const [deleteResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/service-categories/${categoryId}`) && r.request().method() === 'DELETE'),
      page.getByRole('button', { name: 'Evet, Sil' }).click(),
    ])
    expect(deleteResponse.ok(), `DELETE /service-categories başarısız: ${await deleteResponse.text()}`).toBeTruthy()
    await expect(page.getByText(updated).first()).toBeHidden({ timeout: 20000 })
  })
})
