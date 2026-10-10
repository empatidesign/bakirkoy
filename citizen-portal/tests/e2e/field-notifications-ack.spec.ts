import { test, expect } from '@playwright/test'

// Kullanıcı isteği (2026-09-02): anketörün sayfasında gelen mesaj/bildirimler tarih-saatiyle
// listelensin, "Okudum" onayı ekranda verilsin; onay adminde görünsün.
// Bu test anketör tarafını uçtan uca doğrular: duyuru gönder → listede gör → Okudum → admin API onayı görür.

const API = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const TCKN = process.env.E2E_TCKN!
const PASSWORD = process.env.E2E_PASSWORD!
const OTP = process.env.MOCK_OTP || '111111'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!

test('anketör bildirim listesi: tarih-saat, "Okudum" onayı ve admin görünürlüğü', async ({ page, request }) => {
  test.setTimeout(120000)

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
  const interviewerId: string = citizen.user.id

  const title = `E2E Okudum ${Date.now().toString().slice(-6)}`
  const sendRes = await request.post(`${API}/surveys/interviewers/messages`, {
    headers: { Authorization: `Bearer ${admin.token}` },
    data: { title, body: 'Bu duyuruyu okuduğunuzu onaylayın.', interviewerIds: [interviewerId], notify: true, sms: false, requiresAck: true },
  })
  expect(sendRes.ok()).toBeTruthy()

  // Anketör olarak giriş
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

  await page.goto('/saha')
  await expect(page.getByText('Saha Anket Sistemi')).toBeVisible({ timeout: 15000 })

  // Zorunlu duyuru popup'ı açılırsa önce onu geçelim ki liste testi tek yolu ölçsün.
  const gateAck = page.getByRole('button', { name: /Okudum/ }).first()
  if (await gateAck.isVisible().catch(() => false)) {
    await gateAck.click()
    await page.waitForTimeout(1000)
  }

  // Bildirimler sekmesi: duyuru başlığı, gönderim tarih-saati görünür.
  await page.getByTestId('field-notifications-tab').click()
  await expect(page.getByText('Mesaj ve Bildirimler')).toBeVisible({ timeout: 15000 })
  const row = page.getByTestId('field-notification-item').filter({ hasText: title }).first()
  await expect(row).toBeVisible({ timeout: 15000 })
  await expect(row.getByText(/Gönderim: \d{2}\.\d{2}\.\d{4}/)).toBeVisible()

  // Popup'tan onaylanmadıysa listeden "Okudum" ile onayla.
  const ackBtn = row.getByRole('button', { name: 'Okudum' })
  if (await ackBtn.isVisible().catch(() => false)) {
    await ackBtn.click()
  }
  await expect(row.getByText('OKUNDU ONAYLANDI')).toBeVisible({ timeout: 15000 })
  await expect(row.getByText(/Okudum onayı: \d{2}\.\d{2}\.\d{4}/)).toBeVisible()
  await page.screenshot({ path: 'test-results/anketor-bildirimler.png' })

  // Admin API: onay alıcı bazında görünür.
  type Summary = { title: string; readCount: number; acknowledgedCount: number; receipts: Array<{ interviewerName: string; isRead: boolean; acknowledgedAt: string | null }> }
  const list = await (await request.get(`${API}/surveys/interviewers/notifications?interviewerId=${interviewerId}&take=10`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  })).json()
  const summary = (list.data as Summary[]).find((r) => r.title === title)
  expect(summary, 'duyuru admin listesinde olmalı').toBeTruthy()
  expect(summary!.readCount).toBe(1)
  expect(summary!.acknowledgedCount).toBe(1)
  expect(summary!.receipts[0].acknowledgedAt).toBeTruthy()
})
