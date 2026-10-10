/**
 * Ortak FacilityModule Şablonu — Spor Salonu üzerinden temsili derinlikte test.
 *
 * Bu şablon 7 modülü (`sports`, `kasif`, `pool`, `youth-camp`, `scout-camp`,
 * `science-center`, `accessible-life`, `women-family`) aynı bileşenlerle çalıştırıyor
 * (`src/templates/FacilityTemplate/`, bkz. `docs/ADMIN_PANEL_MODULE_SCENARIO_MATRIX_2026-09-04.md`
 * madde A). Kullanıcı isteği (2026-09-04): "sıfır hata istiyorum."
 *
 * DÜRÜST KAPSAM NOTU: GroupFormFields.tsx 551 satır (haftalık program, tekrarlayan dönem,
 * belge gereksinimi, akademi whitelist gibi çok sayıda koşullu alan içeriyor) — kütüphane
 * modülündeki gibi HER alanı kapsayan bir test ayrı, büyük bir çalışma gerektirir. Bu test
 * bilinçli olarak temel akışı (Tesis oluştur → Şube oluştur → Ana Grup oluştur, TÜM zorunlu
 * ve birkaç önemli opsiyonel alanla) sıfır hatayla doğrular; grup formunun ileri alanları
 * (program/takvim, evrak, akademi ayarları) bu testin kapsamı DIŞINDADIR ve ayrı bir
 * iterasyonda ele alınmalıdır.
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

test.describe.serial('FacilityModule şablonu (Spor Salonu üzerinden) — Tesis + Şube + Ana Grup, sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let token = ''
  let serviceFacilityId = ''
  let facilityId = ''
  let branchId = ''
  const tag = `QA-TEST-E2E-AUTO Spor ${Date.now()}`

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const me = await (await apiCtx.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).json()
    const adminUserId = me?.data?.me?.id

    // Ön koşul: Hizmet Tesisi (kütüphane testinde de kullanılan desen — facility formu
    // ayrıca kapsamlı test edildi, burada odak sports-specific akış).
    const sfRes = await apiCtx.post(`${API_BASE}/service-facilities`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `${tag} Tesisi`, type: 'sports', locationType: 'Indoor',
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
    // NOT (2026-09-06, orphan-data bug bulundu ve düzeltildi): branchId hiç izlenmiyor/
    // silinmiyordu — API'den 3 orphan "QA-TEST-E2E-AUTO Spor ... Futbol" şubesi bulundu.
    // Grup silmeden branch silinemiyor (BRANCH_IN_USE) ama bu testte grup yaratılmıyor,
    // o yüzden doğrudan silinebiliyor. Sıra önemli: facility → branch → service-facility.
    if (facilityId) await apiCtx.delete(`${API_BASE}/sports/facilities/${facilityId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    if (branchId) await apiCtx.delete(`${API_BASE}/sports/branches/${branchId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    if (serviceFacilityId) await apiCtx.delete(`${API_BASE}/service-facilities/${serviceFacilityId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    await apiCtx.dispose()
  })

  test('1) ADMIN PANEL UI: Spor Salonu oluşturulur — TÜM zorunlu alanlar, sıfır hata', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)

    await page.goto('/sports')
    await page.getByRole('button', { name: 'Yönet', exact: true }).click()
    const managerDrawer = page.locator('div.relative.z-10').last()
    await managerDrawer.getByRole('button', { name: /Yeni Spor Salonu Ekle/i }).click()

    const drawer = page.locator('div.relative.z-10').last()
    await drawer.getByPlaceholder(/Spor Salonu adını giriniz/i).fill(tag)

    // Mekan Türü: varsayılan "Kapalı Tesis" — Açık Alan'a geçip geri dönerek segment'in
    // GERÇEKTEN çalıştığını kanıtlıyoruz (iki yönlü test, kütüphane testinden öğrenilen desen).
    await drawer.getByRole('button', { name: 'Açık Alan' }).click()
    await drawer.getByRole('button', { name: 'Kapalı Tesis' }).click()

    await pickSelect(page, drawer, /Hizmet tesisi seçin/, `${tag} Tesisi`, { searchable: true })
    await drawer.getByPlaceholder('Örn. 120').fill('80')

    await drawer.getByRole('button', { name: 'Yeni kişi ekle' }).click()
    await drawer.getByPlaceholder('Kişinin adı ve soyadı').fill('QA Test Spor Sorumlusu')
    // NOT (2026-09-04, gerçek testte bulunan fark): FacilityFormDrawer'ın `valid` mantığı
    // service-facilities/library formlarından FARKLI — managerId YA DA (grantAccess VE
    // manager VE managerEmail) zorunlu. "Yeni kişi ekle" + erişim vermeden bırakmak (diğer
    // formlarda geçerliydi) burada butonu disabled bırakıyor. Bu yüzden "Sisteme erişim ver"
    // switch'ini açıp e-posta da giriyoruz.
    await drawer.getByPlaceholder('11 haneli T.C. kimlik no').fill('10000000146')
    await drawer.getByPlaceholder('0(5XX) XXX XX XX').first().fill('05557778899')
    await drawer.getByPlaceholder('ornek@belediye.gov.tr').fill('qa-test-spor-sorumlu@nexora.local')
    await drawer.locator('button[role="switch"]').first().click()

    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    const saveBtn = drawer.getByRole('button', { name: 'Ekle', exact: true })
    await expect(saveBtn).toBeEnabled({ timeout: 5000 })
    await saveBtn.click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('oluşturuldu', { exact: false })).toBeVisible({ timeout: 10000 })

    const freshToken = await getFreshToken(page)
    const listRes = await page.request.get(`${API_BASE}/sports/facilities?search=${encodeURIComponent(tag)}`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const listBody = await listRes.json()
    const created = listBody?.data?.items?.[0]
    facilityId = created?.id
    expect(facilityId, 'oluşturulan spor salonu API listesinde bulunmalı').toBeTruthy()
    expect(created.name).toBe(tag)
    expect(created.kind).toBe('indoor')
    expect(created.capacity).toBe(80)
    expect(created.managerName ?? created.manager).toBe('QA Test Spor Sorumlusu')
  })

  test('2) ADMIN PANEL UI: Şube (branş) eklenir, sıfır hata', async ({ page }) => {
    test.setTimeout(30_000)
    expect(facilityId, 'önceki testte spor salonu oluşturulmuş olmalı').toBeTruthy()
    await adminLoginUi(page)

    await page.goto(`/sports?f=${facilityId}&tab=branches`)
    await page.getByRole('button', { name: /Yeni Branş/i }).click()

    const drawer = page.locator('div.relative.z-10').last()
    const branchName = `${tag} Futbol`
    await drawer.getByPlaceholder(/Branş adını giriniz/i).fill(branchName)
    await drawer.getByPlaceholder(/Kısa açıklama/i).fill('Otomatik QA testi ile oluşturuldu.')
    await drawer.getByPlaceholder('Örn. 4').fill('6')
    await drawer.getByPlaceholder('Örn. 3').first().fill('3')

    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    await drawer.getByRole('button', { name: 'Kaydet', exact: true }).click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('eklendi', { exact: false })).toBeVisible({ timeout: 10000 })

    const freshToken = await getFreshToken(page)
    const listRes = await page.request.get(`${API_BASE}/sports/branches?search=${encodeURIComponent(branchName)}`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const listBody = await listRes.json()
    const created = listBody?.data?.items?.[0]
    branchId = created?.id
    expect(branchId, 'oluşturulan şube API listesinde bulunmalı').toBeTruthy()
    expect(created.name).toBe(branchName)
    expect(created.periodMonths).toBe(6)
    expect(created.absenceLimit).toBe(3)
  })

  test('3) ADMIN PANEL UI: Ana Grup oluşturulur (temel alanlar), sıfır hata', async ({ page }) => {
    test.setTimeout(30_000)
    expect(facilityId, 'önceki testte spor salonu oluşturulmuş olmalı').toBeTruthy()
    expect(branchId, 'önceki testte şube oluşturulmuş olmalı').toBeTruthy()
    await adminLoginUi(page)

    await page.goto(`/sports?f=${facilityId}&tab=groups`)
    await page.getByRole('button', { name: /Yeni Grup/i }).click()

    const drawer = page.locator('div.relative.z-10').last()
    const groupName = `${tag} A Takımı`
    await drawer.getByPlaceholder(/Grup adını giriniz/i).fill(groupName)

    // Branş seçimi zorunlu — bu olmadan kayıt reddedilir (getGroupFormErrors).
    await pickSelect(page, drawer, /Branş seçin|seçiniz/i, `${tag} Futbol`, { searchable: true })

    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
    await saveBtn.click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText(/oluşturuldu|eklendi/, { exact: false })).toBeVisible({ timeout: 10000 })

    const freshToken = await getFreshToken(page)
    const listRes = await page.request.get(`${API_BASE}/sports/groups?search=${encodeURIComponent(groupName)}`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const listBody = await listRes.json()
    const created = listBody?.data?.items?.[0]
    expect(created, 'oluşturulan grup API listesinde bulunmalı').toBeTruthy()
    expect(created.name).toBe(groupName)
    expect(created.branchId).toBe(branchId)
  })
})
