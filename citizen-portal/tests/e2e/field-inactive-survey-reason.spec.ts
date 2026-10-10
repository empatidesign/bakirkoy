import { test, expect, type Page } from '@playwright/test'

// Hata (2026-09-02, kullanıcı bildirdi): "/saha sayfasında anket bölümünde pasif anket
// başlamıyor, sebep nedir".
//
// Kök neden: Anket yönetici tarafından pasife alındığında (Survey.IsActive=false) görev
// haklı olarak kapanıyor, ANCAK anketör ekranı sebebi istemcide tahmin ediyordu ve
// "Tarih dışı" yazıyordu. Tarihler geçerli olduğu için bu mesaj yanlış yönlendiriyor,
// anketör neden başlatamadığını anlayamıyordu.
//
// Düzeltme: sebep artık backend'den (FieldTaskDto.closedReason) geliyor ve ekranda
// "Anket pasif" olarak gösteriliyor.

const API = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const TCKN = process.env.E2E_TCKN!
const PASSWORD = process.env.E2E_PASSWORD!
const OTP = process.env.MOCK_OTP || '111111'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!

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

test('pasif ankete bağlı görev "Anket pasif" sebebiyle gösterilir', async ({ page, request }) => {
  test.setTimeout(150000)

  const tokenOf = async (loginPath: string, verifyPath: string, data: Record<string, unknown>) => {
    const l = await (await request.post(`${API}${loginPath}`, { data })).json()
    if (l?.data?.accessToken) return { token: l.data.accessToken as string, user: l.data.user }
    const v = await (await request.post(`${API}${verifyPath}`, {
      data: { otpSessionToken: l.data.otpSessionToken, code: OTP },
    })).json()
    return { token: v.data.accessToken as string, user: v.data.user }
  }

  const citizen = await tokenOf('/auth/citizen/login', '/auth/citizen/verify-otp', { identifier: TCKN, password: PASSWORD })
  const admin = await tokenOf('/auth/login', '/auth/verify-otp', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  const auth = { Authorization: `Bearer ${admin.token}` }

  // Saha modu açık, aktif bir ankete görev ata.
  const surveys = await (await request.get(`${API}/surveys?page=1&limit=50`, { headers: auth })).json()
  const survey = (surveys.data?.items ?? []).find((s: { fieldEnabled: boolean; isActive: boolean }) => s.fieldEnabled && s.isActive)
  test.skip(!survey, 'Saha modu açık aktif anket yok')

  const created = await (await request.post(`${API}/surveys/field-tasks`, {
    headers: auth,
    data: {
      surveyId: survey.id, interviewerId: citizen.user.id, interviewerType: 'participant',
      neighborhood: 'Cebeci',
      startDate: new Date(Date.now() - 86_400_000).toISOString(),
      endDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      targetCount: 20, dailyTarget: 5, note: 'E2E pasif anket sebebi', status: 'assigned',
    },
  })).json()
  const taskId: string = created.data.id

  try {
    // Anketi pasife al → görev kapanmalı ve sebebi "survey_inactive" olmalı.
    await request.patch(`${API}/surveys/${survey.id}/toggle-status`, { headers: auth })

    const tasks = await (await request.get(`${API}/me/surveys/field/tasks`, {
      headers: { Authorization: `Bearer ${citizen.token}` },
    })).json()
    const row = (tasks.data ?? []).find((t: { id: string }) => t.id === taskId)
    expect(row.isWindowOpen).toBe(false)
    expect(row.closedReason, 'sebep backend\'den gelmeli').toBe('survey_inactive')

    // Ekranda "Tarih dışı" değil, "Anket pasif" yazmalı.
    await login(page)
    await page.goto('/saha')
    await expect(page.getByText('Saha Anket Sistemi')).toBeVisible({ timeout: 15000 })
    await dismissMandatoryAnnouncements(page)

    await page.getByRole('button', { name: /^Anketler/ }).last().click()
    // Pasif görev listenin sonunda olabilir; aramayla daraltıyoruz.
    await page.getByPlaceholder(/Anket veya kategori ara/i).fill(survey.title)
    await page.waitForTimeout(800)

    // Ekranda "Tarih dışı" değil "Anket pasif" yazmalı (regresyonun ölçüldüğü yer).
    await expect(page.getByText('Anket pasif').first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('Tarih dışı')).toHaveCount(0)

    // Kapalı görevin başlat düğmesi devre dışı olmalı.
    const startBtn = page.getByRole('button', { name: /Anketi Başlat/ }).first()
    await expect(startBtn).toBeVisible({ timeout: 10000 })
    await expect(startBtn).toBeDisabled()
  } finally {
    // Test verisini geri al: anketi aktif et, görevi sil.
    await request.patch(`${API}/surveys/${survey.id}/toggle-status`, { headers: auth })
    await request.delete(`${API}/surveys/field-tasks/${taskId}`, { headers: auth })
  }
})
