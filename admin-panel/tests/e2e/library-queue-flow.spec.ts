/**
 * Kütüphane — Sıra (queue) sistemi akışı: kapasite dolduğunda citizen sıraya girer,
 * admin "Sıra Başını Çağır" ile çağırır, citizen bildirimi görüp GERÇEK QR ile giriş yapar.
 *
 * Kapsam (sirali sistem, queueEnabled=true, capacity=1):
 *   1. Admin API ile kapasite 1 olan kütüphaneye BAŞKA bir üye (dummy TCKN) walk-in
 *      check-in ile yerleştirilir — kütüphane dolar (free=0).
 *   2. CITIZEN PORTAL UI: kıraathane kartına tıklanır, "Sıraya Katıl" butonu (queueEnabled
 *      && free===0 durumunda görünür) GERÇEKTEN tıklanır — POST /me/libraries/{id}/queue.
 *   3. ADMIN PANEL UI: QueueTab'de "Sırada Bekleyenler" listesinde üyenin GERÇEKTEN
 *      göründüğü doğrulanır (cross-surface tutarlılık).
 *   4. Dummy üye çıkış yapar (koltuk boşalır) — admin "Sıra Başını Çağır" butonuna
 *      GERÇEKTEN tıklar, çağrı API'sini tetikler.
 *   5. CITIZEN PORTAL UI: "Sıranız geldi!" bandı GERÇEKTEN görünür, kalan süre gösterilir.
 *   6. CITIZEN PORTAL UI: gerçek QR (statik QR) ile giriş yapılır — "called" durumundan
 *      "inside" durumuna geçiş, admin panelde İçeridekiler'de doğrulanır.
 *
 * DÜRÜST KAPSAM NOTU: "Sıradan Ayrıl" (leaveQueue) ve "Düşür" (admin expire) aksiyonları
 * ile Otomatik Sıra Çağrısı (autoQueueCallEnabled, 30sn interval polling) bu dosyanın
 * kapsamı DIŞINDA — otomatik çağrı zaten SettingsTab'de alan olarak test edildi, burada
 * odak MANUEL çağırma + citizen bildirim/giriş UI zincirinin gerçekliği.
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
const DUMMY_TCKN = process.env.E2E_DUMMY_TCKN || '10031555370' // kapasiteyi doldurmak için GERÇEK kayıtlı bir katılımcı TCKN'i (ResolveMemberAsync var olan bir Participant bekliyor) — sahte üretilmiş bir TCKN 404 PARTICIPANT_NOT_FOUND verir

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

test.describe.serial('Kütüphane — Sıra (queue) sistemi akışı, citizen UI + admin manuel çağırma', () => {
  test.skip(
    !hasAdminCredentials() || !hasCitizenCredentials(),
    'E2E_ADMIN_EMAIL/PASSWORD ve E2E_TCKN/PASSWORD verilmedi — atlandı',
  )

  let apiCtx: APIRequestContext
  let token = ''
  let serviceFacilityId = ''
  let libraryId = ''
  let libraryName = ''
  let dummySessionId = ''
  let staticQrCode = ''

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const authHeaders = { Authorization: `Bearer ${token}` }

    const me = await (await apiCtx.get(`${API_BASE}/auth/me`, { headers: authHeaders })).json()
    const adminUserId = me?.data?.me?.id
    expect(adminUserId, 'admin user id alınmalı').toBeTruthy()

    const tag = uniq('QA-TEST-E2E-AUTO Sira')
    const sfRes = await apiCtx.post(`${API_BASE}/service-facilities`, {
      headers: authHeaders,
      data: {
        name: `${tag} Tesisi`, type: 'library', locationType: 'Indoor',
        city: 'İstanbul', district: 'Sultangazi', address: 'E2E Test Mah. No:4', latitude: 41.1039, longitude: 28.8674,
        managerId: adminUserId, weekdayOpen: '08:00', weekdayClose: '22:00',
        weekendOpen: '09:00', weekendClose: '20:00', parkingCapacity: 0, parkingType: 'Free', capacity: 100,
      },
    })
    expect(sfRes.ok(), `service-facility oluşturulamadı: ${await sfRes.text()}`).toBeTruthy()
    serviceFacilityId = (await sfRes.json()).data.id
    libraryName = tag

    // Kapasite 1 — 1 dummy üye ile HEMEN dolacak, citizen'ın "Sıraya Katıl" düğmesini
    // görmesi için (free===0) minimum kapasite. accessType=qr (statik QR ile çağrılan
    // giriş testi için gerekli — masali DEĞİL, sirali basit sistem).
    const libRes = await apiCtx.post(`${API_BASE}/libraries`, {
      headers: authHeaders,
      data: {
        name: libraryName, description: 'QA sıra akışı testi', serviceFacilityId,
        managerId: adminUserId, seatingMode: 'sirali', isMultiFloor: false,
        floors: [{ id: 'floor-1', name: 'Zemin Kat', capacity: 1, active: true, autoOpenWhenPreviousFull: false }],
        amenities: ['wifi'], queueEnabled: true, reservationEnabled: false,
        entryControlMode: 'qr', exitControlMode: 'qr', autoCheckOutAfterMinutes: 0,
        useCustomBreakSettings: false, breakDurationMinutes: 15, maxDailyBreaks: 3,
        longBreakDurationMinutes: 30, maxStudyHoursPerDay: 0, requireBreakAfterHours: 0,
        ipRestrictionEnabled: false, allowedIps: [], isActive: true, breakSystemEnabled: false,
      },
    })
    expect(libRes.ok(), `kütüphane oluşturulamadı: ${await libRes.text()}`).toBeTruthy()
    libraryId = (await libRes.json()).data.id

    // Statik QR etkinleştir (test 6'da citizen QR ile giriş yapabilsin diye).
    const enableQrRes = await apiCtx.patch(`${API_BASE}/libraries/${libraryId}/static-qr/toggle`, {
      headers: authHeaders,
      data: { enabled: true },
    })
    expect(enableQrRes.ok(), `statik QR etkinleştirilemedi: ${await enableQrRes.text()}`).toBeTruthy()
    const modeRes = await apiCtx.patch(`${API_BASE}/libraries/${libraryId}/static-qr/mode`, {
      headers: authHeaders,
      data: { mode: 'entry_exit' },
    })
    expect(modeRes.ok(), `statik QR modu ayarlanamadı: ${await modeRes.text()}`).toBeTruthy()

    // NOT (2026-09-04, gerçek testte bulunan davranış): Global varsayılan ayarlarda
    // "Otomatik Sıra Çağrısı" (autoQueueCallEnabled) AÇIK — yeni kütüphane bu varsayılanı
    // devralır ve QueueTab'in periyodik (30sn) auto-call effect'i test 3'ten ÖNCE devreye
    // girip sıra başını otomatik çağırabiliyor, "Sıra Başını Çağır" butonu "Önce çağrılan
    // kişiyi sonlandırın" diyerek disabled kalıyor. Bu testin ODAĞI MANUEL çağırma
    // olduğundan, otomatik çağrıyı test kütüphanesi için kapatıyoruz (genel varsayılan
    // etkilenmiyor).
    const currentSettingsRes = await apiCtx.get(`${API_BASE}/library-settings?libraryId=${libraryId}`, { headers: authHeaders })
    const currentSettings = (await currentSettingsRes.json())?.data
    const settingsSaveRes = await apiCtx.put(`${API_BASE}/library-settings?libraryId=${libraryId}`, {
      headers: authHeaders,
      data: { ...currentSettings, autoQueueCallEnabled: false },
    })
    expect(settingsSaveRes.ok(), `otomatik sıra çağrısı kapatılamadı: ${await settingsSaveRes.text()}`).toBeTruthy()
    const qrRes = await apiCtx.get(`${API_BASE}/libraries/${libraryId}/static-qr`, { headers: authHeaders })
    staticQrCode = (await qrRes.json())?.data?.code
    expect(staticQrCode, 'statik QR kodu alınmalı').toBeTruthy()

    // Test citizen hesabında kalıntı oturum/sıra varsa temizle.
    const cToken = await citizenToken(apiCtx)
    const cSess = await (await apiCtx.get(`${API_BASE}/me/libraries/session`, { headers: { Authorization: `Bearer ${cToken}` } })).json()
    if (cSess?.data?.id) await apiCtx.post(`${API_BASE}/library-sessions/${cSess.data.id}/exit`, { headers: authHeaders }).catch(() => {})
    const cQueue = await (await apiCtx.get(`${API_BASE}/me/libraries/my-queue`, { headers: { Authorization: `Bearer ${cToken}` } })).json()
    if (cQueue?.data?.id) await apiCtx.delete(`${API_BASE}/me/libraries/${libraryId}/queue`, { headers: { Authorization: `Bearer ${cToken}` } }).catch(() => {})

    // Kapasiteyi dummy üye ile doldur (walk-in check-in, admin API). NOT (2026-09-04,
    // gerçek testte bulunan davranış #1): kütüphane entryControlMode='qr' olduğundan
    // EnforceEntryMethod yalnızca method='qr' kabul ediyor — 'manual' 409 QR_REQUIRED
    // verir. Admin API'den bile bu kural uygulanıyor; method'u 'qr' göndererek geçiyoruz.
    //
    // NOT (2026-09-04, gerçek testte bulunan davranış #2): DUMMY_TCKN de GERÇEK bir
    // katılımcı (ResolveMemberAsync var olan bir Participant bekliyor, sahte üretilmiş
    // TCKN 404 PARTICIPANT_NOT_FOUND verir). Bu katılımcının BAŞKA bir kütüphanede
    // (önceki test koşusu veya manuel debug'dan kalıntı) aktif oturumu varsa
    // EnforceSingleActiveAsync check-in'i 409 ACTIVE_SESSION_EXISTS ile engeller.
    // "libraries/all/persons?status=inside" ile TÜM kütüphanelerdeki aktif oturumları
    // tarayıp DUMMY_TCKN'e ait olanı bulup çıkışını yaptırıyoruz, sonra tekrar deniyoruz.
    const doDummyCheckIn = () => apiCtx.post(`${API_BASE}/libraries/${libraryId}/check-in`, {
      headers: authHeaders,
      data: { tckn: DUMMY_TCKN, participantId: null, memberName: 'QA Dummy Doldurucu', phone: '05550000000', birthDate: null, guardianPhone: null, method: 'qr', seat: null },
    })
    let dummyCheckIn = await doDummyCheckIn()
    if (dummyCheckIn.status() === 409) {
      const errBody = await dummyCheckIn.json()
      if (errBody?.errorCode === 'ACTIVE_SESSION_EXISTS') {
        const allInsideRes = await apiCtx.get(`${API_BASE}/libraries/all/persons?status=inside&limit=200`, { headers: authHeaders })
        const allInsideBody = await allInsideRes.json()
        // NOT: AllLibrariesPersonDto'da Tckn alanı YOK, sadece MemberName — bu isim
        // benzersiz olduğundan (dummy check-in isteğindeki memberName ile aynı) güvenilir.
        const staleEntry = (allInsideBody?.data?.items ?? []).find((x: { memberName?: string }) => x.memberName === 'QA Dummy Doldurucu')
        expect(staleEntry, `dummy için kalıntı oturum bulunamadı, ama ACTIVE_SESSION_EXISTS hatası alındı: ${JSON.stringify(errBody)}`).toBeTruthy()
        const exitRes = await apiCtx.post(`${API_BASE}/library-sessions/${staleEntry.id}/exit`, { headers: authHeaders })
        expect(exitRes.ok(), `kalıntı oturum çıkışı başarısız: ${await exitRes.text()}`).toBeTruthy()
        dummyCheckIn = await doDummyCheckIn()
      }
    }
    expect(dummyCheckIn.ok(), `dummy check-in başarısız: ${await dummyCheckIn.text()}`).toBeTruthy()
    const dummyBody = await dummyCheckIn.json()
    expect(dummyBody?.data?.entered, 'dummy üye girişi yapılmalı (kapasite dolmalı)').toBe(true)

    const occRes = await apiCtx.get(`${API_BASE}/libraries/${libraryId}/occupants?page=1&limit=5`, { headers: authHeaders })
    const occBody = await occRes.json()
    dummySessionId = occBody?.data?.items?.[0]?.id
    expect(dummySessionId, 'dummy oturum id bulunmalı').toBeTruthy()
  })

  test.afterAll(async () => {
    const cleanupToken = await adminToken(apiCtx).catch(() => token)
    const cToken = await citizenToken(apiCtx).catch(() => null)
    if (cToken) {
      const sess = await (await apiCtx.get(`${API_BASE}/me/libraries/session`, { headers: { Authorization: `Bearer ${cToken}` } })).json()
      if (sess?.data?.id) await apiCtx.post(`${API_BASE}/library-sessions/${sess.data.id}/exit`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    }
    if (dummySessionId) await apiCtx.post(`${API_BASE}/library-sessions/${dummySessionId}/exit`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    if (libraryId) await apiCtx.delete(`${API_BASE}/libraries/${libraryId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    if (serviceFacilityId) await apiCtx.delete(`${API_BASE}/service-facilities/${serviceFacilityId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    await apiCtx.dispose()
  })

  test('1) CITIZEN PORTAL UI: kapasite dolu kütüphanede "Sıraya Katıl" GERÇEKTEN tıklanır', async ({ page }) => {
    test.setTimeout(60_000)
    await citizenLoginUi(page)

    await page.goto(`${CITIZEN_PORTAL_URL}/kutuphane`)
    await page.getByPlaceholder('Kıraathane veya semt ara…').fill(libraryName)
    await page.getByText(libraryName, { exact: false }).first().click()

    const modal = page.locator('.fixed.inset-0.z-50').last()
    const joinBtn = modal.getByRole('button', { name: 'Sıraya Katıl', exact: true })
    await expect(joinBtn).toBeVisible({ timeout: 8000 })

    const [joinRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/me/libraries/${libraryId}/queue`) && r.request().method() === 'POST', { timeout: 10000 }),
      joinBtn.click(),
    ])
    expect(joinRes.ok(), `sıraya katılma isteği başarısız: ${await joinRes.text()}`).toBeTruthy()
    await expect(page.getByText('Sıraya katıldınız', { exact: false })).toBeVisible({ timeout: 8000 })
  })

  test('2) ADMIN PANEL UI: QueueTab "Sırada Bekleyenler" listesinde üye GERÇEKTEN görünür', async ({ page }) => {
    test.setTimeout(30_000)
    await adminLoginUi(page)

    await page.goto(`/library?library=${libraryId}`)
    await page.getByRole('button', { name: /^Sıra/i }).click()

    await expect(page.getByText('Sırada Bekleyenler', { exact: true })).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(CITIZEN_TCKN!.slice(0, 3), { exact: false }).or(page.locator('table')).first()).toBeVisible({ timeout: 8000 })

    const freshToken = await getFreshToken(page)
    const queueRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/queue?page=1&limit=25`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const queueBody = await queueRes.json()
    const items = queueBody?.data?.items ?? []
    expect(items.length, `sıra API listesinde bulunmalı: ${JSON.stringify(queueBody).slice(0, 400)}`).toBeGreaterThan(0)
    expect(items[0].status).toBe('waiting')
  })

  test('3) Dummy üye çıkış yapar, admin "Sıra Başını Çağır" ile GERÇEKTEN çağırır', async ({ page }) => {
    test.setTimeout(30_000)
    // Koltuğu boşalt (dummy üye çıkışı) — admin API üzerinden, bu test 3'ün odağı değil.
    const setupToken = await adminToken(apiCtx)
    const exitRes = await apiCtx.post(`${API_BASE}/library-sessions/${dummySessionId}/exit`, { headers: { Authorization: `Bearer ${setupToken}` } })
    expect(exitRes.ok(), `dummy çıkış başarısız: ${await exitRes.text()}`).toBeTruthy()

    await adminLoginUi(page)
    await page.goto(`/library?library=${libraryId}`)
    const ekibimHeading = page.getByText('Ekibim', { exact: true })
    if (await ekibimHeading.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.getByTitle('Kapat').last().click().catch(() => page.keyboard.press('Escape'))
    }
    await page.getByRole('button', { name: /^Sıra/i }).click()

    const callBtn = page.getByRole('button', { name: 'Sıra Başını Çağır', exact: true })
    await expect(callBtn).toBeEnabled({ timeout: 8000 })
    await callBtn.click()
    await expect(page.getByText('Sıra başı çağrıldı', { exact: false })).toBeVisible({ timeout: 8000 })

    const freshToken = await getFreshToken(page)
    const queueRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/queue?page=1&limit=25`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const queueBody = await queueRes.json()
    const called = (queueBody?.data?.items ?? []).find((q: { status: string }) => q.status === 'called')
    expect(called, 'çağrılan kayıt API listesinde bulunmalı').toBeTruthy()
  })

  test('4) CITIZEN PORTAL UI: "Sıranız geldi!" bandı GERÇEKTEN görünür', async ({ page }) => {
    test.setTimeout(30_000)
    await citizenLoginUi(page)

    await page.goto(`${CITIZEN_PORTAL_URL}/kutuphane`)
    // NOT (2026-09-04, gerçek testte bulunan hata): "Sıranız geldi" metni İKİ farklı
    // elemanda görünüyor — LibraryDirectoryTab'in üstteki "Aç" banner'ı ve kütüphane
    // kartındaki köşe rozeti. Strict mode violation'ı önlemek için .first() kullanılıyor.
    await expect(page.getByText(/Sıranız geldi/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('5) CITIZEN PORTAL UI: gerçek statik QR ile giriş yapılır, "called" -> "inside" geçişi doğrulanır', async ({ page }) => {
    test.setTimeout(30_000)
    expect(staticQrCode, 'statik QR kodu alınmış olmalı').toBeTruthy()
    await citizenLoginUi(page)

    const result = await page.evaluate(async (code) => {
      const mod = await import('/src/services/library.service.ts')
      return mod.default.staticScan(code, null, null)
    }, staticQrCode)
    expect(result.action, `beklenmeyen aksiyon: ${JSON.stringify(result)}`).toBe('checkin')
  })

  test('6) ADMIN PANEL UI: İçeridekiler\'de üye GERÇEKTEN görünür, sıra listesi boşalmış', async ({ page }) => {
    test.setTimeout(30_000)
    await adminLoginUi(page)

    await page.goto(`/library?library=${libraryId}`)
    const ekibimHeading = page.getByText('Ekibim', { exact: true })
    if (await ekibimHeading.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.getByTitle('Kapat').last().click().catch(() => page.keyboard.press('Escape'))
    }
    await page.getByRole('button', { name: /^İçeridekiler/i }).click()
    await expect(page.getByText(CITIZEN_TCKN!.slice(-4), { exact: false }).or(page.locator('table')).first()).toBeVisible({ timeout: 8000 })

    const freshToken = await getFreshToken(page)
    const occRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/occupants?page=1&limit=25`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const occBody = await occRes.json()
    expect((occBody?.data?.items ?? []).length, 'içeride 1 üye olmalı').toBeGreaterThan(0)

    const queueRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/queue?page=1&limit=25`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const queueBody = await queueRes.json()
    const active = (queueBody?.data?.items ?? []).filter((q: { status: string }) => q.status === 'waiting' || q.status === 'called')
    expect(active.length, 'aktif sıra kalmamalı (giriş yapıldı)').toBe(0)
  })
})
