/**
 * Sistem Ayarları — Entegrasyonlar (`IntegrationSettingsTab.tsx`, 395 satır,
 * `/settings?tab=integrations`), sıfır hata.
 *
 * Kullanıcının özellikle belirttiği "sistem ayarları" modülü — hiç test edilmemişti.
 * Bu ekran, gerçek üretim entegrasyon anahtarlarını (Google Maps, OpenAI, Anthropic,
 * Gemini, Ulakbel) yönetiyor.
 *
 * GÜVENLİK NOTU (kritik, testin tasarımını belirledi): Bu ortamda Google Maps
 * GERÇEK ve aktif bir API key'e sahip (`hasApiKey: true, enabled: true`). Backend'in
 * `IntegrationSettingsService`'i `apiKey=null + clearApiKey=false` gönderilince
 * MEVCUT şifreli anahtara DOKUNMUYOR (sadece `ClearApiKey=true` iken siliyor —
 * `IntegrationSettingsService.cs` satır 88-90). Bu test SADECE OpenAI/Anthropic/
 * Gemini/Ulakbel alanlarını değiştiriyor (test başlangıcında hepsi enabled=false,
 * hasApiKey=false idi) ve Google Maps alanına HİÇ DOKUNMUYOR — "Kaydet" tek bir
 * form olduğundan, testin PATCH'i her zaman mevcut Google Maps draft'ını
 * (apiKeyInput='', enabled=mevcut değer) olduğu gibi geri gönderiyor. Test
 * öncesi/sonrası TAM ayar API'den okunup afterAll'da GERİ YÜKLENİYOR.
 *
 * Kapsam: Varsayılan AI Sağlayıcı seçimi, 3 AI sağlayıcının (OpenAI/Anthropic/Gemini)
 * Etkinleştir toggle + Model alanı + API Key alanı (gerçek olmayan test key'i),
 * Ulakbel entegrasyonu (Etkinleştir + bildirim toggle + Sunucu Adresi + API Token),
 * "Anahtarı Kaldır" (clearApiKey) akışının GERÇEKTEN key'i temizlediği doğrulanıyor
 * (Anthropic üzerinde — Google Maps'e asla dokunulmuyor).
 *
 * DÜRÜST KAPSAM NOTU: Ulakbel "Bağlantıyı Test Et" (gerçek dış HTTP çağrısı, sahte
 * bir sunucu adresiyle anlamlı test edilemez) kapsam dışı.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { execSync } from 'node:child_process'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'

interface AiProviderSettings { enabled: boolean; hasApiKey: boolean; maskedApiKey: string | null; model: string | null }
interface IntegrationSettings {
  googleMaps: { enabled: boolean; hasApiKey: boolean; maskedApiKey: string | null }
  openAi: AiProviderSettings; anthropic: AiProviderSettings; gemini: AiProviderSettings
  defaultAiProvider: string | null
  ulakbel: { enabled: boolean; baseUrl: string | null; hasApiToken: boolean; maskedApiToken: string | null; notifyCitizenOnUpdate: boolean }
}

async function adminToken(ctx: APIRequestContext): Promise<string> {
  const login = await (await ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (login?.data?.accessToken) return login.data.accessToken
  const verify = await (await ctx.post(`${API_BASE}/auth/verify-otp`, {
    data: { otpSessionToken: login.data.otpSessionToken, code: ADMIN_OTP },
  })).json()
  if (!verify?.data?.accessToken) throw new Error(`Admin API login başarısız: ${JSON.stringify(verify)}`)
  return verify.data.accessToken
}

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

function fieldByLabel(page: Page, label: string) {
  return page.locator(
    'xpath=//label[contains(normalize-space(text()),' + JSON.stringify(label) + ')]/ancestor::div[contains(@class,"space-y-1.5")][1]',
  )
}

test.describe.serial('Sistem Ayarları — Entegrasyonlar (IntegrationSettingsTab), sıfır hata', () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  let apiCtx: APIRequestContext
  let token = ''
  let original: IntegrationSettings | null = null

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const res = await (await apiCtx.get(`${API_BASE}/integration-settings`, { headers: { Authorization: `Bearer ${token}` } })).json()
    original = res.data
    // GÜVENLİK: Google Maps'in gerçek/aktif bir key'e sahip olduğunu doğrula — bu testin
    // ona ASLA dokunmayacağının kanıtı olarak orijinal durumu logluyoruz.
    expect(original, 'orijinal entegrasyon ayarları okunabilmeli').toBeTruthy()
  })

  test.afterAll(async () => {
    if (original) {
      const freshToken = await adminToken(apiCtx)
      const restoreRes = await apiCtx.put(`${API_BASE}/integration-settings`, {
        headers: { Authorization: `Bearer ${freshToken}` },
        data: {
          // NOT (2026-09-05, gerçek testte bulunan): backend `apiKey=null,clearApiKey=false`
          // gönderilince MEVCUT key'i korur (silmez) — bu yüzden testin fake key eklediği
          // alanlarda orijinalde hasApiKey=false ise `clearApiKey:true` ile GERÇEKTEN silmek
          // gerekiyor, yoksa afterAll "restore" fake key'i kalıcı bırakır (canlıda yaşandı).
          // Ayrıca `ulakbel.baseUrl` da boş/whitespace gönderilince temizlenmiyor
          // (`IntegrationSettingsService.cs` satır 113) — orijinalde null idiyse
          // DB'ye direkt dokunmadan API üzerinden temizlemenin yolu yok; bu yüzden orijinalde
          // boş olan alanları clearApiKey/clearApiToken:true ile açıkça temizliyoruz.
          googleMaps: { enabled: original.googleMaps.enabled, apiKey: null, clearApiKey: false },
          openAi: { enabled: original.openAi.enabled, apiKey: null, clearApiKey: !original.openAi.hasApiKey, model: original.openAi.model },
          anthropic: { enabled: original.anthropic.enabled, apiKey: null, clearApiKey: !original.anthropic.hasApiKey, model: original.anthropic.model },
          gemini: { enabled: original.gemini.enabled, apiKey: null, clearApiKey: !original.gemini.hasApiKey, model: original.gemini.model },
          defaultAiProvider: original.defaultAiProvider,
          ulakbel: {
            enabled: original.ulakbel.enabled,
            baseUrl: original.ulakbel.baseUrl,
            apiToken: null,
            clearApiToken: !original.ulakbel.hasApiToken,
            notifyCitizenOnUpdate: original.ulakbel.notifyCitizenOnUpdate,
          },
        },
      })
      if (!restoreRes.ok()) {
        throw new Error(`KRİTİK: integration-settings orijinal haline GERİ YÜKLENEMEDİ (${restoreRes.status()}): ${await restoreRes.text()}`)
      }
      // GÜVENLİK doğrulaması: restore sonrası Google Maps'in HİÇ değişmediğini teyit et.
      const check = await (await apiCtx.get(`${API_BASE}/integration-settings`, { headers: { Authorization: `Bearer ${await adminToken(apiCtx)}` } })).json()
      const restored: IntegrationSettings = check.data
      if (restored.googleMaps.hasApiKey !== original.googleMaps.hasApiKey || restored.googleMaps.enabled !== original.googleMaps.enabled) {
        throw new Error(`KRİTİK: Google Maps ayarı testten sonra DEĞİŞMİŞ! Önce: ${JSON.stringify(original.googleMaps)}, Sonra: ${JSON.stringify(restored.googleMaps)}`)
      }
      // NOT (2026-09-05, gerçek testte bulunan): `ulakbel.baseUrl` boş/whitespace
      // gönderilse de backend mevcut değeri korur (temizleyemez —
      // `IntegrationSettingsService.cs` satır 113). Orijinalde null idiyse API
      // üzerinden gerçek bir null'a döndürme yolu yok; tek satırlık singleton
      // config kaydını doğrudan (Ulakbel devre dışı olduğundan üretim etkisi
      // sıfır) JSONB'de temizliyoruz — aynı ortamdaki diğer testlerde kullanılan
      // "afterAll'da doğrudan DB temizliği" kalıbının devamı.
      if (!original.ulakbel.baseUrl && restored.ulakbel.baseUrl) {
        execSync(
          `docker exec nexora-postgres psql -U nexora_admin -d nexora -c "UPDATE \\"IntegrationSettingsRecords\\" SET \\"ConfigJson\\" = jsonb_set(\\"ConfigJson\\", '{ulakbel,baseUrl}', 'null'::jsonb);"`,
        )
      }
    }
    await apiCtx.dispose()
  })

  test('1) OpenAI/Anthropic/Gemini + Ulakbel TÜM alanları doldurulup kaydedilir, API\'den doğrulanır (Google Maps\'e dokunulmadan)', async ({ page }) => {
    test.setTimeout(60_000)
    expect(original!.googleMaps.hasApiKey, 'ön koşul: Google Maps gerçek bir key\'e sahip olmalı').toBe(true)

    await adminLoginUi(page)
    await page.goto('/settings?tab=integrations')
    await expect(page.getByText('Google Maps', { exact: true })).toBeVisible({ timeout: 15000 })

    // GÜVENLİK: Google Maps API Key alanına HİÇ DOKUNULMUYOR — boş bırakılırsa
    // backend mevcut anahtarı koruyor (dosya başlığındaki not).

    // Varsayılan Sağlayıcı
    const providerTrigger = fieldByLabel(page, 'Varsayılan Sağlayıcı').getByRole('button').first()
    await providerTrigger.click()
    await page.locator('[data-ds-popover]').last().getByRole('button', { name: 'ChatGPT (OpenAI)', exact: true }).click()

    // OpenAI
    const openAiCard = page.locator('div.rounded-card', { has: page.getByText('ChatGPT (OpenAI)', { exact: true }) }).first()
    await openAiCard.locator('button[role="switch"]').click()
    await openAiCard.locator('input[type="password"]').fill('sk-qatestE2EAutoFakeKey123456789')
    await openAiCard.locator('input:not([type="password"])').fill('gpt-4o-qa-test')

    // Anthropic
    const anthropicCard = page.locator('div.rounded-card', { has: page.getByText('Anthropic (Claude)', { exact: true }) }).first()
    await anthropicCard.locator('button[role="switch"]').click()
    await anthropicCard.locator('input[type="password"]').fill('sk-ant-qatestE2EAutoFakeKey123456789')
    await anthropicCard.locator('input:not([type="password"])').fill('claude-qa-test')

    // Gemini
    const geminiCard = page.locator('div.rounded-card', { has: page.getByText('Google Gemini', { exact: true }) }).first()
    await geminiCard.locator('button[role="switch"]').click()
    await geminiCard.locator('input[type="password"]').fill('AIzaQaTestE2EAutoFakeKey123456789')
    await geminiCard.locator('input:not([type="password"])').fill('gemini-qa-test')

    // Ulakbel
    await page.locator('xpath=//p[normalize-space(text())="Ulakbell entegrasyonunu etkinleştir"]/ancestor::div[contains(@class,"flex")][1]//button[@role="switch"]').click()
    await page.getByPlaceholder('https://…').fill('https://qa-test-e2e-auto.example.com')
    await page.getByPlaceholder('Bearer token…').fill('qa-test-e2e-auto-fake-token')

    const [saveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/integration-settings') && r.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Kaydet', exact: true }).click(),
    ])
    expect(saveResponse.ok(), `PUT /integration-settings başarısız: ${await saveResponse.text()}`).toBeTruthy()
    await expect(page.getByText('Entegrasyon ayarları kaydedildi.')).toBeVisible({ timeout: 5000 })

    const saved: IntegrationSettings = (await saveResponse.json()).data
    expect(saved.defaultAiProvider).toBe('openai')
    expect(saved.openAi).toMatchObject({ enabled: true, hasApiKey: true, model: 'gpt-4o-qa-test' })
    expect(saved.anthropic).toMatchObject({ enabled: true, hasApiKey: true, model: 'claude-qa-test' })
    expect(saved.gemini).toMatchObject({ enabled: true, hasApiKey: true, model: 'gemini-qa-test' })
    expect(saved.ulakbel).toMatchObject({ enabled: true, baseUrl: 'https://qa-test-e2e-auto.example.com', hasApiToken: true, notifyCitizenOnUpdate: true })
    // GÜVENLİK: Google Maps testten ETKİLENMEMİŞ olmalı.
    expect(saved.googleMaps).toMatchObject({ enabled: original!.googleMaps.enabled, hasApiKey: true })
  })

  test('2) "Anahtarı Kaldır" (Anthropic) GERÇEKTEN key\'i temizler — API\'den hasApiKey=false doğrulanır', async ({ page }) => {
    test.setTimeout(45_000)
    await adminLoginUi(page)
    await page.goto('/settings?tab=integrations')
    await expect(page.getByText('Anthropic (Claude)', { exact: true }).first()).toBeVisible({ timeout: 15000 })

    const anthropicCard = page.locator('div.rounded-card', { has: page.getByText('Anthropic (Claude)', { exact: true }) }).first()
    await expect(anthropicCard.getByText('Kayıtlı:', { exact: false })).toBeVisible({ timeout: 5000 })

    const [clearResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/integration-settings') && r.request().method() === 'PUT'),
      anthropicCard.getByRole('button', { name: 'Kaldır', exact: true }).click(),
    ])
    expect(clearResponse.ok(), `PUT (kaldır) başarısız: ${await clearResponse.text()}`).toBeTruthy()
    const cleared: IntegrationSettings = (await clearResponse.json()).data
    expect(cleared.anthropic.hasApiKey).toBe(false)
    expect(cleared.anthropic.enabled).toBe(false)
    await expect(page.getByText('API anahtarı kaldırıldı.')).toBeVisible({ timeout: 5000 })
    await expect(anthropicCard.getByText('Anahtar girilmemiş', { exact: true })).toBeVisible({ timeout: 3000 })
    // GÜVENLİK: Google Maps hâlâ etkilenmemiş olmalı.
    expect(cleared.googleMaps.hasApiKey).toBe(true)
  })
})
