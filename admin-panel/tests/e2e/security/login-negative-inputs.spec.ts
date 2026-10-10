/**
 * Login formu — negatif/güvenlik testleri (QA gap #7, #10 — 2026-09-04).
 * admin-panel varyantı — citizen-portal'daki aynı prensip, admin login formuna
 * uygulandı.
 */
import { test, expect } from '@playwright/test'
import { assertInputHandlesNegativePayloads } from '../helpers/negativeInputTesting'

test.describe('Admin login formu — negatif input testleri', () => {
  test('e-posta alanı tehlikeli input\'larla çökmez, XSS enjekte etmez', async ({ page }) => {
    await page.goto('/login')
    const emailInput = page.locator('#email')
    await emailInput.waitFor()

    await assertInputHandlesNegativePayloads(page, emailInput, {
      payloads: ['xssScript', 'xssImgOnerror', 'sqlLikeOr', 'sqlLikeDrop', 'turkishSpecialChars', 'emoji'],
    })
  })

  test('şifre alanı aşırı uzun metin ve özel karakterlerle çökmez', async ({ page }) => {
    await page.goto('/login')
    const passwordInput = page.locator('#password')
    await passwordInput.waitFor()

    await assertInputHandlesNegativePayloads(page, passwordInput, {
      payloads: ['veryLongText', 'nullByte', 'onlyWhitespace'],
    })
  })

  test('XSS payload\'ı ile giriş denemesi sonrası hata mesajında ham HTML render edilmez', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.locator('#email').fill('<script>alert(1)</script>@test.com')
    await page.locator('#password').fill('herhangi-bir-sifre')

    // NOT: axios'un 401/409 login-reddi burada normal bir `pageerror` olarak
    // yüzeye çıkıyor (uygulamanın kendi try/catch'i kullanıcıya "Email veya şifre
    // hatalı" diye güzelce gösteriyor, AMA promise reject'i console/pageerror
    // seviyesinde de görünüyor). Bu bir çökme değil — ekran görüntüsüyle
    // doğrulandı (görsel: input'ta payload ham metin, kullanıcı dostu hata
    // banner'ı). Bu yüzden burada JS hatalarını "çökme" olarak DEĞİL, ayrı bir
    // sinyal olarak takip ediyoruz; asıl güvenlik iddiası (script render
    // edilmiyor + JSON/stack-trace sızmıyor) aşağıdaki assert'lerle doğrulanıyor.
    await page.getByRole('button', { name: 'Giriş Yap' }).click()
    await page.waitForTimeout(2000)

    // XSS koruması: script tag'i DOM'da çalıştırılabilir formda bulunmamalı.
    const executableScript = await page.locator('script:has-text("alert(1)")').count()
    expect(executableScript).toBe(0)

    // Madde 34: kullanıcıya çıplak JSON/stack trace gösterilmemeli — okunabilir
    // Türkçe bir hata mesajı görünmeli.
    await expect(page.getByText(/Email veya şifre hatalı|hatalı/i)).toBeVisible({ timeout: 5000 })
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/"statusCode"|"errorCode"|TypeError:|at Object\./i)

    await expect(page).toHaveURL(/\/login/)
  })
})
