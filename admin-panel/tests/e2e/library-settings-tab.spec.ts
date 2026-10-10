/**
 * Kütüphane — Ayarlar sekmesi (Puan, Mola, Sıra & Rezervasyon kuralları), sıfır hata.
 *
 * Kullanıcı isteği (2026-09-04): "sıfır hata istiyorum." Kütüphane, kullanıcının flagship
 * modülü olarak belirlendi — bu test, önceki oturumda dokümante edilen bilinen bir boşluğu
 * kapatıyor (SettingsTab.tsx hiç UI'dan test edilmemişti, bkz. library-full-lifecycle.spec.ts
 * dosya başlığındaki "Kapsanmayan" listesi).
 *
 * Kapsam: SettingsTab.tsx'in TÜM alanları (millet sistem türü kullanılarak break/reservation
 * bölümlerinin TAMAMI görünür kılınıyor) — Puan Ayarları (4 alan), Giriş Kısıtlaması (2 alan),
 * Mola & Çalışma Kuralları (12 alan + saatlik mola alt-bölümü 2 alan), Sıra & Rezervasyon
 * (5 alan, 2'si DurationInput saat+dakika çifti). Her switch açılıp KOŞULLU alanların
 * göründüğü doğrulanıyor, tüm sayısal alanlar dolduruluyor, kayıt sonrası API'den TAM
 * doğrulanıyor.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { setSwitchRow, fillNumberField } from './helpers/designSystemControls'

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

test.describe('Kütüphane — Ayarlar sekmesi (Puan/Mola/Sıra&Rezervasyon), sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let token = ''
  let serviceFacilityId = ''
  let libraryId = ''
  const tag = `QA-TEST-E2E-AUTO Ayarlar ${Date.now()}`

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const me = await (await apiCtx.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).json()
    const adminUserId = me?.data?.me?.id

    const sfRes = await apiCtx.post(`${API_BASE}/service-facilities`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `${tag} Tesisi`, type: 'library', locationType: 'Indoor',
        city: 'İstanbul', district: 'Sultangazi', address: 'E2E Test Mah. No:1', latitude: 41.1039, longitude: 28.8674,
        managerId: adminUserId, weekdayOpen: '08:00', weekdayClose: '22:00',
        weekendOpen: '09:00', weekendClose: '20:00', parkingCapacity: 0, parkingType: 'Free', capacity: 100,
      },
    })
    expect(sfRes.ok(), `service-facility oluşturulamadı: ${await sfRes.text()}`).toBeTruthy()
    serviceFacilityId = (await sfRes.json()).data.id

    // "millet" (tam sistem) türünde kütüphane — Ayarlar sekmesinin TÜM bölümleri (mola,
    // rezervasyon) sadece bu türde koşulsuz görünür (bkz. SettingsTab.tsx breakSystemEnabled
    // varsayılan true, ama reservationEnabled formda seçilmiş olmalı ki anlamlı olsun).
    const libRes = await apiCtx.post(`${API_BASE}/libraries`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: tag, serviceFacilityId, seatingMode: 'masali', breakSystemEnabled: true,
        queueEnabled: true, reservationEnabled: true, entryControlMode: 'qr', exitControlMode: 'qr',
        autoCheckOutAfterMinutes: '0', amenities: [], isActive: true, isMultiFloor: false, floors: [],
        ipRestrictionEnabled: false, allowedIps: [], geofenceEnabled: false, geofenceRadiusMeters: '150',
      },
    })
    expect(libRes.ok(), `kütüphane oluşturulamadı: ${await libRes.text()}`).toBeTruthy()
    libraryId = (await libRes.json()).data.id
  })

  test.afterAll(async () => {
    const cleanupToken = await adminToken(apiCtx).catch(() => token)
    if (libraryId) await apiCtx.delete(`${API_BASE}/libraries/${libraryId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    if (serviceFacilityId) await apiCtx.delete(`${API_BASE}/service-facilities/${serviceFacilityId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    await apiCtx.dispose()
  })

  test('Puan + Mola + Sıra&Rezervasyon ayarları TÜM alanlarıyla kaydediliyor, sıfır hata', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)

    await page.goto(`/library?library=${libraryId}`)
    await page.getByRole('button', { name: 'Ayarlar', exact: true }).click()
    await expect(page.getByText('Puan Ayarları', { exact: true })).toBeVisible({ timeout: 8000 })

    // ---- Puan Ayarları ----
    await setSwitchRow(page, 'Puan sistemi aktif', true)
    await fillNumberField(page.locator('body'), 'Ziyaret Başı Puan', 5)
    await fillNumberField(page.locator('body'), 'Günlük Puan Tavanı', 20)
    await fillNumberField(page.locator('body'), 'Haftalık Puan Tavanı', 100)
    await setSwitchRow(page, 'QR ile giriş zorunlu', true)
    await setSwitchRow(page, 'Hem giriş hem çıkış kaydı gerekli', true)

    // ---- Giriş Kısıtlaması ----
    await fillNumberField(page.locator('body'), 'Günlük Ziyaret Limiti', 2)
    await setSwitchRow(page, 'Gecikmiş kitabı olan üyenin girişini engelle', true)

    // ---- Mola & Çalışma Kuralları ----
    // breakSystemEnabled varsayılan true — açık bırakıp alt alanların TAMAMINI dolduruyoruz.
    await fillNumberField(page.locator('body'), 'Standart Mola', 20)
    await fillNumberField(page.locator('body'), 'Günlük Max Mola', 4)
    await fillNumberField(page.locator('body'), 'Uzun Mola Süresi', 45)
    await fillNumberField(page.locator('body'), 'Kısa Mola Bekleme Süresi', 60)
    await fillNumberField(page.locator('body'), 'Günlük Max Uzun Mola', 1)
    await fillNumberField(page.locator('body'), 'Günlük Max Çalışma', 8)
    await fillNumberField(page.locator('body'), 'Zorunlu Mola Sonrası', 3)
    await fillNumberField(page.locator('body'), 'Moladan Dönüş Süresi', 10)
    await fillNumberField(page.locator('body'), 'Giriş Sonrası Mola Bekleme', 15)
    await fillNumberField(page.locator('body'), 'Max Oturum Süresi', 480)
    await fillNumberField(page.locator('body'), 'Min. Çıkış Süresi', 5)

    await setSwitchRow(page, 'Saat başı mola sistemi', true)
    await fillNumberField(page.locator('body'), 'Her saat için mola', 5)
    await fillNumberField(page.locator('body'), 'Günlük Max Mola (saatlik)', 6)

    // ---- Sıra & Rezervasyon ----
    await setSwitchRow(page, 'Otomatik Sıra Çağrısı', true)
    await fillNumberField(page.locator('body'), 'Sıra Çağrı Penceresi', 10)
    await fillNumberField(page.locator('body'), 'Otomatik Çıkış Süresi', 30)
    await fillNumberField(page.locator('body'), 'Günlük Rezervasyon Limiti', 3)

    // DurationInput'lar (saat + dakika iki ayrı NumberInput). Field label'ından itibaren
    // en yakın iki input'u sırayla dolduruyoruz.
    const reservationHoldField = page.locator('div.space-y-1\\.5', { has: page.getByText('Rezervasyon Giriş Süresi', { exact: true }) })
    const reservationInputs = reservationHoldField.locator('input')
    await reservationInputs.nth(0).fill('1') // saat
    await reservationInputs.nth(1).fill('30') // dakika

    const walkInField = page.locator('div.space-y-1\\.5', { has: page.getByText('Yer Seçip Giriş Bekleme Süresi (Walk-in)', { exact: true }) })
    const walkInInputs = walkInField.locator('input')
    await walkInInputs.nth(0).fill('0')
    await walkInInputs.nth(1).fill('15')

    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('Ayarlar kaydedildi', { exact: false })).toBeVisible({ timeout: 10000 })

    // Fake-success-detection: API'den geri oku, TÜM alanları doğrula.
    const freshToken = await getFreshToken(page)
    const settingsRes = await page.request.get(`${API_BASE}/library-settings?libraryId=${libraryId}`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const s = (await settingsRes.json())?.data
    expect(s, 'ayarlar API\'den okunabilmeli').toBeTruthy()

    expect(s.pointsEnabled).toBe(true)
    expect(s.pointsPerVisit).toBe(5)
    expect(s.dailyPointCap).toBe(20)
    expect(s.weeklyPointCap).toBe(100)
    expect(s.qrRequired).toBe(true)
    expect(s.requiresEntryAndExit).toBe(true)
    expect(s.dailyVisitCap).toBe(2)
    expect(s.blockEntryOnOverdue).toBe(true)
    expect(s.breakDurationMinutes).toBe(20)
    expect(s.maxDailyBreaks).toBe(4)
    expect(s.longBreakDurationMinutes).toBe(45)
    expect(s.shortBreakCooldownMinutes).toBe(60)
    expect(s.maxDailyLongBreaks).toBe(1)
    expect(s.maxStudyHoursPerDay).toBe(8)
    expect(s.requireBreakAfterHours).toBe(3)
    expect(s.breakReturnGraceMinutes).toBe(10)
    expect(s.minEntryBeforeBreakMinutes).toBe(15)
    expect(s.maxSessionMinutes).toBe(480)
    expect(s.minCheckoutAfterMinutes).toBe(5)
    expect(s.hourlyBreakEnabled).toBe(true)
    expect(s.hourlyBreakMinutesPerHour).toBe(5)
    expect(s.hourlyBreakMaxPerDay).toBe(6)
    expect(s.autoQueueCallEnabled).toBe(true)
    expect(s.queueCallWindowMinutes).toBe(10)
    expect(s.autoCheckOutAfterMinutes).toBe(30)
    expect(s.dailyReservationLimitPerLibrary).toBe(3)
    expect(s.reservationHoldWindowMinutes).toBe(90) // 1 saat 30 dk
    expect(s.walkInHoldMinutes).toBe(15) // 0 saat 15 dk
  })
})
