import { test, expect, type Page } from '@playwright/test'

// Hatalar (2026-09-02, kullanıcı bildirdi):
//  1) "anketörün kendi sayfasında talep giriş için talep formu açılmıyor" — talep/öneri/
//     şikayet formu YALNIZCA anket doldurma ekranında vardı; görev listesinde hiç yoktu.
//  2) "aktif anket başlatılamıyor" — kimlik adımındaki "Ankete başla" butonu, zorunlu
//     alanlar (mahalle/yaş/cinsiyet) dolmadan tamamen kapalıydı; anketör neyin eksik
//     olduğunu göremediği için anketi başlatamıyordu.

const TCKN = process.env.E2E_TCKN!
const PASSWORD = process.env.E2E_PASSWORD!
const OTP = process.env.MOCK_OTP || '111111'

/**
 * Zorunlu duyuru penceresi ("Okudum, anladım" onayı verilmeden kapanmaz) ekranı bloke eder.
 * Birden fazla onay bekleyen duyuru olabileceği için hepsi kapanana kadar döngüyle onaylanır.
 */
async function dismissMandatoryAnnouncements(page: Page) {
  const gate = page.getByTestId('mandatory-announcement')
  for (let i = 0; i < 15; i++) {
    if (!(await gate.isVisible().catch(() => false))) break
    const ackButton = gate.getByRole('button', { name: /Okudum/ }).first()
    if (!(await ackButton.isVisible().catch(() => false))) break
    await ackButton.click()
    await page.waitForTimeout(600)
  }
}

async function login(page: Page) {
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

async function openField(page: Page) {
  await page.goto('/saha')
  await expect(page.getByText('Saha Anket Sistemi')).toBeVisible({ timeout: 15000 })
  await dismissMandatoryAnnouncements(page)
}

test('görev listesinden talep formu açılır', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await openField(page)

  // Üst bardaki "Talep" düğmesi görev listesi ekranında bulunur ve formu açar.
  const talepBtn = page.getByTestId('field-quick-actions')
  await expect(talepBtn).toBeVisible({ timeout: 15000 })
  await talepBtn.click()

  // Form açıldı: modal başlığı, tür seçenekleri ve açıklama alanı görünür.
  await expect(page.getByText('Hızlı İşlemler')).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: /Talep \/ Öneri \/ Şikayet/ }).first()).toBeVisible()
  await expect(page.getByPlaceholder(/talep\/öneri\/şikayetini yazın/i)).toBeVisible()
  await page.screenshot({ path: 'test-results/talep-formu.png' })
})

test('kimlik adımında "Ankete başla" tıklanabilir ve eksik alanı bildirir', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)
  await page.evaluate(() => {
    Object.keys(localStorage).filter((k) => k.startsWith('nexora_field_draft_')).forEach((k) => localStorage.removeItem(k))
  })
  await openField(page)

  await page.getByRole('button', { name: /^Anketler/ }).last().click()
  const startTask = page.getByRole('button', { name: /Anketi Başlat/ }).first()
  await expect(startTask).toBeVisible({ timeout: 20000 })
  await startTask.click()
  await expect(page.getByText('Görüşülen kişi')).toBeVisible({ timeout: 20000 })

  // Anonim modda zorunlu alanlar boşken buton KAPALI OLMAMALI (regresyon: disabled'dı).
  await page.getByRole('button', { name: /Anonim|İsimsiz/ }).first().click()
  const begin = page.getByRole('button', { name: /Ankete başla/ }).first()
  await expect(begin).toBeVisible()
  await expect(begin).toBeEnabled()

  // Eksik alanla tıklanınca anketöre ne eksik olduğu söylenir.
  await begin.click()
  await expect(page.getByText(/Yaş grubunu seçin|Cinsiyet seçin|mahalleyi seçin/i).first())
    .toBeVisible({ timeout: 10000 })

  // Alanlar doldurulunca anket gerçekten başlar.
  const age = page.getByTestId('anon-age-groups').getByRole('button').first()
  await age.click()
  const gender = page.getByTestId('anon-genders').getByRole('button').first()
  await gender.click()
  await begin.click()
  await expect(page.getByText('Katılımcı Bilgileri')).toBeVisible({ timeout: 20000 })
  await page.screenshot({ path: 'test-results/anket-basladi.png' })
})

test('T.C. kimlikli modda anket başlatılabilir (mahalle düzenlenebilir)', async ({ page }) => {
  test.setTimeout(150000)
  await login(page)
  await page.evaluate(() => {
    Object.keys(localStorage).filter((k) => k.startsWith('nexora_field_draft_')).forEach((k) => localStorage.removeItem(k))
  })
  await openField(page)

  await page.getByRole('button', { name: /^Anketler/ }).last().click()
  const startTask = page.getByRole('button', { name: /Anketi Başlat/ }).first()
  await expect(startTask).toBeVisible({ timeout: 20000 })
  await startTask.click()
  await expect(page.getByText('Görüşülen kişi')).toBeVisible({ timeout: 20000 })

  // Varsayılan mod T.C. kimlikli: TC + doğum tarihi ile doğrula.
  await page.locator('input[inputmode="numeric"]').first().fill('13140071298')
  await page.locator('input[type="date"]').first().fill('1980-01-01')
  await page.getByRole('button', { name: /Kimliği Doğrula/ }).click()
  await expect(page.getByText(/Kimlik doğrulandı|NVI Doğrulandı/).first()).toBeVisible({ timeout: 20000 })

  // Regresyon: mahalle/yaş/cinsiyet salt-okunur değil, DÜZENLENEBİLİR olmalı.
  // Sorgudan boş dönerse anketör dolduramayıp anketi hiç başlatamıyordu.
  // Not: design-system Select yerel <select> değil, buton tabanlı bir bileşendir.
  const hoodField = page.locator('[data-field="neighborhood"]')
  await expect(hoodField).toHaveCount(1, { timeout: 10000 })
  await hoodField.scrollIntoViewIfNeeded()
  const hoodControl = hoodField.locator('button, select').first()
  await expect(hoodControl).toBeVisible({ timeout: 10000 })
  await expect(hoodControl).toBeEnabled()
  await expect(page.locator('[data-field="ageGroup"]').locator('button, select').first()).toBeEnabled()
  await expect(page.locator('[data-field="gender"]').locator('button, select').first()).toBeEnabled()

  // Anket gerçekten başlar.
  await page.getByRole('button', { name: /Ankete başla/ }).first().click()
  await expect(page.getByText('Katılımcı Bilgileri')).toBeVisible({ timeout: 20000 })
})
