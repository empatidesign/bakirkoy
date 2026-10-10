import { test, expect, type Page } from '@playwright/test'
import { purgeCitizenSubmissionsByTitlePrefix } from './helpers/citizenSubmissionCleanup'

// Kullanıcı isteği (2026-09-05): "TC kimlik doğum tarihi sorgulaması olacak ... kişi
// talep bıraktığında anonim ise burdan o bilgileri isteyecek, başlangıçta vermişse o
// bilgilere göre doldurulacak". Bu test, anket kimlik adımında T.C. + doğum tarihi
// verilmiş bir görüşmede, anket bitmeden hızlı işlemler menüsünden açılan Talep/Öneri/
// Şikayet formunun TC ve doğum tarihini OTOMATİK doldurduğunu ve bu bilginin backend'e
// gerçekten (CitizenTc + CitizenBirthDate) yazıldığını uçtan uca doğrular.
//
// field-survey-form-layout.spec.ts içindeki kardeş test (anonim senaryo) sadece TC/doğum
// tarihi VERİLMEDİĞİNDE anonim + boş kaydedildiğini doğruluyordu; TC'li senaryoda otomatik
// doldurmanın gerçekten çalıştığını hiçbir test kapsamıyordu — bu boşluğu kapatır.

const API = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const TCKN = process.env.E2E_TCKN!
const PASSWORD = process.env.E2E_PASSWORD!
const OTP = process.env.MOCK_OTP || '111111'
const RESPONDENT_TCKN = '13140071298' // sistemde NVI ile doğrulanabilen sabit test TCKN'i
const RESPONDENT_BIRTHDATE = '1980-01-01'

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  return { status: res.status, body: await res.json().catch(() => null) as any }
}

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

test('T.C. kimlikli görüşmede doğum tarihi talep formuna otomatik aktarılır ve DB\'ye yazılır', async ({ page }) => {
  test.setTimeout(150000)
  await login(page)
  await page.evaluate(() => {
    Object.keys(localStorage).filter((k) => k.startsWith('nexora_field_draft_')).forEach((k) => localStorage.removeItem(k))
  })
  await page.goto('/saha')
  await expect(page.getByText('Saha Anket Sistemi')).toBeVisible({ timeout: 15000 })
  await dismissMandatoryAnnouncements(page)

  await page.getByRole('button', { name: /^Anketler/ }).last().click()
  const startTask = page.getByRole('button', { name: /Anketi Başlat/ }).first()
  await expect(startTask).toBeVisible({ timeout: 20000 })
  await startTask.click()
  await expect(page.getByText('Görüşülen kişi')).toBeVisible({ timeout: 20000 })

  // T.C. kimlikli modda TC + doğum tarihi ile NVI doğrulaması yap.
  await page.locator('input[inputmode="numeric"]').first().fill(RESPONDENT_TCKN)
  await page.locator('input[type="date"]').first().fill(RESPONDENT_BIRTHDATE)
  await page.getByRole('button', { name: /Kimliği Doğrula/ }).click()
  await expect(page.getByText(/Kimlik doğrulandı|NVI Doğrulandı/).first()).toBeVisible({ timeout: 20000 })

  // Mahalle zorunlu; kayıtlı gelmediyse elle seç.
  const hoodField = page.locator('[data-field="neighborhood"]')
  const hoodControl = hoodField.locator('button, select').first()
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

  await page.getByRole('button', { name: /Ankete başla/ }).first().click()
  await expect(page.getByText('Katılımcı Bilgileri')).toBeVisible({ timeout: 20000 })

  // Anketi bitirmeden, hamburger menüden "Hızlı işlemler" (Talep/Öneri/Şikayet) aç.
  await page.getByLabel('Menü').click()
  await page.getByText('Hızlı işlemler').click()
  await expect(page.getByText('Hızlı İşlemler')).toBeVisible({ timeout: 10000 })

  // T.C. ve Doğum Tarihi alanları anket kimlik adımından OTOMATİK gelmiş olmalı.
  const tcInput = page.locator('input[maxlength="11"]')
  await expect(tcInput).toHaveValue(RESPONDENT_TCKN, { timeout: 10000 })
  const birthDateInput = page.locator('input[type="date"]').first()
  await expect(birthDateInput).toHaveValue(RESPONDENT_BIRTHDATE, { timeout: 10000 })
  await expect(page.getByText(/sistemden geldi/).first()).toBeVisible()

  // Formu doldurup gönder.
  const marker = `BIRTHDATE-PREFILL-E2E-${Date.now()}`
  await page.fill('input[placeholder="Kısa başlık"]', marker)
  await page.fill('textarea', 'Doğum tarihi otomatik doldurma E2E testi.')
  const konuInput = page.locator('input[placeholder*="Konu ara"]')
  await konuInput.scrollIntoViewIfNeeded()
  await konuInput.click()
  await page.waitForTimeout(300)
  await konuInput.press('ArrowDown')
  await konuInput.press('Enter')

  await page.getByRole('button', { name: /Başvuruyu Kaydet/ }).click()
  await expect(page.getByText(/Başvuru oluşturuldu/)).toBeVisible({ timeout: 15000 })

  // Gerçek kanıt: DB'de kayıt TC ve doğum tarihiyle birlikte yazılmış olmalı.
  const login2 = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD }) })
  let tok = login2.body?.data?.accessToken
  if (!tok) {
    const v = await api('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ otpSessionToken: login2.body?.data?.otpSessionToken, code: OTP }) })
    tok = v.body?.data?.accessToken
  }
  const list = await api(`/citizen-submissions?page=1&limit=10&search=${marker}`, {
    headers: { Authorization: `Bearer ${tok}` },
  })
  const created = (list.body?.data?.items ?? []).find((x: { title?: string }) => x.title === marker)
  expect(created, 'Talep DB\'de bulunamadı').toBeTruthy()
  expect(created.citizenTc).toBe(RESPONDENT_TCKN)
  expect(created.citizenBirthDate, 'citizenBirthDate DB\'ye yazılmamış').toBeTruthy()
  // API tarih-saatli (offset'li) ISO string döner (ör. "1980-01-01T00:00:00+03:00");
  // saf `new Date(...)` ile ayrıştırmak yerel saat dilimine göre kaydırma yapabileceğinden
  // (UTC'ye çevrilir) sadece string'in tarih kısmını karşılaştırmak doğru ve kararlıdır.
  expect(String(created.citizenBirthDate).slice(0, 10)).toBe(RESPONDENT_BIRTHDATE)

  await purgeCitizenSubmissionsByTitlePrefix(marker)
})
