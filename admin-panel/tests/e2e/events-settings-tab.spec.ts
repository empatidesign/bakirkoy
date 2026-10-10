/**
 * Etkinlikler — Ayarlar sekmesi (`SettingsTab.tsx`, 205 satır), sıfır hata.
 *
 * Kullanıcı isteği (2026-09-04): "sıfır hata istiyorum" + "hiçbir ui ve input sellectbox
 * veya ayarın eksik gecilmemesi gerek". Bu sekme, yeni bir etkinlik oluşturulurken ayar
 * yapılmazsa geçerli olan TÜM varsayılanları (yaş, yedek liste oranı, iptal süresi, onay
 * kuralları, katılım kısıtları, bildirimler, SMS şablonları, yoklama kuralları, QR/kiosk,
 * görsel ölçüleri) tutan bir singleton config — daha önce HİÇ UI'dan test edilmemişti.
 *
 * Kapsam: Genel Kurallar (4 sayı alanı + 3 switch), Katılım Kuralları (Select + sayı +
 * 3 switch), Bildirimler (5 switch), SMS Şablonları (6 event, her biri switch+textarea
 * koşullu görünür), Yoklama Kuralları (3 switch + 4 sayı + 2 switch), QR ve Kiosk
 * (Select QR türü + koşullu sayı alanı + 4 switch, publicLinkRequiresPin koşullu),
 * Görsel Ayarları (2 switch + 2 switch + Web/Mobil 3x3 görsel ölçü tablosu = 18 sayı alanı).
 *
 * DÜRÜST KAPSAM NOTU: Bu tekil bir singleton config (tüm sistemde tek satır, tüm yeni
 * etkinlikleri etkiler). Test öncesi/sonrası orijinal değerler API'den okunup afterAll'da
 * GERİ YÜKLENİYOR.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { pickDsOption, setSwitchRow } from './helpers/designSystemControls'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'

interface ImageSpec { width: number; height: number; maxSizeKb: number }
interface ImageVariants { cover: ImageSpec; card: ImageSpec; thumb: ImageSpec }
interface NotificationTemplate { event: string; smsEnabled: boolean; smsBody: string }
interface EventSettings {
  general: { minAge: number; maxAge: number; waitingListRatio: number; cancellationDeadlineHours: number; requireApproval: boolean; allowWaitingList: boolean; autoApproveWaitingList: boolean }
  participation: { defaultLimitPeriod: string; defaultLimitCount: number; enforceTcUnique: boolean; blockDuplicateApplications: boolean; requireGenderMatch: boolean }
  notifications: { email: boolean; sms: boolean; push: boolean; applicationConfirm: boolean; reminder24h: boolean; reminder1h: boolean; cancellationNotice: boolean }
  attendance: { qrCheckIn: boolean; manualCheckIn: boolean; bulkCheckIn: boolean; lateThresholdMinutes: number; closeAfterMinutes: number; allowWalkIn: boolean; recordCheckOut: boolean; openBeforeMinutes: number; checkOutCloseAfterMinutes: number }
  qr: { mode: string; rotationSeconds: number; kioskEnabled: boolean; kioskAutoFullscreen: boolean; kioskShowName: boolean; publicLinkEnabled: boolean; publicLinkRequiresPin: boolean }
  images: { cropEnabled: boolean; autoCompress: boolean; enforceWebSpecs: boolean; enforceMobileSpecs: boolean; web: ImageVariants; mobile: ImageVariants }
  notificationTemplates: NotificationTemplate[]
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

async function getFreshToken(page: Page): Promise<string> {
  const t = await page.evaluate(() => localStorage.getItem('admin_access_token') || sessionStorage.getItem('admin_access_token'))
  if (!t) throw new Error('Sayfada güncel access_token bulunamadı.')
  return t
}

// NOT: SettingsTab'de bu label'lar hem Field hem düz metin olarak birden fazla yerde
// tekrarlanmadığından design-system NumberInput için basit Field-wrapper XPath'i yeterli.
function fieldByLabel(page: Page, label: string) {
  return page.locator(
    'xpath=//label[contains(normalize-space(text()),' + JSON.stringify(label) + ')]/ancestor::div[contains(@class,"space-y-1.5")][1]',
  )
}

async function fillNum(page: Page, label: string, value: number) {
  await fieldByLabel(page, label).locator('input').first().fill(String(value))
}

test.describe('Etkinlikler — Ayarlar sekmesi (SettingsTab), sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let token = ''
  let original: EventSettings | null = null

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const res = await (await apiCtx.get(`${API_BASE}/event-settings`, { headers: { Authorization: `Bearer ${token}` } })).json()
    original = res.data
  })

  // NOT (2026-09-04, gerçek testte bulunan KRİTİK gotcha — tekrarlayan single-session
  // policy): `token` beforeAll'da BİR KEZ alınıyor, ama test içindeki `adminLoginUi(page)`
  // UI üzerinden TEKRAR login olduğu için backend'in tek-oturum politikası bu eski token'ı
  // GEÇERSİZ KILIYOR. Restore PUT'u eski token ile 401 SESSION_INVALIDATED alıp SESSİZCE
  // başarısız oluyordu (response hiç kontrol edilmiyordu) — bu, canlı singleton config'i
  // test verisiyle kirli bıraktı ve elle DB düzeltmesi gerektirdi. Artık restore öncesi
  // token'ı YENİDEN alıyoruz ve PUT'un GERÇEKTEN başarılı olduğunu doğruluyoruz.
  test.afterAll(async () => {
    if (original) {
      const freshToken = await adminToken(apiCtx)
      const restoreRes = await apiCtx.put(`${API_BASE}/event-settings`, { headers: { Authorization: `Bearer ${freshToken}` }, data: original })
      if (!restoreRes.ok()) {
        throw new Error(`KRİTİK: event-settings orijinal haline GERİ YÜKLENEMEDİ (${restoreRes.status()}): ${await restoreRes.text()}`)
      }
    }
    await apiCtx.dispose()
  })

  test('TÜM alanlar dolduruluyor, kaydediliyor, API üzerinden tam doğrulanıyor', async ({ page }) => {
    test.setTimeout(90_000)
    await adminLoginUi(page)
    await page.goto('/events?tab=settings')
    await expect(page.getByText('Etkinlik Ayarları')).toBeVisible({ timeout: 15000 })

    // --- Genel Kurallar ---
    await fillNum(page, 'Minimum Yaş', 12)
    await fillNum(page, 'Maksimum Yaş', 70)
    await fillNum(page, 'Yedek Liste Oranı', 25)
    await fillNum(page, 'İptal Süresi', 18)
    await setSwitchRow(page, 'Başvurularda manuel onay zorunlu', false)
    await setSwitchRow(page, 'Yedek liste açık', true)
    await setSwitchRow(page, 'Yedek listeyi otomatik yükselt', true)

    // --- Katılım Kuralları ---
    await pickDsOption(page, fieldByLabel(page, 'Varsayılan Limit Periyodu'), 'Ayda')
    await fillNum(page, 'Limit Adedi', 3)
    await setSwitchRow(page, 'TC Kimlik tekilliği zorunlu', true)
    await setSwitchRow(page, 'Çift başvuruları engelle', true)
    await setSwitchRow(page, 'Cinsiyet eşleşmesi zorunlu', true)

    // --- Bildirimler ---
    await setSwitchRow(page, 'SMS bildirimi', true)
    await setSwitchRow(page, 'Başvuru onay bildirimi', true)
    await setSwitchRow(page, '24 saat önce hatırlatma', true)
    await setSwitchRow(page, '1 saat önce hatırlatma', true)
    await setSwitchRow(page, 'İptal bildirimi', true)

    // --- SMS Şablonları --- (6 event, hepsi enable + metin dolduruluyor)
    const smsTemplateLabels = [
      'Başvuru Alındı', 'Değerlendiriliyor', 'Onaylandı',
      'Kaydınız Yapıldı', 'Reddedildi', 'Yedek Listesine Alındı',
    ]
    for (const label of smsTemplateLabels) {
      await setSwitchRow(page, label, true)
      // NOT (2026-09-04, gerçek testte bulunan gotcha): ToggleRow'un KENDİSİ de
      // `rounded-card` sınıfına sahip (bkz. Field.tsx) — bu yüzden en yakın (`[1]`)
      // rounded-card ata, dıştaki SMS şablon konteyneri değil ToggleRow'un kendisi
      // oluyor ve textarea (ToggleRow'un dışında, kardeşi) hiç bulunamıyordu. İkinci
      // (`[2]`) rounded-card ataya çıkarak gerçek dış konteynere ulaşıyoruz.
      // Denetimde bulundu (2026-10-01): ToggleRow etiketi <p> değil <label> render
      // ediyor (bkz. Field.tsx ToggleRow) — XPath buna göre güncellendi.
      const row = page.locator('xpath=//label[normalize-space(text())=' + JSON.stringify(label) + ']/ancestor::div[contains(@class,"rounded-card")][2]')
      await row.locator('textarea').fill(`QA-TEST-E2E-AUTO ${label} SMS metni {{ad}} {{soyad}}.`)
    }

    // --- Yoklama Kuralları ---
    await setSwitchRow(page, 'QR ile giriş', true)
    await setSwitchRow(page, 'Manuel giriş', true)
    await setSwitchRow(page, 'Toplu giriş', true)
    await fillNum(page, 'Giriş Açılış', 45)
    await fillNum(page, 'Geç Kalma Eşiği', 20)
    await fillNum(page, 'Yoklama Kapanış', 90)
    await fillNum(page, 'Çıkış Kapanış', 200)
    await setSwitchRow(page, 'Başvurusuz katılıma izin ver', true)
    await setSwitchRow(page, 'Çıkış zamanını kaydet', true)

    // --- QR ve Kiosk ---
    await pickDsOption(page, fieldByLabel(page, 'QR Türü'), 'Sabit QR')
    // NOT: QR Türü "Sabit QR" seçilince "QR Yenileme Süresi" alanı KOŞULLU olarak
    // kayboluyor (`s.qr.mode === 'rotating'` şartı) — bu yüzden önce rotating'e geri
    // dönüp süre alanını da doldurarak her iki dalı da (koşullu render + normal alan)
    // gerçekten egzersiz ediyoruz.
    await pickDsOption(page, fieldByLabel(page, 'QR Türü'), 'Değişken QR')
    await fillNum(page, 'QR Yenileme Süresi', 45)
    await setSwitchRow(page, 'Kiosk / ekran modu aktif', true)
    await setSwitchRow(page, 'Kiosk otomatik tam ekran', true)
    await setSwitchRow(page, 'Okutan kişinin adını göster', true)
    await setSwitchRow(page, 'Görevli için açık paylaşım linki', true)
    // publicLinkEnabled=true olunca koşullu "PIN iste" satırı görünür hale gelir.
    await expect(page.getByText('Paylaşım linki için PIN iste')).toBeVisible({ timeout: 3000 })
    await setSwitchRow(page, 'Paylaşım linki için PIN iste', true)

    // --- Görsel Ayarları ---
    await setSwitchRow(page, 'Kırpma (crop) seçeneği aktif', true)
    await setSwitchRow(page, 'Otomatik sıkıştırma', true)
    await setSwitchRow(page, 'Web ölçülerini zorunlu kıl', true)
    await setSwitchRow(page, 'Mobil ölçülerini zorunlu kıl', true)

    // Web/Mobil görsel ölçü tabloları: her biri 3 satır (Kapak/Kart/Küçük) x 3 sütun
    // (Genişlik/Yükseklik/Maks KB) = 9 sayı alanı x 2 grup = 18 alan. Grup başlığından
    // en yakın tablo konteynerine XPath ile çıkıp SIRALI input'ları dolduruyoruz.
    async function fillImageGroup(title: string, values: number[]) {
      const group = page.locator('xpath=//p[normalize-space(text())=' + JSON.stringify(title) + ']/ancestor::div[contains(@class,"rounded-card")][1]')
      const inputs = group.locator('input')
      expect(await inputs.count()).toBe(9)
      for (let i = 0; i < values.length; i++) await inputs.nth(i).fill(String(values[i]))
    }
    const webValues = [1800, 700, 750, 550, 350, 180, 220, 220, 70]
    const mobileValues = [1000, 1300, 550, 700, 700, 220, 300, 300, 90]
    await fillImageGroup('Web Görselleri (Gezi)', webValues)
    await fillImageGroup('Mobil Görseller (Gezi)', mobileValues)

    // --- Kaydet ve API'den TAM doğrula ---
    const [saveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/event-settings') && r.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Ayarları Kaydet' }).click(),
    ])
    expect(saveResponse.ok(), `PUT /event-settings başarısız: ${await saveResponse.text()}`).toBeTruthy()
    await expect(page.getByText('Etkinlik ayarları kaydedildi.')).toBeVisible({ timeout: 5000 })

    const saved = (await saveResponse.json()).data as EventSettings
    expect(saved.general).toMatchObject({ minAge: 12, maxAge: 70, waitingListRatio: 25, cancellationDeadlineHours: 18, requireApproval: false, allowWaitingList: true, autoApproveWaitingList: true })
    expect(saved.participation).toMatchObject({ defaultLimitPeriod: 'monthly', defaultLimitCount: 3, enforceTcUnique: true, blockDuplicateApplications: true, requireGenderMatch: true })
    expect(saved.notifications).toMatchObject({ sms: true, applicationConfirm: true, reminder24h: true, reminder1h: true, cancellationNotice: true })
    expect(saved.attendance).toMatchObject({ qrCheckIn: true, manualCheckIn: true, bulkCheckIn: true, lateThresholdMinutes: 20, closeAfterMinutes: 90, openBeforeMinutes: 45, checkOutCloseAfterMinutes: 200, allowWalkIn: true, recordCheckOut: true })
    expect(saved.qr).toMatchObject({ mode: 'rotating', rotationSeconds: 45, kioskEnabled: true, kioskAutoFullscreen: true, kioskShowName: true, publicLinkEnabled: true, publicLinkRequiresPin: true })
    expect(saved.images).toMatchObject({ cropEnabled: true, autoCompress: true, enforceWebSpecs: true, enforceMobileSpecs: true })
    expect(saved.images.web).toMatchObject({
      cover: { width: 1800, height: 700, maxSizeKb: 750 },
      card: { width: 550, height: 350, maxSizeKb: 180 },
      thumb: { width: 220, height: 220, maxSizeKb: 70 },
    })
    expect(saved.images.mobile).toMatchObject({
      cover: { width: 1000, height: 1300, maxSizeKb: 550 },
      card: { width: 700, height: 700, maxSizeKb: 220 },
      thumb: { width: 300, height: 300, maxSizeKb: 90 },
    })
    for (const label of smsTemplateLabels) {
      const eventKey = { 'Başvuru Alındı': 'application_received', 'Değerlendiriliyor': 'application_reviewing', 'Onaylandı': 'application_approved', 'Kaydınız Yapıldı': 'application_registered', 'Reddedildi': 'application_rejected', 'Yedek Listesine Alındı': 'application_waitlisted' }[label]!
      const tpl = saved.notificationTemplates.find((t) => t.event === eventKey)
      expect(tpl, `${label} şablonu bulunamalı`).toBeTruthy()
      expect(tpl!.smsEnabled).toBe(true)
      expect(tpl!.smsBody).toContain('QA-TEST-E2E-AUTO')
    }

    // Sayfayı yenileyip kaydedilen değerlerin GERÇEKTEN kalıcı olduğunu (sayfa
    // yenilenmiş bir GET ile) doğruluyoruz — sadece kaydet-response'una güvenmek yerine.
    const freshToken = await getFreshToken(page)
    const reGet = await (await page.request.get(`${API_BASE}/event-settings`, { headers: { Authorization: `Bearer ${freshToken}` } })).json()
    expect(reGet.data.general.minAge).toBe(12)
    expect(reGet.data.qr.mode).toBe('rotating')
    expect(reGet.data.images.web.cover.width).toBe(1800)
  })

  test('Negatif: QR Türü "Sabit QR" iken QR Yenileme Süresi alanı gizleniyor (koşullu render)', async ({ page }) => {
    test.setTimeout(45_000)
    await adminLoginUi(page)
    await page.goto('/events?tab=settings')
    await expect(page.getByText('Etkinlik Ayarları')).toBeVisible({ timeout: 15000 })

    await pickDsOption(page, fieldByLabel(page, 'QR Türü'), 'Sabit QR')
    await expect(page.getByText('QR Yenileme Süresi')).toBeHidden({ timeout: 3000 })

    await pickDsOption(page, fieldByLabel(page, 'QR Türü'), 'Değişken QR')
    await expect(page.getByText('QR Yenileme Süresi')).toBeVisible({ timeout: 3000 })
  })
})
