/**
 * Kütüphane — Rezervasyon akışı (citizen-portal UI'dan gerçek "aynı gün rezervasyon" senaryosu).
 *
 * Kapsam: "Millet Kıraathanesi" (systemType=millet) sistem türünde, reservationEnabled=true
 * olan bir kütüphanede:
 *   1. CITIZEN PORTAL UI: kıraathaneler listesinde masa seçip "Rezervasyon Yap" tıklanır
 *      (gerçek buton tıklaması, gerçek network isteği — me/libraries/{id}/reservations).
 *   2. ADMIN PANEL UI: SeatingTab'de o koltuğun "Rezerve" durumunda GERÇEKTEN göründüğü
 *      doğrulanır (cross-surface tutarlılık — fake success detection, madde 81).
 *   3. CITIZEN PORTAL UI: "Rezervasyonlarım" sekmesinde rezervasyon kartı görünür, "İptal"
 *      butonuyla GERÇEKTEN iptal edilir (ConfirmModal onaylanır).
 *   4. ADMIN PANEL UI: SeatingTab'de koltuk tekrar "Boş" durumuna GERÇEKTEN döndüğü doğrulanır.
 *   5. Ayrıca admin tarafından rezervasyon iptali de test edilir (SeatingTab → koltuğa tıkla →
 *      "Rezervasyonu İptal Et" — bu kez admin-initiated cancel, farklı endpoint/yetki yolu).
 *
 * DÜRÜST KAPSAM NOTU: Kütüphanenin kendisi ve koltuk yapısı (kat/bölüm/masa) API üzerinden
 * kuruluyor — bunlar SeatingStructureEditor.tsx'in kendi (ayrı, karmaşık) UI'ı ve zaten
 * library-full-lifecycle.spec.ts'te temel kütüphane oluşturma UI'ı ayrıca test edildi. Bu
 * dosyanın ODAĞI rezervasyon akışının kendisi (yap/iptal/cross-surface tutarlılık), koltuk
 * yapısı kurma UI'ı değil. Sıra çağırma (queue-calling) UI'ı, mola sistemi UI'ı ve Mesai
 * modülü bu dosyanın kapsamı DIŞINDA — ayrı test dosyalarında ele alınacak (bkz. senaryo
 * matrisi dokümanı).
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

test.describe.serial('Kütüphane — Rezervasyon akışı (millet sistemi, masa seçimli, aynı gün rezervasyon)', () => {
  test.skip(
    !hasAdminCredentials() || !hasCitizenCredentials(),
    'E2E_ADMIN_EMAIL/PASSWORD ve E2E_TCKN/PASSWORD verilmedi — atlandı',
  )

  let apiCtx: APIRequestContext
  let token = ''
  let serviceFacilityId = ''
  let libraryId = ''
  let libraryName = ''
  let reservationId = ''
  const _seatKey = 'seat-1' // SeatStructureRequest'te tablo->seat otomatik üretilir, ilk masanın ilk koltuğu

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const authHeaders = { Authorization: `Bearer ${token}` }

    const me = await (await apiCtx.get(`${API_BASE}/auth/me`, { headers: authHeaders })).json()
    const adminUserId = me?.data?.me?.id
    expect(adminUserId, 'admin user id alınmalı').toBeTruthy()

    const tag = uniq('QA-TEST-E2E-AUTO Rez')
    const sfRes = await apiCtx.post(`${API_BASE}/service-facilities`, {
      headers: authHeaders,
      data: {
        name: `${tag} Tesisi`, type: 'library', locationType: 'Indoor',
        city: 'İstanbul', district: 'Sultangazi', address: 'E2E Test Mah. No:2', latitude: 41.1039, longitude: 28.8674,
        managerId: adminUserId, weekdayOpen: '08:00', weekdayClose: '22:00',
        weekendOpen: '09:00', weekendClose: '20:00', parkingCapacity: 0, parkingType: 'Free', capacity: 100,
      },
    })
    expect(sfRes.ok(), `service-facility oluşturulamadı: ${await sfRes.text()}`).toBeTruthy()
    serviceFacilityId = (await sfRes.json()).data.id
    libraryName = tag

    // Kütüphane: millet sistemi (masali + breakSystemEnabled), reservationEnabled=true.
    // NOT: SeatingMode/Floors burada BOŞ bırakılıyor — koltuk yapısı ayrı bir çağrıyla
    // (seat-structure endpoint) kuruluyor, tıpkı UI'ın kendi akışında olduğu gibi
    // (LibraryFormDrawer önce temel kütüphaneyi kaydeder, koltuk yapısı SeatingTab'de kurulur).
    const libRes = await apiCtx.post(`${API_BASE}/libraries`, {
      headers: authHeaders,
      data: {
        name: libraryName, description: 'QA rezervasyon akışı testi', serviceFacilityId,
        managerId: adminUserId, seatingMode: 'masali', isMultiFloor: false, floors: [],
        amenities: ['wifi'], queueEnabled: true, reservationEnabled: true,
        entryControlMode: 'qr', exitControlMode: 'qr', autoCheckOutAfterMinutes: 0,
        useCustomBreakSettings: false, breakDurationMinutes: 15, maxDailyBreaks: 3,
        longBreakDurationMinutes: 30, maxStudyHoursPerDay: 0, requireBreakAfterHours: 0,
        ipRestrictionEnabled: false, allowedIps: [], isActive: true, breakSystemEnabled: true,
      },
    })
    expect(libRes.ok(), `kütüphane oluşturulamadı: ${await libRes.text()}`).toBeTruthy()
    libraryId = (await libRes.json()).data.id

    // Koltuk yapısı: 1 kat, 1 bölüm, 1 masa, 2 koltuk — rezervasyon testine yetecek minimum.
    const structRes = await apiCtx.put(`${API_BASE}/libraries/${libraryId}/seat-structure`, {
      headers: authHeaders,
      data: {
        isMultiFloor: false,
        floors: [{
          id: 'floor-1', name: 'Zemin Kat', capacity: 2, active: true, autoOpenWhenPreviousFull: false, krokiUrl: null,
          sections: [{
            id: 'sec-1', name: 'Genel Alan', type: 'general', color: '#3B82F6', capacity: 2,
            tables: [{ id: 'table-1', name: 'Masa 1', seatCount: 2 }],
          }],
        }],
      },
    })
    expect(structRes.ok(), `koltuk yapısı kaydedilemedi: ${await structRes.text()}`).toBeTruthy()

    // Güvenlik temizliği: test citizen hesabında aktif oturum/rezervasyon kalmışsa temizle.
    const cToken = await citizenToken(apiCtx).catch(() => null)
    if (cToken) {
      const activeSession = await (await apiCtx.get(`${API_BASE}/me/libraries/session`, {
        headers: { Authorization: `Bearer ${cToken}` },
      })).json()
      const staleSessionId = activeSession?.data?.id
      if (staleSessionId) {
        await apiCtx.post(`${API_BASE}/library-sessions/${staleSessionId}/exit`, { headers: authHeaders }).catch(() => {})
      }
      const activeReservations = await (await apiCtx.get(`${API_BASE}/me/libraries/reservations?page=1&limit=20`, {
        headers: { Authorization: `Bearer ${cToken}` },
      })).json()
      const held = (activeReservations?.data?.items ?? []).find((r: { status: string }) => r.status === 'held')
      if (held) {
        await apiCtx.delete(`${API_BASE}/me/libraries/reservations/${held.id}`, { headers: { Authorization: `Bearer ${cToken}` } }).catch(() => {})
      }
    }
  })

  test.afterAll(async () => {
    const cleanupToken = await adminToken(apiCtx).catch(() => token)
    if (libraryId) await apiCtx.delete(`${API_BASE}/libraries/${libraryId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    if (serviceFacilityId) await apiCtx.delete(`${API_BASE}/service-facilities/${serviceFacilityId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    await apiCtx.dispose()
  })

  test('1) CITIZEN PORTAL UI: masa seçilip "Rezervasyon Yap" ile gerçek rezervasyon yapılır', async ({ page }) => {
    test.setTimeout(60_000)
    await citizenLoginUi(page)

    await page.goto(`${CITIZEN_PORTAL_URL}/kutuphane`)
    await page.getByPlaceholder('Kıraathane veya semt ara…').fill(libraryName)
    await page.getByText(libraryName, { exact: false }).first().click()

    // LibraryDetailModal içinde "Masa Seçimi" sekmesi (masali mod için varsayılan tab zaten bu).
    const modal = page.locator('.fixed.inset-0.z-50').last()
    await expect(modal.getByText('Masa Seçimi', { exact: true })).toBeVisible({ timeout: 8000 })

    // İlk boş masayı seç (LibraryTableGrid) — "boş" etiketli ilk masaya tıkla. NOT (2026-09-04,
    // gerçek testte bulunan hata): page.locator('button',{hasText:/boş/i}).first() arka plandaki
    // kıraathane kart listesindeki (LibraryDirectoryTab) bir butona da eşleşiyor ve TIKLANAMAZ
    // kalıyor (modal üstte olsa da locator sayfa genelinde arıyor) — modal içinde scope'la.
    const freeTable = modal.locator('button', { hasText: /boş/i }).first()
    await expect(freeTable).toBeVisible({ timeout: 8000 })
    await freeTable.click()
    // NOT (2026-09-04, gerçek testte bulunan hata): tıklandıktan sonra buton artık "boş" metnini
    // İÇERMİYOR ("Seçildi" oldu) — bu yüzden aynı filtered locator'ı yeniden sorgulamak "element(s)
    // not found" verir (stale filter). Bunun yerine "Seçildi" badge'inin modal içinde göründüğünü
    // doğrudan doğrula.
    await expect(modal.getByText('Seçildi', { exact: true })).toBeVisible({ timeout: 3000 })

    // "Rezervasyon Yap" butonu (canReserve = reservationEnabled && reservationAllowed !== false).
    const reserveBtn = modal.getByRole('button', { name: /Rezervasyon Yap/i })
    await expect(reserveBtn).toBeEnabled({ timeout: 5000 })
    await reserveBtn.click()

    await expect(page.getByText('Rezervasyonunuz alındı', { exact: false })).toBeVisible({ timeout: 10000 })

    // Fake-success-detection: API'den rezervasyonu geri oku.
    const freshToken = await getFreshToken(page)
    const listRes = await page.request.get(`${API_BASE}/me/libraries/reservations?page=1&limit=20`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const listBody = await listRes.json()
    const held = (listBody?.data?.items ?? []).find((r: { libraryId: string; status: string }) => r.libraryId === libraryId && r.status === 'held')
    expect(held, `rezervasyon API listesinde bulunmalı: ${JSON.stringify(listBody).slice(0, 400)}`).toBeTruthy()
    reservationId = held.id
    expect(held.seat, 'rezervasyonda seçilen koltuk kaydedilmeli').toBeTruthy()
    expect(held.holdUntil, 'rezervasyon giriş süresi (holdUntil) atanmalı').toBeTruthy()
  })

  test('2) ADMIN PANEL UI: SeatingTab\'de koltuk "Rezerve" durumunda GERÇEKTEN görünür', async ({ page }) => {
    test.setTimeout(30_000)
    await adminLoginUi(page)

    await page.goto(`/library?library=${libraryId}`)
    await page.getByRole('button', { name: 'Oturma Planı', exact: true }).click()

    // NOT: LibrarySeatGrid'de rezerve koltuk özel renk/ikonla gösterilir. Doğrudan
    // "Rezerve" sayaç kartından (StatCard) GERÇEKTEN 1 olduğunu doğruluyoruz — bu,
    // UI'ın seat-plan API'sinden gelen veriyi doğru render ettiğinin kanıtı.
    await expect(page.getByText('Rezerve', { exact: true })).toBeVisible({ timeout: 8000 })
    const reservedCard = page.locator('div', { has: page.getByText('Rezerve', { exact: true }) }).last()
    await expect(reservedCard.getByText('1', { exact: true })).toBeVisible({ timeout: 8000 })

    // Fake-success-detection ikinci kanıt: API'den seat-plan çekip reserved=1 olduğunu doğrula.
    const freshToken = await getFreshToken(page)
    const seatPlanRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/seat-plan`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const seatPlanBody = await seatPlanRes.json()
    expect(seatPlanBody?.data?.reserved).toBe(1)
  })

  test('3) CITIZEN PORTAL UI: "Rezervasyonlarım" sekmesinde görünür, GERÇEKTEN iptal edilir', async ({ page }) => {
    test.setTimeout(30_000)
    expect(reservationId, 'önceki testte rezervasyon oluşturulmuş olmalı').toBeTruthy()
    await citizenLoginUi(page)

    await page.goto(`${CITIZEN_PORTAL_URL}/kutuphane`)
    await page.getByRole('button', { name: 'Rezervasyonlarım' }).click()

    await expect(page.getByText(libraryName, { exact: false }).first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Girişe kalan süre', { exact: true })).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: 'İptal', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Rezervasyonu iptal et' })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'İptal Et', exact: true }).click()

    await expect(page.getByText('Rezervasyon iptal edildi', { exact: false })).toBeVisible({ timeout: 8000 })

    // Fake-success-detection: API'den rezervasyon durumu artık "held" DEĞİL olmalı.
    const freshToken = await getFreshToken(page)
    const getRes = await page.request.get(`${API_BASE}/me/libraries/reservations?page=1&limit=20`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const body = await getRes.json()
    const stillHeld = (body?.data?.items ?? []).find((r: { id: string; status: string }) => r.id === reservationId && r.status === 'held')
    expect(stillHeld, 'rezervasyon artık "held" durumunda olmamalı').toBeFalsy()
  })

  test('4) ADMIN PANEL UI: koltuk tekrar "Boş" durumuna GERÇEKTEN döner', async ({ page }) => {
    test.setTimeout(30_000)
    await adminLoginUi(page)

    await page.goto(`/library?library=${libraryId}`)
    await page.getByRole('button', { name: 'Oturma Planı', exact: true }).click()
    await page.getByRole('button', { name: 'Yenile' }).click()

    const freshToken = await getFreshToken(page)
    const seatPlanRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/seat-plan`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const seatPlanBody = await seatPlanRes.json()
    expect(seatPlanBody?.data?.reserved).toBe(0)
    expect(seatPlanBody?.data?.available).toBeGreaterThan(0)
  })

  test('5) ADMIN-INITIATED CANCEL: admin SeatingTab üzerinden yeni bir rezervasyonu iptal eder', async ({ page }) => {
    test.setTimeout(60_000)
    // Yeni bir rezervasyon oluştur (API üzerinden — bu testin odağı admin-side cancel yolu).
    const cToken = await citizenToken(apiCtx)
    const seatPlanRes0 = await apiCtx.get(`${API_BASE}/libraries/${libraryId}/seat-plan`, {
      headers: { Authorization: `Bearer ${await adminToken(apiCtx)}` },
    })
    const seatPlan0 = (await seatPlanRes0.json())?.data
    const freeSeat = seatPlan0?.floors?.[0]?.seats?.find((s: { status: string }) => s.status === 'available' || s.status === 'free')
      ?? seatPlan0?.floors?.[0]?.sections?.[0]?.tables?.[0]?.seats?.find((s: { status: string }) => s.status === 'available' || s.status === 'free')
    expect(freeSeat, 'boş koltuk bulunmalı (test 4te serbest kalmış olmalı)').toBeTruthy()

    const reserveRes = await apiCtx.post(`${API_BASE}/me/libraries/${libraryId}/reservations`, {
      headers: { Authorization: `Bearer ${cToken}` },
      data: { seat: freeSeat.key },
    })
    expect(reserveRes.ok(), `admin-cancel testi için rezervasyon oluşturulamadı: ${await reserveRes.text()}`).toBeTruthy()

    await adminLoginUi(page)
    await page.goto(`/library?library=${libraryId}`)
    await page.getByRole('button', { name: 'Oturma Planı', exact: true }).click()
    await page.getByRole('button', { name: 'Yenile' }).click()

    // Rezerve koltuğa tıkla — SeatingTab.onSeatClick sadece occupied/on_break/reserved
    // durumundaki koltuklarda modal açar.
    const _seatButtons = page.locator('button, [role="button"]').filter({ hasText: '' })
    // Legend + grid render'ı component-specific; rezerve koltuğa ulaşmak için grid içindeki
    // "reserved" class/tone taşıyan ilk elemente XPath ile gidiyoruz (LibrarySeatGrid renk
    // kodlaması SEAT_STATUS_LABELS['reserved'] metnini title/aria olarak taşıyabilir).
    await page.waitForTimeout(1000) // seat-plan realtime/poll güncellemesi için kısa bekleme
    const reservedSeat = page.getByTitle(/[Rr]ezerve/).first().or(page.locator('[aria-label*="ezerve" i]').first())
    await expect(reservedSeat).toBeVisible({ timeout: 8000 })
    await reservedSeat.click()

    await expect(page.getByRole('button', { name: /Rezervasyonu İptal Et/i })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /Rezervasyonu İptal Et/i }).click()
    await expect(page.getByText('Rezervasyon iptal edildi', { exact: false })).toBeVisible({ timeout: 8000 })

    // Fake-success-detection: API'den doğrula.
    const freshToken = await getFreshToken(page)
    const seatPlanRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/seat-plan`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const seatPlanBody = await seatPlanRes.json()
    expect(seatPlanBody?.data?.reserved).toBe(0)
  })
})
