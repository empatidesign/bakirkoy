import { test, expect, type Page } from '@playwright/test'

// Kullanıcı isteği (2026-09-02): Android tablet uygulamasında "internet bağlantısı zayıf
// veya olmayacak bir moddaysa kaydedilecek ve bağlantı sağlandığında otomatik gönderilecek".
//
// Tablet kabuğu `window.AnketTablet` köprüsünü enjekte eder. Bu test, köprü varken
// çevrimdışı kalan bir anket kaydının localStorage'a değil NATIVE kuyruğa gittiğini
// doğrular — kayıt kaybı bu üründeki en pahalı hata olduğu için burada ölçülür.

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

test('tablet köprüsü varken çevrimdışı anket native kuyruğa yazılır', async ({ page, context }) => {
  test.setTimeout(150000)

  // Tablet kabuğunun enjekte ettiği köprüyü taklit et; çağrıları yakala.
  await page.addInitScript(() => {
    ;(window as unknown as { __queued: unknown[] }).__queued = []
    ;(window as unknown as { AnketTablet: unknown }).AnketTablet = {
      queue: (endpoint: string, body: string, token: string, label: string) => {
        ;(window as unknown as { __queued: unknown[] }).__queued.push({ endpoint, body, token, label })
      },
      pendingCount: () => (window as unknown as { __queued: unknown[] }).__queued.length,
      flushNow: () => { /* native tarafta WorkManager yürütür */ },
      isTabletApp: () => true,
    }
  })

  await login(page)
  await page.evaluate(() => {
    Object.keys(localStorage).filter((k) => k.startsWith('nexora_field_draft_')).forEach((k) => localStorage.removeItem(k))
    localStorage.removeItem('nexora_field_offline_queue')
  })

  await page.goto('/saha')
  await expect(page.getByText('Saha Anket Sistemi')).toBeVisible({ timeout: 15000 })
  await dismissMandatoryAnnouncements(page)

  await page.getByRole('button', { name: /^Anketler/ }).last().click()
  const startTask = page.getByRole('button', { name: /Anketi Başlat/ }).first()
  await expect(startTask).toBeVisible({ timeout: 20000 })
  await startTask.click()
  await expect(page.getByText('Görüşülen kişi')).toBeVisible({ timeout: 20000 })

  // Anonim katılımla hızlıca soru ekranına geç.
  await page.getByRole('button', { name: /Anonim|İsimsiz/ }).first().click()
  await page.waitForTimeout(400)
  // Mahalle görev mahallesinden öntanımlı gelmezse elle seç (anonim modda zorunlu).
  const hoodControl = page.locator('[data-field="neighborhood"]').locator('button, select').first()
  if (await hoodControl.count() > 0) {
    const label = (await hoodControl.innerText().catch(() => '')).trim()
    if (!label || /seçin/i.test(label)) {
      await hoodControl.click()
      await page.waitForTimeout(300)
      await page.getByRole('option').first().click().catch(async () => {
        await page.locator('[role="listbox"] >> nth=0').locator('button, li').first().click()
      })
    }
  }
  await page.getByTestId('anon-age-groups').getByRole('button').nth(2).click()
  await page.getByTestId('anon-genders').getByRole('button').first().click()
  await page.getByRole('button', { name: /Ankete başla/ }).first().click()
  await expect(page.getByText('Katılımcı Bilgileri')).toBeVisible({ timeout: 20000 })

  const radios = page.locator('button[role="radio"]')
  const count = await radios.count()
  for (let i = 0; i < Math.min(count, 6); i++) {
    const r = radios.nth(i)
    if (await r.isVisible().catch(() => false)) { await r.click(); await page.waitForTimeout(150) }
  }

  // Bağlantıyı kes: gönderim ağ hatasıyla düşecek.
  await context.setOffline(true)
  await page.getByRole('button', { name: /Anketi Tamamla/ }).first().click()
  await page.waitForTimeout(3000)

  // Kayıt NATIVE kuyruğa gitmeli (localStorage'a değil).
  const queued = await page.evaluate(() => (window as unknown as { __queued: Array<{ endpoint: string; body: string }> }).__queued)
  expect(queued.length, 'çevrimdışı kayıt native köprüye iletilmeli').toBeGreaterThan(0)
  expect(queued[0].endpoint).toMatch(/\/me\/surveys\/field\/tasks\/[^/]+\/responses$/)
  expect(JSON.parse(queued[0].body)).toHaveProperty('localUuid')

  // Native köprü varken web'in kendi localStorage kuyruğu KULLANILMAMALI (çift kayıt olmasın).
  const localQueue = await page.evaluate(() => localStorage.getItem('nexora_field_offline_queue'))
  expect(localQueue === null || JSON.parse(localQueue).length === 0).toBe(true)

  await context.setOffline(false)
})
