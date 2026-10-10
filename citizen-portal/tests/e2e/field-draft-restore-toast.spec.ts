import { test, expect, type Page } from '@playwright/test'

// Hata (2026-09-02, kullanıcı bildirdi): "Yarım kalan kayıt geri yüklendi." bildirimi
// sürekli düşüyordu. Kök neden: taslak yalnızca anket gönderilince siliniyor; anketör
// göndermeden çıkarsa taslak diskte kalıyor ve göreve HER girişte bildirim yeniden
// tetikleniyordu (React StrictMode'da ayrıca mount başına iki kez).
//
// Bu test kök nedeni ölçer: aynı taslakla ekran iki kez açıldığında bildirim yalnızca
// ilk açılışta görünmeli, ikinci açılışta görünmemeli; cevaplar yine geri yüklenmeli.

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

async function openFirstTask(page: Page) {
  await page.goto('/saha')
  await expect(page.getByText('Saha Anket Sistemi')).toBeVisible({ timeout: 15000 })
  await dismissMandatoryAnnouncements(page)
  await page.getByRole('button', { name: /^Anketler/ }).last().click()
  const startBtn = page.getByRole('button', { name: /Anketi Başlat|^Başlat$/ }).first()
  await expect(startBtn).toBeVisible({ timeout: 20000 })
  await startBtn.click()
  // Taslak yoksa kimlik adımı, taslak varsa doğrudan soru adımı açılır.
  await expect(
    page.getByText('Görüşülen kişi').or(page.getByText('Katılımcı Bilgileri')),
  ).toBeVisible({ timeout: 20000 })
}

test('yarım kalan kayıt bildirimi yalnızca bir kez gösterilir', async ({ page }) => {
  test.setTimeout(150000)
  await login(page)
  await openFirstTask(page)

  // Bu görev için cevabı olan bir taslak yaz (anketör yarıda bırakmış gibi).
  const taskId = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('nexora_field_draft_'))
    keys.forEach((k) => localStorage.removeItem(k))
    return null
  })
  void taskId

  await page.evaluate(() => {
    // Ekrandaki aktif görevin kimliğini URL yerine runner'ın yazdığı anahtardan alamayız;
    // bu yüzden bilinen bir sahte kimlikle değil, gerçek görev kimliğiyle yazmalıyız.
    // Runner ilk cevabı yazınca anahtar oluşacağı için burada bir şey yapmıyoruz.
  })

  // İlk soruya bir cevap ver → otomatik kayıt taslağı oluşturur.
  await page.getByRole('button', { name: /Anonim|İsimsiz/ }).first().click()
  const ageBtn = page.getByRole('button', { name: '25-34' }).first()
  if (await ageBtn.isVisible().catch(() => false)) await ageBtn.click()
  const genderBtn = page.getByRole('button', { name: /^Erkek$/ }).first()
  if (await genderBtn.isVisible().catch(() => false)) await genderBtn.click()
  await page.getByRole('button', { name: /Ankete başla/ }).click()
  await page.waitForTimeout(500)

  const option = page.locator('button[role="radio"], button[role="checkbox"]').first()
  await expect(option).toBeVisible({ timeout: 15000 })
  await option.click()
  await page.waitForTimeout(2000) // otomatik kayıt (1.2 sn) tamamlansın

  const draftKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith('nexora_field_draft_')))
  expect(draftKeys.length, 'taslak yazılmalı').toBeGreaterThan(0)

  // 1. açılış: görevden çık ve tekrar gir → bildirim BİR KEZ görünür.
  await page.getByRole('button', { name: 'Görevlerime dön' }).first().click().catch(async () => {
    await page.getByLabel('Görevlerime dön').click()
  })
  await page.waitForTimeout(800)
  await openFirstTask(page)
  await expect(page.getByText('Yarım kalan kayıt geri yüklendi.')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(5000) // toast kaybolsun

  // 2. açılış: aynı taslakla tekrar girildiğinde bildirim ARTIK GÖRÜNMEZ.
  await page.reload()
  await openFirstTask(page)
  await page.waitForTimeout(2500)
  await expect(page.getByText('Yarım kalan kayıt geri yüklendi.')).toHaveCount(0)

  // Taslak yine de geri yüklenmiş olmalı (cevaplar kaybolmadı).
  const stillHasDraft = await page.evaluate(() =>
    Object.keys(localStorage).some((k) => k.startsWith('nexora_field_draft_')))
  expect(stillHasDraft, 'taslak korunmalı').toBe(true)
})
