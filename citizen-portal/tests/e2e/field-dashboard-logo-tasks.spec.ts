import { test, expect } from '@playwright/test'

// Kullanıcı isteği (2026-09-01): /saha panelinde sistem logosu görünsün ve en az 10 anket
// görevi listelensin.
//
// Kullanıcı isteği (2026-09-02): dashboard sekmesinde LİSTE/TABLO olmasın — yalnızca özet
// kartları. Katılımcılar TABLO değil, tıklanabilir BUTON olarak görünsün. Bu test artık
// üçünü de doğrular: logo, dashboard'da tablo YOKLUĞU, katılımcıların buton olması.

const TCKN = process.env.E2E_TCKN!
const PASSWORD = process.env.E2E_PASSWORD!
const OTP = process.env.MOCK_OTP || '111111'

test('saha paneli: logo, dashboard\'da tablo yok, katılımcılar buton olarak görünür', async ({ page }) => {
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

  await page.goto('/saha')
  await expect(page.getByText('Saha Anket Sistemi')).toBeVisible({ timeout: 15000 })

  // 1) Sistem logosu üst barda görünür (public/logo.png).
  const logo = page.locator('header img[alt="Sultan Şehir"]')
  await expect(logo).toBeVisible()
  expect(await logo.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)

  // 2) "TABLET" rozeti yok.
  await expect(page.locator('header').getByText('Tablet', { exact: true })).toHaveCount(0)

  // 3) Açılış sekmesi Dashboard'dır ve HİÇBİR TABLO içermez (kullanıcı isteği 2026-09-02).
  await expect(page.getByRole('button', { name: 'Dashboard' })).toHaveClass(/bg-indigo-600/)
  await expect(page.locator('table')).toHaveCount(0)

  // 4) Metrik kartları gerçekten TIKLANABİLİR (buton) ve ilgili filtreye/sekmeye götürür.
  const openCard = page.getByRole('button', { name: /^\d+ Açık Görev$/ })
  await expect(openCard).toBeVisible()
  await openCard.click()
  await expect(page.getByRole('button', { name: 'Anketler', exact: false })).toHaveClass(/bg-indigo-600/)
  // "Açık" filtresi otomatik seçili gelir.
  await expect(page.getByRole('button', { name: /^Açık\s*\d*$/ })).toHaveClass(/bg-indigo-600/)

  // Dashboard'a dön.
  await page.getByRole('button', { name: 'Dashboard' }).click()
  await expect(page.locator('table')).toHaveCount(0)

  // 5) Katılımcı listesi varsa TABLO değil, her biri tek başına TIKLANABİLİR BUTON'dur.
  const participantsHeading = page.getByText('Ankete Katılan Kişiler')
  await expect(participantsHeading).toBeVisible()
  const participantCountText = await page.locator('text=/\\d+ katılımcı/').first().textContent()
  const count = Number((participantCountText ?? '0').match(/\d+/)?.[0] ?? 0)
  if (count > 0) {
    const firstParticipant = page.locator('button:has-text("SG-")').first()
    await expect(firstParticipant).toBeVisible()
    // Buton olduğu ve tıklanabilir olduğu doğrulanır (disabled değil).
    await expect(firstParticipant).toBeEnabled()
  }
})
