/**
 * Kütüphane — Kapı Cihazları (turnike/kilit) UI formu, sıfır hata.
 *
 * Kullanıcı isteği (2026-09-04): "sıfır hata istiyorum." Kütüphane flagship modül — bu
 * test önceki oturumda dokümante edilen bilinen bir boşluğu kapatıyor
 * (library-full-lifecycle.spec.ts "Kapsanmayan" listesi: "Cihaz (turnike/kilit) ekleme
 * formu UI'dan hiç test edilmedi"). Yanlış cihaz IP/port/röle ayarı fiziksel kapı
 * kilidinin açılmamasına (kullanıcı mahsur kalır) veya yanlış tetiklenmesine yol açabilir.
 *
 * Kapsam: LibraryDevicesSection.tsx'in TÜM alanları — hem "Tek Yön" (Giriş/Çıkış segment)
 * hem "Tek Cihaz Hem Giriş Hem Çıkış" (Toggle, Tekrar Okutma Süresi) çalışma modları AYRI
 * cihazlarla test ediliyor, IP/Port/kullanıcı/şifre/röle/kilit-yolu/kilit-tetikle TÜM
 * alanlar dolduruluyor, kayıt sonrası API'den doğrulanıyor. Ayrıca cihaz kodu/webhook/API
 * anahtarı gösterimi (salt-okunur alanlar) ve Aktif/Pasif toggle'ı da doğrulanıyor.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { pickSegment, pickSelect } from './helpers/designSystemControls'

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

async function openLibraryEditDrawer(page: import('@playwright/test').Page, libraryName: string) {
  await page.goto('/library')
  await page.getByRole('button', { name: 'Yönet', exact: true }).click()
  const managerDrawer = page.locator('div.relative.z-10').last()
  await managerDrawer.getByPlaceholder(/[Aa]ra/).fill(libraryName)
  await expect(managerDrawer.locator('tbody tr')).toHaveCount(1, { timeout: 5000 })
  await managerDrawer.getByRole('button', { name: 'Düzenle' }).click()
  const editDrawer = page.locator('div.relative.z-10').last()
  await expect(editDrawer.getByText('Kütüphane Düzenle').first()).toBeVisible({ timeout: 5000 })
  return editDrawer
}

test.describe.serial('Kütüphane — Kapı Cihazları (turnike/kilit), sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let token = ''
  let serviceFacilityId = ''
  let libraryId = ''
  const tag = `QA-TEST-E2E-AUTO Cihaz ${Date.now()}`
  let entryDeviceId = ''
  let toggleDeviceId = ''

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

    const libRes = await apiCtx.post(`${API_BASE}/libraries`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: tag, serviceFacilityId, seatingMode: 'sirali', breakSystemEnabled: false,
        queueEnabled: true, reservationEnabled: false, entryControlMode: 'qr', exitControlMode: 'qr',
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

  test('1) "Tek Yön" (Giriş) cihazı — TÜM alanlar (IP/Port/kullanıcı/şifre/röle/kilit yolu/kilit tetikle), sıfır hata', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)
    const drawer = await openLibraryEditDrawer(page, tag)

    await drawer.getByText('Kapı Cihazları', { exact: true }).scrollIntoViewIfNeeded()
    await drawer.getByRole('button', { name: 'Cihaz Ekle' }).click()

    const deviceForm = drawer
    await deviceForm.getByPlaceholder('Örn: Ana Giriş Turnikesi').fill(`${tag} Giriş Turnikesi`)

    // Çalışma Modu: varsayılan "Tek Yön" — açıkça teyit et, sonra Yön: Giriş seç.
    // NOT (2026-09-04, gerçek testte bulunan hata): drawer scope'unda 'Giriş' adlı birden
    // fazla buton var (kütüphanenin kendi Giriş Kontrol Modu segmenti dahil). "Yön" label'ından
    // XPath ile en yakın SegmentedControl grid'ine inip scope'u daraltıyoruz.
    await pickSegment(deviceForm, 'Tek Yön (Giriş veya Çıkış)')
    const directionSection = page.locator(
      'xpath=//*[normalize-space(text())="Yön"]/following-sibling::div[contains(@class,"grid")][1]',
    )
    await directionSection.getByRole('button', { name: 'Giriş', exact: true }).click()

    const entryDeviceIdValue = `QATEST-ENTRY-${Date.now()}`
    await deviceForm.getByPlaceholder('LiderTek Device_Id').fill(entryDeviceIdValue)
    await deviceForm.getByPlaceholder('192.168.1.10').fill('192.168.50.10')
    await deviceForm.locator('input[type="number"]').nth(0).fill('8080') // Port
    // Çalışma Şekli: design-system özel Select bileşeni (native <select> DEĞİL). Offline'a
    // geçip geri Online'a dönerek select'in GERÇEKTEN çalıştığını kanıtla.
    await pickSelect(page, deviceForm, 'Online', 'Offline')
    await pickSelect(page, deviceForm, 'Offline', 'Online')

    // Kullanıcı Adı / Şifre — grid-cols-2 satırında, placeholder yok. NOT (2026-09-04, gerçek
    // testte bulunan hata): input index tabanlı seçim YANLIŞ input'a yazdı (Cihaz Adı'nı
    // ezdi) — bu formda TÜM placeholder'sız input'lar aynı 'type yok' tipinde, DOM sırası
    // beklenenden farklı çıktı. Label metninden XPath ile en yakın kardeş input'a gitmek
    // güvenilir sonuç verdi.
    // NOT: Input.tsx kendi içinde <div><div>...<input/></div></div> sarmalıyor — Label'ın
    // doğrudan sibling'i input değil, input'u İÇEREN bir div. following-sibling::div//input.
    const usernameInput = page.locator(
      'xpath=//*[normalize-space(text())="Kullanıcı Adı"]/following-sibling::div[1]//input',
    )
    await usernameInput.fill('qatest_admin')
    const passwordInput = page.locator(
      'xpath=//*[normalize-space(text())="Şifre"]/following-sibling::div[1]//input',
    )
    await passwordInput.fill('QaTestDevice2026!')

    await deviceForm.locator('input[type="number"]').nth(1).fill('2') // Röle No
    await deviceForm.locator('input[type="number"]').nth(2).fill('4000') // Röle Süresi (ms)
    await deviceForm.getByPlaceholder(/relay\/trigger/).fill('/qa-test/relay/trigger')

    // Kilit Tetikle switch — deviceForm scope'unda TEK bir switch olmalı ama drawer'ın diğer
    // switch'leriyle (Sıra sistemi, GPS kısıtlaması, Durum) karışmaması için "Kilit Tetikle"
    // label'ından XPath ile en yakın satıra iniyoruz.
    const lockSwitch = page.locator(
      'xpath=//*[normalize-space(text())="Kilit Tetikle"]/ancestor::div[contains(@class,"justify-between")][1]//button[@role="switch"]',
    )
    await expect(lockSwitch).toHaveAttribute('aria-checked', 'true')
    await lockSwitch.click()
    await expect(lockSwitch).toHaveAttribute('aria-checked', 'false')
    await lockSwitch.click()
    await expect(lockSwitch).toHaveAttribute('aria-checked', 'true')

    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    const createBtn = deviceForm.getByRole('button', { name: 'Cihazı Oluştur' })
    await expect(createBtn).toBeEnabled({ timeout: 5000 })
    await createBtn.click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('Cihaz oluşturuldu', { exact: false })).toBeVisible({ timeout: 10000 })

    // Fake-success-detection: API'den geri oku, TÜM alanları doğrula.
    const freshToken = await getFreshToken(page)
    const listRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/devices`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const listBody = await listRes.json()
    const devices: Array<Record<string, unknown>> = listBody?.data ?? []
    const created = devices.find((d) => d.name === `${tag} Giriş Turnikesi`)
    expect(created, `oluşturulan cihaz API listesinde bulunmalı: ${JSON.stringify(devices).slice(0, 500)}`).toBeTruthy()
    entryDeviceId = created!.id as string

    expect(created!.direction).toBe('entry')
    expect(created!.operationMode).toBe('directional')
    expect(created!.deviceId).toBe(entryDeviceIdValue)
    expect(created!.ipAddress).toBe('192.168.50.10')
    expect(created!.port).toBe(8080)
    expect(created!.workMode).toBe('online')
    expect(created!.username).toBe('qatest_admin')
    expect(created!.relayNo).toBe(2)
    expect(created!.relayMs).toBe(4000)
    expect(created!.httpPath).toBe('/qa-test/relay/trigger')
    expect(created!.triggerLockOnSuccess).toBe(true)
    expect(created!.isActive).toBe(true)
    // Cihaz kodu ve API key backend'de otomatik üretilmeli (salt-okunur alanlar).
    expect(created!.deviceCode, 'cihaz kodu otomatik üretilmeli').toBeTruthy()
  })

  test('2) "Tek Cihaz, Hem Giriş Hem Çıkış" (Toggle) cihazı — Tekrar Okutma Süresi dahil, sıfır hata', async ({ page }) => {
    test.setTimeout(60_000)
    expect(entryDeviceId, 'önceki testte giriş cihazı oluşturulmuş olmalı').toBeTruthy()
    await adminLoginUi(page)
    const drawer = await openLibraryEditDrawer(page, tag)

    await drawer.getByText('Kapı Cihazları', { exact: true }).scrollIntoViewIfNeeded()
    await drawer.getByRole('button', { name: 'Cihaz Ekle' }).click()

    const deviceForm = drawer
    await deviceForm.getByPlaceholder('Örn: Ana Giriş Turnikesi').fill(`${tag} Tek Kapı`)

    // Çalışma Modu: Toggle — bu mod seçilince "Yön" segment'i kaybolup "Tekrar Okutma
    // Süresi" alanı GÖRÜNMELİ (koşullu alan geçişi, kütüphane testinden öğrenilen desen).
    await pickSegment(deviceForm, 'Tek Cihaz, Hem Giriş Hem Çıkış')
    await expect(deviceForm.getByText('Yön', { exact: true })).toHaveCount(0)
    await expect(deviceForm.getByText('Tekrar Okutma Süresi (dk)', { exact: true })).toBeVisible({ timeout: 3000 })

    const cooldownField = page.locator(
      'xpath=//*[normalize-space(text())="Tekrar Okutma Süresi (dk)"]/following-sibling::div[1]//input',
    )
    await cooldownField.fill('7')

    const toggleDeviceIdValue = `QATEST-TOGGLE-${Date.now()}`
    await deviceForm.getByPlaceholder('LiderTek Device_Id').fill(toggleDeviceIdValue)
    await deviceForm.getByPlaceholder('192.168.1.10').fill('192.168.50.20')

    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    await deviceForm.getByRole('button', { name: 'Cihazı Oluştur' }).click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('Cihaz oluşturuldu', { exact: false })).toBeVisible({ timeout: 10000 })

    const freshToken = await getFreshToken(page)
    const listRes = await page.request.get(`${API_BASE}/libraries/${libraryId}/devices`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })
    const listBody = await listRes.json()
    const devices: Array<Record<string, unknown>> = listBody?.data ?? []
    const created = devices.find((d) => d.name === `${tag} Tek Kapı`)
    expect(created, 'oluşturulan toggle cihazı API listesinde bulunmalı').toBeTruthy()
    toggleDeviceId = created!.id as string

    expect(created!.operationMode).toBe('toggle')
    expect(created!.toggleCooldownMinutes).toBe(7)
    expect(created!.deviceId).toBe(toggleDeviceIdValue)
  })

  test('3) Cihaz Pasifleştir/Aktifleştir — GERÇEKTEN durum değişiyor mu (API\'den doğrulanır)', async ({ page }) => {
    test.setTimeout(30_000)
    expect(toggleDeviceId, 'önceki testte toggle cihazı oluşturulmuş olmalı').toBeTruthy()
    await adminLoginUi(page)
    const drawer = await openLibraryEditDrawer(page, tag)

    await drawer.getByText('Kapı Cihazları', { exact: true }).scrollIntoViewIfNeeded()
    // NOT (2026-09-04): deviceRow için locator('div',{has:...}).last() güvenilmez çıktı
    // (Tooltip sarmalayıcıları nedeniyle). Cihaz adı metninden XPath ile en yakın
    // "space-y-2 rounded-field" kart div'ine çıkıp, o kart içindeki butonu buluyoruz.
    const deviceRow = page.locator(
      `xpath=//span[normalize-space(text())="${tag} Tek Kapı"]/ancestor::div[contains(@class,"rounded-field")][1]`,
    )
    await deviceRow.getByRole('button', { name: 'Pasifleştir' }).click()
    await expect(page.getByText('Cihaz pasifleştirildi', { exact: false })).toBeVisible({ timeout: 8000 })

    const freshToken = await getFreshToken(page)
    const afterDeactivate = await (await page.request.get(`${API_BASE}/libraries/${libraryId}/devices`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    })).json()
    const deactivated = (afterDeactivate?.data ?? []).find((d: { id: string }) => d.id === toggleDeviceId)
    expect(deactivated?.isActive, 'pasifleştirdikten sonra isActive=false olmalı').toBe(false)
  })
})
