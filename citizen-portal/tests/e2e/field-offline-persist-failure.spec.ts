import { test, expect, type Page } from '@playwright/test'

// Kullanıcı isteği (2026-09-05, denetim bulgusu): "internet yoksa cache'e yazsın" akışı
// `localStorage.setItem` başarısız olduğunda (kota dolu, private-mode, WebView kısıtı)
// SESSİZCE "cihaza kaydedildi" diyip formu temizliyordu — kayıt hem sunucuya hem cihaza
// hiç ulaşmadan tamamen kayboluyordu. Düzeltme: `fieldOfflineQueue.writeQueue` artık
// yazmanın gerçekten tuttuğunu doğruluyor (geri okuyup karşılaştırıyor) ve boolean
// döndürüyor; `fieldSurvey.service` bu false durumunda FieldOfflinePersistFailedError
// fırlatıyor, UI formu KORUYOR ve "cihaza kaydedilemedi" hatası gösteriyor.
//
// Bu test, önceki turda YALNIZCA MANTIKSAL olarak doğru varsayılan bu düzeltmeyi gerçek
// bir tarayıcıda `localStorage.setItem`'ı bozarak (QuotaExceededError fırlatacak şekilde
// override ederek) uçtan uca kanıtlar — kardeş test dosyası
// (field-quick-actions-search-tc-offline.spec.ts) yalnızca YAZMA BAŞARILI olduğu "mutlu
// yol" senaryosunu kapsıyordu.

const TCKN = process.env.FIELD_TCKN || '98000000748'
const PASSWORD = process.env.FIELD_PASSWORD || 'Test1234!'
const OTP = process.env.MOCK_OTP || '111111'

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

test('localStorage yazımı başarısız olursa kayıt "kaydedildi" denip kaybolmaz, form korunur', async ({ page }) => {
  test.setTimeout(90000)

  // Depolama kotası dolu senaryosunu taklit et: `nexora_field_offline_queue` anahtarına
  // yazmaya çalışıldığında gerçek bir tarayıcının atacağı hatayı fırlat. Diğer anahtarlar
  // (login/onboarding durumu) etkilenmesin diye yalnızca bu anahtar hedeflenir.
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'nexora_field_offline_queue') {
        const err = new DOMException('The quota has been exceeded.', 'QuotaExceededError')
        throw err
      }
      return original.call(this, key, value)
    }
  })

  await loginAsInterviewer(page)
  await page.goto('/saha')
  await expect(page.getByText('Saha Anket Sistemi')).toBeVisible({ timeout: 15000 })
  const gate = page.getByRole('button', { name: /^Okudum$/ }).first()
  if (await gate.isVisible().catch(() => false)) { await gate.click(); await page.waitForTimeout(800) }
  await page.getByTestId('field-quick-actions').click()
  await expect(page.getByText('Hızlı İşlemler')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(500)

  const konuInput = page.locator('input').first()
  await konuInput.click()
  await konuInput.type('Kaldırım', { delay: 30 })
  await page.waitForTimeout(400)
  await page.keyboard.press('Enter')

  const marker = `PERSIST-FAIL-E2E-${Date.now()}`
  await page.fill('input[placeholder="Kısa başlık"]', marker)
  await page.fill('textarea', 'Depolama başarısızlığı E2E testi.')

  // Ağ isteğini GERÇEKTEN başarısız kıl (sunucudan hiç yanıt gelmez) — offline kuyruk
  // yoluna girmesi için gereken tek koşul budur.
  await page.route('**/me/surveys/field/submissions', (route) => route.abort('failed'))

  await page.getByRole('button', { name: 'Başvuruyu Kaydet' }).click()

  // KRİTİK: "cihazınıza kaydedildi" (başarı) mesajı GÖSTERİLMEMELİ; bunun yerine cihaza
  // yazımın da başarısız olduğunu belirten net bir hata gösterilmeli.
  await expect(page.getByText(/İnternet yok: başvuru cihazınıza kaydedildi/)).not.toBeVisible()
  await expect(page.getByText(/cihaza kaydedilemedi/i)).toBeVisible({ timeout: 8000 })

  // Form KAPANMAMALI ve alanlar TEMİZLENMEMELİ — anketör verisi hâlâ ekranda, tekrar
  // deneyebilir ya da bağlantıyı düzeltip gönderebilir.
  await expect(page.getByText('Hızlı İşlemler')).toBeVisible()
  await expect(page.locator('input[placeholder="Kısa başlık"]')).toHaveValue(marker)
  await expect(page.locator('textarea')).toHaveValue('Depolama başarısızlığı E2E testi.')

  // Kuyrukta da bu kayıt YOK (yazma zaten başarısız oldu, kuyruğa giremedi) — yanlış
  // pozitif bir "kuyrukta güvende" izlenimi verilmemeli.
  const queue = await page.evaluate(() => {
    try { return localStorage.getItem('nexora_field_offline_queue') } catch { return null }
  })
  expect(queue === null || !queue.includes(marker)).toBe(true)
})
