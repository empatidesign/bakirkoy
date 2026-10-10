/**
 * Visual regression baseline (QA gap #8, #41-43 — 2026-09-04).
 *
 * Kök neden: repoda `toHaveScreenshot` kullanımı SIFIRDI. Ekran görüntüleri
 * alınıyordu (`screenshot: 'only-on-failure'`, video-proof klasörleri) ama
 * bunlar sadece debug/kanıt amaçlıydı — baseline'a karşı piksel karşılaştırması
 * yapan gerçek bir visual regression sistemi yoktu.
 *
 * public-portal ilk baseline için seçildi: auth gerektirmiyor (CI'da güvenilir
 * çalışır, login flake riski yok), küçük ve stabil bir yüzeyi var (3 sayfa).
 *
 * İlk çalıştırmada baseline'lar `--update-snapshots` ile üretilmeli:
 *   npx playwright test tests/e2e/visual/ --update-snapshots
 * Sonraki çalıştırmalarda mevcut baseline'a karşı karşılaştırılır.
 */
import { test, expect } from '@playwright/test'

test.describe('Visual regression — kritik ekranlar', () => {
  test('ana sayfa', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('home-page.png', { fullPage: true })
  })

  test('etkinlikler listesi', async ({ page }) => {
    await page.goto('/etkinlikler')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('events-list-page.png', { fullPage: true })
  })

  test('hizmet tesisleri listesi', async ({ page }) => {
    await page.goto('/tesisler')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('facilities-list-page.png', { fullPage: true })
  })
})
