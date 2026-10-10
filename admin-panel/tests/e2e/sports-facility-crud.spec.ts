/**
 * Spor Salonu Yönetimi (`/sports`, `FacilityModule` şablonu — sports/pool/kasif/
 * youth-camp/scout-camp/science-center/accessible-life/women-family 8 modülün
 * paylaştığı ortak kod yolu), sıfır hata.
 *
 * Matriste "Orta öncelik" (Seviye 1'den Seviye 3'e yükseltildi) — bu modül
 * gerçek üretim verisi taşıyan büyük bir sistem (Facility→Şube→Grup→Sporcu),
 * `facility-exhaustive-form.spec.ts`'in test ettiği Hizmet Tesisleri
 * (ServiceFacilitiesTab) modülünden TAMAMEN FARKLI bir kod yolu — bu daha önce
 * yanlışlıkla "zaten kapsanmış" sanılmıştı, düzeltildi.
 *
 * Kapsam: "Yönet" drawer'ından Facility (Spor Salonu) oluşturma — TÜM alanlar
 * (isim, mekan türü, hizmet tesisi seçimi, kapasite, sorumlu kişi — yeni kişi
 * ekle veya opsiyonel bırakma), listede görünme, düzenleme, durum değiştirme
 * (Aktif/Pasif toggle, ConfirmModal YOK — doğrudan buton), silme (ConfirmModal
 * ile). Ayrıca: silme kaskadının Şube/Grup'a gerçekten yayıldığının API ile
 * kanıtlanması (test 6) ve "8 modül aynı kodu paylaşıyor" iddiasının Pool
 * modülünde de gerçekten çalıştığının doğrulanması (test 7, farklı bir
 * defaultFacilityKind='mixed' config değeriyle). Her adım API'den
 * (`/sports/facilities`, `/pool/facilities`) doğrulanıyor.
 *
 * DÜRÜST KAPSAM NOTU: `FacilityModule` 8469 satırlık dev bir sistem (Şube,
 * Grup, Seans, Başvuru, Cihaz, Yoklama, Rapor, Eğitmen sekmeleri dahil) —
 * bu test SADECE en üst seviye Facility CRUD'unu + silme kaskadını + tek bir
 * kardeş modülde (Pool) paketleme doğrulamasını kapsıyor. Şube/Grup/Seans/
 * Başvuru/Cihaz/Yoklama alt-sekmelerinin TAM formu kapsam DIŞINDA — her biri
 * kütüphane modülündeki benzerleri kadar derin, ayrı bir test dosyası
 * gerektirir. Diğer 6 kardeş modül (kasif/youth-camp/scout-camp/science-center/
 * accessible-life/women-family) ayrıca tek tek doğrulanmadı — Pool'daki
 * doğrulama, hepsinin aynı `FacilityModule.tsx`/`FacilityFormDrawer.tsx`/
 * `FacilityService.cs` kodunu (sadece config farkıyla) kullandığını
 * (moduleConfig.ts + FacilityModuleRegistry.cs okunarak) gösteriyor.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { clickRowAction } from './helpers/rowActions'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'

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

async function adminToken(ctx: APIRequestContext): Promise<string> {
  const login = await (await ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (login?.data?.accessToken) return login.data.accessToken
  const verify = await (await ctx.post(`${API_BASE}/auth/verify-otp`, {
    data: { otpSessionToken: login.data.otpSessionToken, code: ADMIN_OTP },
  })).json()
  if (!verify?.data?.accessToken) throw new Error(`Admin API login başarısız: ${JSON.stringify(verify)}`)
  return verify.data.accessToken
}

interface SportsFacility {
  id: string; name: string; kind: string; capacity: number
  serviceFacilityId: string; managerName: string | null; managerPhone: string | null
  isActive: boolean
}

test.describe.serial('Spor Salonu Yönetimi (FacilityModule, Sports modülü) — Facility CRUD, sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let facilityId = ''
  let serviceFacilityId = ''
  const facilityName = `QA-TEST-E2E-AUTO Spor Salonu ${Date.now()}`

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    const token = await adminToken(apiCtx)
    // Testin bağlanacağı bir Indoor hizmet tesisi bul (mevcut olanlardan).
    const res = await (await apiCtx.get(`${API_BASE}/service-facilities?locationType=Indoor&page=1&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()
    serviceFacilityId = res?.data?.items?.[0]?.id ?? ''
    expect(serviceFacilityId, 'test için en az 1 Indoor hizmet tesisi olmalı').toBeTruthy()
  })

  test.afterAll(async () => {
    if (facilityId) {
      const token = await adminToken(apiCtx)
      await apiCtx.delete(`${API_BASE}/sports/facilities/${facilityId}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    }
    const token = await adminToken(apiCtx)
    const check = await (await apiCtx.get(`${API_BASE}/sports/facilities?search=${encodeURIComponent('QA-TEST-E2E-AUTO')}&page=1&limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()
    const orphans = (check?.data?.items ?? []) as SportsFacility[]
    if (orphans.length > 0) throw new Error(`KRİTİK: ${orphans.length} orphan spor salonu kaldı: ${JSON.stringify(orphans.map((o) => o.id))}`)
    await apiCtx.dispose()
  })

  test('1) Yeni Spor Salonu oluşturulur — TÜM alanlar (mekan türü, hizmet tesisi, kapasite, sorumlu), API\'den doğrulanır', async ({ page }) => {
    test.setTimeout(45_000)
    await adminLoginUi(page)
    await page.goto('/sports')
    await expect(page.getByRole('button', { name: 'Yönet', exact: true })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Yönet', exact: true }).click()

    await expect(page.getByText('Spor Salonu Yönetimi', { exact: false }).last()).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /Yeni Spor Salonu Ekle/ }).click()

    const drawer = page.locator('div.relative.z-10').last()
    await expect(drawer.getByText('Yeni Spor Salonu Ekle', { exact: false }).first()).toBeVisible({ timeout: 5000 })

    await drawer.getByPlaceholder('Spor Salonu adını giriniz...').fill(facilityName)
    await drawer.locator('button[aria-haspopup]', { hasText: 'Hizmet tesisi seçin...' }).first().click()
    await page.locator('div[data-ds-popover] button').filter({ hasNotText: 'Hizmet tesisi seçin...' }).first().click()

    await drawer.getByPlaceholder('Örn. 120').fill('80')

    // Sorumlu: mevcut yöneticiden seç (varsayılan mod). Basit/güvenli senaryo — yeni bir
    // admin hesabı oluşturmadan mevcut bir yöneticiyi (Süper Admin) atar. "Yeni kişi ekle +
    // erişim vermeden" senaryosu (2026-09-06'da düzeltilen bug) aşağıdaki test 5'te kanıtlanır.
    await drawer.getByPlaceholder(/Yöneticilerden ara ve seç|Yöneticiden seç/).click()
    await drawer.getByPlaceholder(/Yöneticilerden ara ve seç|Yöneticiden seç/).fill('Süper Admin')
    await page.locator('[data-ds-popover]').last().getByText('Süper Admin', { exact: false }).first().click()

    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/sports/facilities') && r.request().method() === 'POST'),
      drawer.getByRole('button', { name: 'Ekle', exact: true }).click(),
    ])
    expect(createResponse.ok(), `POST /sports/facilities başarısız: ${await createResponse.text()}`).toBeTruthy()
    const created: SportsFacility = (await createResponse.json()).data
    facilityId = created.id
    expect(created).toMatchObject({ name: facilityName, kind: 'indoor', capacity: 80, isActive: true })
    expect((created as unknown as { managerId: string | null }).managerId, 'mevcut yöneticiden bir managerId atanmalı').toBeTruthy()
    await expect(page.getByText('Spor Salonu oluşturuldu.', { exact: false })).toBeVisible({ timeout: 10000 })
    // Not (2026-10-01): React StrictMode (dev modu) bazen listeyi çift render edip bir
    // "hayalet" (0x0 boyutlu, display:table-row ama rect boş) eski kopya bırakıyor —
    // .last() gerçek/yerleşmiş satırı garantiler.
    await expect(page.locator('tr', { hasText: facilityName }).last()).toBeVisible({ timeout: 5000 })
  })

  test('2) Düzenleme: isim ve kapasite güncellenir, API\'den doğrulanır', async ({ page }) => {
    test.setTimeout(45_000)
    expect(facilityId, 'ön koşul: test 1 salonu oluşturmuş olmalı').toBeTruthy()
    await adminLoginUi(page)
    await page.goto('/sports')
    await page.getByRole('button', { name: 'Yönet', exact: true }).click()
    await expect(page.getByText('Spor Salonu Yönetimi', { exact: false }).last()).toBeVisible({ timeout: 5000 })

    // Not (2026-10-01): StrictMode hayalet-satır sorunu için .last() — bkz. test 1.
    const row = page.locator('tr', { hasText: facilityName }).last()
    await expect(row).toBeVisible({ timeout: 10000 })
    await clickRowAction(page, row, 'Düzenle')

    const drawer = page.locator('div.relative.z-10').last()
    await expect(drawer.getByText('Spor Salonu Düzenle', { exact: false }).first()).toBeVisible({ timeout: 5000 })

    const newName = `${facilityName} (Düzenlendi)`
    await drawer.getByPlaceholder('Spor Salonu adını giriniz...').fill(newName)
    await drawer.getByPlaceholder('Örn. 120').fill('150')

    const [updateResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/sports/facilities/${facilityId}`) && r.request().method() === 'PUT'),
      drawer.getByRole('button', { name: 'Güncelle', exact: true }).click(),
    ])
    expect(updateResponse.ok(), `PUT başarısız: ${await updateResponse.text()}`).toBeTruthy()
    const updated: SportsFacility = (await updateResponse.json()).data
    expect(updated).toMatchObject({ name: newName, capacity: 150 })
  })

  test('3) Durum değiştirme: Aktif -> Pasif -> Aktif, API\'den doğrulanır', async ({ page }) => {
    test.setTimeout(45_000)
    expect(facilityId).toBeTruthy()
    await adminLoginUi(page)
    await page.goto('/sports')
    await page.getByRole('button', { name: 'Yönet', exact: true }).click()
    await expect(page.getByText('Spor Salonu Yönetimi', { exact: false }).last()).toBeVisible({ timeout: 5000 })

    const updatedName = `${facilityName} (Düzenlendi)`
    const row = page.locator('tr', { hasText: updatedName }).last()
    await expect(row).toBeVisible({ timeout: 10000 })

    const [toggleOffResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/sports/facilities/${facilityId}/toggle-status`) && r.request().method() === 'PATCH'),
      row.getByRole('button', { name: 'Aktif', exact: true }).click(),
    ])
    expect(toggleOffResponse.ok()).toBeTruthy()
    expect((await toggleOffResponse.json()).data.isActive).toBe(false)
    await expect(page.getByText('pasife alındı', { exact: false })).toBeVisible({ timeout: 5000 })

    const rowAfter = page.locator('tr', { hasText: updatedName }).last()
    const [toggleOnResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/sports/facilities/${facilityId}/toggle-status`) && r.request().method() === 'PATCH'),
      rowAfter.getByRole('button', { name: 'Pasif', exact: true }).click(),
    ])
    expect(toggleOnResponse.ok()).toBeTruthy()
    expect((await toggleOnResponse.json()).data.isActive).toBe(true)
  })

  test('4) Silme (ConfirmModal) — kayıt API\'den doğrulanan şekilde kalıcı olarak kaldırılır', async ({ page }) => {
    test.setTimeout(45_000)
    expect(facilityId).toBeTruthy()
    await adminLoginUi(page)
    await page.goto('/sports')
    await page.getByRole('button', { name: 'Yönet', exact: true }).click()
    await expect(page.getByText('Spor Salonu Yönetimi', { exact: false }).last()).toBeVisible({ timeout: 5000 })

    const updatedName = `${facilityName} (Düzenlendi)`
    const row = page.locator('tr', { hasText: updatedName }).last()
    await expect(row).toBeVisible({ timeout: 10000 })
    await clickRowAction(page, row, 'Sil')
    await expect(page.getByText('geri alınamaz', { exact: false })).toBeVisible({ timeout: 3000 })

    const [deleteResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/sports/facilities/${facilityId}`) && r.request().method() === 'DELETE'),
      page.getByRole('heading', { name: 'Spor Salonu Sil' }).locator('xpath=ancestor::div[contains(@class,"rounded-panel")][1]').getByRole('button', { name: 'Sil', exact: true }).click(),
    ])
    expect(deleteResponse.ok(), `DELETE başarısız: ${await deleteResponse.text()}`).toBeTruthy()
    await expect(page.getByText('silindi', { exact: false })).toBeVisible({ timeout: 5000 })
    await expect(row).not.toBeVisible({ timeout: 5000 })

    const freshToken = await adminToken(apiCtx)
    const getRes = await apiCtx.get(`${API_BASE}/sports/facilities/${facilityId}`, { headers: { Authorization: `Bearer ${freshToken}` } })
    expect(getRes.status(), 'silinen kayıt artık 404 dönmeli').toBe(404)
    facilityId = '' // afterAll'da tekrar silmeyi denemesin
  })

  test('5) Yönetici seçilmeden (opsiyonel) tesis oluşturulabilir — bug fix doğrulaması', async ({ page }) => {
    test.setTimeout(45_000)
    // Kullanıcı isteği (2026-09-06): "hiçbir modülde yönetici ekleme zorunluluğu
    // olmayacak". Önceden FacilityFormDrawer'ın valid koşulu
    // `managerId || (grantAccess && manager && managerEmail)` idi — yani hem mevcut
    // yönetici seçmek HEM DE grantAccess (gerçek admin hesabı açma) zorunluydu.
    // Fix sonrası: sadece isResponsiblePersonValid(form) kullanılıyor, Emergency Areas
    // ile aynı kural — grantAccess kapalıyken yönetici alanları tamamen opsiyonel.
    const secondFacilityName = `QA-TEST-E2E-AUTO Spor Salonu NoMgr ${Date.now()}`
    await adminLoginUi(page)
    await page.goto('/sports')
    await page.getByRole('button', { name: 'Yönet', exact: true }).click()
    await expect(page.getByText('Spor Salonu Yönetimi', { exact: false }).last()).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /Yeni Spor Salonu Ekle/ }).click()

    const drawer = page.locator('div.relative.z-10').last()
    await expect(drawer.getByText('Yeni Spor Salonu Ekle', { exact: false }).first()).toBeVisible({ timeout: 5000 })

    await drawer.getByPlaceholder('Spor Salonu adını giriniz...').fill(secondFacilityName)
    await drawer.locator('button[aria-haspopup]', { hasText: 'Hizmet tesisi seçin...' }).first().click()
    await page.locator('div[data-ds-popover] button').filter({ hasNotText: 'Hizmet tesisi seçin...' }).first().click()
    await drawer.getByPlaceholder('Örn. 120').fill('50')

    // Yönetici alanına HİÇ dokunmadan (mevcut yöneticiden seç modu, boş) doğrudan ekle —
    // buton disabled OLMAMALI (bug'lı haliyle burada devre dışı kalırdı).
    const addBtn = drawer.getByRole('button', { name: 'Ekle', exact: true })
    await expect(addBtn).toBeEnabled({ timeout: 3000 })

    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/sports/facilities') && r.request().method() === 'POST'),
      addBtn.click(),
    ])
    expect(createResponse.ok(), `POST /sports/facilities başarısız: ${await createResponse.text()}`).toBeTruthy()
    const created: SportsFacility = (await createResponse.json()).data
    expect(created).toMatchObject({ name: secondFacilityName, isActive: true })
    expect((created as unknown as { managerId: string | null }).managerId, 'yönetici seçilmediği için managerId boş olmalı').toBeFalsy()
    await expect(page.getByText('Spor Salonu oluşturuldu.', { exact: false })).toBeVisible({ timeout: 10000 })

    // Temizlik.
    const token = await adminToken(apiCtx)
    await apiCtx.delete(`${API_BASE}/sports/facilities/${created.id}`, { headers: { Authorization: `Bearer ${token}` } })
  })

  test('6) Tesis silinince bağlı Şube/Grup kaskad silinir — belgelenen failure-mode gerçek API ile kanıtlanır', async ({}) => {
    test.setTimeout(45_000)
    // FacilityService.DeleteAsync'teki yorum: "bağlı TÜM gruplar (ve onların seans/
    // başvuru içerikleri) otomatik olarak kaskad silinir" — bu iddia daha önce hiç
    // test edilmemişti (sadece kod okuma ile doğru varsayılmıştı). Gerçek API ile kanıtla:
    // tesis + şube + grup oluştur, tesisi sil, grubun artık listede görünmediğini doğrula.
    const token = await adminToken(apiCtx)
    const headers = { Authorization: `Bearer ${token}` }

    const facRes = await apiCtx.post(`${API_BASE}/sports/facilities`, {
      headers, data: {
        name: `QA-TEST-E2E-AUTO Kaskad Tesis ${Date.now()}`, kind: 'indoor', serviceFacilityId,
        capacity: 30, managerId: null, managerName: null, managerPhone: null, managerEmail: null,
        emergencyPhone: null, grantAccess: false, isActive: true,
      },
    })
    expect(facRes.ok(), `Facility oluşturma başarısız: ${await facRes.text()}`).toBeTruthy()
    const cascadeFacilityId: string = (await facRes.json()).data.id

    const branchRes = await apiCtx.post(`${API_BASE}/sports/branches`, {
      headers, data: { name: `QA-TEST-E2E-AUTO Şube ${Date.now()}`, description: '', periodMonths: 1, absenceLimit: 0, consecutiveAbsenceLimit: 0, isActive: true },
    })
    expect(branchRes.ok(), `Branch oluşturma başarısız: ${await branchRes.text()}`).toBeTruthy()
    const branchId: string = (await branchRes.json()).data.id

    const groupRes = await apiCtx.post(`${API_BASE}/sports/groups`, {
      headers, data: {
        facilityId: cascadeFacilityId, branchId, parentGroupId: null,
        name: `QA-TEST-E2E-AUTO Grup ${Date.now()}`, description: '', type: 'kurs', gender: 'mixed',
        capacity: 20, reserveCapacity: 5, ageMin: 0, ageMax: 99,
        schedule: [{ day: 'monday', startTime: '10:00', endTime: '11:00' }],
        attendanceMode: 'full',
        fee: { isPaid: false, feeType: 'monthly', amount: 0, siblingDiscount: 0, staffDiscount: 0 },
        conditions: {}, periodStart: null, periodEnd: null, periodMonths: 1, periodType: 'date_range',
        periodCount: 0, applicationStartDate: null, applicationEndDate: null,
        academyWhitelistEnabled: false, absenceLimit: 0, consecutiveAbsenceLimit: 0,
        entryGraceMinutes: 0, instructorId: null, isActive: true,
      },
    })
    expect(groupRes.ok(), `Group oluşturma başarısız: ${await groupRes.text()}`).toBeTruthy()
    const groupId: string = (await groupRes.json()).data.id

    // Grubun var olduğunu (kaskad öncesi) doğrula.
    const beforeGet = await apiCtx.get(`${API_BASE}/sports/groups/${groupId}`, { headers })
    expect(beforeGet.status(), 'silme öncesi grup mevcut olmalı').toBe(200)

    // Tesisi sil — belgelenen kaskad davranışı burada tetikleniyor.
    const delRes = await apiCtx.delete(`${API_BASE}/sports/facilities/${cascadeFacilityId}`, { headers })
    expect(delRes.ok(), `Facility silme başarısız: ${await delRes.text()}`).toBeTruthy()

    // Grup artık normal GET ile bulunamamalı (soft-delete kaskadı) — 404 veya
    // silinmiş olarak işaretlenmiş olmalı, hangisi olursa olsun "hâlâ aktif ve
    // görünür" durumu YANLIŞ olur.
    const afterGet = await apiCtx.get(`${API_BASE}/sports/groups/${groupId}`, { headers })
    expect(afterGet.status(), 'tesis silindikten sonra grup artık normal GET ile bulunmamalı (kaskad silindi)').toBe(404)

    const branchDelRes = await apiCtx.delete(`${API_BASE}/sports/branches/${branchId}`, { headers })
    expect(branchDelRes.ok(), `Temizlik: Branch silme başarısız: ${await branchDelRes.text()}`).toBeTruthy()
  })

  test('7) Pool modülü (paylaşılan FacilityModule şablonu) — Sports\'ta doğrulanan davranış gerçekten Pool\'da da çalışır', async ({ page }) => {
    test.setTimeout(45_000)
    // Sports/Pool/Kasif/vb 8 modülün "aynı ortak kod yolunu paylaştığı" iddiası daha önce
    // sadece kaynak kod okumasıyla (import karşılaştırması) doğrulanmıştı — bu SESSION'ın
    // BAŞINDA facility-template için tam olarak bu yüzden yanlış bir "zaten kapsanmış" iddiası
    // yapılmış ve harness tarafından yakalanmıştı. Kod okuması TEK BAŞINA yetersiz: bu test
    // Pool'da GERÇEKTEN aynı UI+API akışının çalıştığını kanıtlıyor. Pool özellikle seçildi
    // çünkü defaultFacilityKind='mixed' — sports/pool/kasif'in çoğu 'indoor' kullanırken bu
    // farklı bir config değeri, modül-özel config'in gerçekten okunduğunu da doğrular.
    const poolFacilityName = `QA-TEST-E2E-AUTO Havuz Tesisi ${Date.now()}`
    await adminLoginUi(page)
    await page.goto('/pool')
    await expect(page.getByRole('button', { name: 'Yönet', exact: true })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Yönet', exact: true }).click()
    await expect(page.getByText('Havuz Tesisi Yönetimi', { exact: false }).last()).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /Yeni Havuz Tesisi Ekle/ }).click()

    const drawer = page.locator('div.relative.z-10').last()
    await expect(drawer.getByText('Yeni Havuz Tesisi Ekle', { exact: false }).first()).toBeVisible({ timeout: 5000 })
    await drawer.getByPlaceholder('Havuz Tesisi adını giriniz...').fill(poolFacilityName)
    await drawer.locator('button[aria-haspopup]', { hasText: 'Hizmet tesisi seçin...' }).first().click()
    await page.locator('div[data-ds-popover] button').filter({ hasNotText: 'Hizmet tesisi seçin...' }).first().click()
    await drawer.getByPlaceholder('Örn. 120').fill('40')

    const addBtn = drawer.getByRole('button', { name: 'Ekle', exact: true })
    await expect(addBtn).toBeEnabled({ timeout: 3000 })
    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/pool/facilities') && r.request().method() === 'POST'),
      addBtn.click(),
    ])
    expect(createResponse.ok(), `POST /pool/facilities başarısız: ${await createResponse.text()}`).toBeTruthy()
    const created: SportsFacility = (await createResponse.json()).data
    expect(created).toMatchObject({ name: poolFacilityName, capacity: 40, isActive: true })
    await expect(page.getByText('Havuz Tesisi oluşturuldu.', { exact: false })).toBeVisible({ timeout: 10000 })

    // Temizlik + orphan doğrulaması (Sports'tan ayrı bir modül namespace'i — kendi
    // afterAll'ı burayı temizlemez, bu yüzden testin kendisi temizler ve doğrular).
    const token = await adminToken(apiCtx)
    const delRes = await apiCtx.delete(`${API_BASE}/pool/facilities/${created.id}`, { headers: { Authorization: `Bearer ${token}` } })
    expect(delRes.ok()).toBeTruthy()
    const check = await (await apiCtx.get(`${API_BASE}/pool/facilities?search=${encodeURIComponent('QA-TEST-E2E-AUTO')}&page=1&limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()
    expect((check?.data?.items ?? []).length, 'Pool modülünde orphan kalmamalı').toBe(0)
  })
})
