/**
 * Kütüphane — Mesai (personel vardiya) modülü, MesaiTab UI akışı.
 *
 * Kapsam:
 *   1. ADMIN PANEL UI: yönetici hesabından personel eklenir (StaffFormDrawer, "Yönetici"
 *      kaynağı, gerçek Combobox arama ve seçim).
 *   2. ADMIN PANEL UI: admin bu personel için "Mesai Başlat" ile GERÇEKTEN mesai başlatır
 *      (konum + not alanları dahil), Aktif Mesailer tablosunda görünür.
 *   3. ADMIN PANEL UI: admin "Mesai Bitir" (ConfirmModal) ile GERÇEKTEN bitirir, API'den
 *      workedMinutes ve status=ended doğrulanır.
 *   4. Personel kendi hesabıyla (gerçek UI login) giriş yapıp "Mesaimi Başlat" self-service
 *      akışını (konum izni promptu, GeoPosition state geçişleri) GERÇEKTEN kullanır —
 *      StartMine API isteği doğrulanır.
 *   5. Personel "Mesaimi Bitir" ile kendi mesaisini GERÇEKTEN bitirir, "Mesai Geçmişim"
 *      tablosunda kaydın göründüğü doğrulanır.
 *   6. ADMIN PANEL UI: personeli "Pasife Al" (ConfirmModal) ile GERÇEKTEN pasife alır,
 *      pasif personelin "Mesai Başlat" butonunun disabled olduğu doğrulanır.
 *
 * GERÇEK MİMARİ BOŞLUK BULUNDU (2026-09-04, test yazılırken keşfedildi — bkz. aşağıdaki
 * beforeAll yorumu): StaffFormDrawer'ın "Yönetici" kaynağından eklenen bir personel,
 * kendi hesabıyla giriş yaptığında /library sayfasına HİÇ erişemiyor (404 LIBRARY_NOT_FOUND,
 * sessizce). Sebep: LibraryStaff.WorkingLibraryIds ("hangi kütüphanede mesai başlatabilir")
 * ile EnsureInScopeAsync'in kontrol ettiği AdminScope/ScopeNode ("hangi sayfaları görebilir")
 * TAMAMEN AYRI mekanizmalar ve hiçbir UI akışı ikisini senkronize etmiyor. Bu nedenle test
 * 1-2-3 (admin-initiated, sorunsuz — admin zaten scope'suz SuperAdmin) StaffFormDrawer
 * akışını kullanıyor; test 4-5 (self-service) için AYRI bir personel, kütüphane formunun
 * "Sisteme Erişim Ver" (grantAccess) akışıyla oluşturuluyor (bu akış GERÇEKTEN bir
 * ScopeNode oluşturuyor) + ayrıca library-staff kaydı da açılıyor (self mesai
 * endpoint'lerinin ihtiyaç duyduğu ikinci parça).
 *
 * DÜRÜST KAPSAM NOTU: "Katılımcı (Vatandaş)" kaynağından personel ekleme, kapı QR'ı
 * (StaffDoorQrModal), IP-tabanlı otomatik mesai devralma (zaten library-shift-ip-takeover.spec.ts'te
 * API-only test edildi) ve mesai saati düzenleme (ShiftEditModal) bu dosyanın kapsamı DIŞINDA.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'

const hasAdminCredentials = () => !!(ADMIN_EMAIL && ADMIN_PASSWORD)

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

async function adminToken(ctx: APIRequestContext): Promise<string> {
  const login = await (await ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (login?.data?.accessToken) return login.data.accessToken
  const verify = await (
    await ctx.post(`${API_BASE}/auth/verify-otp`, { data: { otpSessionToken: login.data.otpSessionToken, code: ADMIN_OTP } })
  ).json()
  if (!verify?.data?.accessToken) throw new Error(`Admin API login başarısız: ${JSON.stringify(verify)}`)
  return verify.data.accessToken
}

async function adminLoginUi(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.locator('#email').fill(ADMIN_EMAIL!)
  await page.locator('#password').fill(ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  if (await page.getByRole('button', { name: /Doğrula/ }).isVisible({ timeout: 5000 }).catch(() => false)) {
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

test.describe.serial('Kütüphane — Mesai (personel vardiya) modülü, MesaiTab UI akışı', () => {
  test.skip(!hasAdminCredentials(), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi — atlandı')

  let apiCtx: APIRequestContext
  let token = ''
  let serviceFacilityId = ''
  let libraryId = ''
  let libraryName = ''
  let staffId = ''
  let shiftId = ''
  let tempAdminId = '' // StaffFormDrawer testi için (Combobox'ta aranacak, scope YOK ama bu test admin-initiated olduğundan sorun değil)
  let selfServiceAdminId = '' // grantAccess ile scope'lu, self-service testleri için
  let selfServiceStaffId = ''
  let selfServiceEmail = ''
  const generatedPassword = 'sultangazi' // NOT: mock modda tüm yeni hesaplar için sabit üretilen ilk şifre (library-shift-ip-takeover.spec.ts'te de doğrulandı)

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const authHeaders = { Authorization: `Bearer ${token}` }

    const me = await (await apiCtx.get(`${API_BASE}/auth/me`, { headers: authHeaders })).json()
    const adminUserId = me?.data?.me?.id
    expect(adminUserId, 'admin user id alınmalı').toBeTruthy()

    const tag = uniq('QA-TEST-E2E-AUTO Mesai')
    const sfRes = await apiCtx.post(`${API_BASE}/service-facilities`, {
      headers: authHeaders,
      data: {
        name: `${tag} Tesisi`, type: 'library', locationType: 'Indoor',
        city: 'İstanbul', district: 'Sultangazi', address: 'E2E Test Mah. No:5', latitude: 41.1039, longitude: 28.8674,
        managerId: adminUserId, weekdayOpen: '08:00', weekdayClose: '22:00',
        weekendOpen: '09:00', weekendClose: '20:00', parkingCapacity: 0, parkingType: 'Free', capacity: 100,
      },
    })
    expect(sfRes.ok(), `service-facility oluşturulamadı: ${await sfRes.text()}`).toBeTruthy()
    serviceFacilityId = (await sfRes.json()).data.id
    libraryName = tag

    // NOT (2026-09-04, gerçek testte bulunan mimari boşluk — bkz. dosya başlığı): kütüphaneyi
    // "Sisteme Erişim Ver" (grantAccess=true) İLE oluşturuyoruz — bu, ScopedStaffService.AssignAsync
    // ile GERÇEK bir AdminScope/ScopeNode kaydı üreten TEK yol. Elde edilen admin kullanıcı
    // test 4-5'teki self-service akış için kullanılacak.
    const libRes = await apiCtx.post(`${API_BASE}/libraries`, {
      headers: authHeaders,
      data: {
        name: libraryName, description: 'QA mesai modülü testi', serviceFacilityId,
        managerId: null, manager: 'QA Test E2E Auto Mesai Self', managerEmail: `qa.mesai.self.${Date.now()}@nexora.local`,
        managerPhone: '05559990001', grantAccess: true, deliveryChannel: 'Email',
        seatingMode: 'sirali', isMultiFloor: false,
        floors: [{ id: 'floor-1', name: 'Zemin Kat', capacity: 20, active: true, autoOpenWhenPreviousFull: false }],
        amenities: ['wifi'], queueEnabled: true, reservationEnabled: false,
        entryControlMode: 'manual', exitControlMode: 'manual', autoCheckOutAfterMinutes: 0,
        useCustomBreakSettings: false, breakDurationMinutes: 15, maxDailyBreaks: 3,
        longBreakDurationMinutes: 30, maxStudyHoursPerDay: 0, requireBreakAfterHours: 0,
        ipRestrictionEnabled: false, allowedIps: [], isActive: true, breakSystemEnabled: false,
      },
    })
    expect(libRes.ok(), `kütüphane oluşturulamadı: ${await libRes.text()}`).toBeTruthy()
    const libBody = (await libRes.json()).data
    libraryId = libBody.id
    expect(libBody.managerName, 'grantAccess ile yönetici GERÇEKTEN atanmalı').toBe('QA Test E2E Auto Mesai Self')

    // Oluşan yönetici hesabının admin id'sini ve email'ini bul (audit log'dan değil,
    // admins listesinden — daha güvenilir bir kaynak).
    const adminsListRes = await apiCtx.get(`${API_BASE}/admins?search=qa.mesai.self&limit=5`, { headers: authHeaders })
    const adminsListBody = await adminsListRes.json()
    const selfAdmin = (adminsListBody?.data?.items ?? [])[0]
    expect(selfAdmin, 'grantAccess ile oluşan yönetici admins listesinde bulunmalı').toBeTruthy()
    selfServiceAdminId = selfAdmin.id
    selfServiceEmail = selfAdmin.email

    // NOT (2026-09-04, mimari boşluğun İKİNCİ parçası): AdminScope (sayfa erişimi) tek
    // başına yeterli değil — StartMineAsync/EndMineAsync ayrıca bir LibraryStaff kaydı
    // (uow.LibraryStaff.GetByAdminUserAsync) bekliyor. Bu ikisi de HİÇ senkronize
    // edilmediğinden, self-service akışının çalışması için library-staff kaydını da
    // AYRICA (API üzerinden, StaffFormDrawer'ın kullandığı aynı endpoint) açıyoruz.
    const staffCreateRes = await apiCtx.post(`${API_BASE}/library-staff`, {
      headers: authHeaders,
      data: { adminUserId: selfServiceAdminId, participantId: null, workingLibraryIds: [libraryId], canEditOwnShifts: false, hasDoorAccess: false },
    })
    expect(staffCreateRes.ok(), `self-service personel kaydı oluşturulamadı: ${await staffCreateRes.text()}`).toBeTruthy()
    selfServiceStaffId = (await staffCreateRes.json()).data.id

    // İKİNCİ, AYRI bir yönetici hesabı — StaffFormDrawer "Yönetici" Combobox testi için
    // (test 1-2-3, admin-initiated, scope sorunu YOK çünkü işlemi yapan SuperAdmin).
    const roleOptionsRes = await apiCtx.get(`${API_BASE}/roles/options`, { headers: authHeaders })
    const roleOptions = (await roleOptionsRes.json())?.data ?? []
    const role = roleOptions.find((r: { key: string }) => r.key === 'demo-module-library') ?? roleOptions[0]
    expect(role?.key, 'personel rolü bulunmalı').toBeTruthy()

    const tempAdminEmail = `qa.mesai.${Date.now()}@nexora.local`
    const createRes = await apiCtx.post(`${API_BASE}/admins`, {
      headers: authHeaders,
      data: { fullName: 'QA Test E2E Auto Mesai Personeli', email: tempAdminEmail, phone: '05559990000', role: role!.key, deliveryChannel: 'Email' },
    })
    expect(createRes.ok(), `geçici personel adayı oluşturulamadı: ${await createRes.text()}`).toBeTruthy()
    tempAdminId = (await createRes.json()).data.id
  })

  test.afterAll(async () => {
    const cleanupToken = await adminToken(apiCtx).catch(() => token)
    const cleanupHeaders = { Authorization: `Bearer ${cleanupToken}` }
    if (shiftId) await apiCtx.post(`${API_BASE}/library-shifts/${shiftId}/end`, { headers: cleanupHeaders }).catch(() => {})
    if (staffId) await apiCtx.delete(`${API_BASE}/library-staff/${staffId}`, { headers: cleanupHeaders }).catch(() => {})
    if (selfServiceStaffId) await apiCtx.delete(`${API_BASE}/library-staff/${selfServiceStaffId}`, { headers: cleanupHeaders }).catch(() => {})
    if (tempAdminId) await apiCtx.delete(`${API_BASE}/admins/${tempAdminId}`, { headers: cleanupHeaders }).catch(() => {})
    if (selfServiceAdminId) await apiCtx.delete(`${API_BASE}/admins/${selfServiceAdminId}`, { headers: cleanupHeaders }).catch(() => {})
    if (libraryId) await apiCtx.delete(`${API_BASE}/libraries/${libraryId}`, { headers: cleanupHeaders }).catch(() => {})
    if (serviceFacilityId) await apiCtx.delete(`${API_BASE}/service-facilities/${serviceFacilityId}`, { headers: cleanupHeaders }).catch(() => {})
    await apiCtx.dispose()
  })

  test('1) ADMIN PANEL UI: personel GERÇEKTEN eklenir (StaffFormDrawer, Yönetici kaynağı)', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)

    await page.goto(`/library?library=${libraryId}&tab=mesai`)
    await page.getByRole('button', { name: 'Personel Ekle' }).click()

    const drawer = page.locator('div.relative.z-10').last()
    await expect(drawer.getByText('Yeni Personel').first()).toBeVisible({ timeout: 5000 })

    // Kaynak segmenti varsayılan "Yönetici" — Combobox'ta gerçek arama yapıp seç.
    // NOT (2026-09-04, gerçek testte bulunan hata): Combobox dropdown sonuçları drawer
    // scope'u DIŞINDA render ediliyor (portal) — drawer.getByText(...) bulamıyor, page
    // scope'unda aramak gerekiyor.
    await drawer.getByPlaceholder('Yöneticilerden ara ve seç...').fill('QA Test E2E Auto Mesai Personeli')
    const searchResult = page.getByText('QA Test E2E Auto Mesai Personeli', { exact: false }).first()
    await expect(searchResult).toBeVisible({ timeout: 8000 })
    await searchResult.click()

    // Seçim sonrası detay kartı (rol/telefon/email) GERÇEKTEN görünmeli.
    await expect(drawer.getByText('Rol', { exact: true })).toBeVisible({ timeout: 3000 })

    const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtn).toBeEnabled({ timeout: 5000 })
    await saveBtn.click()
    // NOT (2026-09-04, gerçek testte bulunan davranış, break-flow testinde de görülmüştü):
    // drawer.locator('div.relative.z-10').last() genel bir selector olduğundan, "Ekibim"
    // (Team) sağ paneli açıksa onu da eşleştirip toHaveCount(0) hep 1 döner. Drawer'ın
    // KENDİ başlığının kaybolduğunu doğrulamak daha güvenilir.
    await expect(page.getByRole('heading', { name: 'Yeni Personel' })).toHaveCount(0, { timeout: 8000 })

    // Fake-success-detection: API'den personel listesini çekip GERÇEKTEN eklendiğini doğrula.
    const freshToken = await getFreshToken(page)
    const listRes = await page.request.get(`${API_BASE}/library-staff?libraryId=${libraryId}&limit=50`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const listBody = await listRes.json()
    const created = (listBody?.data?.items ?? []).find((s: { adminUserId?: string }) => s.adminUserId === tempAdminId)
    expect(created, `oluşturulan personel API listesinde bulunmalı: ${JSON.stringify(listBody).slice(0, 400)}`).toBeTruthy()
    staffId = created.id
    expect(created.sourceType).toBe('admin')
    expect(created.workingLibraryIds).toContain(libraryId)
    expect(created.isActive).toBe(true)
  })

  test('2) ADMIN PANEL UI: admin bu personel için "Mesai Başlat" ile GERÇEKTEN mesai başlatır', async ({ page }) => {
    test.setTimeout(30_000)
    expect(staffId, 'önceki testte personel oluşturulmuş olmalı').toBeTruthy()
    await adminLoginUi(page)

    await page.goto(`/library?library=${libraryId}&tab=mesai`)
    const staffRow = page.locator('tr', { has: page.getByText('QA Test E2E Auto Mesai Personeli', { exact: false }) })
    await expect(staffRow).toBeVisible({ timeout: 8000 })
    await staffRow.getByRole('button', { name: 'Mesai Başlat' }).click()

    await expect(page.getByRole('heading', { name: 'Mesai Başlat' })).toBeVisible({ timeout: 5000 })
    await page.getByPlaceholder('Örn. Zemin Kat Danışma').fill('Zemin Kat Danışma Masası')
    await page.getByPlaceholder('Mesai notu (opsiyonel)').fill('QA test — otomatik mesai başlatma')

    const startBtn = page.getByRole('button', { name: 'Başlat', exact: true })
    await expect(startBtn).toBeEnabled({ timeout: 5000 })
    await startBtn.click()
    await expect(page.getByText('Mesai başlatıldı', { exact: false })).toBeVisible({ timeout: 8000 })

    // Aktif Mesailer tablosunda GERÇEKTEN görünmeli.
    await expect(page.getByText('Çalışıyor', { exact: true }).first()).toBeVisible({ timeout: 8000 })

    // Fake-success-detection: API'den aktif mesai listesini çek.
    const freshToken = await getFreshToken(page)
    const activeRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/shifts/active`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const activeBody = await activeRes.json()
    const active = (activeBody?.data ?? []).find((s: { staffId: string }) => s.staffId === staffId)
    expect(active, `aktif mesai API listesinde bulunmalı: ${JSON.stringify(activeBody).slice(0, 400)}`).toBeTruthy()
    shiftId = active.id
    expect(active.location).toBe('Zemin Kat Danışma Masası')
    expect(active.notes).toBe('QA test — otomatik mesai başlatma')
    expect(active.status).toBe('active')
    expect(active.initiationType).toBe('admin')
  })

  test('3) ADMIN PANEL UI: admin "Mesai Bitir" ile GERÇEKTEN bitirir', async ({ page }) => {
    test.setTimeout(30_000)
    expect(shiftId, 'önceki testte mesai başlatılmış olmalı').toBeTruthy()
    await adminLoginUi(page)

    await page.goto(`/library?library=${libraryId}&tab=mesai`)
    await expect(page.getByText('QA Test E2E Auto Mesai Personeli', { exact: false }).first()).toBeVisible({ timeout: 8000 })

    // NOT (2026-09-04, aynı gotcha diğer dosyalarda da bulundu): IconButton'ların erişilebilir
    // adı HTML title DEĞİL aria-label — getByTitle değil getByRole('button',{name}) kullanılmalı.
    await page.getByRole('button', { name: 'Mesai bitir' }).first().click()
    await expect(page.getByRole('heading', { name: 'Mesai Bitir' })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Mesai Bitir', exact: true }).click()
    await expect(page.getByText('mesaisi bitirildi', { exact: false })).toBeVisible({ timeout: 8000 })

    // Fake-success-detection: API'den doğrula — artık aktif listede yok, status=ended, workedMinutes dolu.
    const freshToken = await getFreshToken(page)
    const activeRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/shifts/active`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const activeBody = await activeRes.json()
    expect((activeBody?.data ?? []).find((s: { id: string }) => s.id === shiftId), 'mesai artık aktif listede olmamalı').toBeFalsy()

    const shiftsRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/shifts?page=1&limit=25`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const shiftsBody = await shiftsRes.json()
    const ended = (shiftsBody?.data?.items ?? []).find((s: { id: string }) => s.id === shiftId)
    expect(ended, 'bitirilen mesai geçmiş listede bulunmalı').toBeTruthy()
    expect(ended.status).toBe('ended')
    expect(ended.workedMinutes, 'çalışma süresi hesaplanmış olmalı').not.toBeNull()
  })

  test('4) PERSONEL KENDİ HESABIYLA: "Mesaimi Başlat" self-service akışı GERÇEKTEN kullanılır', async ({ page, context }) => {
    test.setTimeout(60_000)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 41.1039, longitude: 28.8674 })

    await page.goto('/login')
    await page.locator('#email').fill(selfServiceEmail)
    await page.locator('#password').fill(generatedPassword)
    await page.getByRole('button', { name: 'Giriş Yap' }).click()
    if (await page.waitForURL('**/login/otp', { timeout: 5000 }).then(() => true).catch(() => false)) {
      const otpInputs = page.locator('input[inputmode="numeric"]')
      const count = await otpInputs.count()
      for (let i = 0; i < Math.min(6, count); i++) await otpInputs.nth(i).fill(ADMIN_OTP[i])
      await page.getByRole('button', { name: /Doğrula/ }).click()
    }
    // Yeni hesap ilk girişte şifre belirlemeye zorlanabilir — bkz. permissions-role-creation.spec.ts NOT.
    // NOT (2026-09-04, gerçek testte bulunan gerçek metin ve gotcha): ekran başlığı
    // "Şifrenizi Belirleyin", buton "Şifreyi Belirle ve Devam Et". AYRICA: isVisible({timeout})
    // RETRY YAPMIYOR — anlık DOM durumunu kontrol edip hemen döner (login+OTP sonrası ekran
    // henüz render olmamışsa yanlışlıkla false döner, sonraki adımlar hiç çalışmaz). Bunun
    // yerine .waitFor({state:'visible'}) ile GERÇEKTEN retry-polling yapıp, timeout olursa
    // (yani ekran hiç görünmezse, zaten şifre belirlenmiş bir hesapsa) sessizce devam et.
    const pwScreen = page.getByText('Şifrenizi Belirleyin', { exact: false })
    const pwScreenAppeared = await pwScreen.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)
    if (pwScreenAppeared) {
      const newPass = 'QaTestMesai2026!'
      await page.getByPlaceholder('En az 8 karakter').first().fill(newPass)
      await page.getByPlaceholder('Şifreyi tekrar giriniz').first().fill(newPass)
      await page.getByRole('button', { name: 'Şifreyi Belirle ve Devam Et' }).click()
    }
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
    // NOT (2026-09-04, gerçek testte bulunan davranış): FirstLoginPasswordPage şifre
    // belirledikten sonra `window.location.href = '/dashboard'` ile TAM SAYFA yenilemesi
    // yapıyor (SPA navigasyonu değil) — hemen ardından page.goto çağırmak bu yenilemeyle
    // yarışıyor ve navigasyon kayboluyor (mesai sayfası hiç yüklenmiyor). Dashboard'a
    // gerçekten ulaşıldığını bekleyip sonra mesai sayfasına gidiyoruz.
    await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {})
    await page.waitForLoadState('networkidle').catch(() => {})

    await page.goto(`/library?library=${libraryId}&tab=mesai`)
    await expect(page.getByText('Mesaim —', { exact: false })).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Şu an mesaide değilsiniz', { exact: false })).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: 'Mesaimi Başlat' }).click()
    await expect(page.getByRole('heading', { name: 'Mesaimi Başlat' })).toBeVisible({ timeout: 5000 })
    // Konum izni verildiğinden "Konumunuz alındı" mesajı GERÇEKTEN görünmeli.
    await expect(page.getByText('Konumunuz alındı', { exact: false })).toBeVisible({ timeout: 8000 })
    await page.getByPlaceholder('Örn. Zemin Kat Danışma').fill('Self-servis QA testi')

    const startRes = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/libraries/${libraryId}/shifts/me/start`) && r.request().method() === 'POST', { timeout: 10000 }),
      page.getByRole('button', { name: 'Başlat', exact: true }).click(),
    ])
    expect(startRes[0].ok(), `self mesai başlatma isteği başarısız: ${await startRes[0].text()}`).toBeTruthy()
    await expect(page.getByText('Mesainiz başlatıldı', { exact: false })).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Çalışıyor · başlangıç', { exact: false })).toBeVisible({ timeout: 5000 })
  })

  test('5) PERSONEL KENDİ HESABIYLA: "Mesaimi Bitir" ile GERÇEKTEN bitirir, geçmişte görünür', async ({ page, context }) => {
    test.setTimeout(30_000)
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 41.1039, longitude: 28.8674 })

    await page.goto('/login')
    await page.locator('#email').fill(selfServiceEmail)
    // NOT: test 4'te şifre 'QaTestMesai2026!' olarak değiştirilmiş olabilir — önce onu dene.
    await page.locator('#password').fill('QaTestMesai2026!')
    await page.getByRole('button', { name: 'Giriş Yap' }).click()
    if (await page.waitForURL('**/login/otp', { timeout: 5000 }).then(() => true).catch(() => false)) {
      const otpInputs = page.locator('input[inputmode="numeric"]')
      const count = await otpInputs.count()
      for (let i = 0; i < Math.min(6, count); i++) await otpInputs.nth(i).fill(ADMIN_OTP[i])
      await page.getByRole('button', { name: /Doğrula/ }).click()
    }
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })

    await page.goto(`/library?library=${libraryId}&tab=mesai`)
    await expect(page.getByText('Çalışıyor · başlangıç', { exact: false })).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: 'Mesaimi Bitir' }).click()
    await expect(page.getByRole('heading', { name: 'Mesaimi Bitir' })).toBeVisible({ timeout: 5000 })
    // NOT (2026-09-04, gerçek testte bulunan strict-mode hatası): ConfirmModal'ın onay
    // butonu ile arkadaki kartın butonu AYNI metni ("Mesaimi Bitir") taşıyor. ConfirmModal
    // dialog'una scope'la.
    const confirmDialog = page.getByRole('dialog').or(page.locator('div.relative.z-10').last())
    await confirmDialog.getByRole('button', { name: 'Mesaimi Bitir', exact: true }).click()
    await expect(page.getByText('Mesainiz bitirildi', { exact: false })).toBeVisible({ timeout: 8000 })

    // "Mesai Geçmişim" tablosunda kayıt GERÇEKTEN görünmeli.
    await expect(page.getByText('Self-servis QA testi', { exact: false }).or(page.getByText('Bitti', { exact: true })).first()).toBeVisible({ timeout: 8000 })
  })

  test('6) ADMIN PANEL UI: personel "Pasife Al" ile GERÇEKTEN pasife alınır, Mesai Başlat disabled olur', async ({ page }) => {
    test.setTimeout(30_000)
    await adminLoginUi(page)

    await page.goto(`/library?library=${libraryId}&tab=mesai`)
    const staffRow = page.locator('tr', { has: page.getByText('QA Test E2E Auto Mesai Personeli', { exact: false }) })
    await expect(staffRow).toBeVisible({ timeout: 8000 })
    await staffRow.getByRole('button', { name: 'Pasife al' }).click()

    await expect(page.getByRole('heading', { name: 'Personeli Pasife Al' })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Onayla', exact: true }).click()
    await expect(page.getByText('Personel pasife alındı', { exact: false })).toBeVisible({ timeout: 8000 })

    // Fake-success-detection: API'den doğrula.
    const freshToken = await getFreshToken(page)
    const listRes = await page.request.get(`${API_BASE}/library-staff?libraryId=${libraryId}&limit=50`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const listBody = await listRes.json()
    const found = (listBody?.data?.items ?? []).find((s: { id: string }) => s.id === staffId)
    expect(found?.isActive).toBe(false)

    // UI'da "Mesai Başlat" butonu artık disabled ("Personel pasif" title'ıyla).
    const updatedRow = page.locator('tr', { has: page.getByText('QA Test E2E Auto Mesai Personeli', { exact: false }) })
    await expect(updatedRow.getByRole('button', { name: 'Mesai Başlat' })).toBeDisabled({ timeout: 5000 })
  })
})
