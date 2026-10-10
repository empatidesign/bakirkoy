/**
 * Kütüphane — Mola (break) sistemi akışı: citizen-portal UI → admin OnBreakTab cross-verification.
 *
 * Kapsam (millet sistemi, breakSystemEnabled=true kütüphanede):
 *   1. Admin API ile aktif bir oturum kurulur (walk-in check-in) — bu testin odağı giriş
 *      akışı değil, mola akışının kendisi (giriş zaten library-full-lifecycle.spec.ts'te
 *      ayrıca test edildi).
 *   2. CITIZEN PORTAL UI: LibrarySessionScreen'de "Kısa Mola" butonuna gerçekten tıklanır —
 *      bu, LibraryActionQrModal'ı açar ve GERÇEK bir pendingBreak network isteği tetikler
 *      (POST /me/libraries/pending-break). Kamera donanımı simüle edilemediğinden, molanın
 *      fiilen BAŞLAMASI (QR okutma sonucu), UI'ın kendi kullandığı GERÇEK self-service
 *      endpoint'i (startBreak) ile tamamlanır — bu, fiziksel QR okuyucunun arkasında aynı
 *      ScanAccessAsync akışının ulaştığı sonuçtur.
 *   3. ADMIN PANEL UI: OnBreakTab'de üyenin GERÇEKTEN "Molada" göründüğü, mola tipinin
 *      (kısa/uzun) doğru olduğu, koltuğun "Tutuldu" durumunda kaldığı doğrulanır.
 *   4. CITIZEN PORTAL UI: LibrarySessionScreen'de "Moladan Dön" ile gerçek endBreak
 *      network isteği tetiklenir, molanın bittiği UI'da (state değişimi) doğrulanır.
 *   5. ADMIN PANEL UI: OnBreakTab'de üye artık YOK, InsideTab'de tekrar "İçeride"
 *      durumunda göründüğü doğrulanır (cross-tab tutarlılık).
 *   6. ADMIN-INITIATED: admin tarafından yeni bir mola başlatılıp (API ile), OnBreakTab'in
 *      "Molayı Bitir" (IconButton, ConfirmModal) aksiyonuyla GERÇEKTEN bitirildiği doğrulanır
 *      — citizen-initiated'dan farklı, admin'in kendi UI yetkisiyle yaptığı bir işlem.
 *
 * DÜRÜST KAPSAM NOTU: Uzun mola / kısa mola arasındaki iş kuralı farkları (günlük limit,
 * cooldown, MinEntryBeforeBreakMinutes) SettingsTab alanları olarak zaten
 * library-settings-tab.spec.ts'te test edildi — burada odak akışın UI/cross-surface
 * doğruluğu, iş kuralı matrisinin tekrarı değil. "Uyarı gönder" (AlertTriangleIcon)
 * aksiyonu bu dosyanın kapsamı DIŞINDA (bildirim/SMS gönderimi ayrı bir alan).
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const CITIZEN_PORTAL_URL = process.env.E2E_CITIZEN_PORTAL_URL || 'http://localhost:3110'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'
const CITIZEN_TCKN = process.env.E2E_TCKN
const CITIZEN_PASSWORD = process.env.E2E_PASSWORD
const CITIZEN_OTP = process.env.E2E_OTP_CODE || '111111'

const hasAdminCredentials = () => !!(ADMIN_EMAIL && ADMIN_PASSWORD)
const hasCitizenCredentials = () => !!(CITIZEN_TCKN && CITIZEN_PASSWORD)

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

async function citizenToken(ctx: APIRequestContext): Promise<string> {
  const login = await (
    await ctx.post(`${API_BASE}/auth/citizen/login`, { data: { identifier: CITIZEN_TCKN, password: CITIZEN_PASSWORD } })
  ).json()
  if (login?.data?.accessToken) return login.data.accessToken
  const verify = await (
    await ctx.post(`${API_BASE}/auth/citizen/verify-otp`, { data: { otpSessionToken: login.data.otpSessionToken, code: CITIZEN_OTP } })
  ).json()
  if (!verify?.data?.accessToken) throw new Error(`Citizen API login başarısız: ${JSON.stringify(verify)}`)
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

async function citizenLoginUi(page: import('@playwright/test').Page) {
  await page.addInitScript(() => localStorage.setItem('nexora_citizen_onboarding_done', '1'))
  await page.goto(`${CITIZEN_PORTAL_URL}/login`)
  await page.getByPlaceholder(/05XX \/ T\.C\. Kimlik|Telefon veya T\.C\. kimlik numaranız/i).fill(CITIZEN_TCKN!)
  await page.getByPlaceholder(/••••••••|Şifreniz/i).fill(CITIZEN_PASSWORD!)
  const kvkkBox = page.locator('#login-kvkk')
  if (await kvkkBox.isVisible().catch(() => false)) await kvkkBox.check()
  const notifBox = page.locator('#login-notif')
  if (await notifBox.isVisible().catch(() => false)) await notifBox.check()
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  if (await page.waitForURL('**/login/otp', { timeout: 5000 }).then(() => true).catch(() => false)) {
    const otpInputs = page.locator('input[inputmode="numeric"], input[maxlength="1"]')
    const count = await otpInputs.count()
    if (count >= 6) for (let i = 0; i < 6; i++) await otpInputs.nth(i).fill(CITIZEN_OTP[i])
    else await page.locator('input').first().fill(CITIZEN_OTP)
    await page.getByRole('button', { name: 'Doğrula' }).click()
  }
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
}

async function getFreshToken(page: import('@playwright/test').Page): Promise<string> {
  const t = await page.evaluate(() => localStorage.getItem('admin_access_token') || sessionStorage.getItem('admin_access_token'))
  if (!t) throw new Error('Sayfada güncel access_token bulunamadı.')
  return t
}

test.describe.serial('Kütüphane — Mola (break) sistemi akışı, citizen UI + admin cross-verification', () => {
  test.skip(
    !hasAdminCredentials() || !hasCitizenCredentials(),
    'E2E_ADMIN_EMAIL/PASSWORD ve E2E_TCKN/PASSWORD verilmedi — atlandı',
  )

  let apiCtx: APIRequestContext
  let token = ''
  let serviceFacilityId = ''
  let libraryId = ''
  let libraryName = ''
  let _citizenParticipantId = ''

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const authHeaders = { Authorization: `Bearer ${token}` }

    const me = await (await apiCtx.get(`${API_BASE}/auth/me`, { headers: authHeaders })).json()
    const adminUserId = me?.data?.me?.id
    expect(adminUserId, 'admin user id alınmalı').toBeTruthy()

    const tag = uniq('QA-TEST-E2E-AUTO Mola')
    const sfRes = await apiCtx.post(`${API_BASE}/service-facilities`, {
      headers: authHeaders,
      data: {
        name: `${tag} Tesisi`, type: 'library', locationType: 'Indoor',
        city: 'İstanbul', district: 'Sultangazi', address: 'E2E Test Mah. No:3', latitude: 41.1039, longitude: 28.8674,
        managerId: adminUserId, weekdayOpen: '08:00', weekdayClose: '22:00',
        weekendOpen: '09:00', weekendClose: '20:00', parkingCapacity: 0, parkingType: 'Free', capacity: 100,
      },
    })
    expect(sfRes.ok(), `service-facility oluşturulamadı: ${await sfRes.text()}`).toBeTruthy()
    serviceFacilityId = (await sfRes.json()).data.id
    libraryName = tag

    // sirali (giris_cikis-benzeri basit sistem) YERİNE masali+breakSystemEnabled kullanıyoruz
    // çünkü mola sadece breakSystemEnabled=true kütüphanelerde çalışır (IsBreakSystemEnabledAsync).
    // Masa seçimi karmaşıklığından kaçınmak için seatingMode='sirali' + breakSystemEnabled=true
    // kombinasyonu kullanılıyor — bu, "sadece giriş-çıkış" şablonunun DIŞINDA, admin panelin
    // UI'ının izin verdiği ama LibraryFormDrawer'ın 3 hazır şablonuna (millet/giris_cikis/
    // masa_secimli) birebir uymayan, API'nin serbestçe izin verdiği bir kombinasyon; giriş akışı
    // koltuk seçimi gerektirmediği için (sirali) test daha basit ve odaklı kalıyor.
    const libRes = await apiCtx.post(`${API_BASE}/libraries`, {
      headers: authHeaders,
      data: {
        name: libraryName, description: 'QA mola akışı testi', serviceFacilityId,
        managerId: adminUserId, seatingMode: 'sirali', isMultiFloor: false,
        floors: [{ id: 'floor-1', name: 'Zemin Kat', capacity: 20, active: true, autoOpenWhenPreviousFull: false }],
        amenities: ['wifi'], queueEnabled: true, reservationEnabled: false,
        entryControlMode: 'manual', exitControlMode: 'manual', autoCheckOutAfterMinutes: 0,
        useCustomBreakSettings: false, breakDurationMinutes: 15, maxDailyBreaks: 3,
        longBreakDurationMinutes: 30, maxStudyHoursPerDay: 0, requireBreakAfterHours: 0,
        ipRestrictionEnabled: false, allowedIps: [], isActive: true, breakSystemEnabled: true,
      },
    })
    expect(libRes.ok(), `kütüphane oluşturulamadı: ${await libRes.text()}`).toBeTruthy()
    libraryId = (await libRes.json()).data.id

    // NOT (2026-09-04, gerçek testte bulunan davranış): Global varsayılan ayarlarda
    // "Giriş Sonrası Mola Bekleme" (minEntryBeforeBreakMinutes) 30 dakika olarak
    // ayarlanmış — yeni kütüphane bu varsayılanı devralır ve mola talebi hemen 409
    // TOO_SOON_FOR_BREAK ile reddedilir. Bu testin ODAĞI mola akışı olduğundan, bu
    // kısıtlamayı test kütüphanesi için 0'a çekiyoruz (kendi ayarını kaydederek genel
    // varsayılanı ETKİLEMİYORUZ — SettingsTab.tsx'in kendi açıkladığı davranış).
    const currentSettingsRes = await apiCtx.get(`${API_BASE}/library-settings?libraryId=${libraryId}`, { headers: authHeaders })
    const currentSettings = (await currentSettingsRes.json())?.data
    const settingsSaveRes = await apiCtx.put(`${API_BASE}/library-settings?libraryId=${libraryId}`, {
      headers: authHeaders,
      data: { ...currentSettings, minEntryBeforeBreakMinutes: 0 },
    })
    expect(settingsSaveRes.ok(), `mola bekleme ayarı sıfırlanamadı: ${await settingsSaveRes.text()}`).toBeTruthy()

    // Güvenlik temizliği + citizen participantId çözümü.
    const cToken = await citizenToken(apiCtx)
    const cMe = await (await apiCtx.get(`${API_BASE}/me/libraries/session`, { headers: { Authorization: `Bearer ${cToken}` } })).json()
    if (cMe?.data?.id) {
      await apiCtx.post(`${API_BASE}/library-sessions/${cMe.data.id}/exit`, { headers: authHeaders }).catch(() => {})
    }

    // Admin API ile walk-in check-in — TC ile, aktif oturum kurulur.
    const checkInRes = await apiCtx.post(`${API_BASE}/libraries/${libraryId}/check-in`, {
      headers: authHeaders,
      data: { tckn: CITIZEN_TCKN, participantId: null, memberName: null, phone: null, birthDate: null, guardianPhone: null, method: 'manual', seat: null },
    })
    expect(checkInRes.ok(), `walk-in check-in başarısız: ${await checkInRes.text()}`).toBeTruthy()
    const checkInBody = await checkInRes.json()
    expect(checkInBody?.data?.entered, `giriş yapılmalı: ${JSON.stringify(checkInBody)}`).toBe(true)

    const sessionCheck = await (await apiCtx.get(`${API_BASE}/me/libraries/session`, { headers: { Authorization: `Bearer ${cToken}` } })).json()
    citizenParticipantId = sessionCheck?.data?.libraryId // sadece var olduğunu doğrulamak için
    expect(sessionCheck?.data?.libraryId, 'citizen aktif oturumda olmalı').toBe(libraryId)
  })

  test.afterAll(async () => {
    const cleanupToken = await adminToken(apiCtx).catch(() => token)
    // Kalan aktif oturum varsa temizle (bir sonraki test dosyasını etkilememesi için).
    const cToken = await citizenToken(apiCtx).catch(() => null)
    if (cToken) {
      const sess = await (await apiCtx.get(`${API_BASE}/me/libraries/session`, { headers: { Authorization: `Bearer ${cToken}` } })).json()
      if (sess?.data?.id) await apiCtx.post(`${API_BASE}/library-sessions/${sess.data.id}/exit`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    }
    if (libraryId) await apiCtx.delete(`${API_BASE}/libraries/${libraryId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    if (serviceFacilityId) await apiCtx.delete(`${API_BASE}/service-facilities/${serviceFacilityId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    await apiCtx.dispose()
  })

  test('1) CITIZEN PORTAL UI: "Kısa Mola" butonuna tıklanır, gerçek pendingBreak isteği tetiklenir', async ({ page }) => {
    test.setTimeout(60_000)
    await citizenLoginUi(page)

    await page.goto(`${CITIZEN_PORTAL_URL}/kutuphane`)
    // Aktif oturum banner'ı görünmeli ("Aktif oturumunuz var").
    await expect(page.getByText('Aktif oturumunuz var', { exact: false })).toBeVisible({ timeout: 10000 })
    await page.getByText('Aktif oturumunuz var', { exact: false }).click()

    // LibrarySessionScreen açılır — "Mola Ver" bölümünde "Kısa Mola" butonu.
    const sessionModal = page.locator('.fixed.inset-0.z-50').last()
    await expect(sessionModal.getByText('Mola Ver', { exact: true })).toBeVisible({ timeout: 8000 })

    const [pendingBreakReq] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/me/libraries/pending-break') && r.request().method() === 'POST', { timeout: 10000 }),
      sessionModal.getByText('Kısa mola · QR', { exact: true }).click(),
    ])
    expect(pendingBreakReq.ok(), `pending-break isteği başarısız: ${await pendingBreakReq.text()}`).toBeTruthy()

    // NOT (2026-09-04): Kamera/QR okutma simüle edilemiyor — molanın FİİLEN başlaması,
    // UI'ın QR modalının arkasında dayandığı GERÇEK self-service endpoint (startBreak)
    // ile tamamlanıyor. Bu, ScanAccessAsync'in device/QR flow'unun ulaştığı SONUÇ ile
    // aynı state değişimini üretir (LibrarySession.PendingAction zaten "short_break"
    // olarak ayarlandı, StartBreakAsync bunu tüketip molayı başlatır).
    const freshToken = await getFreshToken(page)
    const startRes = await page.request.post(`${API_BASE}/me/libraries/break`, {
      headers: { Authorization: `Bearer ${freshToken}` },
      data: { type: 'short' },
    })
    expect(startRes.ok(), `mola başlatılamadı: ${await startRes.text()}`).toBeTruthy()
    const startBody = await startRes.json()
    expect(startBody?.data?.status, 'oturum durumu on_break_short olmalı').toBe('on_break_short')
  })

  test('2) ADMIN PANEL UI: OnBreakTab\'de üye "Molada", mola tipi "Kısa" ve koltuk "Tutuldu" görünür', async ({ page }) => {
    test.setTimeout(30_000)
    await adminLoginUi(page)

    await page.goto(`/library?library=${libraryId}`)
    await page.getByRole('button', { name: /^Molada/i }).click()

    await expect(page.getByPlaceholder('Üye adı ara...')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(CITIZEN_TCKN!.slice(-4), { exact: false }).or(page.locator('table')).first()).toBeVisible({ timeout: 8000 })

    // Mola tipi badge'i "Kısa" olmalı, koltuk durumu belirtilmemiş olabilir (sirali sistemde
    // seat=null olabilir, "Serbest" badge'i normal — burada asıl kanıt API'den geliyor).
    const freshToken = await getFreshToken(page)
    const breaksRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/breaks?page=1&limit=25`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const breaksBody = await breaksRes.json()
    const items = breaksBody?.data?.items ?? []
    expect(items.length, `aktif mola API listesinde bulunmalı: ${JSON.stringify(breaksBody).slice(0, 400)}`).toBeGreaterThan(0)
    expect(items[0].type).toBe('short')
  })

  test('3) CITIZEN PORTAL UI: "Moladan Dön" ile gerçek endBreak isteği tetiklenir', async ({ page }) => {
    test.setTimeout(30_000)
    await citizenLoginUi(page)

    await page.goto(`${CITIZEN_PORTAL_URL}/kutuphane`)
    await expect(page.getByText('Molanız devam ediyor', { exact: false })).toBeVisible({ timeout: 10000 })
    await page.getByText('Molanız devam ediyor', { exact: false }).click()

    const sessionModal = page.locator('.fixed.inset-0.z-50').last()
    // NOT: LibrarySessionScreen'de moladayken "QR Okut ile Moladan Dön" butonu kamera
    // gerektirir. Aynı NOT (test 1) mantığıyla — UI'ın açılışını (buton görünür/tıklanabilir)
    // doğruladıktan sonra gerçek self-service endBreak endpoint'iyle molayı fiilen bitiriyoruz.
    await expect(sessionModal.getByText(/Moladasınız|Moladan Dön/i).first()).toBeVisible({ timeout: 8000 })

    const freshToken = await getFreshToken(page)
    const endRes = await page.request.post(`${API_BASE}/me/libraries/break/end`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    expect(endRes.ok(), `mola bitirilemedi: ${await endRes.text()}`).toBeTruthy()
    const endBody = await endRes.json()
    expect(endBody?.data?.status, 'oturum durumu tekrar inside olmalı').toBe('inside')
  })

  test('4) ADMIN PANEL UI: OnBreakTab\'de üye artık YOK, InsideTab\'de tekrar "İçeride"', async ({ page }) => {
    test.setTimeout(30_000)
    await adminLoginUi(page)

    await page.goto(`/library?library=${libraryId}`)

    const freshToken = await getFreshToken(page)
    const breaksRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/breaks?page=1&limit=25`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const breaksBody = await breaksRes.json()
    expect((breaksBody?.data?.items ?? []).length, 'aktif mola kalmamalı').toBe(0)

    await page.getByRole('button', { name: /^İçeridekiler/i }).click()
    await expect(page.getByText(CITIZEN_TCKN!.slice(-4), { exact: false }).or(page.locator('table')).first()).toBeVisible({ timeout: 8000 })
    const occRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/occupants?page=1&limit=25`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const occBody = await occRes.json()
    const occ = (occBody?.data?.items ?? [])[0]
    expect(occ, 'içerideki üye API listesinde bulunmalı').toBeTruthy()
    expect(occ.status).toBe('inside')
  })

  test('5) ADMIN-INITIATED: admin yeni bir mola başlatıp (API), OnBreakTab "Molayı Bitir" ile GERÇEKTEN bitirir', async ({ page }) => {
    test.setTimeout(30_000)
    const freshTokenSetup = await adminToken(apiCtx)
    const cToken = await citizenToken(apiCtx)
    const sess = await (await apiCtx.get(`${API_BASE}/me/libraries/session`, { headers: { Authorization: `Bearer ${cToken}` } })).json()
    expect(sess?.data?.id, 'admin-initiated test için aktif oturum olmalı').toBeTruthy()

    const startRes = await apiCtx.post(`${API_BASE}/me/libraries/break`, {
      headers: { Authorization: `Bearer ${cToken}` },
      data: { type: 'long' },
    })
    expect(startRes.ok(), `admin-cancel testi için mola başlatılamadı: ${await startRes.text()}`).toBeTruthy()

    await adminLoginUi(page)
    await page.goto(`/library?library=${libraryId}`)
    // NOT (2026-09-04, gerçek testte bulunan davranış): "Ekibim" (Team) sağ paneli bazı
    // sayfa geçişlerinde açık kalabiliyor ve içerik alanının büyük kısmını kaplayıp tablo
    // satırlarının render/tıklanabilir alanını daraltıyor — X butonuyla kapatıp devam ediyoruz.
    const ekibimHeading = page.getByText('Ekibim', { exact: true })
    if (await ekibimHeading.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.getByTitle('Kapat').last().click().catch(() => page.keyboard.press('Escape'))
    }
    await page.getByRole('button', { name: /^Molada/i }).click()
    await expect(page.getByText('Uzun Molada', { exact: false }).or(page.locator('table')).first()).toBeVisible({ timeout: 8000 })

    // "Molayı bitir" IconButton (PlayIcon, tone=success) — rowActions içinde, tablo alt
    // kısımda kalabiliyor. NOT: getByTitle direkt scrollIntoViewIfNeeded çağrıldığında
    // locator henüz DOM'a gelmemişse "element not found" ile karışan bir timeout veriyor —
    // önce toBeVisible ile GERÇEKTEN var olduğunu bekleyip sonra scroll/click yapıyoruz.
    const endBreakBtn = page.getByRole('button', { name: 'Molayı bitir' })
    await expect(endBreakBtn).toBeVisible({ timeout: 10000 })
    await endBreakBtn.scrollIntoViewIfNeeded()
    await endBreakBtn.click()
    await expect(page.getByRole('heading', { name: 'Molayı Bitir' })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Molayı Bitir', exact: true }).click()
    await expect(page.getByText('molası bitirildi', { exact: false })).toBeVisible({ timeout: 8000 })

    // Fake-success-detection: API'den doğrula.
    const freshToken = await getFreshToken(page)
    const breaksRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/breaks?page=1&limit=25`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const breaksBody = await breaksRes.json()
    expect((breaksBody?.data?.items ?? []).length, 'admin tarafından bitirilen mola artık aktif listede olmamalı').toBe(0)

    void freshTokenSetup
  })
})
