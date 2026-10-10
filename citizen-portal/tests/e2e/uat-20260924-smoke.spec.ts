import { test, expect, Page } from '@playwright/test'

// UAT 24.09.2026 — oluşturulan test verisinin gerçek vatandaş arayüzünde göründüğünü doğrular.
// Çalıştırma: BASE_URL=http://localhost:3100 npx playwright test tests/e2e/uat-20260924-smoke.spec.ts --retries=0
const PASSWORD = 'Test1234!'
const OTP = '111111'

async function login(page: Page, tckn: string) {
  await page.addInitScript(() => localStorage.setItem('nexora_citizen_onboarding_done', '1'))
  await page.goto('/login')
  await page.getByPlaceholder(/05XX \/ T\.C\. Kimlik|Telefon veya T\.C\. kimlik numaranız/i).fill(tckn)
  await page.getByPlaceholder(/••••••••|Şifreniz/i).fill(PASSWORD)
  for (const id of ['#login-kvkk', '#login-notif']) {
    const box = page.locator(id)
    if (await box.isVisible().catch(() => false)) await box.check()
  }
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  await page.waitForURL('**/login/otp', { timeout: 40000 })
  const inputs = page.locator('input[inputmode="numeric"], input[maxlength="1"]')
  if ((await inputs.count()) >= 6) for (let i = 0; i < 6; i++) await inputs.nth(i).fill(OTP[i])
  else await page.locator('input').first().fill(OTP)
  await page.getByRole('button', { name: /^Doğrula/ }).first().click()
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 40000 })
}

test.describe.configure({ mode: 'serial' })

test('U05 (70 yaş): zorunlu anket modalı + etkinlik/gezi/spor listeleri', async ({ page }) => {
  await login(page, process.env.UAT_U05!)
  // Zorunlu anket modalı: pacing (60 dk) içinde tekrar gösterilmemeli. API'deki özet hangi durumda
  // olduğumuzu söyler; modal görünürlüğü bununla birebir eşleşmeli.
  // Beklenen modal durumu dışarıdan (API /me/surveys/pending/summary) verilir: UAT_U05_MODAL=1|0
  const modal = page.getByText(/Değerlendirme|Zorunlu Duyuru Anketi/).first()
  if (process.env.UAT_U05_MODAL === '1') {
    await expect(modal).toBeVisible({ timeout: 20000 })
    // Zorunlu anket modalı listeyi örter; kapatınca (X) 60 dk pacing başlar ve listeye geçilir.
    await page.getByRole('button', { name: /Kapat|close/i }).first().click().catch(() => page.keyboard.press('Escape'))
  } else await expect(modal).toBeHidden({ timeout: 8000 })
  await page.screenshot({ path: 'test-results/uat-u05-required-survey.png' })

  await page.goto('/etkinlikler')
  await expect(page.getByText('UAT · Yaşlılar Haftası Buluşması').first()).toBeVisible({ timeout: 20000 })
  await page.screenshot({ path: 'test-results/uat-u05-events.png' })

  await page.goto('/geziler')
  await expect(page.getByText(/UAT · Emekliler Sapanca Gezisi/).first()).toBeVisible({ timeout: 20000 })
  await expect(page.getByText(/UAT · Boğaz Vapur Turu/).first()).toBeVisible()
  await page.screenshot({ path: 'test-results/uat-u05-travels.png' })

  await page.goto('/spor')
  await expect(page.getByText(/Yaşınıza uygun/).first()).toBeVisible({ timeout: 20000 })
  await page.getByPlaceholder(/Spor, salon veya tesis ara/).fill('Yoga')
  await expect(page.getByText('UAT Yoga', { exact: true }).last()).toBeVisible({ timeout: 20000 })
  await page.screenshot({ path: 'test-results/uat-u05-sports.png' })
})

test('U07 (19 yaş kadın): anket listesi isteğe bağlı + gençlik anketi', async ({ page }) => {
  await login(page, process.env.UAT_U07!)
  await page.goto('/anketler')
  await expect(page.getByText('UAT Genel Memnuniyet Anketi (İsteğe Bağlı)').first()).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('UAT Gençlik Anketi').first()).toBeVisible()
  await page.screenshot({ path: 'test-results/uat-u07-surveys.png' })
})
