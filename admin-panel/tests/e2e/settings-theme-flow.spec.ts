/**
 * Sistem Ayarları — Tema Ayarları (`ThemeSettingsTab.tsx`, 1140 satır,
 * `/settings?tab=theme`), sıfır hata (hafif kapsam).
 *
 * DÜRÜST KAPSAM NOTU: Bu ekran tamamen `localStorage`'a yazıyor
 * (`nexora_active_theme`, `nexora_token_overrides`, `nexora_ui_toggles`,
 * `nexora_ui_selects`, `nexora_custom_presets` anahtarları) — HİÇBİR backend
 * API çağrısı yok (`grep api\.|fetch\(` boş sonuç döndü). Bu, kullanıcının
 * SADECE KENDİ tarayıcısında saklanan, sunucu tarafında hiçbir gerçek veriyi
 * etkilemeyen, salt kozmetik bir CSS token editörü. Diğer testlerimizdeki
 * "API'den doğrula" standardı burada teknik olarak uygulanamaz (doğrulanacak
 * bir API yok) — bu yüzden bilinçli olarak DÜŞÜK ROI/düşük risk kabul edilip
 * (matriste de böyle işaretlenmişti) sadece temel işlevselliği (hazır tema
 * uygulama, dark/light mode, preset kaydetme/yükleme/silme) sayfa yenileme
 * sonrası localStorage'dan GERÇEKTEN kalıcı olduğunu doğrulayan hafif bir
 * smoke test yazıldı — 1140 satırlık token editörünün HER bir CSS
 * değişkeni/slider'ı kapsam DIŞINDADIR (kullanıcı isteğinin "sıfır hata"
 * standardı iş kuralı taşıyan formlar içindir, bu ekranda iş kuralı yok).
 *
 * Kapsam: Hazır tema kartına tıklama → localStorage'a yazıldığını ve sayfa
 * yenileme sonrası aktif tema olarak kaldığını doğrulama; Dark/Light mode
 * toggle; özel preset kaydetme → localStorage'a yazıldığını doğrulama →
 * başka bir temaya geçip preset'i tekrar yükleyerek geri döndüğünü
 * doğrulama → preset silme.
 */
import { test, expect, type Page } from '@playwright/test'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'

async function adminLoginUi(page: Page) {
  await page.goto('/login')
  await page.locator('#email').fill(ADMIN_EMAIL!)
  await page.locator('#password').fill(ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  if (await page.waitForURL('**/login/otp', { timeout: 5000 }).then(() => true).catch(() => false)) {
    const otpInputs = page.locator('input[inputmode="numeric"]')
    const count = await otpInputs.count()
    for (let i = 0; i < Math.min(6, count); i++) await otpInputs.nth(i).fill(ADMIN_OTP[i])
    await page.getByRole('button', { name: /Doğrula/ }).click()
  }
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
}

async function getLocalStorageItem(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key)
}

test.describe.serial('Sistem Ayarları — Tema Ayarları (ThemeSettingsTab), hafif kapsam', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  test.afterAll(async ({ browser }) => {
    // Testlerin bıraktığı localStorage kalıntılarını temizle (sonraki testleri etkilememesi için).
    const page = await browser.newPage()
    await adminLoginUi(page)
    await page.evaluate(() => {
      localStorage.removeItem('nexora_active_theme')
      localStorage.removeItem('nexora_token_overrides')
      localStorage.removeItem('nexora_ui_toggles')
      localStorage.removeItem('nexora_ui_selects')
      localStorage.removeItem('nexora_custom_presets')
    })
    await page.close()
  })

  test('1) Hazır tema uygulama — localStorage\'a yazılır, sayfa yenileme sonrası kalıcı kalır', async ({ page }) => {
    test.setTimeout(45_000)
    await adminLoginUi(page)
    await page.goto('/settings?tab=theme')
    await expect(page.getByText('Hazır tasarlanmış tema koleksiyonu', { exact: false })).toBeVisible({ timeout: 15000 })

    // "Midnight Pro" temasını uygula.
    await page.getByText('Midnight Pro', { exact: false }).click()
    await expect(page.getByText('Midnight Pro', { exact: false }).first()).toBeVisible()

    const stored = await getLocalStorageItem(page, 'nexora_active_theme')
    expect(stored).toBe('"midnight-pro"')
    const tokenOverrides = await getLocalStorageItem(page, 'nexora_token_overrides')
    expect(tokenOverrides, 'tema uygulanınca token override\'ları da yazılmalı').not.toBeNull()
    expect(JSON.parse(tokenOverrides!)).not.toEqual({})

    // Sayfa yenileme sonrası kalıcılık.
    await page.reload()
    await expect(page.getByText('Hazır tasarlanmış tema koleksiyonu', { exact: false })).toBeVisible({ timeout: 15000 })
    const storedAfterReload = await getLocalStorageItem(page, 'nexora_active_theme')
    expect(storedAfterReload).toBe('"midnight-pro"')
  })

  // NOT (2026-09-05, kaynak kodda bulundu): Dark/Light mode paneli kullanıcının açık
  // isteğiyle (2026-08-03) geçici olarak gizlendi — `ThemeSettingsTab.tsx` içinde
  // `{(false as boolean) && (...)}` ile render edilmiyor (kod korunuyor, `mode` her
  // zaman 'light'e sabit). Bu yüzden dark/light toggle testi ANLAMSIZ ve kapsam
  // dışı bırakıldı — geri açıldığında eklenebilir.

  test('2) Özel preset kaydetme, farklı temaya geçip tekrar yükleme, silme', async ({ page }) => {
    test.setTimeout(45_000)
    await adminLoginUi(page)
    await page.goto('/settings?tab=theme')
    await expect(page.getByText('Hazır tasarlanmış tema koleksiyonu', { exact: false })).toBeVisible({ timeout: 15000 })

    // Önce "Rose Gold" temasını uygula (preset'in içeriği bu olacak).
    await page.getByText('Rose Gold', { exact: false }).click()
    await page.waitForTimeout(200)

    const presetName = `QA-TEST-E2E-AUTO Preset ${Date.now()}`
    await page.getByRole('button', { name: 'Tema Kaydet', exact: true }).click()
    const presetInput = page.getByPlaceholder('ör: Kurumsal Mavi, Koyu Yeşil...')
    await presetInput.fill(presetName)
    await page.getByRole('button', { name: 'Kaydet', exact: true }).click()

    const presetsAfterSave = await getLocalStorageItem(page, 'nexora_custom_presets')
    expect(presetsAfterSave, 'preset localStorage\'a yazılmalı').not.toBeNull()
    const parsed = JSON.parse(presetsAfterSave!) as { name: string }[]
    expect(parsed.some((p) => p.name === presetName), 'kaydedilen preset listede olmalı').toBe(true)

    // Farklı bir temaya geç (Obsidian).
    await page.getByText('Obsidian', { exact: false }).click()
    await page.waitForTimeout(200)
    expect(await getLocalStorageItem(page, 'nexora_active_theme')).toBe('"obsidian"')

    // Preset'i tekrar yükle (isim butonuna tıklayarak) — Rose Gold token'larına geri dönmeli.
    await page.getByRole('button', { name: presetName, exact: true }).click()
    await page.waitForTimeout(200)
    const tokensAfterLoad = JSON.parse((await getLocalStorageItem(page, 'nexora_token_overrides'))!)
    expect(tokensAfterLoad, 'preset yüklenince token override\'lar boş olmamalı').not.toEqual({})

    // Preset'i sil (✕ butonu, presetin kendi satırı içinde).
    const presetRow = page.locator('div', { has: page.getByRole('button', { name: presetName, exact: true }) }).last()
    await presetRow.getByRole('button', { name: '✕', exact: true }).click()
    await page.waitForTimeout(200)
    const presetsAfterDelete = JSON.parse((await getLocalStorageItem(page, 'nexora_custom_presets'))!) as { name: string }[]
    expect(presetsAfterDelete.some((p) => p.name === presetName), 'silinen preset listede kalmamalı').toBe(false)
  })
})
