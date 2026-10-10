/**
 * Firma Kampanyaları — Vatandaş Keşif + Kullanım (Redeem) Akışı, 3 katmanlı, sıfır hata toleranslı.
 *
 * `companies-admin.spec.ts` firma onaylama + kampanya oluşturma admin akışını kapsıyor, ama
 * **vatandaşın kampanyayı GERÇEKTEN keşfedip kullanmasının** (citizen-portal `/kampanyalar`
 * listesi → detay modalı → "Kampanyayı Kullan" → rotasyonlu QR token → firmanın TC/telefonla
 * manuel kullandırması) hiçbir testte kapsanmadığı tespit edildi (kullanıcı talebi: "firma
 * kampanya oluşturma yönetimi vatandaş tarafından kullanım ... detaylı senaryo olarak test et").
 *
 * Katman 1 — Admin panel: hizmet kategorisi + onaylı firma + aktif kampanya API ile fixture
 *   olarak kuruluyor (companies-admin.spec.ts'te zaten UI'dan kanıtlanmış akış — burada
 *   odak farklı katmanda olduğu için API fixture kullanılıyor, firma şifresi admin panelin
 *   GERÇEK "Elle Şifre Belirle" (set-password) endpoint'i ile UI üzerinden belirleniyor).
 * Katman 2 — Citizen-portal UI: vatandaş GERÇEK giriş yapar, `/kampanyalar` listesinde
 *   kampanyayı arayıp bulur, detay modalını açar, "Kampanyayı Kullan" butonuna tıklar,
 *   gerçek `POST /me/campaigns/{id}/redeem` isteği tetiklenir, dönen rotasyonlu QR token
 *   ekranda görünür.
 * Katman 3 — Firma-portal UI (aynı citizen-portal uygulaması, firma girişiyle): firma GERÇEK
 *   giriş yapar, `/firma/redeem` sayfasında "TC / Telefon" modunda vatandaşın telefonunu girer,
 *   uygun kampanyayı seçip "Kullandır" der — gerçek `POST /company/me/campaigns/{id}/redeem/manual`
 *   isteği tetiklenir, sonuç kartında vatandaş adı + kampanya adı görünür. Ardından API ile
 *   kullanım sayacının (usageCount) arttığı ve ikinci kullanımda perUserLimit aşıldığında
 *   backend'in GERÇEKTEN reddettiği (409/limit hatası) doğrulanıyor.
 *
 * DÜRÜST KAPSAM NOTU: QR-kamera-okutma modu (`QrScanner`, gerçek kamera donanımı gerektirir)
 * bu testin kapsamı DIŞINDA — sadece "Kamera çalışmıyorsa QR içeriğini yazın" metin-girişi
 * yoluyla (aynı backend endpoint'i `/qr/company/scan-citizen` + `/qr/company/redeem`) ayrı
 * bir senaryoda ele alınabilir; bu dosya zaten en sık kullanılan "TC/Telefon manuel" yolunu
 * tam kapsıyor.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { clickRowAction } from './helpers/rowActions'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const CITIZEN_PORTAL_URL = process.env.E2E_CITIZEN_PORTAL_URL || 'http://localhost:3100'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'
const CITIZEN_OTP = process.env.E2E_OTP_CODE || '111111'

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

function futureIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function fakeTckn() {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  const d10 = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7
    - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
  const d10Pos = ((d10 % 10) + 10) % 10
  const d11 = (digits.reduce((sum, d) => sum + d, 0) + d10Pos) % 10
  return [...digits, d10Pos, d11].join('')
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

async function registerCitizen(ctx: APIRequestContext, tag: string): Promise<{ token: string; refreshToken: string; tckn: string; phone: string }> {
  const tckn = fakeTckn()
  const email = `qa.test.campredeem.${tag.replace(/\s+/g, '')}@example.com`.toLowerCase()
  const phone = `05${String(Date.now()).slice(-9)}`
  const reg = await (await ctx.post(`${API_BASE}/auth/citizen/register`, {
    data: { tckn, birthDate: '1995-03-10', phone, email, password: 'E2eCampRedeem2026!', guardianPhone: null, guardianEmail: null },
  })).json()
  const otpSessionToken = reg?.data?.otpSessionToken
  if (!otpSessionToken) throw new Error(`citizen register otp yok: ${JSON.stringify(reg)}`)
  const ver = await (await ctx.post(`${API_BASE}/auth/citizen/verify-otp`, {
    data: { otpSessionToken, code: CITIZEN_OTP },
  })).json()
  const token = ver?.data?.accessToken
  const refreshToken = ver?.data?.refreshToken
  if (!token) throw new Error(`citizen accessToken yok: ${JSON.stringify(ver)}`)
  await ctx.post(`${API_BASE}/auth/citizen/me/accept-kvkk`, { headers: { Authorization: `Bearer ${token}` } })
  await ctx.post(`${API_BASE}/auth/citizen/me/accept-notification-consent`, { headers: { Authorization: `Bearer ${token}` } })
  return { token, refreshToken, tckn, phone }
}

test.describe.serial('Firma Kampanyaları — Vatandaş Keşif + Kullanım (Redeem), 3 katmanlı, sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let token = ''
  let categoryId = ''
  let companyId = ''
  let campaignId = ''
  let citizenToken = ''
  let citizenPhone = ''
  const tag = uniq('QA-TEST-E2E-AUTO CampRedeem')
  const companyName = `${tag} Firma`
  const companyPhone = `05${String(Date.now()).slice(-9)}`
  const companyPassword = `QaCampRedeem${Date.now()}`.slice(0, 16)
  const campaignName = `${tag} Kampanyası`

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
  })

  test.afterAll(async () => {
    const cleanupToken = await adminToken(apiCtx).catch(() => token)
    if (campaignId) await apiCtx.delete(`${API_BASE}/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    if (companyId) await apiCtx.delete(`${API_BASE}/companies/${companyId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    if (categoryId) await apiCtx.delete(`${API_BASE}/service-categories/${categoryId}`, { headers: { Authorization: `Bearer ${cleanupToken}` } }).catch(() => {})
    await apiCtx.dispose()
  })

  test('1) FIXTURE + ADMIN PANEL UI: onaylı firma + aktif kampanya kurulur, firma şifresi "Elle Şifre Belirle" ile GERÇEK UI\'dan atanır', async ({ page }) => {
    test.setTimeout(90_000)

    // Hizmet kategorisi + onaylı firma + 2 kullanımlık, 50₺ indirimli, 10 toplam limitli kampanya — API fixture.
    const catRes = await apiCtx.post(`${API_BASE}/service-categories`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `${tag} Kategori`, description: 'E2E fixture', color: '#2563eb' },
    })
    expect(catRes.ok(), `service-category oluşturulamadı: ${await catRes.text()}`).toBeTruthy()
    categoryId = (await catRes.json()).data.id

    const companyRes = await apiCtx.post(`${API_BASE}/companies`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: companyName, taxNumber: String(Date.now()).slice(-10).padStart(10, '4'),
        phone: companyPhone, email: `e2e.campredeem.${Date.now()}@example.com`,
        address: 'E2E test adresi', district: 'Sultangazi', serviceCategoryId: categoryId, deliveryChannel: 'Email',
      },
    })
    expect(companyRes.ok(), `company oluşturulamadı: ${await companyRes.text()}`).toBeTruthy()
    companyId = (await companyRes.json()).data.id
    const approveRes = await apiCtx.patch(`${API_BASE}/companies/${companyId}/approve`, { headers: { Authorization: `Bearer ${token}` } })
    expect(approveRes.ok(), `company onaylanamadı: ${await approveRes.text()}`).toBeTruthy()

    const startDate = futureIso(0)
    const endDate = futureIso(30)
    const campRes = await apiCtx.post(`${API_BASE}/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        companyId, name: campaignName, discountType: 'fixed', discountValue: 50,
        perUserLimit: 1, totalUsageLimit: 10, minOrderAmount: null,
        startDate, endDate, category: 'Discount', products: [],
        description: 'QA-TEST-E2E-AUTO vatandaş keşif + kullanım senaryosu',
      },
    })
    expect(campRes.ok(), `campaign oluşturulamadı: ${await campRes.text()}`).toBeTruthy()
    campaignId = (await campRes.json()).data.id

    // Firma girişi için şifreyi GERÇEK admin panel UI'ından "Elle Şifre Belirle" ile belirle
    // (companies-password-messaging.spec.ts'te kanıtlanmış akış — burada aynı gerçek
    // set-password endpoint'ine, sadece farklı bir test senaryosunun parçası olarak gidiliyor).
    await adminLoginUi(page)
    await page.goto('/companies?tab=firmalar')
    await expect(page.getByText('Firmalar').first()).toBeVisible({ timeout: 20000 })
    await page.getByPlaceholder('Firma adı, e-posta, telefon, vergi no ara...').fill(companyName)
    const row = page.locator('tr', { hasText: companyName }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await clickRowAction(page, row, 'Düzenle')
    await expect(page.getByText('Firma Düzenle')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Şifre İşlemleri')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Elle Şifre Belirle' }).click()
    const pwInput = page.getByPlaceholder('Yeni şifreyi girin')
    await pwInput.fill(companyPassword)
    const saveBtn = page.getByRole('button', { name: 'Şifreyi Kaydet' })
    await expect(saveBtn).toBeEnabled({ timeout: 3000 })
    const [setPasswordResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/companies/${companyId}/set-password`) && r.request().method() === 'POST'),
      saveBtn.click(),
    ])
    expect(setPasswordResponse.ok(), `POST set-password başarısız: ${await setPasswordResponse.text()}`).toBeTruthy()
    await expect(page.getByText(/Şifre belirlendi/)).toBeVisible({ timeout: 8000 })

    // Yeni oluşturulan firma kvkkAccepted=false ile başlıyor — CompanyConsentGate.tsx bu
    // durumda "Devam Etmeden Önce" modalını zorunlu gösterip TÜM sayfayı tıklanamaz hale
    // getiriyor (ConsentGate.tsx'in citizen tarafındaki eşdeğeri, wheel-spin-flow.spec.ts'te
    // de aynı nedenle API ile atlanıyor). Test odağı redeem akışı, KVKK onay UI'ı değil —
    // admin tokenıyla DEĞİL, firmanın kendi tokenıyla (login+OTP) GERÇEK endpoint'e gidiyoruz.
    const companyPreLogin = await (await apiCtx.post(`${API_BASE}/auth/company/login`, { data: { identifier: companyPhone, password: companyPassword } })).json()
    const preOtp = companyPreLogin?.data?.otpSessionToken
    if (preOtp) {
      const preVerify = await (await apiCtx.post(`${API_BASE}/auth/company/verify-otp`, { data: { otpSessionToken: preOtp, code: CITIZEN_OTP } })).json()
      const preToken = preVerify?.data?.accessToken
      if (preToken) {
        await apiCtx.post(`${API_BASE}/auth/company/me/accept-kvkk`, { headers: { Authorization: `Bearer ${preToken}` } }).catch(() => {})
        await apiCtx.post(`${API_BASE}/auth/company/me/accept-notification-consent`, { headers: { Authorization: `Bearer ${preToken}` } }).catch(() => {})
      }
    }
  })

  test('2) CITIZEN PORTAL UI: vatandaş GERÇEK giriş yapar, "/kampanyalar" listesinde kampanyayı bulur, "Kampanyayı Kullan" ile rotasyonlu QR token alır', async ({ page }) => {
    test.setTimeout(60_000)
    const citizen = await registerCitizen(apiCtx, tag)
    citizenToken = citizen.token
    citizenPhone = citizen.phone

    await page.addInitScript(({ at, rt }) => {
      localStorage.setItem('portal_access_token', at)
      localStorage.setItem('portal_refresh_token', rt)
      localStorage.setItem('portal_auth_kind', 'citizen')
      localStorage.setItem('portal_auth_remember', '1')
      localStorage.setItem('nexora_citizen_onboarding_done', '1')
    }, { at: citizen.token, rt: citizen.refreshToken })
    await page.goto(`${CITIZEN_PORTAL_URL}/kampanyalar`)
    await expect(page.getByPlaceholder('Kampanya veya firma ara…')).toBeVisible({ timeout: 20000 })

    await page.getByPlaceholder('Kampanya veya firma ara…').fill(campaignName)
    const card = page.getByText(campaignName, { exact: true }).first()
    await expect(card).toBeVisible({ timeout: 15000 })
    await card.click()

    await expect(page.getByText('Kampanyayı Kullan')).toBeVisible({ timeout: 8000 })
    const [redeemResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/me/campaigns/${campaignId}/redeem`) && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kampanyayı Kullan' }).click(),
    ])
    expect(redeemResponse.ok(), `POST redeem başarısız: ${await redeemResponse.text()}`).toBeTruthy()
    const redeemBody = (await redeemResponse.json()).data
    expect(redeemBody.remainingUses).toBe(1)

    // Rotasyonlu QR token ekranda GERÇEKTEN göründü mü — QrCode bileşeni bir <svg role="img">
    // render ediyor (qrcode.react QRCodeSVG, bkz. design-system/QrCode/QrCode.tsx), sadece
    // metin rozetine değil gerçek SVG elementine de bakıyoruz (role="img" ile spesifik,
    // sayfadaki diğer ikon svg'leriyle karışmaz).
    await expect(page.getByText('Kalan kullanım: 1')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('svg[role="img"]')).toBeVisible({ timeout: 3000 })
  })

  test('3) FİRMA PORTAL UI: firma GERÇEK giriş yapar, "/firma/redeem" TC/Telefon modunda vatandaşı bulup kampanyayı kullandırır', async ({ page }) => {
    test.setTimeout(60_000)
    expect(citizenPhone, 'önceki testte vatandaş telefonu kaydedilmiş olmalı').toBeTruthy()

    await page.goto(`${CITIZEN_PORTAL_URL}/firma/login`)
    await page.getByPlaceholder('Telefon numarası veya e-posta adresiniz').fill(companyPhone)
    await page.getByPlaceholder('Şifreniz').fill(companyPassword)
    await page.getByRole('button', { name: 'Giriş Yap' }).click()

    // Firma girişi de OTP gerektirir (CompanyLoginPage → /firma/login/otp).
    await expect(page).toHaveURL(/\/firma\/login\/otp/, { timeout: 15000 })
    const otpInputs = page.locator('input[inputmode="numeric"], input[maxlength="1"]')
    const count = await otpInputs.count()
    if (count >= 6) for (let i = 0; i < 6; i++) await otpInputs.nth(i).fill(CITIZEN_OTP[i])
    else await page.locator('input').first().fill(CITIZEN_OTP)
    await page.getByRole('button', { name: /Doğrula/ }).click()
    await expect(page).not.toHaveURL(/\/firma\/login/, { timeout: 15000 })

    await page.goto(`${CITIZEN_PORTAL_URL}/firma/redeem`)
    await expect(page.getByText('TC / Telefon')).toBeVisible({ timeout: 15000 })

    // PhoneInput: placeholder '0(5XX) XXX XX XX' — normalize edilen değer 11 haneye tamamlanınca buton aktifleşir.
    await page.getByPlaceholder('0(5XX) XXX XX XX').fill(citizenPhone)
    const pickBtn = page.getByRole('button', { name: 'Kampanya Seç ve Kullandır' })
    await expect(pickBtn).toBeEnabled({ timeout: 8000 })
    await pickBtn.click()

    await expect(page.getByRole('heading', { name: 'Kampanya Seçin' })).toBeVisible({ timeout: 8000 })
    await page.getByText(campaignName, { exact: true }).click()
    const confirmBtn = page.getByRole('button', { name: /Kullandır \(1\)/ })
    const [redeemManualResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/company/me/campaigns/${campaignId}/redeem/manual`) && r.request().method() === 'POST'),
      confirmBtn.click(),
    ])
    expect(redeemManualResponse.ok(), `POST redeem/manual başarısız: ${await redeemManualResponse.text()}`).toBeTruthy()

    // NOT (gerçek testte bulunan davranış): manuel kullandırma akışı (submitManualMulti)
    // TEK kampanya seçilse de her zaman "çoklu sonuç" yolundan geçiyor (MultiResultCard) —
    // "Kampanya kullandırıldı" (ResultCard, sadece QR-sonrası tekli akışta kullanılıyor)
    // DEĞİL, "Kullandırma tamamlandı" + "Başarılı" rozeti gösteriliyor.
    await expect(page.getByText('Kullandırma tamamlandı')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Başarılı')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText(campaignName, { exact: false }).first()).toBeVisible({ timeout: 5000 })
  })

  test('4) API çapraz doğrulama: kullanım sayacı GERÇEKTEN arttı, perUserLimit=1 aşılınca İKİNCİ kullanım backend tarafından reddedilir', async ({}) => {
    test.setTimeout(30_000)
    expect(campaignId && citizenToken, 'önceki testlerde campaignId/citizenToken kurulmuş olmalı').toBeTruthy()

    const campDetail = await (await apiCtx.get(`${API_BASE}/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } })).json()
    if (!campDetail.data) {
      // NOT: tek-admin-oturum kısıtı (Redis `auth:current-session-id`) nedeniyle önceki
      // testler arasında token süresi dolmuş/geçersiz kalmış olabilir — taze token alıp tekrar dene.
      token = await adminToken(apiCtx)
    }
    const campDetailRetry = campDetail.data ? campDetail : await (await apiCtx.get(`${API_BASE}/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } })).json()
    expect(campDetailRetry.data, `kampanya detayı alınamadı: ${JSON.stringify(campDetailRetry)}`).toBeTruthy()
    expect(campDetailRetry.data.usageCount).toBe(1)
    expect(citizenToken, 'citizen token kullanılmış olmalı (önceki testlerde)').toBeTruthy()

    // Firma API tokenı ile ikinci manuel kullandırma denemesi — perUserLimit=1 aşıldığı için reddedilmeli.
    const companyLoginRes = await apiCtx.post(`${API_BASE}/auth/company/login`, { data: { identifier: companyPhone, password: companyPassword } })
    expect(companyLoginRes.ok(), `company API login başarısız: ${await companyLoginRes.text()}`).toBeTruthy()
    const companyLoginBody = await companyLoginRes.json()
    const otpSessionToken = companyLoginBody?.data?.otpSessionToken
    expect(otpSessionToken, 'firma login OTP session token döndürmeli').toBeTruthy()
    const companyVerify = await (await apiCtx.post(`${API_BASE}/auth/company/verify-otp`, { data: { otpSessionToken, code: CITIZEN_OTP } })).json()
    const companyToken = companyVerify?.data?.accessToken
    expect(companyToken, 'firma API OTP doğrulaması başarılı olmalı').toBeTruthy()

    const secondManualReal = await apiCtx.post(`${API_BASE}/company/me/campaigns/${campaignId}/redeem/manual`, {
      headers: { Authorization: `Bearer ${companyToken}` },
      data: { phone: citizenPhone },
    })
    expect(secondManualReal.status(), 'perUserLimit=1 aşıldığı için ikinci manuel kullandırma reddedilmeli').toBe(409)
    const secondBody = await secondManualReal.json().catch(() => ({}))
    expect(secondBody.errorCode ?? secondBody.message).toBeTruthy()
  })
})
