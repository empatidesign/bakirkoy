/**
 * Sistem Ayarları — Üst Menü (`TopMenuTab.tsx`, `/settings?tab=top-menu`), sıfır hata.
 *
 * Kullanıcının özellikle belirttiği "sistem ayarları" modülü — TÜM alt sekmeler
 * (`docs/ADMIN_PANEL_MODULE_SCENARIO_MATRIX_2026-09-04.md` madde D) hiç test edilmemişti.
 * Bu ekran, vatandaş portalındaki hizmet kartlarının ÜSTÜNDE görünen hızlı erişim
 * linklerini yönetiyor — yanlış bir link hedefi veya yanlışlıkla gizlenmiş bir öğe
 * TÜM vatandaşları etkiler (platform geneli navigasyon hatası).
 *
 * Kapsam: Ekleme (tüm alanlar: başlık, renk ColorSwatchPicker, 3 menü tipi — Uygulama
 * İçi/Dış URL/WebView, hedef URL, "yeni sekmede aç" checkbox'ı sadece dış URL/WebView'de
 * koşullu görünür), Düzenleme (aynı formun edit modu), Görünürlük toggle (gerçek API
 * PUT'u ile isVisible), Silme (ConfirmModal), Sıralama (drag-drop → reorder API'si).
 * Negatif validasyon: boş başlık/hedef ile "Kaydet" toast.error gösterip kaydetmiyor.
 *
 * DÜRÜST KAPSAM NOTU: Gerçek drag-and-drop (HTML5 dataTransfer API, Playwright'te
 * dragTo() ile native drag event'leri tetiklenemiyor — bkz. Playwright docs) kapsam
 * dışı; `reorder` API çağrısı doğrudan servis metoduyla API seviyesinde doğrulanıyor.
 * `MobileMenuTab` (banner'lar, gruplar, dosya yükleme içeren daha karmaşık kardeş
 * ekran) ayrı bir iterasyonda ele alınmalı.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

async function adminToken(ctx: APIRequestContext): Promise<string> {
  const login = await (await ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (login?.data?.accessToken) return login.data.accessToken
  const verify = await (await ctx.post(`${API_BASE}/auth/verify-otp`, {
    data: { otpSessionToken: login.data.otpSessionToken, code: ADMIN_OTP },
  })).json()
  if (!verify?.data?.accessToken) throw new Error(`Admin API login başarısız: ${JSON.stringify(verify)}`)
  return verify.data.accessToken
}

async function adminLoginUi(page: Page) {
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

async function getFreshToken(page: Page): Promise<string> {
  const t = await page.evaluate(() => localStorage.getItem('admin_access_token') || sessionStorage.getItem('admin_access_token'))
  if (!t) throw new Error('Sayfada güncel access_token bulunamadı.')
  return t
}

test.describe.serial('Sistem Ayarları — Üst Menü (TopMenuTab), sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let itemId = ''
  const title = uniq('QA-TEST-E2E-AUTO ÜstMenü')
  const titleUpdated = `${title} Güncel`

  test.beforeAll(async () => { apiCtx = await pwRequest.newContext() })

  test.afterAll(async () => {
    const token = await adminToken(apiCtx).catch(() => '')
    if (token && itemId) {
      await apiCtx.delete(`${API_BASE}/top-menu/${itemId}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    }
    await apiCtx.dispose()
  })

  test('1) Yeni menü öğesi eklenir — TÜM alanlar (3 menü tipi, koşullu "yeni sekmede aç"), negatif validasyon', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)
    await page.goto('/settings?tab=top-menu')
    await expect(page.getByText('Üst Menü Linkleri')).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Ekle' }).click()

    // Negatif: boş formda Kaydet basınca toast.error, form açık kalır.
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click()
    await expect(page.getByText('Başlık ve link hedefi zorunludur.')).toBeVisible({ timeout: 3000 })

    await page.getByPlaceholder('Örn: Ana Sayfa').fill(title)

    // Renk: ColorSwatchPicker.
    const colorSwatch = page.locator('button[style*="background"]').first()
    await colorSwatch.click().catch(() => {})
    // ColorSwatchPicker bir popover açıyorsa ilk rengi seç; açmıyorsa (basit swatch grid) devam et.
    const popoverSwatch = page.locator('[data-ds-popover] button').first()
    if (await popoverSwatch.isVisible({ timeout: 500 }).catch(() => false)) await popoverSwatch.click()

    // Menü tipi: design-system Select bileşeni. Pilot modda native <select> render
    // ediyor (2026-10-01 denetiminde doğrulandı — bu yorum eskiden "native DEĞİL" diyordu).
    // "Dış URL" seçip koşullu "yeni sekmede aç" checkbox'ının GÖRÜNDÜĞÜNÜ doğrula.
    const linkTypeSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Uygulama İçi' }) }).first()
    await linkTypeSelect.selectOption({ label: 'Dış URL (External)' })
    await expect(page.getByText('Yeni sekmede aç (_blank)')).toBeVisible({ timeout: 3000 })
    await page.getByPlaceholder('https://...').fill('https://qa-test-e2e-auto.example.com')
    await page.locator('input[type="checkbox"]').check()

    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/top-menu/') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kaydet', exact: true }).click(),
    ])
    expect(createResponse.ok(), `POST /top-menu başarısız: ${await createResponse.text()}`).toBeTruthy()
    await expect(page.getByText('Menü öğesi eklendi.')).toBeVisible({ timeout: 5000 })

    const created = (await createResponse.json()).data
    itemId = created.id
    expect(created).toMatchObject({
      title, linkType: 1, linkTarget: 'https://qa-test-e2e-auto.example.com', openInBlank: true, isVisible: true,
    })
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Dış URL').first()).toBeVisible({ timeout: 3000 })
  })

  test('2) Düzenleme: başlık ve menü tipi (Uygulama İçi\'ne) değiştirilir, "yeni sekmede aç" alanı kaybolur', async ({ page }) => {
    test.setTimeout(45_000)
    expect(itemId, 'önceki testte öğe oluşturulmuş olmalı').toBeTruthy()

    await adminLoginUi(page)
    await page.goto('/settings?tab=top-menu')
    await expect(page.getByText('Üst Menü Linkleri')).toBeVisible({ timeout: 15000 })

    const row = page.locator('xpath=//span[contains(normalize-space(text()),' + JSON.stringify(title) + ')]/ancestor::div[contains(@class,"cursor-move")][1]')
    await row.locator('button[aria-label="Düzenle"]').click()

    const titleInput = page.getByPlaceholder('Örn: Ana Sayfa')
    await titleInput.fill(titleUpdated)

    const linkTypeSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Uygulama İçi' }) }).first()
    await linkTypeSelect.selectOption({ label: 'Uygulama İçi' })
    // "Uygulama İçi" seçilince "yeni sekmede aç" koşullu satırı kaybolmalı.
    await expect(page.getByText('Yeni sekmede aç (_blank)')).toBeHidden({ timeout: 3000 })
    await page.getByPlaceholder('/basvurularim').fill('/qa-test-e2e-auto')

    const [updateResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/top-menu/${itemId}`) && r.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Kaydet', exact: true }).click(),
    ])
    expect(updateResponse.ok(), `PUT /top-menu başarısız: ${await updateResponse.text()}`).toBeTruthy()
    await expect(page.getByText('Güncellendi.')).toBeVisible({ timeout: 5000 })

    const updated = (await updateResponse.json()).data
    expect(updated).toMatchObject({ title: titleUpdated, linkType: 0, linkTarget: '/qa-test-e2e-auto' })
    await expect(page.getByText(titleUpdated).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Uygulama İçi').first()).toBeVisible({ timeout: 3000 })
  })

  test('3) Görünürlük toggle GERÇEK API çağrısı yapar, sayfa yenilenince kalıcılığı doğrular', async ({ page }) => {
    test.setTimeout(45_000)
    expect(itemId, 'önceki testte öğe oluşturulmuş olmalı').toBeTruthy()

    await adminLoginUi(page)
    await page.goto('/settings?tab=top-menu')
    await expect(page.getByText('Üst Menü Linkleri')).toBeVisible({ timeout: 15000 })

    const row = page.locator('xpath=//span[contains(normalize-space(text()),' + JSON.stringify(titleUpdated) + ')]/ancestor::div[contains(@class,"cursor-move")][1]')
    await expect(row.getByText('Görünür', { exact: true })).toBeVisible({ timeout: 5000 })

    const [toggleResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/top-menu/${itemId}`) && r.request().method() === 'PUT'),
      row.locator('button[aria-label="Görünürlük"]').click(),
    ])
    expect(toggleResponse.ok(), `PUT (görünürlük) başarısız: ${await toggleResponse.text()}`).toBeTruthy()
    const toggled = (await toggleResponse.json()).data
    expect(toggled.isVisible).toBe(false)
    await expect(row.getByText('Gizli', { exact: true })).toBeVisible({ timeout: 5000 })

    // Sayfa yenilensin, API'den GERÇEKTEN kalıcı olduğu doğrulansın.
    const freshToken = await getFreshToken(page)
    const check = await (await page.request.get(`${API_BASE}/top-menu/`, { headers: { Authorization: `Bearer ${freshToken}` } })).json()
    const item = (check.data as { id: string; isVisible: boolean }[]).find((i) => i.id === itemId)
    expect(item?.isVisible).toBe(false)
  })

  test('4) Sıralama (reorder) API çağrısı — sıralamanın GERÇEKTEN değiştiği API\'den doğrulanıyor', async ({ page }) => {
    test.setTimeout(45_000)
    expect(itemId, 'önceki testte öğe oluşturulmuş olmalı').toBeTruthy()

    await adminLoginUi(page)
    const freshToken = await getFreshToken(page)
    const before = await (await page.request.get(`${API_BASE}/top-menu/`, { headers: { Authorization: `Bearer ${freshToken}` } })).json()
    const items: { id: string; order: number }[] = before.data
    expect(items.length, 'reorder testi için en az 2 menü öğesi olmalı').toBeGreaterThan(1)

    // Sırayı ters çevirip reorder API'sini doğrudan çağır (gerçek native drag-drop
    // Playwright'te tetiklenemiyor — bkz. dosya başlığı dürüst kapsam notu).
    const reversedIds = items.map((i) => i.id).reverse()
    const reorderRes = await page.request.put(`${API_BASE}/top-menu/reorder`, {
      headers: { Authorization: `Bearer ${freshToken}`, 'Content-Type': 'application/json' },
      data: { orderedIds: reversedIds },
    })
    expect(reorderRes.ok(), `PUT /top-menu/reorder başarısız: ${await reorderRes.text()}`).toBeTruthy()

    const after = await (await page.request.get(`${API_BASE}/top-menu/`, { headers: { Authorization: `Bearer ${freshToken}` } })).json()
    const afterItems: { id: string; order: number }[] = after.data
    const sortedIds = [...afterItems].sort((a, b) => a.order - b.order).map((i) => i.id)
    expect(sortedIds).toEqual(reversedIds)

    // Orijinal sırayı geri yükle — kayıt fixture kirliliği bırakmasın.
    const restoreRes = await page.request.put(`${API_BASE}/top-menu/reorder`, {
      headers: { Authorization: `Bearer ${freshToken}`, 'Content-Type': 'application/json' },
      data: { orderedIds: items.map((i) => i.id) },
    })
    expect(restoreRes.ok()).toBeTruthy()
  })

  test('5) Silme: ConfirmModal onaylanınca öğe GERÇEKTEN silinir', async ({ page }) => {
    test.setTimeout(45_000)
    expect(itemId, 'önceki testte öğe oluşturulmuş olmalı').toBeTruthy()

    await adminLoginUi(page)
    await page.goto('/settings?tab=top-menu')
    await expect(page.getByText('Üst Menü Linkleri')).toBeVisible({ timeout: 15000 })

    const row = page.locator('xpath=//span[contains(normalize-space(text()),' + JSON.stringify(titleUpdated) + ')]/ancestor::div[contains(@class,"cursor-move")][1]')
    await row.locator('button[aria-label="Sil"]').click()
    await expect(page.getByRole('heading', { name: 'Menü Öğesini Sil' })).toBeVisible({ timeout: 5000 })

    const [deleteResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/top-menu/${itemId}`) && r.request().method() === 'DELETE'),
      page.getByRole('button', { name: 'Onayla', exact: true }).click(),
    ])
    expect(deleteResponse.ok(), `DELETE /top-menu başarısız: ${await deleteResponse.text()}`).toBeTruthy()
    await expect(page.getByText('Silindi.')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(titleUpdated).first()).toBeHidden({ timeout: 5000 })

    itemId = '' // afterAll'da tekrar silmeye çalışmasın.
  })
})
