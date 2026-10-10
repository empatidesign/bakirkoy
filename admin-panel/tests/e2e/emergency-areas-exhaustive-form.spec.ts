/**
 * Acil Toplanma Alanları — sıfır hata toleranslı UI testi.
 *
 * Kullanıcı isteği (2026-09-04): "sıfır hata istiyorum." Bu modül afet/güvenlik verisi
 * taşıyor — yanlış konum/kapasite/donanım bilgisi gerçek bir kriz anında hayati risk
 * oluşturur (`docs/ADMIN_PANEL_MODULE_SCENARIO_MATRIX_2026-09-04.md` madde D, öncelik #3).
 *
 * Kapsam: TÜM form alanları gerçekten dolduruluyor (isim, mahalle, adres, GPS koordinatları,
 * kapasite, alan büyüklüğü, TÜM 6 donanım checkbox'ı, sorumlu kişi), kayıt sonrası API'den
 * TÜM alanlar doğrulanıyor. Ayrıca (bu oturumda eklendi): düzenleme (alan/donanım güncelleme),
 * durum değiştirme (Aktif/Pasif toggle, ConfirmModal ile), silme — tam CRUD döngüsü.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { clickRowAction } from './helpers/rowActions'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'

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

test.describe.serial('Acil Toplanma Alanları — kapsamlı form testi, sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let areaId = ''
  const areaName = `QA-TEST-E2E-AUTO Alan ${Date.now()}`

  test.beforeAll(async () => { apiCtx = await pwRequest.newContext() })
  test.afterAll(async () => {
    const login = await (await apiCtx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
    let cleanupToken = login?.data?.accessToken
    if (!cleanupToken && login?.data?.otpSessionToken) {
      const verify = await (await apiCtx.post(`${API_BASE}/auth/verify-otp`, {
        data: { otpSessionToken: login.data.otpSessionToken, code: ADMIN_OTP },
      })).json()
      cleanupToken = verify?.data?.accessToken
    }
    if (areaId && cleanupToken) {
      await apiCtx.delete(`${API_BASE}/emergency-areas/${areaId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    }
    await apiCtx.dispose()
  })

  test('Yeni acil toplanma alanı — TÜM alanlar (6 donanım, GPS, sorumlu) gerçekten dolduruluyor, sıfır hata', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)

    await page.goto('/emergency-areas')
    await page.getByRole('button', { name: /Yeni Alan/i }).click()

    const drawer = page.locator('div.relative.z-10').last()
    await expect(drawer.getByText('Yeni Acil Alan Ekle', { exact: false }).first()).toBeVisible({ timeout: 5000 })

    await drawer.getByPlaceholder(/Cebeci Park/i).fill(areaName)

    // Mahalle — Combobox (allowCustom), yazıp ekle. NOT (2026-09-04, gerçek testte bulunan
    // hata): Escape tuşu useOverlayDismiss stack'inin EN ÜSTÜNDEKİNİ kapatır — Combobox popup'ı
    // değil, drawer'ın kendisi kapanabilir. Bunun yerine başka bir alana tıklayarak kapatıyoruz.
    const neighborhoodInput = drawer.getByPlaceholder('Mahalle seçin...')
    await neighborhoodInput.click()
    await neighborhoodInput.fill('QA Test Mahallesi')
    // Combobox popup'ı input'un ALTINDA açılıyor (adres alanını kaplıyor) — header'a
    // tıklamak popup'ı güvenle kapatır çünkü header her zaman popup'ın üstünde/dışında.
    await drawer.getByText('Yeni Acil Alan Ekle', { exact: false }).first().click()

    await drawer.getByPlaceholder(/Cadde, sokak, no/i).fill(`${areaName} Cad. No:1`)

    // GPS koordinatları — MapPicker altındaki lat/lng input'ları.
    await drawer.getByPlaceholder('41.0750').fill('41.1055')
    await drawer.getByPlaceholder('28.8700').fill('28.8680')

    await drawer.getByPlaceholder(/Örn\. 2000/).fill('1500')
    await drawer.getByPlaceholder(/Örn\. 3500/).fill('2200')

    // TÜM 6 donanım checkbox'ını işaretle — afet senaryosunda hepsi kritik bilgi.
    for (const label of ['Tuvalet', 'İçme Suyu', 'Elektrik', 'Jeneratör', 'Isıtma', 'Çadır Alanı']) {
      await drawer.getByText(label, { exact: true }).click()
    }

    // Sorumlu: "Yeni kişi ekle" — erişim vermeden (facility testinde de doğrulanan doğru desen).
    await drawer.getByRole('button', { name: 'Yeni kişi ekle' }).click()
    await drawer.getByPlaceholder('Kişinin adı ve soyadı').fill('QA Test Acil Alan Sorumlusu')
    await drawer.getByPlaceholder('0(5XX) XXX XX XX').first().fill('05553334455')

    await drawer.getByPlaceholder(/Alan hakkında not/).fill('Otomatik QA testi ile oluşturuldu.')

    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    await drawer.getByRole('button', { name: 'Kaydet', exact: true }).click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('oluşturuldu', { exact: false })).toBeVisible({ timeout: 10000 })

    // Fake-success-detection: API'den geri oku, TÜM alanları doğrula.
    const freshToken = await getFreshToken(page)
    const listRes = await page.request.get(`${API_BASE}/emergency-areas?search=${encodeURIComponent(areaName)}`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const listBody = await listRes.json()
    const created = listBody?.data?.items?.[0]
    areaId = created?.id
    expect(areaId, 'oluşturulan alan API listesinde bulunmalı').toBeTruthy()

    expect(created.name).toBe(areaName)
    expect(created.neighborhood).toContain('QA Test Mahallesi')
    expect(created.address).toContain('Cad. No:1')
    expect(created.latitude).toBeCloseTo(41.1055, 3)
    expect(created.longitude).toBeCloseTo(28.868, 3)
    expect(created.capacity).toBe(1500)
    expect(created.areaSizeM2).toBe(2200)
    expect(created.equipment).toMatchObject({
      toilet: true, water: true, electricity: true, generator: true, heating: true, tentArea: true,
    })
    expect(created.manager).toBe('QA Test Acil Alan Sorumlusu')
    expect(created.managerPhone).toBe('05553334455')
    expect(created.description).toContain('Otomatik')
  })

  test('Düzenleme: alan adı, kapasite ve donanım güncellenir, API\'den doğrulanır', async ({ page }) => {
    test.setTimeout(45_000)
    expect(areaId, 'ön koşul: test 1 alanı oluşturmuş olmalı').toBeTruthy()
    await adminLoginUi(page)
    await page.goto('/emergency-areas')

    const row = page.locator('tr', { hasText: areaName }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await clickRowAction(page, row, 'Düzenle')

    const drawer = page.locator('div.relative.z-10').last()
    await expect(drawer.getByText('Acil Alan Düzenle', { exact: false }).first()).toBeVisible({ timeout: 5000 })

    const nameInput = drawer.getByPlaceholder(/Cebeci Park/i)
    await nameInput.fill(`${areaName} (Düzenlendi)`)
    await drawer.getByPlaceholder(/Örn\. 2000/).fill('3000')
    // Donanımdan birini kaldır (Jeneratör), krizde ekipman durumunun doğru yansıması kritik.
    await drawer.getByText('Jeneratör', { exact: true }).click()

    const [updateResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/emergency-areas/') && r.request().method() === 'PUT'),
      drawer.getByRole('button', { name: 'Güncelle', exact: true }).click(),
    ])
    expect(updateResponse.ok(), `PUT başarısız: ${await updateResponse.text()}`).toBeTruthy()
    await expect(page.getByText('kaydedildi', { exact: false })).toBeVisible({ timeout: 10000 })

    const freshToken = await getFreshToken(page)
    const getRes = await page.request.get(`${API_BASE}/emergency-areas/${areaId}`, { headers: { Authorization: `Bearer ${freshToken}` } })
    const updated = (await getRes.json()).data
    expect(updated.name).toBe(`${areaName} (Düzenlendi)`)
    expect(updated.capacity).toBe(3000)
    expect(updated.equipment).toMatchObject({ generator: false, toilet: true, water: true, electricity: true, heating: true, tentArea: true })
  })

  test('Durum değiştirme: Aktif -> Pasif (ConfirmModal ile) API\'den doğrulanır', async ({ page }) => {
    test.setTimeout(30_000)
    expect(areaId).toBeTruthy()
    await adminLoginUi(page)
    await page.goto('/emergency-areas')

    const row = page.locator('tr', { hasText: `${areaName} (Düzenlendi)` }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await clickRowAction(page, row, 'Pasife Al')
    await expect(page.getByText('pasife alınacak', { exact: false })).toBeVisible({ timeout: 3000 })

    const [toggleResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/toggle-status') && r.request().method() === 'PATCH'),
      page.locator('.z-50').getByRole('button', { name: 'Onayla', exact: true }).click(),
    ])
    expect(toggleResponse.ok(), `Durum değiştirme başarısız: ${await toggleResponse.text()}`).toBeTruthy()

    const freshToken = await getFreshToken(page)
    const getRes = await page.request.get(`${API_BASE}/emergency-areas/${areaId}`, { headers: { Authorization: `Bearer ${freshToken}` } })
    const afterToggle = (await getRes.json()).data
    expect(afterToggle.status).toBe('Passive')
  })

  test('Silme (ConfirmModal) — kayıt API\'den doğrulanan şekilde kalıcı olarak kaldırılır', async ({ page }) => {
    test.setTimeout(30_000)
    expect(areaId).toBeTruthy()
    await adminLoginUi(page)
    await page.goto('/emergency-areas')

    const row = page.locator('tr', { hasText: `${areaName} (Düzenlendi)` }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await clickRowAction(page, row, 'Sil')
    await expect(page.getByText('geri alınamaz', { exact: false })).toBeVisible({ timeout: 3000 })

    const freshToken = await getFreshToken(page)
    const [deleteResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/emergency-areas/${areaId}`) && r.request().method() === 'DELETE'),
      page.locator('.z-50').getByRole('button', { name: 'Evet, Sil', exact: true }).click(),
    ])
    expect(deleteResponse.ok(), `DELETE başarısız: ${await deleteResponse.text()}`).toBeTruthy()
    await expect(row).not.toBeVisible({ timeout: 5000 })

    const getRes = await page.request.get(`${API_BASE}/emergency-areas/${areaId}`, { headers: { Authorization: `Bearer ${freshToken}` } })
    expect(getRes.status(), 'silinen kayıt artık 404 dönmeli').toBe(404)
    areaId = '' // afterAll'da tekrar silmeyi denemesin
  })
})
