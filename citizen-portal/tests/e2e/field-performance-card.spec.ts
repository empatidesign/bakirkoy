import { test, expect } from '@playwright/test'

// Kullanıcı isteği (2026-09-02): "anketörler sayfasında da alınan anketler sayıları
// performans" görünsün. Bu test, gerçek verisi olan bir anketörle giriş yapıp saha
// panelindeki performans kartının DOLU geldiğini doğrular.

const API = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const OTP = process.env.MOCK_OTP || '111111'

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  return { status: res.status, body: await res.json().catch(() => null) as any }
}

async function adminToken(): Promise<string> {
  const l = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }) })
  if (l.body?.data?.accessToken) return l.body.data.accessToken
  const v = await api('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ otpSessionToken: l.body?.data?.otpSessionToken, code: OTP }) })
  return v.body?.data?.accessToken
}

/** En çok anket toplamış anketör için tek kullanımlık giriş kodu üretir. */
async function topInterviewerBypass(): Promise<{ code: string; completed: number }> {
  const tok = await adminToken()
  const auth = { Authorization: `Bearer ${tok}` }
  const perf = await api('/surveys/interviewer-performance', { headers: auth })
  const rows = (perf.body?.data?.interviewers ?? []).filter((r: any) => r.completedCount > 0)
  if (rows.length === 0) throw new Error('Yanıt toplamış anketör yok; önce fill-sultangazi-responses.mjs çalıştırın.')
  const top = rows[0]
  const bp = await api(`/auth/citizen/${top.interviewerId}/bypass-code`, { method: 'POST', headers: auth })
  return { code: bp.body?.data?.code as string, completed: top.completedCount as number }
}

test.use({ viewport: { width: 1194, height: 834 } })

test('anketör panelinde kişisel performans kartı dolu gelir', async ({ page }) => {
  const { code, completed } = await topInterviewerBypass()

  await page.addInitScript(() => {
    try { window.localStorage.setItem('nexora_citizen_onboarding_done', '1') } catch { /* yok say */ }
  })
  await page.goto(`/bypass?code=${encodeURIComponent(code)}&to=/saha`)
  await page.waitForURL(/\/saha/, { timeout: 25000 })

  // İlk girişte KVKK/bildirim onay modalı çıkabilir; panel bunun arkasında kalır.
  // Onay modalı çıkarsa kapat (bypass ile ilk girişte tetiklenir).
  const consent = page.getByText('Devam Etmeden Önce')
  if (await consent.isVisible().catch(() => false)) {
    const boxes = page.locator('input[type="checkbox"]')
    const count = await boxes.count()
    for (let i = 0; i < count; i++) await boxes.nth(i).check({ force: true }).catch(() => {})
    for (const cb of await page.getByRole('checkbox').all()) await cb.check({ force: true }).catch(() => {})
    await page.getByRole('button', { name: /Onaylayıp Devam Et/ }).click({ force: true }).catch(() => {})
    await expect(consent).toBeHidden({ timeout: 15000 }).catch(() => {})
  }

  // Performans kartı görünür ve gerçek sayılarla dolu olmalı.
  await expect(page.getByText('Performansım')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('Hedefe ulaşma')).toBeVisible()
  await expect(page.getByText('Toplam Anket')).toBeVisible()
  await expect(page.getByText('Ort. Görüşme')).toBeVisible()
  await expect(page.getByText('Çalışılan Mahalle')).toBeVisible()

  // "Toplam Anket" değeri sıfır olmamalı (bu anketör gerçekten kayıt toplamış).
  const totalCard = page.locator('section', { hasText: 'Performansım' })
  await expect(totalCard).toContainText(String(completed))

  // Görev tablosu da dolu olmalı.
  await expect(page.getByText('Açık Görevler ve Toplanan Anketler')).toBeVisible()

  if (process.env.FIELD_PERF_SHOT) {
    // Ekran görüntüsü, panel gerçekten görünür olduktan sonra alınır.
    await expect(page.getByText('Performansım')).toBeVisible()
    await page.waitForTimeout(600)
    await page.screenshot({ path: process.env.FIELD_PERF_SHOT, fullPage: true })
  }
})
