import { test, expect, type Page } from '@playwright/test'

// Kullanıcı isteği (2026-09-01) kapsamında saha modunun portal ile birlikte yaşayan
// davranışlarını doğrular:
//  1. Vatandaş portalını seçen saha görevlisi, /anketler ekranındaki kısayolla saha
//     sistemine geçebilmeli (yeniden giriş yapmak zorunda kalmamalı).
//  2. /saha ekranında anketörün KENDİ bekleyen zorunlu anketi (PendingSurveyGate)
//     saha görüşmesini bloklamamalı.
//  3. Kapalı tarih aralığındaki görevde "Anket doldur" devre dışı olmalı.

const TCKN = process.env.FIELD_TCKN || '10028544554'
const PASSWORD = process.env.FIELD_PASSWORD || 'Test1234!'
const OTP = process.env.MOCK_OTP || '111111'

async function loginAsInterviewer(page: Page) {
  // İlk kullanım tanıtım turu (OnboardingWizard) tam ekran overlay açar ve tıklamaları
  // engeller; test profili her koşumda temiz olduğu için bayrak baştan set edilir.
  await page.addInitScript(() => {
    try { window.localStorage.setItem('nexora_citizen_onboarding_done', '1') } catch { /* yok say */ }
  })
  await page.goto('/login')
  await page.locator('input').first().fill(TCKN)
  await page.getByPlaceholder(/Şifre/i).first().fill(PASSWORD)
  await page.getByRole('button', { name: /Giriş Yap/i }).click()
  await page.waitForURL(/\/login\/otp/, { timeout: 20000 })
  const quick = page.getByRole('button', { name: /Hızlı Test/ })
  if (await quick.isVisible().catch(() => false)) {
    await quick.click()
  } else {
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

test.describe('Saha modu ile vatandaş portalı bir arada', () => {
  test('portalı seçen anketör /anketler kısayoluyla saha sistemine geçer', async ({ page }) => {
    await loginAsInterviewer(page)

    // Mod seçiminde bilinçli olarak vatandaş portalını seç.
    if (page.url().includes('/mod-secimi')) {
      await page.getByRole('button', { name: /Vatandaş Portalı/ }).click()
    }
    await page.goto('/anketler')

    // Portal modunda anketörün KENDİ bekleyen anketi modal olarak açılabilir; isteğe bağlı
    // anket modali kapatılıp saha kısayoluna erişilebildiği doğrulanır.
    // İlk kullanım tanıtım turu ("Atla") açıksa kapat.
    const skipTour = page.getByRole('button', { name: 'Atla' })
    if (await skipTour.isVisible().catch(() => false)) {
      await skipTour.click()
      await page.waitForTimeout(500)
    }

    const modalClose = page.getByRole('button', { name: /Kapat|Daha sonra|Şimdi değil/ })
    if (await modalClose.first().isVisible().catch(() => false)) {
      await modalClose.first().click()
      await page.waitForTimeout(500)
    } else {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }

    const shortcut = page.getByRole('button', { name: /Saha Anket Sistemi/ })
    await expect(shortcut).toBeVisible({ timeout: 20000 })
    await shortcut.click()

    await page.waitForURL(/\/saha/, { timeout: 20000 })
    await expect(page.getByRole('heading', { name: 'Saha Anket Sistemi' })).toBeVisible()
  })

  test('/saha ekranı zorunlu anket modali ile bloklanmaz ve kapalı görev pasiftir', async ({ page }) => {
    await loginAsInterviewer(page)
    await page.goto('/saha')

    await expect(page.getByRole('table')).toBeVisible({ timeout: 20000 })

    // PendingSurveyGate'in tam ekran bloklayıcı modali saha modunda görünmemeli.
    await page.waitForTimeout(1500)
    await expect(page.getByRole('button', { name: /Ankete Başla|Anketi Doldur/ })).toHaveCount(0)
    await expect(page.getByRole('table')).toBeVisible()

    // Koşullu blokların sessizce atlanmadığını garanti et: en az bir kapalı görev olmalı.
    await expect(page.getByText(/Tarih dışı|Hedef doldu|Günlük kota doldu/).first()).toBeVisible({ timeout: 10000 })

    // Kapalı tarih aralığındaki görev satırında buton devre dışı olmalı.
    // Hedefi dolmuş görev de pasif olmalı ve nedeni "Hedef doldu" yazmalı (E2E ile bulunan
    // ve düzeltilen kusurun regresyon koruması).
    const fullRow = page.getByRole('row').filter({ hasText: 'KotaDolu' })
    if (await fullRow.count() > 0) {
      await expect(fullRow.first().getByText('Hedef doldu')).toBeVisible()
      await expect(fullRow.first().getByRole('button', { name: /Anket doldur/ })).toBeDisabled()
    }

    const closedRow = page.getByRole('row').filter({ hasText: 'Eski' })
    if (await closedRow.count() > 0) {
      // Kapanma nedeni satırda görünür (Tarih dışı / Hedef doldu / Günlük kota doldu).
      await expect(closedRow.first().getByText(/Tarih dışı|Hedef doldu|Günlük kota doldu/)).toBeVisible()
      await expect(closedRow.first().getByRole('button', { name: /Anket doldur/ })).toBeDisabled()
    }
  })
})
