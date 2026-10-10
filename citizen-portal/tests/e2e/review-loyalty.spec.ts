import { test, expect } from '@playwright/test'
import { login, hasCredentials, TEST_TCKN } from './helpers/auth'
import { psqlAvailable, seedReviewableEvent } from './helpers/reviewFixture'

// Geçmişim ekranından değerlendirme (yıldız + yorum) gönderimi.
// Eski tmp-review-loyalty-check.spec.ts kırılgan CSS sınıfı (.rounded-full.text-gray-400)
// ile chevron'a tıklıyordu ve HİÇ assertion içermiyordu; ekran değişince sessizce
// kırıldı. Burada erişilebilir "Değerlendir" butonu + gerçek API/UI doğrulaması var.
//
// NOT: HistoryPage'de "Değerlendir" butonu `lg:flex` sütununda (HistoryPage.tsx:169);
// varsayılan 430px mobil viewport'ta GÖRÜNMEZ. Bu yüzden test masaüstü genişliğinde
// koşar — yoksa tek giriş yolu kırılgan chevron seçicisi olurdu.
test.use({ viewport: { width: 1280, height: 900 } })

test.describe('Değerlendirme akışı', () => {
  test.skip(!hasCredentials(), 'E2E_TCKN / E2E_PASSWORD verilmedi')

  // Her koşu kendi değerlendirilebilir etkinliğini üretir. Yorum gönderilince o etkinlik
  // "değerlendirilmiş" olur; fixture olmadan spec ikinci koşuda sessizce skip'e düşerdi
  // (bkz. helpers/reviewFixture.ts).
  let seeded = false
  test.beforeAll(() => {
    if (!hasCredentials() || !psqlAvailable()) return
    seedReviewableEvent(TEST_TCKN)
    seeded = true
  })

  test('geçmişten değerlendirme gönderilir ve kaydedildi bildirimi görünür', async ({ page }) => {
    await login(page)
    await page.goto('/gecmisim')
    await page.waitForLoadState('networkidle').catch(() => {})

    // canReview=true olan kayıtlarda render edilir (HistoryPage.tsx:82-90).
    // Buton expand toggle'ı tetikler, form da aynı koşulla açılır (HistoryPage.tsx:204).
    const reviewButtons = page.getByRole('button', { name: 'Değerlendir' })
    await page.waitForTimeout(500)
    const count = await reviewButtons.count()

    // Fixture kurulduysa "buton yok" bir ÜRÜN HATASIDIR — skip ile örtülmez.
    // Yalnız psql'e ulaşılamayan ortamda (fixture kurulamadı) skip meşrudur.
    if (seeded) {
      expect(count, 'fixture kuruldu; en az bir "Değerlendir" butonu görünmeli').toBeGreaterThan(0)
    } else {
      test.skip(count === 0, 'psql yok — değerlendirilebilir fixture kurulamadı')
    }

    await reviewButtons.first().click()

    await expect(page.getByText('Değerlendirmenizi yazın')).toBeVisible({ timeout: 10000 })

    const star = page.getByLabel('4 yıldız').first()
    await expect(star).toBeVisible({ timeout: 10000 })
    await star.click()

    await page.getByPlaceholder('Yorumunuz (opsiyonel)…').first().fill('E2E değerlendirme testi')

    const submitBtn = page.getByRole('button', { name: 'Gönder' }).first()
    await expect(submitBtn).toBeEnabled()

    // event → /me/events/{id}/reviews, travel → /me/travels/{id}/reviews
    const submitResponse = page.waitForResponse(
      (r) => /\/me\/(events|travels)\/[^/]+\/reviews$/.test(new URL(r.url()).pathname) &&
        r.request().method() === 'POST',
      { timeout: 20000 },
    )
    await submitBtn.click()

    const res = await submitResponse
    expect(res.ok(), `değerlendirme API başarılı olmalı — ${res.status()}`).toBeTruthy()

    await expect(page.getByText('Değerlendirmeniz kaydedildi.')).toBeVisible({ timeout: 10000 })
  })
})
