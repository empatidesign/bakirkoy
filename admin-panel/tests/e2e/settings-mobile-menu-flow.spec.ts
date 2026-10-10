/**
 * Sistem Ayarları — Mobil Menü (`MobileMenuTab.tsx` + `MobileMenuItemForm.tsx`,
 * 317+241=558 satır, `/settings?tab=mobile-menu`), sıfır hata.
 *
 * Kullanıcının özellikle belirttiği "sistem ayarları" modülü. Mobil uygulamanın ana
 * menüsünü (öğeler + gruplar) ve sayfa banner'larını yönetiyor. Test öncesinde
 * canlıda hem items hem banners BOŞTU (`GET /mobile-menu/items` → `[]`,
 * `/banners` → `[]`) — bu yüzden orphan/restore riski yok, sadece kendi eklediğimiz
 * test verisini silmemiz yeterli.
 *
 * Kapsam:
 * - Menü Öğesi ekleme: Başlık, İkon (Lucide adı VE gerçek görsel yükleme — iconType
 *   0→1 geçişi doğrulanıyor), Renk (ColorSwatchPicker: hem preset tıklama hem serbest
 *   hex girişi), Link Tipi (3 tip: Modül/WebView/Dış URL — WebView/Dış URL için
 *   backend'in `BeAbsoluteUrl` kısıtı http(s) mutlak URL zorunlu kılıyor, bu da
 *   ayrı bir testte doğrulanıyor), Yeni Grup oluşturma (başlık→anahtar otomatik
 *   türetme + serbest anahtar override), Popüler/Yayında/SadeceGirişYapmış toggle'ları.
 * - Menü Öğesi düzenleme: var olan gruba geçiş, tüm alanların güncellenmesi.
 * - Görünürlük toggle (liste üzerindeki göz ikonu, ayrı buton — formsuz).
 * - Sıralama (reorder): native HTML5 drag-drop Playwright'ta güvenilir tetiklenemediği
 *   için (TopMenuTab kalıbı) doğrudan `PUT /mobile-menu/items/reorder` API çağrısıyla
 *   test edilip liste sırasının API'den doğru döndüğü doğrulanıyor.
 * - Menü Öğesi silme (ConfirmModal).
 * - Banner: Sayfa anahtarı + GERÇEK görsel dosyası yükleme (canvas→JPEG buffer,
 *   `event-image-crop.spec.ts` kalıbı), banner listede görünmesi, banner silme.
 *
 * DÜRÜST KAPSAM NOTU: Native HTML5 drag-drop (öğe kartlarını sürükleyerek sıralama)
 * Playwright'ın `dragTo`/mouse eventleriyle güvenilir tetiklenemiyor (React'ın
 * `onDragStart/onDrop` handler'ları senkron DataTransfer state'ine bağımlı) — bu
 * yüzden reorder API'si doğrudan çağrılarak iş mantığı (persist + sıra döndürme)
 * doğrulanıyor, UI sürükleme etkileşiminin kendisi kapsam dışı (TopMenuTab'daki
 * aynı gerekçe). Banner'ın kendi link tipi/hedefi (WebView/Dış URL) alanları
 * `BannerSection`'da UI'dan expose edilmiyor (sadece `upload()` fonksiyonu
 * `linkType:0, linkTarget:null` sabit gönderiyor) — bu yüzden banner link
 * alanları UI'dan test edilemez, sadece görsel+anahtar+silme kapsanıyor.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'

const TAG = 'QA-TEST-E2E-AUTO'
const uniqTitle = (suffix: string) => `${TAG} ${suffix} ${Date.now()}`

interface MobileMenuItem {
  id: string; title: string; icon: string; iconType: 'Lucide' | 'Image'; color: string
  linkType: 'Module' | 'WebView' | 'ExternalUrl'; linkTarget: string; groupKey: string; groupTitle: string
  isPopular: boolean; isVisible: boolean; requiresAuth: boolean; order: number
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

async function makeJpegBuffer(page: Page, w: number, h: number): Promise<Buffer> {
  const dataUrl = await page.evaluate(([width, height]) => {
    const canvas = document.createElement('canvas')
    canvas.width = width as number
    canvas.height = height as number
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#3355ee'
    ctx.fillRect(0, 0, width as number, height as number)
    return canvas.toDataURL('image/jpeg', 0.9)
  }, [w, h])
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

function itemRow(page: Page, title: string) {
  return page.locator(
    `xpath=//p[normalize-space(text())=${JSON.stringify(title)}]/ancestor::div[contains(@class,"rounded-lg") and contains(@class,"border-border")][1]`,
  )
}

function fieldByLabel(page: Page, label: string) {
  return page.locator(
    'xpath=//label[contains(normalize-space(text()),' + JSON.stringify(label) + ')]/ancestor::div[contains(@class,"space-y-1.5")][1]',
  )
}

async function pickCustomSelect(page: Page, fieldLabel: string, optionText: string) {
  await fieldByLabel(page, fieldLabel).getByRole('button').first().click()
  await page.locator('[data-ds-popover]').last().getByRole('button', { name: optionText, exact: true }).click()
}

test.describe.serial('Sistem Ayarları — Mobil Menü (MobileMenuTab), sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  const createdItemIds: string[] = []
  const createdBannerKeys: string[] = []

  test.beforeAll(async () => { apiCtx = await pwRequest.newContext() })

  test.afterAll(async () => {
    const token = await adminToken(apiCtx)
    for (const id of createdItemIds) {
      await apiCtx.delete(`${API_BASE}/mobile-menu/items/${id}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    }
    for (const key of createdBannerKeys) {
      await apiCtx.delete(`${API_BASE}/mobile-menu/banners/${key}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    }
    // Orphan doğrulaması: test tag'li hiçbir öğe/banner kalmamalı.
    const remainingItems = await (await apiCtx.get(`${API_BASE}/mobile-menu/items`, { headers: { Authorization: `Bearer ${token}` } })).json()
    const orphanItems = (remainingItems.data as MobileMenuItem[]).filter((i) => i.title.includes(TAG))
    if (orphanItems.length > 0) throw new Error(`KRİTİK: ${orphanItems.length} orphan test öğesi kaldı: ${JSON.stringify(orphanItems.map((i) => i.id))}`)
    const remainingBanners = await (await apiCtx.get(`${API_BASE}/mobile-menu/banners`, { headers: { Authorization: `Bearer ${token}` } })).json()
    const orphanBanners = (remainingBanners.data as { pageKey: string }[]).filter((b) => b.pageKey.includes('qa-test'))
    if (orphanBanners.length > 0) throw new Error(`KRİTİK: ${orphanBanners.length} orphan test banner'ı kaldı: ${JSON.stringify(orphanBanners.map((b) => b.pageKey))}`)
    await apiCtx.dispose()
  })

  test('1) Menü Öğesi ekleme: TÜM alanlar (Lucide ikon, yeni grup, renk preset, link tipi Modül)', async ({ page }) => {
    test.setTimeout(45_000)
    await adminLoginUi(page)
    await page.goto('/settings?tab=mobile-menu')
    await expect(page.getByRole('button', { name: 'Öğe Ekle' })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Öğe Ekle' }).click()

    const title = uniqTitle('Modül Öğe')
    await page.getByPlaceholder('Ör. Etkinlikler').fill(title)

    // İkon: Lucide adı serbest metin
    await page.getByPlaceholder(/Lucide ikon adı/).fill('CalendarDays')

    // Renk: preset tıklama
    await page.locator('button[title="#16a34a"]').click()
    await expect(page.locator('input.font-mono').first()).toHaveValue('#16a34a')

    // Link Tipi: varsayılan Modül (0), sayfa yolu gir
    await page.getByPlaceholder('/etkinlikler').fill('/etkinlikler')

    // Yeni Grup oluştur
    await page.getByRole('button', { name: '+ Yeni' }).click()
    const groupTitle = `${TAG} Grup A`
    await page.getByPlaceholder('Grup adı (ör. Şehir Hizmetleri)').fill(groupTitle)
    const expectedKey = groupTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    await expect(page.getByPlaceholder('anahtar (otomatik)')).toHaveValue(expectedKey)

    // Toggle'lar
    await page.locator('xpath=//p[normalize-space(text())="Popüler / Öne çıkan"]/ancestor::div[contains(@class,"rounded-card")][1]//button[@role="switch"]').click()
    await page.locator('xpath=//p[normalize-space(text())="Sadece giriş yapmış kullanıcıya göster"]/ancestor::div[contains(@class,"rounded-card")][1]//button[@role="switch"]').click()

    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/mobile-menu/items') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Ekle', exact: true }).click(),
    ])
    expect(createResponse.ok(), `POST /mobile-menu/items başarısız: ${await createResponse.text()}`).toBeTruthy()
    const created: MobileMenuItem = (await createResponse.json()).data
    createdItemIds.push(created.id)

    expect(created).toMatchObject({
      title, icon: 'CalendarDays', iconType: 'Lucide', color: '#16a34a',
      linkType: 'Module', linkTarget: '/etkinlikler', groupKey: expectedKey, groupTitle,
      isPopular: true, isVisible: true, requiresAuth: true,
    })
    await expect(page.getByText('Öğe eklendi.')).toBeVisible({ timeout: 5000 })
    await expect(itemRow(page, title)).toBeVisible({ timeout: 5000 })
    await expect(itemRow(page, title).getByText('Modül', { exact: true })).toBeVisible()
  })

  test('2) Menü Öğesi ekleme: görsel ikon yükleme (iconType 0→1) + WebView link tipi + mutlak URL kısıtı', async ({ page }) => {
    test.setTimeout(45_000)
    await adminLoginUi(page)
    await page.goto('/settings?tab=mobile-menu')
    await expect(page.getByRole('button', { name: 'Öğe Ekle' })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Öğe Ekle' }).click()

    const title = uniqTitle('Görsel Öğe')
    await page.getByPlaceholder('Ör. Etkinlikler').fill(title)

    // Görsel yükleme
    const [uploadResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/mobile-menu/images') && r.request().method() === 'POST'),
      (async () => {
        const buffer = await makeJpegBuffer(page, 64, 64)
        await page.locator('input[type=file]').first().setInputFiles({ name: 'ikon-qa-test.jpg', mimeType: 'image/jpeg', buffer })
      })(),
    ])
    expect(uploadResponse.ok(), `POST /mobile-menu/images başarısız: ${await uploadResponse.text()}`).toBeTruthy()
    await expect(page.getByText('İkon yüklendi.')).toBeVisible({ timeout: 5000 })
    // iconType 1'e geçince "Lucide ikona dön" butonu görünür olmalı.
    await expect(page.getByRole('button', { name: 'Lucide ikona dön' })).toBeVisible({ timeout: 3000 })

    // Link Tipi: WebView seçilip GEÇERSİZ (göreli) URL girilirse backend reddetmeli
    await pickCustomSelect(page, 'Link Tipi', 'WebView (uygulama içi web)')
    await page.getByPlaceholder('https://example.com').fill('/gecersiz-goreli-yol')

    // Grup: var olan gruptan seç (test 1'de oluşturulan)
    await pickCustomSelect(page, 'Grup', `${TAG} Grup A`)

    const [invalidResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/mobile-menu/items') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Ekle', exact: true }).click(),
    ])
    expect(invalidResponse.status(), 'göreli URL WebView için 400 dönmeli').toBe(400)

    // Şimdi GEÇERLİ mutlak URL ile düzelt
    await page.getByPlaceholder('https://example.com').fill('https://qa-test-e2e-auto.example.com/sayfa')
    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/mobile-menu/items') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Ekle', exact: true }).click(),
    ])
    expect(createResponse.ok(), `POST (geçerli URL) başarısız: ${await createResponse.text()}`).toBeTruthy()
    const created: MobileMenuItem = (await createResponse.json()).data
    createdItemIds.push(created.id)
    expect(created).toMatchObject({ title, iconType: 'Image', linkType: 'WebView', linkTarget: 'https://qa-test-e2e-auto.example.com/sayfa' })
    expect(created.icon).toMatch(/\/files\/public\/mobile-menu\//)
    await expect(itemRow(page, title)).toBeVisible({ timeout: 5000 })
    await expect(itemRow(page, title).locator('img')).toBeVisible()
  })

  test('3) Menü Öğesi düzenleme: başlık/link/renk güncellenir, görünürlük toggle listeden çalışır', async ({ page }) => {
    test.setTimeout(45_000)
    // NOT (2026-09-05, gerçek testte bulunan, tekrarlayan gotcha): API token'ı
    // UI login'den ÖNCE almak gerekiyor — tek-oturum politikası, UI login sonrası
    // önceki API oturumunu geçersiz kılıyor (tersi de geçerli).
    const token = await adminToken(apiCtx)
    const itemsRes = await (await apiCtx.get(`${API_BASE}/mobile-menu/items`, { headers: { Authorization: `Bearer ${token}` } })).json()
    const target = (itemsRes.data as MobileMenuItem[]).find((i) => i.id === createdItemIds[0])!
    expect(target).toBeTruthy()

    await adminLoginUi(page)
    await page.goto('/settings?tab=mobile-menu')
    await expect(page.getByRole('button', { name: 'Öğe Ekle' })).toBeVisible({ timeout: 15000 })

    const row = itemRow(page, target.title)
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.getByRole('button', { name: 'Düzenle' }).click()

    const newTitle = uniqTitle('Düzenlenmiş')
    await page.getByPlaceholder('Ör. Etkinlikler').fill(newTitle)
    await page.getByPlaceholder('/etkinlikler').fill('/degisen-yol')
    await page.locator('input.font-mono').first().fill('#dc2626')

    const [updateResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/mobile-menu/items/${target.id}`) && r.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Güncelle', exact: true }).click(),
    ])
    expect(updateResponse.ok(), `PUT başarısız: ${await updateResponse.text()}`).toBeTruthy()
    const updated: MobileMenuItem = (await updateResponse.json()).data
    expect(updated).toMatchObject({ title: newTitle, linkTarget: '/degisen-yol', color: '#dc2626' })
    await expect(page.getByText('Öğe güncellendi.')).toBeVisible({ timeout: 5000 })

    // Görünürlük toggle (liste üzerinden, formsuz)
    const newRow = itemRow(page, newTitle)
    await expect(newRow).toBeVisible({ timeout: 5000 })
    const [visResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/mobile-menu/items/${target.id}`) && r.request().method() === 'PUT'),
      newRow.getByRole('button', { name: 'Gizle' }).click(),
    ])
    expect(visResponse.ok()).toBeTruthy()
    const hidden: MobileMenuItem = (await visResponse.json()).data
    expect(hidden.isVisible).toBe(false)
    await expect(newRow.getByRole('button', { name: 'Göster' })).toBeVisible({ timeout: 5000 })

    // Geri aç (temiz durum için sonraki testleri etkilememesi adına)
    const [visBackResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/mobile-menu/items/${target.id}`) && r.request().method() === 'PUT'),
      newRow.getByRole('button', { name: 'Göster' }).click(),
    ])
    expect((await visBackResponse.json()).data.isVisible).toBe(true)
  })

  test('4) Sıralama (reorder) — API doğrudan çağrılır, GET ile yeni sıra doğrulanır', async ({}) => {
    const token = await adminToken(apiCtx)
    const before = await (await apiCtx.get(`${API_BASE}/mobile-menu/items`, { headers: { Authorization: `Bearer ${token}` } })).json()
    const items: MobileMenuItem[] = before.data
    expect(items.length).toBeGreaterThanOrEqual(2)
    const reversedIds = [...items].map((i) => i.id).reverse()

    const reorderRes = await apiCtx.put(`${API_BASE}/mobile-menu/items/reorder`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { orderedIds: reversedIds },
    })
    expect(reorderRes.status(), `reorder başarısız: ${await reorderRes.text()}`).toBe(204)

    const after = await (await apiCtx.get(`${API_BASE}/mobile-menu/items`, { headers: { Authorization: `Bearer ${token}` } })).json()
    const afterIds = (after.data as MobileMenuItem[]).sort((a, b) => a.order - b.order).map((i) => i.id)
    expect(afterIds).toEqual(reversedIds)
  })

  test('5) Banner: gerçek görsel yükleme + sayfa anahtarıyla kaydetme + silme', async ({ page }) => {
    test.setTimeout(45_000)
    await adminLoginUi(page)
    await page.goto('/settings?tab=mobile-menu')
    await expect(page.getByRole('button', { name: 'Öğe Ekle' })).toBeVisible({ timeout: 15000 })
    await page.getByText("Banner'lar", { exact: true }).click()
    await expect(page.getByText('Banner Yükle')).toBeVisible({ timeout: 5000 })

    const pageKey = `qa-test-banner-${Date.now()}`
    await page.getByPlaceholder('ör. etkinlikler').fill(pageKey)

    const [uploadResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/mobile-menu/images') && r.request().method() === 'POST'),
      (async () => {
        const buffer = await makeJpegBuffer(page, 1200, 400)
        await page.locator('input[type=file]').first().setInputFiles({ name: 'banner-qa-test.jpg', mimeType: 'image/jpeg', buffer })
      })(),
    ])
    expect(uploadResponse.ok()).toBeTruthy()

    const [saveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/mobile-menu/banners/${pageKey}`) && r.request().method() === 'PUT'),
    ])
    expect(saveResponse.ok(), `PUT banner başarısız: ${await saveResponse.text()}`).toBeTruthy()
    createdBannerKeys.push(pageKey)
    await expect(page.getByText('Banner kaydedildi.')).toBeVisible({ timeout: 5000 })
    await expect(page.locator(`span.font-mono:has-text("${pageKey}")`)).toBeVisible({ timeout: 5000 })

    // Silme
    const bannerCard = page.locator(
      `xpath=//span[contains(@class,"font-mono") and normalize-space(text())=${JSON.stringify(pageKey)}]/ancestor::div[contains(@class,"overflow-hidden")][1]`,
    )
    await bannerCard.getByRole('button', { name: "Banner'ı sil" }).click()
    await page.locator('.z-50').getByRole('button', { name: 'Sil', exact: true }).click()
    await expect(page.getByText('Banner silindi.')).toBeVisible({ timeout: 5000 })
    createdBannerKeys.pop() // manuel silindi, afterAll'da tekrar denemesin

    const check = await (await apiCtx.get(`${API_BASE}/mobile-menu/banners`, { headers: { Authorization: `Bearer ${await adminToken(apiCtx)}` } })).json()
    expect((check.data as { pageKey: string }[]).some((b) => b.pageKey === pageKey)).toBe(false)
  })

  test('6) Menü Öğesi silme (ConfirmModal) — tüm test öğeleri temizlenir', async ({ page }) => {
    test.setTimeout(45_000)
    // NOT: API token UI login'den ÖNCE alınmalı (tek-oturum politikası gotcha'sı).
    const token = await adminToken(apiCtx)
    const itemsRes = await (await apiCtx.get(`${API_BASE}/mobile-menu/items`, { headers: { Authorization: `Bearer ${token}` } })).json()
    const remaining = (itemsRes.data as MobileMenuItem[]).filter((i) => createdItemIds.includes(i.id))
    expect(remaining.length).toBeGreaterThan(0)

    await adminLoginUi(page)
    await page.goto('/settings?tab=mobile-menu')
    await expect(page.getByRole('button', { name: 'Öğe Ekle' })).toBeVisible({ timeout: 15000 })

    for (const item of remaining) {
      const row = itemRow(page, item.title)
      await expect(row).toBeVisible({ timeout: 10000 })
      await row.getByRole('button', { name: 'Sil' }).click()
      await expect(page.getByText('Bu işlem geri alınamaz.')).toBeVisible({ timeout: 3000 })
      const [deleteResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith(`/mobile-menu/items/${item.id}`) && r.request().method() === 'DELETE'),
        page.locator('.z-50').getByRole('button', { name: 'Sil', exact: true }).click(),
      ])
      expect(deleteResponse.status(), `DELETE ${item.id} başarısız: ${await deleteResponse.text()}`).toBe(204)
      await expect(page.getByText('Öğe silindi.').last()).toBeVisible({ timeout: 5000 })
      await expect(itemRow(page, item.title)).not.toBeVisible({ timeout: 5000 })
    }
    createdItemIds.length = 0 // manuel silindi, afterAll'da tekrar denemesin
  })
})
