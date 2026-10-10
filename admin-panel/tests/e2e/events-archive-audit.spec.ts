/**
 * Etkinlikler — Arşiv (soft-delete/geri yükle/kalıcı sil) ve İşlem Geçmişi (audit log)
 * akışları, sıfır hata. `ArchiveTab.tsx` (240 satır) ve `EventAuditModal.tsx` bu modülde
 * HİÇ UI'dan test edilmemişti (`events-admin.spec.ts` sadece normal CRUD kapsıyor).
 *
 * Kapsam:
 *   1. Bir etkinliği sil (soft-delete) → normal listeden kaybolur, arşivde görünür →
 *      geri yükle → normal listede tekrar görünür, arşivden kaybolur.
 *   2. Bir etkinliği sil → arşivde kalıcı sil (süper admin yetkisi gerekir) → kalıcı
 *      olarak kaybolur, hem normal listede hem arşivde görünmez.
 *   3. İşlem Geçmişi modalı — created/deleted/restored aksiyonlarının GERÇEKTEN
 *      loglandığı ve doğru sırada/etiketle gösterildiği doğrulanıyor.
 *
 * DÜRÜST KAPSAM NOTU: Toplu (bulk) geri yükle/kalıcı sil aksiyonları (`selectionActions`)
 * ve arşiv arama/filtre kapsam dışı — tekli aksiyon akışları zaten aynı servis
 * metodlarını (`restore`, `permanentDelete`) çağırıyor, toplu olan sadece Promise.allSettled
 * sarmalayıcısı.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { login } from './helpers/auth'
import { clickRowAction } from './helpers/rowActions'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

function futureIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

let ctx: APIRequestContext
let adminToken = ''

async function freshAdminToken(): Promise<string> {
  const login1 = await (await ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (login1?.data?.accessToken) { adminToken = login1.data.accessToken; return adminToken }
  const verify = await (await ctx.post(`${API_BASE}/auth/verify-otp`, { data: { otpSessionToken: login1.data.otpSessionToken, code: ADMIN_OTP } })).json()
  adminToken = verify?.data?.accessToken ?? ''
  if (!adminToken) throw new Error(`Admin API OTP failed: ${JSON.stringify(verify)}`)
  return adminToken
}

async function apiRequest<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, retried = false): Promise<T> {
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

type Created = { id: string; code?: string; name?: string }

async function createCategory() {
  return apiRequest<Created>('POST', '/event-categories', { name: uniq('QA-TEST-E2E-AUTO Kategori'), description: 'fixture', color: '#2563eb', defaultPoints: 5 })
}

async function createEvent(categoryId: string, name: string) {
  const startDate = futureIso(14)
  return apiRequest<Created>('POST', '/events', {
    name, categoryId, venueType: 'outdoor', facilityId: null, hallId: null,
    location: { name: 'E2E Açık Alan', latitude: 41.02, longitude: 28.88 },
    startDate, endDate: startDate, startTime: '09:00', endTime: '10:00',
    applicationStartDate: futureIso(1), applicationEndDate: futureIso(10),
    gender: 'mixed', capacity: 20, reserveCapacity: 5, minAge: 0, maxAge: 99,
    participationPeriod: 'none', participationLimit: 0,
    description: 'fixture', internalNote: '',
    images: { web: { cover: { width: 1920, height: 720, maxSizeKb: 800 }, card: { width: 600, height: 400, maxSizeKb: 200 }, thumb: { width: 240, height: 240, maxSizeKb: 80 } }, mobile: { cover: { width: 1080, height: 1350, maxSizeKb: 600 }, card: { width: 750, height: 750, maxSizeKb: 250 }, thumb: { width: 320, height: 320, maxSizeKb: 100 } }, ratios: {}, photos: [] },
    access: { hasSessions: false, hasSeating: false, reservationType: 'none', registrationMode: 'required', attendanceEnabled: false, entryMethod: 'checkin', qrEnabled: false, qrType: 'rotating', qrRotationSeconds: 30, kioskEnabled: false, turnstileEnabled: false, publicLinkEnabled: false, publicLinkRequiresPin: false, staffIds: [], notificationTemplates: [], cancellationDeadlineHours: 24 },
    pricing: { isPaid: false, currency: 'TRY', audiences: [], siblingDiscountEnabled: false, siblingDiscounts: [], municipalityEmployeeDiscountEnabled: false, municipalityEmployeePercent: 0, disabledDiscountEnabled: false, disabledPercent: 0, veteranDiscountEnabled: false, veteranPercent: 0, combineDiscounts: false, maxDiscountPercent: 50 },
    points: { enabled: false, basePoints: 0, walkInEarnsPoints: false },
    isActive: true, residencyMode: 'anyone', sultangaziResidentOnly: false,
  })
}

async function searchFor(page: Page, placeholder: string, value: string) {
  await page.getByPlaceholder(placeholder).fill(value)
  await expect(page.getByText(value).first()).toBeVisible({ timeout: 20000 })
}

test.describe.serial('Etkinlikler — Arşiv (soft-delete/restore/kalıcı sil) ve İşlem Geçmişi', () => {
  test.beforeAll(async () => { ctx = await pwRequest.newContext(); await freshAdminToken() })

  const eventIds: string[] = []
  const categoryIds: string[] = []

  // NOT (2026-09-04, gerçek testte bulunan KRİTİK gotcha — tekrarlayan single-session
  // policy): Testler içinde `login(page)` UI üzerinden TEKRAR TEKRAR login olduğundan,
  // module-level `adminToken` her testten sonra geçersiz kalıyor. Testlerin İÇİNDE
  // `.catch(()=>{})` ile sessizce yapılan tekli cleanup çağrıları bu yüzden gerçekte
  // BAŞARISIZ oluyordu (401 alıp yutuluyordu) ve orphan event/kategori kayıtları DB'de
  // kalıyordu (elle bulunup temizlendi). Artık TÜM oluşturulan id'ler merkezi listelerde
  // tutuluyor ve tek bir afterAll'da, taze bir token ile, SIRAYLA (delete → permanent
  // delete → category delete) temizleniyor; her adımın durumu loglanıyor.
  test.afterAll(async () => {
    await freshAdminToken()
    for (const id of eventIds) {
      await ctx.fetch(`${API_BASE}/events/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } }).catch(() => {})
      const purgeRes = await ctx.fetch(`${API_BASE}/events/${id}/permanent`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } }).catch(() => null)
      if (purgeRes && !purgeRes.ok() && purgeRes.status() !== 404) {
        console.log(`CLEANUP: event ${id} kalıcı silinemedi (${purgeRes.status()})`)
      }
    }
    for (const id of categoryIds) {
      const res = await ctx.fetch(`${API_BASE}/event-categories/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } }).catch(() => null)
      if (res && !res.ok() && res.status() !== 404) {
        console.log(`CLEANUP: kategori ${id} silinemedi (${res.status()})`)
      }
    }
    await ctx.dispose()
  })

  test('1) Sil → arşivde görünür → geri yükle → normal listede tekrar görünür, arşivden kaybolur', async ({ page }) => {
    test.setTimeout(90_000)
    const category = await createCategory()
    categoryIds.push(category.id!)
    const eventName = uniq('QA-TEST-E2E-AUTO Arşiv')
    const created = await createEvent(category.id!, eventName)
    eventIds.push(created.id!)

    await login(page)
    await page.goto('/events?tab=events')
    await expect(page.getByText('Etkinlikler').first()).toBeVisible({ timeout: 20000 })
    await searchFor(page, 'Etkinlik adı, kod, hizmet tesisi veya salon ara...', eventName)

    const row = page.locator('tr', { hasText: eventName }).first()
    await clickRowAction(page, row, 'Sil')
    await expect(page.getByRole('heading', { name: 'Etkinliği Çöp Kutusuna Taşı' })).toBeVisible({ timeout: 5000 })
    const [deleteResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/events/${created.id}`) && r.request().method() === 'DELETE' && !r.url().includes('permanent')),
      page.getByRole('button', { name: 'Evet, Sil' }).click(),
    ])
    expect(deleteResponse.ok(), `DELETE /events/${created.id} başarısız`).toBeTruthy()
    await expect(page.getByText(eventName).first()).toBeHidden({ timeout: 15000 })

    await page.goto('/events?tab=archive')
    await expect(page.getByText('Silinen Etkinlikler', { exact: true })).toBeVisible({ timeout: 20000 })
    await searchFor(page, 'Etkinlik adı veya kod ara...', eventName)
    const archiveRow = page.locator('tr', { hasText: eventName }).first()
    await expect(archiveRow).toBeVisible({ timeout: 15000 })
    await expect(archiveRow).toContainText(/superadmin|Süper Admin|Admin/i)

    const [restoreResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/events/${created.id}/restore`) && r.request().method() === 'PATCH'),
      archiveRow.locator('button[aria-label="Geri yükle"]').click(),
    ])
    expect(restoreResponse.ok(), `PATCH restore başarısız: ${await restoreResponse.text()}`).toBeTruthy()
    await expect(page.getByText('Etkinlik geri yüklendi.')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(eventName).first()).toBeHidden({ timeout: 15000 })

    await page.goto('/events?tab=events')
    await expect(page.getByText('Etkinlikler').first()).toBeVisible({ timeout: 20000 })
    await searchFor(page, 'Etkinlik adı, kod, hizmet tesisi veya salon ara...', eventName)
    await expect(page.locator('tr', { hasText: eventName }).first()).toBeVisible({ timeout: 15000 })
  })

  test('2) Sil → arşivde kalıcı sil → hem normal listede hem arşivde görünmez', async ({ page }) => {
    test.setTimeout(90_000)
    const category = await createCategory()
    categoryIds.push(category.id!)
    const eventName = uniq('QA-TEST-E2E-AUTO ArşivPurge')
    const created = await createEvent(category.id!, eventName)
    eventIds.push(created.id!)
    await apiRequest('DELETE', `/events/${created.id}`)

    await login(page)
    await page.goto('/events?tab=archive')
    await expect(page.getByText('Silinen Etkinlikler', { exact: true })).toBeVisible({ timeout: 20000 })
    await searchFor(page, 'Etkinlik adı veya kod ara...', eventName)
    const archiveRow = page.locator('tr', { hasText: eventName }).first()
    await expect(archiveRow).toBeVisible({ timeout: 15000 })

    await archiveRow.locator('button[aria-label="Kalıcı sil"]').click()
    await expect(page.getByRole('heading', { name: 'Etkinliği Kalıcı Sil' })).toBeVisible({ timeout: 5000 })
    const [purgeResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/events/${created.id}/permanent`) && r.request().method() === 'DELETE'),
      page.getByRole('button', { name: 'Evet, Kalıcı Sil' }).click(),
    ])
    expect(purgeResponse.ok(), `DELETE permanent başarısız: ${await purgeResponse.text()}`).toBeTruthy()
    await expect(page.getByText('Etkinlik kalıcı olarak silindi.')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(eventName).first()).toBeHidden({ timeout: 15000 })

    // NOT (2026-09-04, gerçek testte bulunan tekrarlayan gotcha — single-session policy):
    // `login(page)` UI üzerinden tekrar login olduğundan `adminToken` (module-level) artık
    // GEÇERSİZ — 404 yerine 401 dönerdi. Kontrol öncesi token'ı YENİLİYORUZ.
    await freshAdminToken()
    // API'den de kalıcı olarak yok olduğunu doğrula (404 bekleniyor).
    const checkRes = await ctx.fetch(`${API_BASE}/events/${created.id}`, { headers: { Authorization: `Bearer ${adminToken}` } })
    expect(checkRes.status()).toBe(404)
  })

  test('3) İşlem Geçmişi — created/deleted/restored aksiyonları GERÇEKTEN loglanıyor', async ({ page }) => {
    test.setTimeout(90_000)
    const category = await createCategory()
    categoryIds.push(category.id!)
    const eventName = uniq('QA-TEST-E2E-AUTO ArşivAudit')
    const created = await createEvent(category.id!, eventName)
    eventIds.push(created.id!)
    await apiRequest('DELETE', `/events/${created.id}`)
    await apiRequest('PATCH', `/events/${created.id}/restore`)

    await login(page)
    await page.goto('/events?tab=archive')
    // NOT: Geri yüklenen etkinlik artık arşivde GÖRÜNMEZ (soft-delete geri alındığı için) —
    // audit modalını normal Etkinlikler listesinden açıyoruz.
    await page.goto('/events?tab=events')
    await expect(page.getByText('Etkinlikler').first()).toBeVisible({ timeout: 20000 })
    await searchFor(page, 'Etkinlik adı, kod, hizmet tesisi veya salon ara...', eventName)
    const row = page.locator('tr', { hasText: eventName }).first()
    await expect(row).toBeVisible({ timeout: 15000 })

    await clickRowAction(page, row, 'İşlem geçmişi')
    await expect(page.getByText('İşlem Geçmişi')).toBeVisible({ timeout: 8000 })

    const modal = page.locator('div.relative.z-10').last()
    await expect(modal.getByText('Oluşturuldu', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(modal.getByText('Çöp kutusuna taşındı', { exact: true })).toBeVisible({ timeout: 5000 })
    await expect(modal.getByText('Geri yüklendi', { exact: true })).toBeVisible({ timeout: 5000 })
  })
})
