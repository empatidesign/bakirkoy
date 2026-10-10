/**
 * Mobil Uygulama Ayarları (`/mobile-config`) — sıfır hata toleranslı, 2 katmanlı E2E.
 *
 * Kullanıcı isteği (2026-09-04): "sıfır hata istiyorum." Bu ekran, mobil uygulamayı
 * uzaktan native ekranlardan tamamen bir webview'a yönlendirebilen bir "acil fren"
 * mekanizması (`docs/ADMIN_PANEL_MODULE_SCENARIO_MATRIX_2026-09-04.md` madde D,
 * "Mobil Config" — "Öncelik: Yüksek, yanlış config canlı mobil kullanıcıları etkiler").
 * Yanlış bir ayar TÜM mobil kullanıcıları (webview'e hapsedebilir veya tam tersi,
 * zorunlu güncellemeyi atlatabilir) etkiler.
 *
 * Katman 1 — Admin panel UI: Webview toggle, portal adresi (https validasyonu),
 *   kapsanan en yüksek sürüm (semver validasyonu), kullanıcı mesajı, KVKK/bildirim
 *   izni metinleri (6 alan) — kaydedilip API'den doğrulanıyor.
 * Katman 2 — GERÇEK mobil API sözleşmesi (`GET /api/v1/mobile/app-config`,
 *   AllowAnonymous, mobil uygulamanın bizzat çağırdığı uç nokta): admin panelden
 *   yapılan her değişikliğin, mobil istemcinin GERÇEKTEN göreceği cevaba yansıdığını
 *   doğrular. Bu, `MobileConfigService.MatchesVersionRule`'daki "sürüm belirsizse
 *   fail-closed (zorla webview aç)" güvenlik kuralını da gerçek HTTP çağrısıyla test
 *   eder — bu kural yanlış yönde bozulursa güncel olmayan istemciler doğrulama
 *   atlatarak eski/güvenlik açığı olan sürümde kalabilir.
 *
 * DÜRÜST KAPSAM NOTU: Bu, TÜM mobil kullanıcıları etkileyen tekil bir singleton config
 * (tüm sistemde tek satır). Test öncesi/sonrası orijinal değerler API'den okunup
 * afterAll'da GERİ YÜKLENİYOR — aksi halde gerçek canlı ayarı bozardık.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'

interface MobileAppConfig {
  webViewEnabled: boolean
  webViewUrl: string
  webViewMaxVersion: string | null
  webViewMessage: string | null
  legalDocuments: Record<string, string>
  updatedAt: string | null
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

async function fetchConfig(page: import('@playwright/test').Page): Promise<MobileAppConfig> {
  const token = await getFreshToken(page)
  const res = await page.request.get(`${API_BASE}/mobile-config`, { headers: { Authorization: `Bearer ${token}` } })
  const body = await res.json()
  return body.data
}

async function restoreConfig(apiCtx: APIRequestContext, token: string, original: MobileAppConfig) {
  await apiCtx.put(`${API_BASE}/mobile-config/webview`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      enabled: original.webViewEnabled,
      url: original.webViewUrl,
      maxVersion: original.webViewMaxVersion,
      message: original.webViewMessage,
    },
  })
  await apiCtx.put(`${API_BASE}/mobile-config/legal-documents`, {
    headers: { Authorization: `Bearer ${token}` },
    data: original.legalDocuments,
  })
}

test.describe.serial('Mobil Uygulama Ayarları — sıfır hata, 2 katmanlı (admin UI + gerçek mobil public API)', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let originalConfig: MobileAppConfig

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    const token = await adminToken(apiCtx)
    const res = await apiCtx.get(`${API_BASE}/mobile-config`, { headers: { Authorization: `Bearer ${token}` } })
    originalConfig = (await res.json()).data
  })

  test.afterAll(async () => {
    const token = await adminToken(apiCtx)
    await restoreConfig(apiCtx, token, originalConfig)
    // Restore'un gerçekten uygulandığını doğrula (test hijyeni: canlı ayarı bozmadan bırak).
    const check = await (await apiCtx.get(`${API_BASE}/mobile-config`, { headers: { Authorization: `Bearer ${token}` } })).json()
    if (check.data.webViewEnabled !== originalConfig.webViewEnabled || check.data.webViewUrl !== originalConfig.webViewUrl) {
      throw new Error(`Mobil config orijinal haline GERİ YÜKLENEMEDİ! orijinal=${JSON.stringify(originalConfig)} son=${JSON.stringify(check.data)}`)
    }
    await apiCtx.dispose()
  })

  test('1) Webview KAPALIYKEN: portal adresi alanı gizli, sadece sürüm/mesaj görünür; negatif validasyon (geçersiz sürüm) engellenir', async ({ page }) => {
    test.setTimeout(45_000)
    await adminLoginUi(page)
    await page.goto('/mobile-config')
    await expect(page.getByText('Webview modunu aç')).toBeVisible({ timeout: 8000 })

    // Başlangıçta kapalıysa uyarı bannerı GÖRÜNMEMELİ.
    const enabledNow = await page.locator('button[role="switch"]').first().getAttribute('aria-checked')
    if (enabledNow === 'true') {
      await page.locator('button[role="switch"]').first().click()
      await page.waitForTimeout(300)
    }
    await expect(page.getByText('Webview modu aktif.', { exact: false })).not.toBeVisible()

    // Kaydet butonu, webview kapalıyken URL boş olsa bile aktif olmalı (canSave: !enabled || url dolu).
    const saveBtn = page.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtn).toBeEnabled()

    // Sürüm alanına GEÇERSİZ bir değer gir (semver değil) — validasyon hatası UI'da görünmeli
    // ve Kaydet butonu DEVRE DIŞI kalmalı (canSave = !versionError).
    await page.getByPlaceholder('2.1.0').fill('abc.def')
    await expect(page.getByText('Sürüm 1.2.3 biçiminde olmalıdır.').first()).toBeVisible({ timeout: 3000 })
    await expect(saveBtn).toBeDisabled()

    // Düzelt: geçerli bir sürüm gir, hata kaybolmalı, buton tekrar aktif olmalı.
    await page.getByPlaceholder('2.1.0').fill('9.9.9')
    await expect(page.getByText('Sürüm 1.2.3 biçiminde olmalıdır.').first()).not.toBeVisible({ timeout: 3000 })
    await expect(saveBtn).toBeEnabled()

    // Kullanıcı mesajı alanını da doldur, kaydet.
    await page.getByPlaceholder('Uygulamamız kısa süreli bakımda.').fill('QA-TEST-E2E-AUTO mesaj testi')
    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    await saveBtn.click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('Webview modu kapatıldı.', { exact: false })).toBeVisible({ timeout: 8000 })

    // Fake-success-detection: API'den geri oku.
    const cfg = await fetchConfig(page)
    expect(cfg.webViewEnabled).toBe(false)
    expect(cfg.webViewMaxVersion).toBe('9.9.9')
    expect(cfg.webViewMessage).toBe('QA-TEST-E2E-AUTO mesaj testi')

    // KATMAN 2: gerçek mobil public API — webview kapalıyken enabled=false dönmeli, url=null.
    const mobileRes = await page.request.get(`${API_BASE}/mobile/app-config?version=1.0.0`)
    const mobileBody = (await mobileRes.json()).data
    expect(mobileRes.ok()).toBe(true)
    expect(mobileBody.webView.enabled).toBe(false)
    expect(mobileBody.webView.url).toBeNull()
  })

  test('2) Webview AÇILIYOR: https validasyonu (http reddedilir), açıldıktan sonra tehlike bannerı görünür, TÜM alanlar API + gerçek mobil API ile doğrulanır', async ({ page }) => {
    test.setTimeout(45_000)
    await adminLoginUi(page)
    await page.goto('/mobile-config')
    await expect(page.getByText('Webview modunu aç')).toBeVisible({ timeout: 8000 })

    await page.locator('button[role="switch"]').first().click()
    await expect(page.locator('button[role="switch"]').first()).toHaveAttribute('aria-checked', 'true')

    // Tehlike bannerı hemen görünmeli (henüz kaydetmeden, sadece toggle state'e bağlı).
    await expect(page.getByText('Webview modu aktif.', { exact: false })).toBeVisible({ timeout: 3000 })

    // Portal adresi alanı artık ZORUNLU ("required" prop + hint). http (https değil) gir — reddedilmeli.
    const urlInput = page.getByPlaceholder('https://portal.sultangazi.bel.tr')
    await urlInput.fill('http://not-secure.example.com')
    await expect(page.getByText('Portal adresi geçerli bir https adresi olmalıdır.').first()).toBeVisible({ timeout: 3000 })
    const saveBtn = page.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtn).toBeDisabled()

    // Düzelt: geçerli https adresi.
    await urlInput.fill('https://portal-qa-test.nexora.local')
    await expect(page.getByText('Portal adresi geçerli bir https adresi olmalıdır.').first()).not.toBeVisible({ timeout: 3000 })

    // Sürümü ve mesajı da güncelle.
    await page.getByPlaceholder('2.1.0').fill('3.4.5')
    await page.getByPlaceholder('Uygulamamız kısa süreli bakımda.').fill('QA-TEST-E2E-AUTO webview açık')

    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    await saveBtn.click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('Webview modu açıldı.', { exact: false })).toBeVisible({ timeout: 8000 })

    const cfg = await fetchConfig(page)
    expect(cfg.webViewEnabled).toBe(true)
    expect(cfg.webViewUrl).toBe('https://portal-qa-test.nexora.local')
    expect(cfg.webViewMaxVersion).toBe('3.4.5')
    expect(cfg.webViewMessage).toBe('QA-TEST-E2E-AUTO webview açık')

    // Sayfa yeniden yüklendiğinde de aktif banner ve toggle state korunmalı (persist doğrulaması).
    await page.reload()
    await expect(page.getByText('Webview modu aktif.', { exact: false })).toBeVisible({ timeout: 8000 })
    await expect(page.locator('button[role="switch"]').first()).toHaveAttribute('aria-checked', 'true')

    // KATMAN 2a: eski sürümlü istemci (3.4.5'ten KÜÇÜK) — kapsam İÇİNDE, webview GÖRMELİ.
    const oldClient = await page.request.get(`${API_BASE}/mobile/app-config?version=1.0.0`)
    const oldBody = (await oldClient.json()).data
    expect(oldBody.webView.enabled).toBe(true)
    expect(oldBody.webView.url).toBe('https://portal-qa-test.nexora.local')
    expect(oldBody.webView.message).toBe('QA-TEST-E2E-AUTO webview açık')

    // KATMAN 2b: güncel sürümlü istemci (3.4.5'ten BÜYÜK) — kapsam DIŞINDA, webview GÖRMEMELİ.
    const newClient = await page.request.get(`${API_BASE}/mobile/app-config?version=9.0.0`)
    const newBody = (await newClient.json()).data
    expect(newBody.webView.enabled).toBe(false)
    expect(newBody.webView.url).toBeNull()

    // KATMAN 2c (GÜVENLİK KURALI): sürüm PARAMETRESİZ/boş istek — "fail-closed" kuralı gereği
    // webview ZORLA AÇIK dönmeli (istemci sürümü kanıtlanamıyorsa güncel olduğu varsayılamaz).
    // Bu, MobileConfigService.MatchesVersionRule dokümantasyonundaki güvenlik davranışının
    // gerçek bir HTTP çağrısıyla doğrulanmasıdır — kritik regresyon noktası.
    const noVersionClient = await page.request.get(`${API_BASE}/mobile/app-config`)
    const noVersionBody = (await noVersionClient.json()).data
    expect(noVersionBody.webView.enabled, 'sürüm belirtilmeden yapılan istek fail-closed olarak webview zorlamalı').toBe(true)

    // KATMAN 2d: geçersiz/anlamsız sürüm string'i de aynı şekilde fail-closed olmalı.
    const garbageVersionClient = await page.request.get(`${API_BASE}/mobile/app-config?version=not-a-version`)
    const garbageVersionBody = (await garbageVersionClient.json()).data
    expect(garbageVersionBody.webView.enabled, 'anlamsız sürüm string\'i fail-closed olarak webview zorlamalı').toBe(true)
  })

  test('3) KVKK ve bildirim izni metinleri — TÜM 6 alan değiştirilir, ayrı "İzin metinlerini kaydet" butonu ile kaydedilir, boş alan varsa buton devre dışı kalır', async ({ page }) => {
    test.setTimeout(45_000)
    await adminLoginUi(page)
    await page.goto('/mobile-config')
    await expect(page.getByText('KVKK ve izin metinleri')).toBeVisible({ timeout: 8000 })

    const fields: Array<[string, string]> = [
      ['Vatandaş KVKK metni', 'QA-TEST-E2E-AUTO vatandaş kvkk metni güncellendi.'],
      ['Vatandaş bildirim izni', 'QA-TEST-E2E-AUTO vatandaş bildirim metni güncellendi.'],
      ['Firma KVKK metni', 'QA-TEST-E2E-AUTO firma kvkk metni güncellendi.'],
      ['Firma bildirim izni', 'QA-TEST-E2E-AUTO firma bildirim metni güncellendi.'],
      ['Firma personeli KVKK metni', 'QA-TEST-E2E-AUTO firma personeli kvkk metni güncellendi.'],
      ['Firma personeli bildirim izni', 'QA-TEST-E2E-AUTO firma personeli bildirim metni güncellendi.'],
    ]

    // NOT (2026-09-04, gerçek testte bulunan hata — kütüphane/üst-menü testlerinde de aynı hata
    // bulunmuştu): `locator('div', { has: ... })` TÜM ata div'leri eşleştirir (form gövdesi
    // dahil), `.first()`/`.last()` DOM sırasına göre BELİRSİZ sonuç verip locator.fill'i
    // timeout'a düşürebilir. Bunun yerine XPath ile label metninden Field'ın KENDİ wrapper'ına
    // (`space-y-1.5` sınıfı) çıkıyoruz.
    const fieldByLabel = (label: string) => page.locator(
      'xpath=//label[contains(normalize-space(text()),' + JSON.stringify(label) + ')]/ancestor::div[contains(@class,"space-y-1.5")][1]',
    )
    for (const [label, value] of fields) {
      const textarea = fieldByLabel(label).locator('textarea').first()
      await textarea.fill(value)
    }

    const legalSaveBtn = page.getByRole('button', { name: 'İzin metinlerini kaydet' })
    // Negatif kontrol: bir alanı GEÇİCİ olarak boşalt, buton devre dışı kalmalı (Object.values(...).some(!text.trim())).
    const firstTextarea = fieldByLabel(fields[0][0]).locator('textarea').first()
    await firstTextarea.fill('')
    await expect(legalSaveBtn).toBeDisabled()
    await firstTextarea.fill(fields[0][1]) // geri doldur

    await expect(legalSaveBtn).toBeEnabled()
    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    await legalSaveBtn.click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('KVKK ve bildirim izni metinleri güncellendi.', { exact: false })).toBeVisible({ timeout: 8000 })

    // Fake-success-detection: TÜM 6 alanı API'den doğrula.
    const cfg = await fetchConfig(page)
    expect(cfg.legalDocuments.citizenKvkk).toBe(fields[0][1])
    expect(cfg.legalDocuments.citizenNotification).toBe(fields[1][1])
    expect(cfg.legalDocuments.companyKvkk).toBe(fields[2][1])
    expect(cfg.legalDocuments.companyNotification).toBe(fields[3][1])
    expect(cfg.legalDocuments.companyStaffKvkk).toBe(fields[4][1])
    expect(cfg.legalDocuments.companyStaffNotification).toBe(fields[5][1])

    // KATMAN 2: gerçek mobil public API de yeni metinleri döndürmeli (mobil app KVKK modalını buradan çeker).
    const mobileRes = await page.request.get(`${API_BASE}/mobile/app-config?version=1.0.0`)
    const mobileBody = (await mobileRes.json()).data
    expect(mobileBody.legalDocuments.citizenKvkk).toBe(fields[0][1])
    expect(mobileBody.legalDocuments.companyStaffNotification).toBe(fields[5][1])
  })

  test('4) Yetkisiz erişim: mobile-config.manage izni olmadan PUT isteği reddedilmeli (403), .view izni olmadan sayfa açılamamalı', async ({ page }) => {
    test.setTimeout(30_000)
    // Sadece admin token ile 403 senaryosunu API seviyesinde doğrula — gerçek bir "izinsiz kullanıcı"
    // hesabı bu test dosyasında oluşturulmuyor (RBAC zaten permissions-role-creation.spec.ts'te
    // kapsamlı test edildi), burada sadece endpoint'in .RequirePermission ile korunduğunu, token'sız
    // isteğin de reddedildiğini doğruluyoruz (regresyon: bu satırlar yanlışlıkla AllowAnonymous
    // yapılırsa TÜM belediye ayarları herkese açık hale gelir).
    const anonRes = await page.request.get(`${API_BASE}/mobile-config`)
    expect(anonRes.status(), 'admin mobile-config GET endpointi token\'sız erişime kapalı olmalı').toBe(401)

    const anonPut = await page.request.put(`${API_BASE}/mobile-config/webview`, {
      data: { enabled: false, url: '', maxVersion: null, message: null },
    })
    expect(anonPut.status(), 'admin mobile-config PUT endpointi token\'sız erişime kapalı olmalı').toBe(401)

    // Buna karşın GERÇEK mobil public endpoint token'sız erişilebilir olmalı (mobil app henüz
    // login olmadan da bu config'i okuyabilmeli — webview zorlaması login öncesi de geçerli olmalı).
    const publicRes = await page.request.get(`${API_BASE}/mobile/app-config?version=1.0.0`)
    expect(publicRes.status(), 'mobil public app-config token\'sız erişilebilir olmalı (AllowAnonymous)').toBe(200)
  })
})
