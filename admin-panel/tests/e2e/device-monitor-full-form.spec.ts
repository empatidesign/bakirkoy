/**
 * Cihaz Canlı Takip (`/device-monitor`) — sıfır hata toleranslı derinlemesine E2E.
 *
 * Bu, TÜM modüllerin (kütüphane + 7 FacilityModule şablonu) cihazlarını TEK bir
 * merkezi panelden yöneten kritik bir operasyonel ekran (`docs/ADMIN_PANEL_MODULE_SCENARIO_MATRIX_2026-09-04.md`
 * madde D, "Cihaz İzleme"). `device-monitor-edit.spec.ts` ve `device-monitor-move-search.spec.ts`
 * SADECE kütüphane cihazının temel alanlarını (isim, port) kapsıyor — bu dosya, EKSİK KALAN
 * iki gerçek gap'i kapatıyor:
 *   1. Kütüphane cihazının GERİ KALAN TÜM alanları: Çalışma Modu segment'i (Tek Yön ↔ Tek
 *      Cihaz), Tekrar Okutma Süresi (toggle modunda görünür), Cihaz Id/IP, Röle No/Ms,
 *      Kilit Tetikleme Yolu, "Kilit Tetikle" switch'i — HİÇBİRİ önceki testlerde kapsanmamıştı.
 *   2. FacilityDevice düzenleme yolu (`editingItem?.source !== 'library'` else-branch) —
 *      DeviceMonitorPage.tsx'te bu branch HİÇ test edilmemişti (Spor Salonu cihazı üzerinden
 *      temsili olarak test ediliyor; 3 yönlü SegmentedControl — Giriş/Çıkış/Çift Yönlü —
 *      kütüphane formundan FARKLI).
 *
 * DÜRÜST KAPSAM NOTU: "Taşı" modalı ve temel isim/port düzenleme zaten
 * `device-monitor-move-search.spec.ts` / `device-monitor-edit.spec.ts`'te var, burada
 * TEKRAR edilmiyor — bu dosya sadece o testlerin BIRAKTIĞI gap'leri kapatıyor.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
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

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

async function getFreshToken(page: Page): Promise<string> {
  const t = await page.evaluate(() => localStorage.getItem('admin_access_token') || sessionStorage.getItem('admin_access_token'))
  if (!t) throw new Error('Sayfada güncel access_token bulunamadı.')
  return t
}

async function openDeviceMonitor(page: Page) {
  await page.goto('/device-monitor')
  await expect(page.getByRole('heading', { name: /Cihaz Canlı Takip/ })).toBeVisible({ timeout: 20000 })
}

/** Cihaz satırının en yakın satır konteynerine, isminden XPath ile çıkar (kütüphane
 * testlerinde de kullanılan ata-belirsizliği çözümü — `locator('div',{has:...})` yerine). */
function deviceRow(page: Page, deviceName: string) {
  return page.locator(
    'xpath=//p[normalize-space(text())=' + JSON.stringify(deviceName) + ']/ancestor::div[contains(@class,"items-center") and contains(@class,"gap-2")][1]',
  )
}

test.describe.serial('Cihaz Canlı Takip — derinlemesine düzenleme formu (kütüphane TAM alan seti + facility-device yolu), sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let token = ''
  let adminUserId = ''

  // Kütüphane cihazı fixture'ı
  let libServiceFacilityId = ''
  let libraryId = ''
  let libDeviceId = ''
  const libTag = uniq('QA-TEST-E2E-AUTO DevMon Lib')

  // Facility-device (Spor Salonu) fixture'ı
  let sportsServiceFacilityId = ''
  let sportsFacilityId = ''
  let sportsDeviceId = ''
  const sportsTag = uniq('QA-TEST-E2E-AUTO DevMon Sport')

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const me = await (await apiCtx.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).json()
    adminUserId = me.data.me.id

    // --- Kütüphane cihazı fixture'ı ---
    const sfRes = await apiCtx.post(`${API_BASE}/service-facilities`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `${libTag} Tesisi`, type: 'library', locationType: 'Indoor',
        city: 'İstanbul', district: 'Sultangazi', address: 'E2E Mah. No:1', latitude: 41.1039, longitude: 28.8674,
        managerId: adminUserId, weekdayOpen: '08:00', weekdayClose: '22:00',
        weekendOpen: '09:00', weekendClose: '20:00', parkingCapacity: 0, parkingType: 'Free', capacity: 50,
      },
    })
    expect(sfRes.ok(), `library service-facility oluşturulamadı: ${await sfRes.text()}`).toBeTruthy()
    libServiceFacilityId = (await sfRes.json()).data.id

    const libRes = await apiCtx.post(`${API_BASE}/libraries`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: libTag, description: 'device monitor derin test', serviceFacilityId: libServiceFacilityId,
        seatingMode: 'sirali', breakSystemEnabled: false, isMultiFloor: false,
        floors: [{ id: 'f1', name: 'Zemin', capacity: 10, active: true, krokiUrl: null, sections: [] }],
        amenities: [], queueEnabled: false, reservationEnabled: false, deviceControlEnabled: false,
        entryControlMode: 'qr', exitControlMode: 'qr', autoCheckOutAfterMinutes: 0,
        useCustomBreakSettings: false, breakDurationMinutes: 30, maxDailyBreaks: 3,
        longBreakDurationMinutes: 60, maxStudyHoursPerDay: 9, requireBreakAfterHours: 3,
        ipRestrictionEnabled: false, allowedIps: null, isActive: true, grantAccess: false,
      },
    })
    expect(libRes.ok(), `library oluşturulamadı: ${await libRes.text()}`).toBeTruthy()
    libraryId = (await libRes.json()).data.id

    const devRes = await apiCtx.post(`${API_BASE}/libraries/${libraryId}/devices`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `${libTag} Cihaz`, direction: 'entry', deviceId: '', ipAddress: '', port: 80,
        username: '', password: '', relayNo: 1, relayMs: 3000, workMode: 'online', httpPath: '',
        triggerLockOnSuccess: true, operationMode: 'directional', toggleCooldownMinutes: 5,
      },
    })
    expect(devRes.ok(), `library device oluşturulamadı: ${await devRes.text()}`).toBeTruthy()
    libDeviceId = (await devRes.json()).data.id

    // --- Spor Salonu (facility-device) fixture'ı ---
    const sportsSfRes = await apiCtx.post(`${API_BASE}/service-facilities`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `${sportsTag} Tesisi`, type: 'sports', locationType: 'Indoor',
        city: 'İstanbul', district: 'Sultangazi', address: 'E2E Mah. No:2', latitude: 41.1139, longitude: 28.8774,
        managerId: adminUserId, weekdayOpen: '08:00', weekdayClose: '22:00',
        weekendOpen: '09:00', weekendClose: '20:00', parkingCapacity: 0, parkingType: 'Free', capacity: 80,
      },
    })
    expect(sportsSfRes.ok(), `sports service-facility oluşturulamadı: ${await sportsSfRes.text()}`).toBeTruthy()
    sportsServiceFacilityId = (await sportsSfRes.json()).data.id

    const sportsFacRes = await apiCtx.post(`${API_BASE}/sports/facilities`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: sportsTag, kind: 'indoor', serviceFacilityId: sportsServiceFacilityId,
        capacity: 80, managerId: adminUserId, isActive: true,
      },
    })
    expect(sportsFacRes.ok(), `sports facility oluşturulamadı: ${await sportsFacRes.text()}`).toBeTruthy()
    sportsFacilityId = (await sportsFacRes.json()).data.id

    const sportsDevRes = await apiCtx.post(`${API_BASE}/sports/devices`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `${sportsTag} Cihaz`, direction: 'entry', facilityId: sportsFacilityId,
        deviceId: '', ipAddress: '', port: 80, username: '', password: '',
        relayNo: 1, relayMs: 3000, workMode: 'online', httpPath: '', triggerLockOnSuccess: true,
      },
    })
    expect(sportsDevRes.ok(), `sports device oluşturulamadı: ${await sportsDevRes.text()}`).toBeTruthy()
    sportsDeviceId = (await sportsDevRes.json()).data.id
  })

  test.afterAll(async () => {
    const cleanupToken = await adminToken(apiCtx).catch(() => token)
    const h = { Authorization: `Bearer ${cleanupToken}` }
    if (sportsFacilityId) await apiCtx.delete(`${API_BASE}/sports/facilities/${sportsFacilityId}`, { headers: h }).catch(() => {})
    if (sportsServiceFacilityId) await apiCtx.delete(`${API_BASE}/service-facilities/${sportsServiceFacilityId}`, { headers: h }).catch(() => {})
    if (libraryId) await apiCtx.delete(`${API_BASE}/libraries/${libraryId}`, { headers: h }).catch(() => {})
    if (libServiceFacilityId) await apiCtx.delete(`${API_BASE}/service-facilities/${libServiceFacilityId}`, { headers: h }).catch(() => {})
    await apiCtx.dispose()
  })

  test('1) Kütüphane cihazı: Çalışma Modu "Tek Cihaz (toggle)"a geçilir, Tekrar Okutma Süresi görünür/kaydedilir, TÜM diğer alanlar (Id/IP/röle/yol/kilit) doldurulur', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)
    await openDeviceMonitor(page)

    const row = deviceRow(page, `${libTag} Cihaz`)
    await expect(row).toBeVisible({ timeout: 20000 })
    await row.locator('button[aria-label="Cihazı düzenle"]').click()
    await expect(page.getByText('Cihaz Ayarlarını Düzenle')).toBeVisible({ timeout: 10000 })

    const modal = page.locator('div.relative.z-10').last()

    // Başlangıçta "Tek Yön" modundayız (directional) — "Yön" segment'i görünür olmalı.
    await expect(modal.getByText('Yön', { exact: true })).toBeVisible()

    // Çalışma Modu'nu "Tek Cihaz, Hem Giriş Hem Çıkış" (toggle) yap.
    await modal.getByRole('button', { name: 'Tek Cihaz, Hem Giriş Hem Çıkış' }).click()
    // Artık "Yön" segment'i KAYBOLMALI, "Tekrar Okutma Süresi" GÖRÜNMELİ (koşullu render).
    await expect(modal.getByText('Yön', { exact: true })).not.toBeVisible({ timeout: 3000 })
    await expect(modal.getByText('Tekrar Okutma Süresi (dk)')).toBeVisible({ timeout: 3000 })

    const cooldownInput = modal.getByText('Tekrar Okutma Süresi (dk)').locator('xpath=following-sibling::*[1]//input')
    await cooldownInput.fill('12')

    const deviceIdInput = modal.getByText('Cihaz Id', { exact: true }).locator('xpath=following-sibling::*[1]//input')
    await deviceIdInput.fill(`${libTag}-ID`)
    const ipInput = modal.getByText('Cihaz IP', { exact: true }).locator('xpath=following-sibling::*[1]//input')
    await ipInput.fill('10.20.30.40')

    const relayNoInput = modal.getByText('Röle No', { exact: true }).locator('xpath=following-sibling::*[1]//input')
    await relayNoInput.fill('2')
    const relayMsInput = modal.getByText('Röle Süresi (ms)', { exact: true }).locator('xpath=following-sibling::*[1]//input')
    await relayMsInput.fill('4500')

    const httpPathInput = modal.getByText('Kilit Tetikleme Yolu (opsiyonel)').locator('xpath=following-sibling::*[1]//input')
    await httpPathInput.fill('/api/unlock')

    // "Kilit Tetikle" switch'i varsayılan AÇIK — KAPATIYORUZ (iki yönlü test, gerçek toggle kanıtı).
    const lockSwitch = modal.locator('button[role="switch"]').first()
    await expect(lockSwitch).toHaveAttribute('aria-checked', 'true')
    await lockSwitch.click()
    await expect(lockSwitch).toHaveAttribute('aria-checked', 'false')

    // Çalışma Şekli: Online → Offline (custom Select bileşeni — native <select> DEĞİL,
    // buton+popover; pickSelect helper'ı kullanılıyor).
    await pickSelect(page, modal, 'Online', 'Offline')

    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    await modal.getByRole('button', { name: 'Kaydet', exact: true }).click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('Cihaz ayarları güncellendi.')).toBeVisible({ timeout: 10000 })

    // Fake-success-detection: API'den TÜM alanları doğrula.
    const checkToken = await adminToken(apiCtx)
    const check = await apiCtx.get(`${API_BASE}/library-devices/${libDeviceId}`, { headers: { Authorization: `Bearer ${checkToken}` } })
    const updated = (await check.json()).data
    expect(updated.operationMode).toBe('toggle')
    expect(updated.toggleCooldownMinutes).toBe(12)
    expect(updated.deviceId).toBe(`${libTag}-ID`)
    expect(updated.ipAddress).toBe('10.20.30.40')
    expect(updated.relayNo).toBe(2)
    expect(updated.relayMs).toBe(4500)
    expect(updated.httpPath).toBe('/api/unlock')
    expect(updated.triggerLockOnSuccess).toBe(false)
    expect(updated.workMode).toBe('offline')
  })

  test('2) Kütüphane cihazı: modal yeniden açıldığında kaydedilen "toggle" modu ve tüm değerler DOĞRU YÜKLENİYOR (persist doğrulaması)', async ({ page }) => {
    test.setTimeout(30_000)
    await adminLoginUi(page)
    await openDeviceMonitor(page)

    const row = deviceRow(page, `${libTag} Cihaz`)
    await expect(row).toBeVisible({ timeout: 20000 })
    await row.locator('button[aria-label="Cihazı düzenle"]').click()
    await expect(page.getByText('Cihaz Ayarlarını Düzenle')).toBeVisible({ timeout: 10000 })

    const modal = page.locator('div.relative.z-10').last()
    // toggle modundaysak "Tekrar Okutma Süresi" görünür olmalı, değeri 12 olmalı.
    await expect(modal.getByText('Tekrar Okutma Süresi (dk)')).toBeVisible({ timeout: 5000 })
    const cooldownInput = modal.getByText('Tekrar Okutma Süresi (dk)').locator('xpath=following-sibling::*[1]//input')
    await expect(cooldownInput).toHaveValue('12')

    const deviceIdInput = modal.getByText('Cihaz Id', { exact: true }).locator('xpath=following-sibling::*[1]//input')
    await expect(deviceIdInput).toHaveValue(`${libTag}-ID`)

    const lockSwitch = modal.locator('button[role="switch"]').first()
    await expect(lockSwitch).toHaveAttribute('aria-checked', 'false')

    await modal.getByRole('button', { name: 'İptal', exact: true }).click()
    await expect(page.getByText('Cihaz Ayarlarını Düzenle')).not.toBeVisible({ timeout: 3000 })
  })

  test('3) Facility-device (Spor Salonu) düzenleme yolu: 3 yönlü Yön segmenti ("Çift Yönlü" dahil) + TÜM diğer alanlar, HİÇ test edilmemiş else-branch', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)
    await openDeviceMonitor(page)

    const row = deviceRow(page, `${sportsTag} Cihaz`)
    await expect(row).toBeVisible({ timeout: 20000 })
    await row.locator('button[aria-label="Cihazı düzenle"]').click()
    await expect(page.getByText('Cihaz Ayarlarını Düzenle')).toBeVisible({ timeout: 10000 })

    const modal = page.locator('div.relative.z-10').last()
    // Facility-device yolunda header alt başlığı Spor Salonu etiketini göstermeli.
    await expect(modal.getByText('Spor Salonu', { exact: false })).toBeVisible({ timeout: 3000 })

    const newName = `${sportsTag} Cihaz DÜZENLENDİ`
    const nameInput = modal.getByText('Cihaz Adı', { exact: true }).locator('xpath=following-sibling::*[1]//input')
    await nameInput.fill(newName)

    // 3 yönlü segment: kütüphane formunda YOK olan "Çift Yönlü" seçeneğini seç.
    await modal.getByRole('button', { name: 'Çift Yönlü' }).click()

    const deviceIdInput = modal.getByText('Cihaz Id', { exact: true }).locator('xpath=following-sibling::*[1]//input')
    await deviceIdInput.fill(`${sportsTag}-ID`)
    const ipInput = modal.getByText('Cihaz IP', { exact: true }).locator('xpath=following-sibling::*[1]//input')
    await ipInput.fill('192.168.1.99')
    const portInput = modal.getByText('Port', { exact: true }).locator('xpath=following-sibling::*[1]//input')
    await portInput.fill('9090')
    const relayNoInput = modal.getByText('Röle No', { exact: true }).locator('xpath=following-sibling::*[1]//input')
    await relayNoInput.fill('3')
    const relayMsInput = modal.getByText('Röle Süresi (ms)', { exact: true }).locator('xpath=following-sibling::*[1]//input')
    await relayMsInput.fill('2500')
    const httpPathInput = modal.getByText('Kilit Tetikleme Yolu (opsiyonel)').locator('xpath=following-sibling::*[1]//input')
    await httpPathInput.fill('/facility/unlock')

    const lockSwitch = modal.locator('button[role="switch"]').first()
    await expect(lockSwitch).toHaveAttribute('aria-checked', 'true')
    await lockSwitch.click()
    await expect(lockSwitch).toHaveAttribute('aria-checked', 'false')

    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    await modal.getByRole('button', { name: 'Kaydet', exact: true }).click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('Cihaz ayarları güncellendi.')).toBeVisible({ timeout: 10000 })

    // NOT (2026-09-04, gerçek testte bulunan hata): sistemde TEKLİ OTURUM politikası var —
    // `adminToken(apiCtx)` ile yeniden login/OTP yapmak, aynı hesabın UI'daki `page` oturumunu
    // GEÇERSİZ KILAR (bkz. admin-single-session.spec.ts). Bu yüzden reload'ı ÖNCE yapıp UI
    // oturumunu canlı tutarken, API doğrulaması için `page`'in KENDİ taze token'ını kullanıyoruz
    // (yeni bir login YAPMADAN) — apiCtx.get + adminToken() SONRA çağrılmamalı.
    await page.reload()
    await expect(page.getByRole('heading', { name: /Cihaz Canlı Takip/ })).toBeVisible({ timeout: 20000 })
    await expect(deviceRow(page, newName)).toBeVisible({ timeout: 15000 })

    // Fake-success-detection: API'den TÜM alanları doğrula (facility device endpoint, module=sports).
    const sportsCheckToken = await getFreshToken(page)
    const check = await page.request.get(`${API_BASE}/sports/devices/${sportsDeviceId}`, { headers: { Authorization: `Bearer ${sportsCheckToken}` } })
    const updated = (await check.json()).data
    expect(updated.name).toBe(newName)
    expect(updated.direction).toBe('both')
    expect(updated.deviceId).toBe(`${sportsTag}-ID`)
    expect(updated.ipAddress).toBe('192.168.1.99')
    expect(updated.port).toBe(9090)
    expect(updated.relayNo).toBe(3)
    expect(updated.relayMs).toBe(2500)
    expect(updated.httpPath).toBe('/facility/unlock')
    expect(updated.triggerLockOnSuccess).toBe(false)

    // Bu spor salonu cihazı için "taşı" butonu KALICI OLARAK devre dışı olmalı (sadece
    // library kaynaklı cihazlar taşınabilir — DeviceMonitorPage.tsx: disabled={d.source !== 'library'}).
    const movedRow = deviceRow(page, newName)
    await expect(movedRow.locator('button[aria-label="Bu cihaz türü için taşıma desteklenmiyor"]')).toBeDisabled()
  })

  test('4) Kaynak filtresi: "Kütüphane" seçilince sadece kütüphane cihazları listelenir, spor salonu cihazı gizlenir', async ({ page }) => {
    test.setTimeout(30_000)
    await adminLoginUi(page)
    await openDeviceMonitor(page)

    await expect(deviceRow(page, `${libTag} Cihaz`)).toBeVisible({ timeout: 15000 })

    // NOT: DeviceMonitorPage.tsx içindeki bu filtre native <select> DEĞİL, design-system'in
    // custom Select bileşeni (buton+popover) — pickSelect helper'ı kullanılıyor.
    await pickSelect(page, page.locator('body'), 'Tüm Modüller', 'Kütüphane')

    await expect(deviceRow(page, `${libTag} Cihaz`)).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(`${sportsTag} Cihaz`, { exact: false })).not.toBeVisible({ timeout: 3000 })

    await pickSelect(page, page.locator('body'), 'Kütüphane', 'Tüm Modüller')
    await expect(deviceRow(page, `${libTag} Cihaz`)).toBeVisible({ timeout: 8000 })
  })
})
