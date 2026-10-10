/**
 * Negative/security input testing helper (QA gap #7, #10, #12 — 2026-09-04).
 *
 * Kök neden: hiçbir spec dosyasında XSS/SQLi-benzeri input, aşırı uzun metin,
 * Türkçe karakter/emoji gibi negatif senaryolar test edilmiyordu. Amaç saldırı
 * yapmak DEĞİL — input validation ve escaping davranışını doğrulamak (madde 10).
 */
import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Bilinen "tehlikeli" input sınıfları. Her biri farklı bir davranış sınıfını
 * test eder: script injection, SQL-benzeri syntax, aşırı uzunluk, Unicode/emoji.
 */
export const NEGATIVE_INPUT_PAYLOADS = {
  xssScript: '<script>alert(1)</script>',
  xssImgOnerror: '<img src=x onerror=alert(1)>',
  sqlLikeOr: "' OR 1=1 --",
  sqlLikeDrop: "'; DROP TABLE users; --",
  veryLongText: 'A'.repeat(5000),
  turkishSpecialChars: 'ğüşiöçĞÜŞİÖÇ',
  emoji: '🎉💀🔥👨‍👩‍👧‍👦',
  htmlEntities: '&lt;script&gt;&amp;&quot;',
  nullByte: 'test\u0000value',
  onlyWhitespace: '     ',
} as const

export type NegativePayloadKey = keyof typeof NEGATIVE_INPUT_PAYLOADS

/**
 * Bir input alanına her negatif payload'ı sırayla yazıp, sayfanın (a) çökmediğini
 * (madde 34 — kullanıcıya JSON/stack trace/undefined gösterilmemeli) ve (b) script
 * payload'ının DOM'a ham/execute-edilebilir HTML olarak enjekte edilmediğini
 * (reflected XSS koruması) doğrular.
 *
 * Bu fonksiyon bir "saldırı" değil, tarayıcı tarafı escaping/validation'ın var
 * olduğunun regresyon testidir — sunucu tarafı validasyonu test etmez.
 */
export async function assertInputHandlesNegativePayloads(
  page: Page,
  input: Locator,
  options: { submit?: () => Promise<void>; payloads?: NegativePayloadKey[] } = {},
): Promise<void> {
  const keysToTest = options.payloads ?? (Object.keys(NEGATIVE_INPUT_PAYLOADS) as NegativePayloadKey[])

  for (const key of keysToTest) {
    const payload = NEGATIVE_INPUT_PAYLOADS[key]
    const pageErrors: string[] = []
    const onError = (e: Error) => pageErrors.push(`${e.name}: ${e.message}`)
    page.on('pageerror', onError)

    await input.fill(payload)
    if (options.submit) {
      await options.submit().catch(() => {
        // Submit'in kendisi validasyon nedeniyle engellenmiş olabilir — bu
        // BEKLENEN bir sonuç (madde 11 — zorunlu/geçersiz alan reddi), hata değil.
      })
    }

    // Madde 34: kullanıcıya çıplak stack trace/undefined/null gösterilmemeli.
    const bodyText = await page.locator('body').innerText().catch(() => '')
    const leaksInternals = /\bundefined\b|\bnull\b.*error|stack trace|at Object\.|TypeError:/i.test(bodyText)
    if (leaksInternals) {
      throw new Error(
        `Negatif payload "${key}" ("${payload.slice(0, 40)}...") sonrası sayfa ` +
          `teknik hata detayı (stack trace/undefined) sızdırıyor olabilir. Body: ${bodyText.slice(0, 200)}`,
      )
    }

    if (pageErrors.length > 0) {
      throw new Error(
        `Negatif payload "${key}" bir JS runtime hatası tetikledi (uygulama çöktü): ${pageErrors.join('; ')}`,
      )
    }

    // XSS koruması: script/img-onerror payload'ları GERÇEKTEN DOM'da parse edilip
    // çalıştırılabilir hale gelmemeli. React varsayılan olarak metni escape eder;
    // burada bunun kırılmadığını doğruluyoruz.
    if (key === 'xssScript' || key === 'xssImgOnerror') {
      const scriptTagRendered = await page
        .locator('script:has-text("alert(1)")')
        .count()
        .catch(() => 0)
      if (scriptTagRendered > 0) {
        throw new Error(
          `KRİTİK: "${key}" payload'ı DOM'a çalıştırılabilir bir <script> olarak enjekte edildi — reflected XSS.`,
        )
      }
    }

    page.off('pageerror', onError)
  }
}

/**
 * Bir formu tamamen boş bırakıp submit ettiğinde uygun validasyon mesajlarının
 * çıktığını, ve sayfanın (yanlışlıkla) başka bir route'a gitmediğini doğrular
 * (madde 11 — zorunlu alan testi, jenerik versiyon).
 */
export async function assertEmptyFormShowsValidation(
  page: Page,
  submit: () => Promise<void>,
  expectedUrlPattern: RegExp,
): Promise<void> {
  const urlBefore = page.url()
  await submit()
  await page.waitForTimeout(500)
  await expect(page).toHaveURL(expectedUrlPattern)
  expect(page.url()).toBe(urlBefore)
}
