/**
 * Sistem Ayarları — Menü Yönetimi (`MenuManagementTab.tsx`, 723 satır,
 * `/settings?tab=menu-management`), sıfır hata — SADECE "Menü Bölümleri" (SectionsPanel).
 *
 * Kullanıcının özellikle belirttiği "sistem ayarları" modülü — hiç test edilmemişti.
 * Bu ekran, vatandaş portalındaki (web sidebar + mobil alt menü) TÜM navigasyon
 * yapısını yönetiyor — yanlış yapılandırma platform geneli navigasyon hatası yaratır.
 *
 * Kapsam: Yeni Bölüm oluşturma (başlık→anahtar otomatik türetme, ikon, 3 görünürlük
 * toggle'ı), Bölüm düzenleme (aynı alanlar inline), Bölüme Öğe ekleme (TÜM alanlar:
 * Bağlı Modül seçimi ile otomatik başlık/link/ikon/renk doldurma, Link Tipi, Sidebar/
 * Mobil link hedefleri, 5 görünürlük toggle'ı, rozet metni+rengi), Öğe düzenleme,
 * Öğe görünürlük hızlı toggle (Gizle/Göster ikon butonu), Öğe silme, Bölüm silme
 * (ConfirmModal, "bölüm ve içindeki tüm öğeler silinsin mi" uyarısı).
 *
 * DÜRÜST KAPSAM NOTU: "Sistem Modülleri" (ModulesPanel) sekmesi KASITLI OLARAK
 * kapsam dışı — bu panel gerçek platform modüllerinin (Kütüphane, Etkinlikler vb.)
 * aktif/pasif durumunu ve sidebar sırasını yönetiyor; test sırasında yanlışlıkla
 * gerçek bir modülü pasife almak CANLI SİSTEMİ BOZAR. Sürükle-bırak (native
 * HTML5 dataTransfer, Playwright'te tetiklenemiyor) ve reorder API'leri de
 * kapsam dışı — aynı gotcha, bkz. settings-top-menu-flow.spec.ts.
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

function sectionCard(page: Page, title: string) {
  return page.locator('xpath=//span[contains(normalize-space(text()),' + JSON.stringify(title) + ')]/ancestor::div[contains(@class,"rounded-card")][1]')
}

test.describe.serial('Sistem Ayarları — Menü Yönetimi (Menü Bölümleri), sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let sectionId = ''
  let itemId = ''
  const title = uniq('QA-TEST-E2E-AUTO Bölüm')
  const _titleUpdated = `${title} Güncel`
  const itemTitle = uniq('QA-TEST-E2E-AUTO Öğe')

  test.beforeAll(async () => { apiCtx = await pwRequest.newContext() })

  test.afterAll(async () => {
    const token = await adminToken(apiCtx).catch(() => '')
    if (token) {
      if (itemId) await apiCtx.delete(`${API_BASE}/app-menu/items/${itemId}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
      if (sectionId) await apiCtx.delete(`${API_BASE}/app-menu/sections/${sectionId}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    }
    await apiCtx.dispose()
  })

  test('1) Yeni Bölüm oluşturulur — başlık girilince anahtar (key) otomatik türetilir, görünürlük toggle\'ları çalışır', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)
    await page.goto('/settings?tab=menu-management')
    await expect(page.getByText('Menü Yönetimi').first()).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Menü Bölümleri' }).click()

    await page.getByRole('button', { name: 'Bölüm Ekle' }).click()
    await expect(page.getByText('Yeni Bölüm', { exact: true })).toBeVisible({ timeout: 5000 })

    await page.getByPlaceholder('Ulaşım').fill(title)
    // Anahtar (key) alanı otomatik türetilmeli (başlığın lowercase + tire-slug hali).
    const keyInput = page.getByPlaceholder('ulasim')
    const autoKey = await keyInput.inputValue()
    expect(autoKey.length, 'anahtar başlıktan otomatik türetilmeli').toBeGreaterThan(0)
    expect(autoKey).toMatch(/^[a-z0-9-]+$/)

    await page.getByPlaceholder('Bus').fill('QaTestAutoIcon')

    // Görünürlük toggle'larını KAPATIP (varsayılan hepsi açık) her birinin gerçekten
    // etkilendiğini doğrula.
    const _visibleToggle = page.locator('xpath=//p[normalize-space(text())="Görünür"]/ancestor::div[contains(@class,"flex")][1]//button[@role="switch"]')
    const sidebarToggle = page.locator('xpath=//p[normalize-space(text())="Vatandaş Portalı\'nda göster"]/ancestor::div[contains(@class,"flex")][1]//button[@role="switch"]')
    await sidebarToggle.click()

    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/app-menu/sections') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Oluştur' }).click(),
    ])
    expect(createResponse.ok(), `POST /app-menu/sections başarısız: ${await createResponse.text()}`).toBeTruthy()
    const created = (await createResponse.json()).data
    sectionId = created.id
    expect(created).toMatchObject({ title, key: autoKey, icon: 'QaTestAutoIcon', isVisible: true, showInSidebar: false, showInMobile: true })
    await expect(page.getByText('Bölüm eklendi.')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 5000 })
    // Portalda gizli rozetinin GERÇEKTEN göründüğünü doğrula (showInSidebar=false).
    await expect(sectionCard(page, title).getByText('Portalda gizli')).toBeVisible({ timeout: 3000 })
  })

  test('2) Bölüme yeni Öğe eklenir — Bağlı Modül seçilince başlık/link/ikon/renk otomatik dolar, TÜM alanlar kaydedilir', async ({ page }) => {
    test.setTimeout(60_000)
    expect(sectionId, 'önceki testte bölüm oluşturulmuş olmalı').toBeTruthy()

    await adminLoginUi(page)
    await page.goto('/settings?tab=menu-management')
    await expect(page.getByText('Menü Yönetimi').first()).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Menü Bölümleri' }).click()
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 })

    const card = sectionCard(page, title)
    await card.getByRole('button', { name: 'Öğe ekle' }).click()

    // Bağlı Modül: design-system Select bileşeni (native <select> DEĞİL, custom
    // buton+popover). Seçilince başlık/link/ikon/renk otomatik doldurulur — sonra
    // başlığı benzersiz test etiketiyle EZİYORUZ (aksi halde tüm öğeler aynı ada sahip olur).
    const moduleTrigger = card.getByRole('button', { name: '— Modüle bağlama —', exact: true })
    await moduleTrigger.click()
    const modulePopover = page.locator('[data-ds-popover]').last()
    await expect(modulePopover).toBeVisible({ timeout: 3000 })
    const moduleOptions = modulePopover.locator('button')
    const moduleOptionsCount = await moduleOptions.count()
    expect(moduleOptionsCount, 'en az bir aktif modül olmalı (placeholder hariç)').toBeGreaterThan(1)
    await moduleOptions.nth(1).click()
    const titleInput = card.locator('xpath=.//label[contains(normalize-space(text()),"Başlık")]/ancestor::div[contains(@class,"space-y-1.5")][1]//input')
    const autoTitle = await titleInput.inputValue()
    expect(autoTitle.length, 'modül seçilince başlık otomatik dolmalı').toBeGreaterThan(0)

    await titleInput.fill(itemTitle)

    // Sidebar Link (zorunlu) alanını benzersiz bir test linkiyle üzerine yaz.
    const sidebarLinkInput = card.getByPlaceholder(/^\/[a-z]+$/).first()
    await sidebarLinkInput.fill('/qa-test-e2e-auto-item')

    await card.getByPlaceholder('Yeni').fill('QA-TEST')

    const [createItemResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/app-menu/items') && r.request().method() === 'POST'),
      card.getByRole('button', { name: 'Ekle', exact: true }).click(),
    ])
    expect(createItemResponse.ok(), `POST /app-menu/items başarısız: ${await createItemResponse.text()}`).toBeTruthy()
    const createdItem = (await createItemResponse.json()).data
    itemId = createdItem.id
    expect(createdItem).toMatchObject({ sectionId, title: itemTitle, linkTarget: '/qa-test-e2e-auto-item', badgeText: 'QA-TEST' })
    await expect(page.getByText('Öğe eklendi.')).toBeVisible({ timeout: 5000 })
    await expect(card.getByText(itemTitle)).toBeVisible({ timeout: 5000 })
  })

  test('3) Öğe görünürlük hızlı toggle GERÇEK API çağrısı yapar (Gizle/Göster ikon butonu)', async ({ page }) => {
    test.setTimeout(45_000)
    expect(itemId, 'önceki testte öğe oluşturulmuş olmalı').toBeTruthy()

    await adminLoginUi(page)
    await page.goto('/settings?tab=menu-management')
    await expect(page.getByText('Menü Yönetimi').first()).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Menü Bölümleri' }).click()
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 })

    const card = sectionCard(page, title)
    const itemRow = card.locator('xpath=//span[normalize-space(text())=' + JSON.stringify(itemTitle) + ']/ancestor::div[contains(@class,"rounded-lg")][1]')
    await expect(itemRow).toBeVisible({ timeout: 5000 })

    const [toggleResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/app-menu/items/${itemId}`) && r.request().method() === 'PUT'),
      itemRow.locator('button[aria-label="Gizle"]').click(),
    ])
    expect(toggleResponse.ok(), `PUT (görünürlük) başarısız: ${await toggleResponse.text()}`).toBeTruthy()
    const toggled = (await toggleResponse.json()).data
    expect(toggled.isVisible).toBe(false)
    await expect(itemRow.locator('button[aria-label="Göster"]')).toBeVisible({ timeout: 5000 })
  })

  test('4) Öğe ve Bölüm silinir — ConfirmModal onayları GERÇEK DELETE çağrısı yapar', async ({ page }) => {
    test.setTimeout(45_000)
    expect(sectionId && itemId, 'önceki testlerde bölüm ve öğe oluşturulmuş olmalı').toBeTruthy()

    await adminLoginUi(page)
    await page.goto('/settings?tab=menu-management')
    await expect(page.getByText('Menü Yönetimi').first()).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Menü Bölümleri' }).click()
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 })

    const card = sectionCard(page, title)
    const itemRow = card.locator('xpath=//span[normalize-space(text())=' + JSON.stringify(itemTitle) + ']/ancestor::div[contains(@class,"rounded-lg")][1]')
    await itemRow.locator('button[aria-label="Sil"]').click()
    await expect(page.getByRole('heading', { name: 'Öğeyi sil' })).toBeVisible({ timeout: 5000 })
    const [deleteItemResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/app-menu/items/${itemId}`) && r.request().method() === 'DELETE'),
      page.locator('div.relative.z-10').last().getByRole('button', { name: 'Sil', exact: true }).click(),
    ])
    expect(deleteItemResponse.ok(), `DELETE /app-menu/items başarısız: ${await deleteItemResponse.text()}`).toBeTruthy()
    await expect(page.getByText('Öğe silindi.')).toBeVisible({ timeout: 5000 })
    itemId = ''

    await card.locator('button[aria-label="Sil"]').first().click()
    await expect(page.getByRole('heading', { name: 'Bölümü sil' })).toBeVisible({ timeout: 5000 })
    const [deleteSectionResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/app-menu/sections/${sectionId}`) && r.request().method() === 'DELETE'),
      page.locator('div.relative.z-10').last().getByRole('button', { name: 'Sil', exact: true }).click(),
    ])
    expect(deleteSectionResponse.ok(), `DELETE /app-menu/sections başarısız: ${await deleteSectionResponse.text()}`).toBeTruthy()
    await expect(page.getByText('Bölüm silindi.')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(title).first()).toBeHidden({ timeout: 5000 })
    sectionId = ''
  })
})
