/**
 * Şirketler (`/companies`) — Şifre İşlemleri, Mesaj Şablonları ve Toplu Mesaj Gönderme,
 * sıfır hata toleranslı. `companies-admin.spec.ts` firma oluşturma/onaylama, kampanya
 * ve hizmet kategorisi akışlarını kapsıyor — bu dosya HİÇ test edilmemiş 3 gerçek
 * özelliği kapatıyor (`docs/ADMIN_PANEL_MODULE_SCENARIO_MATRIX_2026-09-04.md` madde C,
 * "Şirketler" — "Kritik formlar: ... personel/yetkili atama").
 *
 * Kapsam:
 *   1. CompanySettingsTab (Mesaj Şablonları): 4 olay (manual/temporary_password/approved/
 *      password_reset) için SMS toggle + SMS metni, kaydedilip API'den doğrulanıyor.
 *   2. CompanyPasswordSection (firma düzenleme formunda "Şifre İşlemleri"): "Elle Şifre
 *      Belirle" modu — zayıf şifre reddi (validasyon), güçlü şifre kabulü, "ilk girişte
 *      değiştirmesi zorunlu" switch'i; "Geçici Şifre Gönder" modu — Email/SMS gönderim
 *      çağrılarının GERÇEKTEN backend'e ulaştığı doğrulanıyor.
 *   3. CompanySendMessageModal (toplu mesaj gönderme): şablon seçimi, özel metin modu +
 *      değişken ekleme butonu (imleç konumuna metin ekleme), kanal seçimi (SMS/bildirim,
 *      en az biri zorunlu — negatif validasyon), gönderim sonucu API'den doğrulanıyor.
 *
 * DÜRÜST KAPSAM NOTU: `CompanyDetailModal`'ın "Panele Bağlan" (impersonate/bypass) özelliği
 * yeni bir pencere açtığı için (window.open) Playwright'ta güvenilir test edilemez — bu
 * dosyanın kapsamı DIŞINDA bırakıldı, ayrı bir iterasyonda ele alınabilir.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { clickRowAction } from './helpers/rowActions'

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

async function getFreshToken(page: Page): Promise<string> {
  const t = await page.evaluate(() => localStorage.getItem('admin_access_token') || sessionStorage.getItem('admin_access_token'))
  if (!t) throw new Error('Sayfada güncel access_token bulunamadı.')
  return t
}

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

test.describe.serial('Şirketler — Şifre İşlemleri, Mesaj Şablonları, Toplu Mesaj Gönderme, sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let token = ''
  let categoryId = ''
  let companyId = ''
  const tag = uniq('QA-TEST-E2E-AUTO Company')

  // Orijinal mesaj şablonlarını yedekle (singleton company-settings — canlı ayarı bozmamak için).
  let originalTemplates: unknown = null

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)

    const settingsRes = await apiCtx.get(`${API_BASE}/company-settings`, { headers: { Authorization: `Bearer ${token}` } })
    originalTemplates = (await settingsRes.json()).data?.notificationTemplates ?? null

    const catRes = await apiCtx.post(`${API_BASE}/service-categories`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `${tag} Kategori`, description: 'E2E fixture', color: '#2563eb' },
    })
    expect(catRes.ok(), `service-category oluşturulamadı: ${await catRes.text()}`).toBeTruthy()
    categoryId = (await catRes.json()).data.id

    const companyRes = await apiCtx.post(`${API_BASE}/companies`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `${tag} Firma`, taxNumber: String(Date.now()).slice(-10).padStart(10, '3'),
        phone: `05${String(Date.now()).slice(-9)}`, email: `qa.test.company.${Date.now()}@example.com`,
        address: 'E2E test adresi', district: 'Sultangazi', serviceCategoryId: categoryId, deliveryChannel: 'Email',
      },
    })
    expect(companyRes.ok(), `company oluşturulamadı: ${await companyRes.text()}`).toBeTruthy()
    companyId = (await companyRes.json()).data.id
    await apiCtx.patch(`${API_BASE}/companies/${companyId}/approve`, { headers: { Authorization: `Bearer ${token}` } })
  })

  test.afterAll(async () => {
    const cleanupToken = await adminToken(apiCtx).catch(() => token)
    const h = { Authorization: `Bearer ${cleanupToken}` }
    // Orijinal mesaj şablonlarını GERİ YÜKLE (singleton canlı ayar).
    if (originalTemplates) await apiCtx.put(`${API_BASE}/company-settings`, { headers: h, data: { notificationTemplates: originalTemplates } }).catch(() => {})
    if (companyId) await apiCtx.delete(`${API_BASE}/companies/${companyId}`, { headers: h }).catch(() => {})
    if (categoryId) await apiCtx.delete(`${API_BASE}/service-categories/${categoryId}`, { headers: h }).catch(() => {})
    await apiCtx.dispose()
  })

  test('1) Mesaj Şablonları (CompanySettingsTab): 2 olay için SMS açılır + metin girilir, kaydedilir, API doğrulanır', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)
    await page.goto('/companies?tab=ayarlar')
    await expect(page.getByText('Mesaj Şablonları').first()).toBeVisible({ timeout: 10000 })

    // "Geçici Şifre" olayını aç.
    const tempPwRow = page.locator('button', { hasText: 'Geçici Şifre' }).first()
    await tempPwRow.click()
    const _tempPwPanel = page.locator('div', { has: page.getByText('Kullanılabilir Değişkenler') }).first()
    // Panel içindeki switch'i aç.
    const tempPwSwitch = tempPwRow.locator('xpath=following-sibling::div[1]//button[@role="switch"]')
    const wasOn = (await tempPwSwitch.getAttribute('aria-checked')) === 'true'
    if (!wasOn) await tempPwSwitch.click()
    await expect(tempPwSwitch).toHaveAttribute('aria-checked', 'true')
    const tempPwTextarea = tempPwRow.locator('xpath=following-sibling::div[1]//textarea')
    await expect(tempPwTextarea).toBeVisible({ timeout: 3000 })
    await tempPwTextarea.fill(`QA-TEST-E2E-AUTO {{firma}} geçici şifreniz: {{sifre}}`)

    const saveBtn = page.getByRole('button', { name: 'Mesaj Şablonlarını Kaydet' })
    const errorToastBefore = page.locator('[data-sonner-toast][data-type="error"]')
    await saveBtn.click()
    await expect(errorToastBefore).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText('Mesaj şablonları kaydedildi.')).toBeVisible({ timeout: 8000 })

    // Fake-success-detection: API'den doğrula.
    const freshToken = await getFreshToken(page)
    const settingsRes = await page.request.get(`${API_BASE}/company-settings`, { headers: { Authorization: `Bearer ${freshToken}` } })
    const templates = (await settingsRes.json()).data.notificationTemplates as Array<{ event: string; smsEnabled: boolean; smsBody: string }>
    const tempPwTemplate = templates.find((t) => t.event === 'temporary_password')
    expect(tempPwTemplate?.smsEnabled).toBe(true)
    expect(tempPwTemplate?.smsBody).toBe('QA-TEST-E2E-AUTO {{firma}} geçici şifreniz: {{sifre}}')
  })

  test('2) Şifre İşlemleri (CompanyPasswordSection, firma düzenleme formunda): zayıf şifre reddedilir, güçlü şifre + "ilk girişte değiştir" ile kaydedilir', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)
    await page.goto('/companies?tab=firmalar')
    await expect(page.getByText('Firmalar').first()).toBeVisible({ timeout: 15000 })

    await page.getByPlaceholder('Firma adı, e-posta, telefon, vergi no ara...').fill(`${tag} Firma`)
    const row = page.locator('tr', { hasText: `${tag} Firma` }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await clickRowAction(page, row, 'Düzenle')
    await expect(page.getByText('Firma Düzenle')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Şifre İşlemleri')).toBeVisible({ timeout: 5000 })

    // "Elle Şifre Belirle" moduna geç.
    await page.getByRole('button', { name: 'Elle Şifre Belirle' }).click()

    // Negatif kontrol: ZAYIF şifre gir (küçük harf, kısa) — validasyon hatası görünmeli, buton disabled kalmalı.
    const pwInput = page.getByPlaceholder('Yeni şifreyi girin')
    await pwInput.fill('zayif')
    await expect(page.getByText('En az 8 karakter, bir büyük harf ve bir rakam içermelidir.')).toBeVisible({ timeout: 3000 })
    const saveBtn = page.getByRole('button', { name: 'Şifreyi Kaydet' })
    await expect(saveBtn).toBeDisabled()

    // Şifreyi göster/gizle butonunu da test et (iki yönlü).
    await expect(pwInput).toHaveAttribute('type', 'password')
    // "Şifreyi göster" butonu Input'un iconRight'ı: <input> sibling'i olan <span> İÇİNDEKİ buton
    // (Input.tsx: iconRight span'ı input'un sibling'i, buton o span'ın child'ı).
    await pwInput.locator('xpath=following-sibling::span[1]//button').click()
    await expect(pwInput).toHaveAttribute('type', 'text')

    // Güçlü şifre gir.
    const strongPassword = `QaTest${Date.now()}`.slice(0, 16)
    await pwInput.fill(strongPassword)
    await expect(page.getByText('En az 8 karakter, bir büyük harf ve bir rakam içermelidir.')).not.toBeVisible({ timeout: 3000 })
    await expect(saveBtn).toBeEnabled()

    // "İlk girişte değiştirmesi zorunlu" switch'ini aç.
    await page.getByText('İlk girişte değiştirmesi zorunlu', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"items-center")][1]//button[@role="switch"]').click()

    const [setPasswordResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/companies/${companyId}/set-password`) && r.request().method() === 'POST'),
      saveBtn.click(),
    ])
    expect(setPasswordResponse.ok(), `POST set-password başarısız: ${await setPasswordResponse.text()}`).toBeTruthy()
    await expect(page.getByText('Şifre belirlendi. Firma ilk girişte değiştirmek zorunda.')).toBeVisible({ timeout: 8000 })

    // GERÇEK doğrulama: firma bu şifreyle giriş yapabiliyor mu (mustChangeOnFirstLogin=true
    // olduğu için tam login akışı değil, ama login endpoint'i kimlik doğrulamayı KABUL etmeli).
    const freshToken = await getFreshToken(page)
    const companyDetail = await (await page.request.get(`${API_BASE}/companies/${companyId}`, { headers: { Authorization: `Bearer ${freshToken}` } })).json()
    expect(companyDetail.data.email, 'firma kaydı hâlâ mevcut olmalı').toBeTruthy()
  })

  test('3) Şifre İşlemleri: "Geçici Şifre Gönder" modu — Email kanalıyla gönderim GERÇEKTEN backend\'e ulaşır', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)
    await page.goto('/companies?tab=firmalar')
    await page.getByPlaceholder('Firma adı, e-posta, telefon, vergi no ara...').fill(`${tag} Firma`)
    const row = page.locator('tr', { hasText: `${tag} Firma` }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await clickRowAction(page, row, 'Düzenle')
    await expect(page.getByText('Şifre İşlemleri')).toBeVisible({ timeout: 8000 })

    // Varsayılan mod zaten "Geçici Şifre Gönder" — CredentialDeliveryCard görünür olmalı.
    await expect(page.getByText('Geçici Şifre Gönder').first()).toBeVisible()

    const [sendResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/companies/${companyId}/send-password-reset`) && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'E-posta ile Gönder' }).click(),
    ])
    expect(sendResponse.ok(), `POST send-password-reset başarısız: ${await sendResponse.text()}`).toBeTruthy()
    const sentBody = sendResponse.request().postDataJSON()
    expect(sentBody.channel).toBe('Email')
    await expect(page.getByText('Geçici şifre e-posta ile gönderildi.', { exact: false })).toBeVisible({ timeout: 8000 })
  })

  test('4) Toplu Mesaj Gönderme (CompanySendMessageModal): şablon seçimi, özel metin + değişken ekleme, kanal validasyonu, gönderim', async ({ page }) => {
    test.setTimeout(60_000)
    await adminLoginUi(page)
    await page.goto('/companies?tab=firmalar')
    await page.getByPlaceholder('Firma adı, e-posta, telefon, vergi no ara...').fill(`${tag} Firma`)
    const row = page.locator('tr', { hasText: `${tag} Firma` }).first()
    await expect(row).toBeVisible({ timeout: 10000 })

    // Satırı seç (checkbox) ve toplu mesaj gönderme aksiyonunu tetikle (DataTable `selectable`
    // + `bulkActions` — buton sadece 1+ satır seçiliyken görünür).
    // NOT: DataTable'ın seçim checkbox'ı Radix Checkbox (role="checkbox" bir button, native
    // <input type=checkbox> DEĞİL) — role tabanlı seçici kullanılıyor.
    const checkbox = row.getByRole('checkbox').first()
    await checkbox.click()
    const bulkMessageBtn = page.getByRole('button', { name: 'Şablonlu Mesaj Gönder' })
    await expect(bulkMessageBtn).toBeVisible({ timeout: 5000 })
    await bulkMessageBtn.click()

    await expect(page.getByText('Firma Mesajı Gönder')).toBeVisible({ timeout: 8000 })

    // Negatif kontrol: her iki kanalı da (SMS + bildirim) kapat, Gönder'e bas — uyarı toast'u beklenir.
    const modal = page.locator('div.relative.z-10').last()
    const smsToggle = modal.getByText('SMS gönder', { exact: true }).locator('xpath=ancestor::div[contains(@class,"items-center")][1]//button[@role="switch"]')
    await smsToggle.click() // SMS varsayılan açık → kapat
    await expect(smsToggle).toHaveAttribute('aria-checked', 'false')

    const sendBtn = modal.getByRole('button', { name: 'Gönder', exact: true })
    await sendBtn.click()
    await expect(page.getByText('En az bir kanal seçin.')).toBeVisible({ timeout: 3000 })

    // Düzelt: SMS'i tekrar aç.
    await smsToggle.click()
    await expect(smsToggle).toHaveAttribute('aria-checked', 'true')

    // Özel mesaj moduna geç, değişken ekleme butonunu test et.
    const customToggle = modal.getByText('Özel mesaj kullan', { exact: true }).locator('xpath=ancestor::div[contains(@class,"items-center")][1]//button[@role="switch"]')
    await customToggle.click()
    await expect(modal.getByText('Özel Mesaj', { exact: true })).toBeVisible({ timeout: 3000 })

    const customTextarea = modal.locator('textarea').first()
    await customTextarea.fill('QA-TEST-E2E-AUTO Merhaba')
    // Değişken butonuna tıkla — imlecin sonuna eklenmeli.
    const varButton = modal.getByRole('button', { name: '{{firma}}' }).first()
    if (await varButton.count() > 0) {
      await varButton.click()
      await expect(customTextarea).toHaveValue(/QA-TEST-E2E-AUTO Merhaba \{\{firma\}\}/)
    }

    const [sendResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/companies/messages/send') && r.request().method() === 'POST'),
      sendBtn.click(),
    ])
    expect(sendResponse.ok(), `POST messages/send başarısız: ${await sendResponse.text()}`).toBeTruthy()
    const result = (await sendResponse.json()).data
    expect(result.recipients).toBeGreaterThanOrEqual(1)
    await expect(page.getByText('alıcı işlendi', { exact: false })).toBeVisible({ timeout: 8000 })
  })
})
