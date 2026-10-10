import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { waitIdle } from './helpers/videoProof'

// Ölçüm bulgusu (2026-09-01, saha tablet çalışması): Sonner'ın varsayılan toast
// kapatma düğmesi 20x20px. Saha anketörü tableti ayakta ve tek elle kullanıyor,
// bu boyut parmakla isabet ettirilemiyor. Düğme portal kökünde render edildiği
// için saha ekranındaki `field-survey-shell` kuralı ona ulaşmıyor; bu yüzden
// AppToaster'da ayrıca 44px'e çıkarıldı ve burada doğrulanıyor.
//
// Toast, uygulamanın gerçek hata yolundan üretilir: bildirim tercihleri
// sayfasında kaydetme isteği başarısız olunca uygulama "Tercih güncellenemedi."
// bildirimi gösterir. Böylece ölçülen şey gerçek AppToaster yapılandırmasıdır.
const MIN_TOUCH = 44

test.describe('Bildirim (toast) dokunma hedefi', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')
  test.setTimeout(75_000)

  test('kapatma düğmesi tablette en az 44px', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 })

    await login(page)
    await page.goto('/bildirimler/tercihler')
    await waitIdle(page)

    // Tercih güncelleme isteğini hataya düşür: uygulama toast ile bildirir.
    await page.route('**/api/v1/me/notification-preferences**', (r) =>
      r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Sunucu hatası' }) }))

    const toggles = page.locator('button[role="switch"], input[type="checkbox"]')
    const count = await toggles.count()
    test.skip(count === 0, 'tercih anahtarı bulunamadı')
    await toggles.first().click()

    const closeBtn = page.locator('[data-close-button]').first()
    await expect(closeBtn, 'hata bildirimi ve kapatma düğmesi görünmeli').toBeVisible({ timeout: 10_000 })

    const box = await closeBtn.boundingBox()
    expect(box, 'kapatma düğmesi ölçülebilmeli').not.toBeNull()
    expect(Math.round(box!.height), `kapatma düğmesi yüksekliği ${Math.round(box!.height)}px, en az ${MIN_TOUCH}px olmalı`).toBeGreaterThanOrEqual(MIN_TOUCH)
    expect(Math.round(box!.width), `kapatma düğmesi genişliği ${Math.round(box!.width)}px, en az ${MIN_TOUCH}px olmalı`).toBeGreaterThanOrEqual(MIN_TOUCH)

    // Düğme gerçekten tıklanabilir olmalı: tıklandığında bildirim kapanmalı.
    const before = await page.locator('[data-close-button]').count()
    await closeBtn.click()
    await expect
      .poll(() => page.locator('[data-close-button]').count(), { timeout: 5_000, message: 'kapatma düğmesi tıklanınca bildirim kapanmalı' })
      .toBeLessThan(before)
  })
})
