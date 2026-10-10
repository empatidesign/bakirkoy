import { test, expect, type Page } from '@playwright/test'
import { purgeCitizenSubmissionsByTitlePrefix } from './helpers/citizenSubmissionCleanup'

// Kullanıcı isteği (2026-09-02): saha görevlisi ekranındaki "Hızlı İşlemler" (Talep/Öneri/
// Şikayet) formuna 3 yeni özellik eklendi:
//  1) Konu seçiminde arama (Select -> aranabilir Combobox).
//  2) T.C. kimlik girilince yerel kayıtta bulunursa ad-soyad otomatik dolar (salt-okunur);
//     bulunmazsa "kayıtlı değil, elle girin" uyarısı ile alan serbest kalır.
//  3) İnternet yoksa kayıt cihazda (localStorage) cache'lenir, bağlantı gelince (window
//     'online' olayı) otomatik olarak sunucuya gönderilir.
// Bu test her üç davranışı da gerçek API'ye (:5207) karşı doğrular; offline senaryo
// `page.route(...).abort('failed')` ile GERÇEK bir ağ hatası simüle eder (mock response
// değil — sunucudan hiç yanıt gelmemesi).

const TCKN = process.env.FIELD_TCKN || '98000000748'
const PASSWORD = process.env.FIELD_PASSWORD || 'Test1234!'
const OTP = process.env.MOCK_OTP || '111111'
// Sistemde KAYITLI olduğu bilinen bir TCKN — testteki anketör hesabının kendi TCKN'i
// (tools/seed-field-agents.mjs ile Participant olarak zaten kayıtlı; her zaman lookup'ta
// "isRegistered: true" döner).
const REGISTERED_TCKN = TCKN

async function loginAsInterviewer(page: Page) {
  await page.addInitScript(() => {
    try { window.localStorage.setItem('nexora_citizen_onboarding_done', '1') } catch { /* yok say */ }
  })
  await page.goto('/login')
  await page.locator('input').first().fill(TCKN)
  await page.getByPlaceholder(/Şifre/i).first().fill(PASSWORD)
  await page.getByRole('button', { name: /Giriş Yap/i }).click()
  await page.waitForURL(/\/login\/otp/, { timeout: 20000 })
  const quick = page.getByRole('button', { name: /Hızlı Test/ })
  if (await quick.isVisible().catch(() => false)) await quick.click()
  else {
    const boxes = page.locator('input[maxlength="1"]')
    for (let i = 0; i < 6; i++) await boxes.nth(i).fill(OTP[i])
  }
  const verify = page.getByRole('button', { name: /Doğrula/ })
  if (await verify.isEnabled().catch(() => false)) await verify.click()
  await page.waitForURL((u) => !u.pathname.includes('/otp'), { timeout: 25000 })
  const consent = page.getByRole('heading', { name: 'Devam Etmeden Önce' })
  if (await consent.isVisible().catch(() => false)) {
    for (const cb of await page.getByRole('checkbox').all()) await cb.check()
    await page.getByRole('button', { name: /Onaylayıp Devam Et/ }).click()
    await expect(consent).toBeHidden({ timeout: 15000 })
  }
}

async function openQuickActions(page: Page) {
  await page.goto('/saha')
  await expect(page.getByText('Saha Anket Sistemi')).toBeVisible({ timeout: 15000 })
  const gate = page.getByRole('button', { name: /^Okudum$/ }).first()
  if (await gate.isVisible().catch(() => false)) { await gate.click(); await page.waitForTimeout(800) }
  await page.getByTestId('field-quick-actions').click()
  await expect(page.getByText('Hızlı İşlemler')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(500) // submission options (kategoriler) yüklensin
}

test.describe('Saha Hızlı İşlemler — konu arama, TC otomatik doldurma, offline kuyruk', () => {
  test('Konu alanında arama yapılabilir ve seçim yansır', async ({ page }) => {
    test.setTimeout(90000)
    await loginAsInterviewer(page)
    await openQuickActions(page)

    const konuInput = page.locator('input').first()
    await konuInput.click()
    await konuInput.type('Kaldırım', { delay: 30 })
    await page.waitForTimeout(400)
    await page.keyboard.press('Enter')

    await expect(konuInput).toHaveValue('Kaldırım')
  })

  test('T.C. kayıtlıysa ad-soyad otomatik dolar, kayıtlı değilse manuel girişe izin verir', async ({ page }) => {
    test.setTimeout(90000)
    await loginAsInterviewer(page)
    await openQuickActions(page)

    const tcInput = page.locator('input[maxlength="11"]')
    await tcInput.fill(REGISTERED_TCKN)
    await expect(page.getByText(/sistemde kayıtlı, ad-soyad otomatik dolduruldu/)).toBeVisible({ timeout: 8000 })
    const nameInput = page.getByPlaceholder('Ad Soyad')
    await expect(nameInput).toHaveAttribute('readonly', '')
    await expect(nameInput).not.toHaveValue('')

    // Kayıtlı olmayan bir TC'ye değişince alan tekrar serbest kalır.
    await tcInput.fill('12345678901')
    await expect(page.getByText(/sistemde kayıtlı değil.*elle girin/)).toBeVisible({ timeout: 8000 })
    await expect(nameInput).not.toHaveAttribute('readonly', '')
  })

  test('İnternet yoksa kayıt cihazda cache\'lenir, bağlantı gelince otomatik gönderilir', async ({ page }) => {
    test.setTimeout(90000)
    await loginAsInterviewer(page)
    await openQuickActions(page)

    const konuInput = page.locator('input').first()
    await konuInput.click()
    await konuInput.type('Kaldırım', { delay: 30 })
    await page.waitForTimeout(400)
    await page.keyboard.press('Enter')

    const marker = `OFFLINE-QUEUE-E2E-${Date.now()}`
    await page.fill('input[placeholder="Kısa başlık"]', marker)
    await page.fill('textarea', 'Otomatik offline kuyruk E2E testi.')

    // Ağ isteğini GERÇEKTEN başarısız kıl (sunucudan hiç yanıt gelmez) — bu, offline
    // kuyruğun tetiklendiği tek durumdur (4xx/5xx normal hata olarak kalmalı).
    let blockSubmissions = true
    await page.route('**/me/surveys/field/submissions', (route) => {
      if (blockSubmissions) route.abort('failed')
      else route.continue()
    })

    await page.getByRole('button', { name: 'Başvuruyu Kaydet' }).click()
    await expect(page.getByText(/İnternet yok: başvuru cihazınıza kaydedildi/)).toBeVisible({ timeout: 8000 })

    const queueBefore = await page.evaluate(() => localStorage.getItem('nexora_field_offline_queue'))
    expect(queueBefore).toBeTruthy()
    expect(queueBefore).toContain(marker)

    // Bağlantı geri geldi: 'online' olayı tetiklenince kuyruk otomatik boşalmalı.
    blockSubmissions = false
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect(page.getByText(/bekleyen kayıt sunucuya gönderildi/)).toBeVisible({ timeout: 8000 })

    const queueAfter = await page.evaluate(() => localStorage.getItem('nexora_field_offline_queue'))
    expect(JSON.parse(queueAfter ?? '[]')).toHaveLength(0)

    // Kayıt gerçekten sunucuya ulaştığı için DB'de kalıcı bir CitizenSubmission oluştu
    // (test amaçlıdır, üretim analitiğini bozmaması için temizlenir).
    await purgeCitizenSubmissionsByTitlePrefix(marker)
  })
})
