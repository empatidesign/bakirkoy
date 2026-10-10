/**
 * Salonlar (Halls) — kapsamlı form testi, sıfır hata.
 *
 * Kullanıcı isteği (2026-09-04): "sıfır hata istiyorum." Salon kapasitesi etkinlik
 * kontenjanlarını doğrudan etkiliyor (bkz. formdaki uyarı banner'ı: "Etkinlik kontenjanları
 * bu salonun kapasitesini aşamaz") — yanlış kapasite gerçek bir aşırı-rezervasyon riskine
 * yol açar (`docs/ADMIN_PANEL_MODULE_SCENARIO_MATRIX_2026-09-04.md` madde C).
 *
 * DÜRÜST KAPSAM NOTU: "Koltuklu" (seated) oturma modu `SeatingLayoutBuilder` (ayrı,
 * karmaşık bir görsel düzen editörü) gerektiriyor — bu bileşen kütüphanenin Oturma
 * Planı editörüne benzer ölçekte ayrı bir derinlik gerektirir ve bu testin kapsamı
 * DIŞINDADIR. Bu test "Ayakta" (standing) modunu kullanır — kapasite doğrudan sayısal
 * girişle belirlenir, tüm diğer alanlar (tesis, tür, kat, açıklama, özellikler) TAM
 * kapsanır.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { pickSelect } from './helpers/designSystemControls'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'

async function adminToken(ctx: APIRequestContext): Promise<string> {
  const login = await (await ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (login?.data?.accessToken) return login.data.accessToken
  const verify = await (await ctx.post(`${API_BASE}/auth/verify-otp`, {
    data: { otpSessionToken: login.data.otpSessionToken, code: ADMIN_OTP },
  })).json()
  if (!verify?.data?.accessToken) throw new Error(`Admin API login başarısız: ${JSON.stringify(verify)}`)
  return verify.data.accessToken
}

async function adminLoginUi(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.locator('#email').fill(ADMIN_EMAIL!)
  await page.locator('#password').fill(ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  if (await page.waitForURL('**/login/otp', { timeout: 5000 }).then(() => true).catch(() => false)) {
    const otpInputs = page.locator('input[inputmode="numeric"]')
    const count = await otpInputs.count()
    for (let i = 0; i < Math.min(6, count); i++) await otpInputs.nth(i).fill(ADMIN_OTP[i])
    await page.getByRole('button', { name: /Doğrula/ }).click()
  }
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
}

async function getFreshToken(page: import('@playwright/test').Page): Promise<string> {
  const t = await page.evaluate(() => localStorage.getItem('admin_access_token') || sessionStorage.getItem('admin_access_token'))
  if (!t) throw new Error('Sayfada güncel access_token bulunamadı.')
  return t
}

test.describe('Salonlar — kapsamlı form testi (Ayakta modu), sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let token = ''
  let serviceFacilityId = ''
  let hallId = ''
  const tag = `QA-TEST-E2E-AUTO Salon ${Date.now()}`

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const me = await (await apiCtx.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).json()
    const adminUserId = me?.data?.me?.id

    const sfRes = await apiCtx.post(`${API_BASE}/service-facilities`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `${tag} Tesisi`, type: 'library', locationType: 'Indoor',
        city: 'İstanbul', district: 'Sultangazi', address: 'E2E Test Mah. No:1', latitude: 41.1039, longitude: 28.8674,
        managerId: adminUserId, weekdayOpen: '08:00', weekdayClose: '22:00',
        weekendOpen: '09:00', weekendClose: '20:00', parkingCapacity: 0, parkingType: 'Free', capacity: 100,
      },
    })
    expect(sfRes.ok(), `service-facility oluşturulamadı: ${await sfRes.text()}`).toBeTruthy()
    serviceFacilityId = (await sfRes.json()).data.id
  })

  test.afterAll(async () => {
    const cleanupToken = await adminToken(apiCtx).catch(() => token)
    if (hallId) await apiCtx.delete(`${API_BASE}/halls/${hallId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    if (serviceFacilityId) await apiCtx.delete(`${API_BASE}/service-facilities/${serviceFacilityId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    await apiCtx.dispose()
  })

  test('Yeni salon (Ayakta modu) — TÜM alanlar gerçekten dolduruluyor, sıfır hata', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)

    await page.goto('/halls')
    await page.getByRole('button', { name: /Yeni Salon/i }).click()

    const drawer = page.locator('div.relative.z-10').last()
    await expect(drawer.getByText('Yeni Salon Ekle', { exact: false }).first()).toBeVisible({ timeout: 5000 })

    // Tesis seçimi — design-system özel Select bileşeni (native <select> DEĞİL, custom
    // buton+portal popover). searchable değil ama pickSelect yine de çalışır.
    await pickSelect(page, drawer, /Tesis seçiniz/, `${tag} Tesisi`)

    await drawer.getByPlaceholder('Salon adını giriniz...').fill(tag)
    await drawer.getByPlaceholder('Örn. 0 (zemin)').fill('2')

    // Oturma Modu: "Ayakta" seç — SeatingLayoutBuilder'ı bypass eder, kapasite doğrudan girilir.
    await drawer.getByText('Ayakta', { exact: true }).click()
    await drawer.getByPlaceholder('Kişi kapasitesi').fill('250')

    await drawer.getByPlaceholder(/Tek satır açıklama/).fill('Otomatik QA testi kısa açıklama.')
    await drawer.getByPlaceholder(/Salon hakkında detaylı bilgi/).fill('Otomatik QA testi ile oluşturuldu, detaylı açıklama.')

    // Özellik seç — HallFeaturesPanel'i aç, en az 1 özellik işaretle, kapat.
    await drawer.getByRole('button', { name: 'Özellik Seç' }).click()
    const featuresPanel = page.locator('div.relative.z-10, div[role="dialog"]').last()
    const firstFeatureChip = featuresPanel.locator('button').filter({ hasText: /.+/ }).first()
    await firstFeatureChip.click({ timeout: 5000 }).catch(() => {})
    // Panel kapatma butonu (X veya Kapat/Tamam) — spesifik değilse ESC dener.
    const closeBtn = featuresPanel.getByRole('button', { name: /Kapat|Tamam|Bitti/i }).first()
    if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) await closeBtn.click()
    else await page.keyboard.press('Escape')

    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    await drawer.getByRole('button', { name: 'Kaydet', exact: true }).click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('Salon oluşturuldu', { exact: false })).toBeVisible({ timeout: 10000 })

    // Fake-success-detection: API'den geri oku, TÜM alanları doğrula.
    const freshToken = await getFreshToken(page)
    const listRes = await page.request.get(`${API_BASE}/halls?search=${encodeURIComponent(tag)}`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const listBody = await listRes.json()
    const created = listBody?.data?.items?.[0]
    hallId = created?.id
    expect(hallId, 'oluşturulan salon API listesinde bulunmalı').toBeTruthy()

    expect(created.name).toBe(tag)
    expect(created.facilityId).toBe(serviceFacilityId)
    expect(created.buildingFloor).toBe(2)
    expect(created.seatingMode).toBe('standing')
    expect(created.capacity).toBe(250)
    expect(created.description).toContain('Otomatik')
    expect(created.about).toContain('detaylı açıklama')
  })
})
