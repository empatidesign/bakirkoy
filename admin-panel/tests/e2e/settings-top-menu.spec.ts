/**
 * Sistem Ayarları — Üst Menü (Top Menu) yönetimi, sıfır hata toleranslı.
 *
 * Kullanıcı isteği (2026-09-04): "sıfır hata istiyorum." Bu ekran, vatandaş portalındaki
 * hizmet kartlarının üstünde görünen hızlı erişim linklerini yönetiyor — yanlış bir link
 * hedefi veya yanlışlıkla gizlenmiş bir menü öğesi TÜM vatandaşları etkiler
 * (`docs/ADMIN_PANEL_MODULE_SCENARIO_MATRIX_2026-09-04.md` madde D, "Sistem Ayarları").
 *
 * Kapsam:
 *   1. Yeni menü öğesi ekleme — TÜM alanlar (başlık, renk — hem hex input hem preset swatch,
 *      menü tipi segment/select, hedef URL, "yeni sekmede aç" checkbox'ı sadece dış URL/WebView
 *      tiplerinde görünür), kayıt sonrası API'den doğrulanıyor.
 *   2. Görünürlük toggle — Görünür → Gizli → Görünür, her adımda API'den doğrulanıyor.
 *   3. Düzenleme — başlık ve hedef URL değiştirilip kaydediliyor, API'den doğrulanıyor.
 *   4. Silme — item gerçekten API listesinden kayboluyor mu.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { pickSelect } from './helpers/designSystemControls'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'

const uniq = (prefix: string) => `${prefix} ${Date.now()}`

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

/** Menü öğesi satırının Card kapsayıcısına, başlık metninden XPath ile en yakın en dıştaki
 * kart ata'sına çıkarak ulaşır. NOT (2026-09-04, gerçek testte bulunan hata): `locator('div',
 * { has: ... })` TÜM ata div'leri eşleştirir, `.last()`/`.first()` DOM sırasına göre
 * BELİRSİZ ve yanlış sonuç verebilir (kütüphane testinde de aynı hata bulunmuştu). */
function menuItemRow(page: import('@playwright/test').Page, title: string) {
  return page.locator(
    'xpath=//span[normalize-space(text())=' + JSON.stringify(title) + ']/ancestor::div[contains(@class,"cursor-move")][1]',
  )
}

test.describe.serial('Sistem Ayarları — Üst Menü, sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  const itemTitle = uniq('QA-TEST-E2E-AUTO Menu')
  const itemTitleEdited = `${itemTitle} DÜZENLENDİ`
  let itemId = ''

  test.beforeAll(async () => { apiCtx = await pwRequest.newContext() })
  test.afterAll(async () => {
    const cleanupToken = await adminToken(apiCtx)
    if (itemId) await apiCtx.delete(`${API_BASE}/top-menu/${itemId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    await apiCtx.dispose()
  })

  test('1) Yeni üst menü öğesi eklenir — TÜM alanlar (dış URL tipi, "yeni sekmede aç" dahil), sıfır hata', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)
    await page.goto('/settings?tab=top-menu')
    await expect(page.getByText('Üst Menü Linkleri', { exact: false })).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: 'Ekle', exact: true }).click()
    const form = page.locator('form').filter({ has: page.getByPlaceholder('Örn: Ana Sayfa') })
    await form.getByPlaceholder('Örn: Ana Sayfa').fill(itemTitle)

    // Renk: önce hex input ile, sonra preset swatch'a tıklayarak DEĞİŞTİRİYORUZ (iki yolu da test et).
    await form.getByPlaceholder('#2563eb').fill('#123456')
    await form.locator('button[title="#dc2626"]').click()

    // Menü Tipi: "Dış URL" seç — bu, "yeni sekmede aç" checkbox'ını GÖRÜNÜR yapmalı.
    await pickSelect(page, form, /Uygulama İçi/, 'Dış URL (External)')
    await expect(form.getByText('Yeni sekmede aç')).toBeVisible({ timeout: 3000 })
    await form.locator('input[type="checkbox"]').check()

    await form.getByPlaceholder('https://...').fill('https://example-qa-test.nexora.local')

    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    await form.getByRole('button', { name: 'Kaydet', exact: true }).click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('Menü öğesi eklendi', { exact: false })).toBeVisible({ timeout: 8000 })

    // Fake-success-detection: API'den geri oku, TÜM alanları doğrula.
    const freshToken = await getFreshToken(page)
    const listRes = await page.request.get(`${API_BASE}/top-menu`, { headers: { Authorization: `Bearer ${freshToken}` } })
    const listBody = await listRes.json()
    const items: Array<Record<string, unknown>> = listBody?.data ?? []
    const created = items.find((i) => i.title === itemTitle)
    expect(created, `oluşturulan menü öğesi API listesinde bulunmalı: ${JSON.stringify(items).slice(0, 400)}`).toBeTruthy()
    itemId = created!.id as string

    expect(created!.color).toBe('#dc2626')
    expect(created!.linkType).toBe(1) // Dış URL
    expect(created!.linkTarget).toBe('https://example-qa-test.nexora.local')
    expect(created!.openInBlank).toBe(true)
    expect(created!.isVisible).toBe(true) // varsayılan olarak görünür oluşturulmalı
  })

  test('2) Görünürlük toggle — Gizli\'ye alınır, sonra tekrar Görünür yapılır, her adım API\'den doğrulanır', async ({ page }) => {
    test.setTimeout(30_000)
    expect(itemId, 'önceki testte menü öğesi oluşturulmuş olmalı').toBeTruthy()
    await adminLoginUi(page)
    await page.goto('/settings?tab=top-menu')

    const row = menuItemRow(page, itemTitle)
    await row.getByRole('button', { name: 'Görünürlük' }).click()

    const freshToken1 = await getFreshToken(page)
    const afterHide = await (await page.request.get(`${API_BASE}/top-menu`, { headers: { Authorization: `Bearer ${freshToken1}` } })).json()
    const hiddenItem = (afterHide?.data ?? []).find((i: { id: string }) => i.id === itemId)
    expect(hiddenItem?.isVisible, 'gizlendikten sonra isVisible=false olmalı').toBe(false)

    // UI'da da "Gizli" rozeti görünmeli — sayfayı yenile ve tekrar kontrol et.
    await page.reload()
    await expect(menuItemRow(page, itemTitle).getByText('Gizli')).toBeVisible({ timeout: 8000 })

    const rowAfterReload = menuItemRow(page, itemTitle)
    await rowAfterReload.getByRole('button', { name: 'Görünürlük' }).click()

    const freshToken2 = await getFreshToken(page)
    const afterShow = await (await page.request.get(`${API_BASE}/top-menu`, { headers: { Authorization: `Bearer ${freshToken2}` } })).json()
    const visibleItem = (afterShow?.data ?? []).find((i: { id: string }) => i.id === itemId)
    expect(visibleItem?.isVisible, 'tekrar gösterildikten sonra isVisible=true olmalı').toBe(true)
  })

  test('3) Düzenleme — başlık ve hedef URL değiştirilir, sıfır hata', async ({ page }) => {
    test.setTimeout(30_000)
    expect(itemId, 'önceki testte menü öğesi oluşturulmuş olmalı').toBeTruthy()
    await adminLoginUi(page)
    await page.goto('/settings?tab=top-menu')

    const row = menuItemRow(page, itemTitle)
    await row.getByRole('button', { name: 'Düzenle' }).click()

    const form = page.locator('form').filter({ has: page.getByPlaceholder('Örn: Ana Sayfa') })
    await form.getByPlaceholder('Örn: Ana Sayfa').fill(itemTitleEdited)
    await form.getByPlaceholder('https://...').fill('https://example-qa-test-v2.nexora.local')

    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    await form.getByRole('button', { name: 'Kaydet', exact: true }).click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('Güncellendi', { exact: false })).toBeVisible({ timeout: 8000 })

    const freshToken = await getFreshToken(page)
    const listBody = await (await page.request.get(`${API_BASE}/top-menu`, { headers: { Authorization: `Bearer ${freshToken}` } })).json()
    const updated = (listBody?.data ?? []).find((i: { id: string }) => i.id === itemId)
    expect(updated?.title).toBe(itemTitleEdited)
    expect(updated?.linkTarget).toBe('https://example-qa-test-v2.nexora.local')
  })

  test('4) Silme — item GERÇEKTEN API listesinden kaybolur', async ({ page }) => {
    test.setTimeout(30_000)
    expect(itemId, 'önceki testte menü öğesi oluşturulmuş olmalı').toBeTruthy()
    await adminLoginUi(page)
    await page.goto('/settings?tab=top-menu')

    const row = menuItemRow(page, itemTitleEdited)
    await row.getByRole('button', { name: 'Sil' }).click()
    await page.getByText('Menü Öğesini Sil', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
    await page.getByRole('button', { name: 'Onayla', exact: true }).click()
    await expect(page.getByText('Silindi', { exact: false })).toBeVisible({ timeout: 8000 })

    const freshToken = await getFreshToken(page)
    const listBody = await (await page.request.get(`${API_BASE}/top-menu`, { headers: { Authorization: `Bearer ${freshToken}` } })).json()
    const stillThere = (listBody?.data ?? []).find((i: { id: string }) => i.id === itemId)
    expect(stillThere, 'silinen öğe API listesinde ARTIK olmamalı').toBeFalsy()
    itemId = '' // afterAll'da tekrar silmeye çalışmas��n
  })
})
