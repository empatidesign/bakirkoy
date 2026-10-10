/**
 * Login formu — negatif/güvenlik testleri (QA gap #7, #10 — 2026-09-04).
 *
 * Amaç saldırı yapmak değil, input validation/escaping davranışını doğrulamak.
 * Login formu seçildi çünkü herkese açık, kimlik doğrulaması gerektirmiyor
 * (auth-koruması olmadan da her ortamda çalışabilir) ve en yüksek "saldırı
 * yüzeyi" olan giriş noktası (gerçek TCKN/şifre alanına rastgele metin girmek
 * gerçek kullanıcı davranışının aşırı ucu).
 */
import { test, expect } from '@playwright/test'
import {
  NEGATIVE_INPUT_PAYLOADS,
  assertInputHandlesNegativePayloads,
} from '../helpers/negativeInputTesting'

test.describe('Login formu — negatif input testleri', () => {
  test('TCKN/telefon alanı tehlikeli input\'larla çökmez, XSS enjekte etmez', async ({ page }) => {
    await page.goto('/login')
    const identifierInput = page.getByPlaceholder(/05XX \/ T\.C\. Kimlik|Telefon veya T\.C\. kimlik numaranız/i)
    await identifierInput.waitFor()

    await assertInputHandlesNegativePayloads(page, identifierInput, {
      payloads: ['xssScript', 'xssImgOnerror', 'sqlLikeOr', 'sqlLikeDrop', 'turkishSpecialChars', 'emoji'],
    })
  })

  test('şifre alanı aşırı uzun metin ve özel karakterlerle çökmez', async ({ page }) => {
    await page.goto('/login')
    const passwordInput = page.getByPlaceholder(/••••••••|Şifreniz/i)
    await passwordInput.waitFor()

    await assertInputHandlesNegativePayloads(page, passwordInput, {
      payloads: ['veryLongText', 'nullByte', 'onlyWhitespace'],
    })
  })

  test('XSS payload\'ı login denemesi sonrası hata mesajında ham HTML olarak render edilmez', async ({
    page,
  }) => {
    // Login'i GERÇEKTEN dener (yanlış kimlik bilgisiyle) — backend'in hata mesajını
    // (örn. "kullanıcı bulunamadı") kullanıcı girdisini ECHO ederek oluşturup
    // oluşturmadığını kontrol eder. Reflected XSS'in klasik giriş noktası budur.
    await page.goto('/login')
    await page.getByPlaceholder(/05XX \/ T\.C\. Kimlik|Telefon veya T\.C\. kimlik numaranız/i).fill(
      NEGATIVE_INPUT_PAYLOADS.xssScript,
    )
    await page.getByPlaceholder(/••••••••|Şifreniz/i).fill('herhangi-bir-sifre')
    const kvkkBox = page.locator('#login-kvkk')
    if (await kvkkBox.isVisible().catch(() => false)) await kvkkBox.check()
    const notifBox = page.locator('#login-notif')
    if (await notifBox.isVisible().catch(() => false)) await notifBox.check()

    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(e.message))

    await page.getByRole('button', { name: /Giriş Yap/i }).click()
    await page.waitForTimeout(2000)

    // Sayfa çökmemeli.
    expect(pageErrors, pageErrors.join('; ')).toHaveLength(0)
    // Script tag'i DOM'da çalıştırılabilir formda bulunmamalı.
    const executableScript = await page.locator('script:has-text("alert(1)")').count()
    expect(executableScript).toBe(0)
    // Sayfa hâlâ login'de olmalı (kayıt edilmeden reddedilmiş).
    await expect(page).toHaveURL(/\/login/)
  })
})
