import { test as base } from '@playwright/test'

/**
 * Production Safety Guard (QA gap #1 — 2026-09-04).
 *
 * Kök neden: bu repoda destructive (create/update/delete) E2E testlerini production
 * baseURL'ine karşı çalıştırmayı engelleyen HİÇBİR mekanizma yoktu. Aynı gün canlı
 * Vault/API kesintisi yaşandı (bkz. docs/QA_MASTER_PROMPT_GAP_ANALYSIS_2026-09-04.md,
 * madde 61) — ayrı bir olay ama aynı sınıf risk: yanlış ortama karşı yanlışlıkla
 * yıkıcı bir işlem çalıştırmak.
 *
 * `assertDestructiveTestsAllowed` production'a benzeyen bir baseURL/NODE_ENV
 * gördüğünde `E2E_ALLOW_DESTRUCTIVE=1` açıkça verilmedikçe FAIL eder (atlamaz —
 * sessiz "skip" gerçek riski gizler, biz kırmızı görmek istiyoruz).
 */

const PRODUCTION_HOST_MARKERS = [
  'nexora.gov.tr',
  'sultangazi.bel.tr',
  'nexora.app',
  '.prod.',
  '.production.',
]

export function looksLikeProductionUrl(url: string | undefined): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  if (lower.includes('localhost') || lower.includes('127.0.0.1') || lower.includes('0.0.0.0')) {
    return false
  }
  return PRODUCTION_HOST_MARKERS.some((marker) => lower.includes(marker))
}

export function assertDestructiveTestsAllowed(baseURL: string | undefined): void {
  const nodeEnvIsProduction = process.env.NODE_ENV === 'production'
  const baseUrlIsProduction = looksLikeProductionUrl(baseURL)
  const explicitOverride = process.env.E2E_ALLOW_DESTRUCTIVE === '1'

  if ((nodeEnvIsProduction || baseUrlIsProduction) && !explicitOverride) {
    throw new Error(
      `PRODUCTION SAFETY GUARD: Bu test create/update/delete gibi yıkıcı işlemler içeriyor. ` +
        `Hedef ortam production görünüyor (NODE_ENV=${process.env.NODE_ENV ?? 'unset'}, ` +
        `baseURL=${baseURL ?? 'unset'}). Yanlışlıkla gerçek veriyi bozmayı önlemek için ` +
        `bu test bloklandı. Kasıtlı olarak production'a karşı çalıştırmak istiyorsan ` +
        `E2E_ALLOW_DESTRUCTIVE=1 ortam değişkenini açıkça ver.`,
    )
  }
}

/**
 * `test` — create/update/delete içeren bir spec dosyasında Playwright'ın kendi
 * `test`'i yerine bunu import et. Aynı API, ama her testten önce otomatik olarak
 * `assertDestructiveTestsAllowed(baseURL)` çalıştırır (fixture olarak, `auto: true`).
 *
 * Kullanım:
 * ```ts
 * import { test, expect } from '../helpers/productionSafety'
 * test('yeni kayıt oluşturur', async ({ page }) => { ... }) // guard otomatik çalışır
 * ```
 */
export const test = base.extend<{ productionSafetyGuard: void }>({
  productionSafetyGuard: [
    async ({ baseURL }, use) => {
      assertDestructiveTestsAllowed(baseURL)
      await use()
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
