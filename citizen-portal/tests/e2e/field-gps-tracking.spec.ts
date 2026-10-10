import { test, expect, type Page } from '@playwright/test'
import { SurveyTrash } from './helpers/surveyCleanup'

// Kullanıcı isteği (2026-09-01): "canlı haritada saha görevlileri canlı takip edilecek, GPS
// açık olacak, ne kadar yürüdüğünü nereleri gezdiğini de takip edeceğiz."
//
// Bu test, zincirin İLK halkasını gerçek tarayıcıda doğrular: saha görevlisi ekranı açtığında
// tarayıcı konum izni verilmişse arka planda /me/surveys/field/location isteği gider, başlıkta
// "GPS açık" rozeti ve yürünen mesafe görünür. İzin reddedildiğinde ise takip durur ve görevli
// "Konum izni kapalı" uyarısını görür (yönetici neden iz göremediğini anlayabilsin).

const API = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'

// Hata bulgusu (2026-09-02): bu testin oluşturduğu anketler DB'de kalıp Mahalle
// Analizi ekranının demografisini çarpıtıyordu. Artık koşum sonunda siliniyor.
const trash = new SurveyTrash(API, () => adminToken())
test.afterAll(async () => { await trash.purge() })
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const PASSWORD = 'E2eAudit2026'
const OTP = process.env.MOCK_OTP || '111111'

// Test kendi anketörünü ve saha görevini kurar; sabit bir test hesabına bağlı kalmaz
// (şifresi değişen paylaşılan hesap yüzünden kırılmasın diye).
function validTckn(): string {
  const n: number[] = [1 + Math.floor(Math.random() * 9)]
  for (let i = 1; i < 9; i++) n.push(Math.floor(Math.random() * 10))
  const odd = n[0] + n[2] + n[4] + n[6] + n[8]
  const even = n[1] + n[3] + n[5] + n[7]
  n.push((((odd * 7) - even) % 10 + 10) % 10)
  n.push(n.slice(0, 10).reduce((a, b) => a + b, 0) % 10)
  return n.join('')
}

const dayOffset = (o: number) =>
  new Date(Date.now() + 3 * 3600_000 + o * 86400_000).toISOString().slice(0, 10)

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

/** Yeni bir anketör vatandaş kaydeder ve ona açık bir saha görevi atar; TCKN döner. */
async function provisionInterviewer(): Promise<string> {
  const tckn = validTckn()
  const tag = Math.random().toString(36).slice(2, 10)
  const reg = await api('/auth/citizen/register', {
    method: 'POST',
    body: JSON.stringify({
      tckn, birthDate: '1993-07-01T00:00:00Z',
      phone: '555' + Math.floor(1000000 + Math.random() * 8999999),
      email: `e2e.gps.${tag}@example.com`, password: PASSWORD,
    }),
  })
  const v = await api('/auth/citizen/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ otpSessionToken: reg.body?.data?.otpSessionToken, code: OTP }),
  })
  const token: string = v.body?.data?.accessToken
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
  const participantId = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? payload.sub

  const tok = await adminToken()
  const auth = { Authorization: `Bearer ${tok}` }
  const survey = await api('/surveys', {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      title: `GPS Takip E2E ${tag}`, description: 'Playwright GPS doğrulaması',
      category: 'Belediye Hizmetleri', targetAudience: 'all', topic: 'Temizlik',
      surveyType: 'satisfaction', isActive: true, isAnonymous: false,
      fieldEnabled: true, requireLocation: false, estimatedDuration: 2,
      startDate: dayOffset(0), endDate: dayOffset(7),
      questions: [{ order: 1, type: 'satisfaction', question: 'Mahallenizden memnun musunuz?', required: true, options: [] }],
    }),
  })
  trash.add(survey.body?.data?.id)
  await api('/surveys/field-tasks', {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      surveyId: survey.body?.data?.id, interviewerId: participantId, interviewerType: 'participant',
      neighborhood: 'Cebeci', startDate: dayOffset(0), endDate: dayOffset(3),
      targetCount: 10, dailyTarget: 0, note: 'playwright gps', status: 'assigned',
    }),
  })
  return tckn
}

// Sultangazi merkezi — saha görevlisinin başlangıç konumu.
const START = { latitude: 41.0766, longitude: 28.8716 }

async function loginAsInterviewer(page: Page, tckn: string) {
  await page.addInitScript(() => {
    try { window.localStorage.setItem('nexora_citizen_onboarding_done', '1') } catch { /* yok say */ }
  })
  await page.goto('/login')
  await page.locator('input').first().fill(tckn)
  await page.getByPlaceholder(/Şifre/i).first().fill(PASSWORD)
  await page.getByRole('button', { name: /Giriş Yap/i }).click()
  await page.waitForURL(/\/login\/otp/, { timeout: 20000 })
  const quick = page.getByRole('button', { name: /Hızlı Test/ })
  if (await quick.isVisible().catch(() => false)) {
    await quick.click()
  } else {
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

async function openFieldScreen(page: Page) {
  if (page.url().includes('/mod-secimi')) {
    await page.getByRole('button', { name: /Anket Sistemi/ }).click()
  } else {
    await page.goto('/saha')
  }
  await page.waitForURL(/\/saha/, { timeout: 20000 })
  // Saha kabuğu bir dashboard ile açılır; başlık artık heading değil metin olarak render edilir.
  await expect(page.getByText('Saha Anket Sistemi')).toBeVisible({ timeout: 15000 })
}

test.describe('Saha görevlisi GPS canlı takibi', () => {
  let tckn: string
  test.beforeAll(async () => { tckn = await provisionInterviewer() })

  test('konum izni verildiğinde ping gönderilir ve "GPS açık" rozeti görünür', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(START)

    const pings: Array<{ latitude: number; longitude: number }> = []
    page.on('request', (req) => {
      if (req.url().includes('/me/surveys/field/location') && req.method() === 'POST') {
        try { pings.push(JSON.parse(req.postData() || '{}')) } catch { /* yok say */ }
      }
    })

    await loginAsInterviewer(page, tckn)
    await openFieldScreen(page)

    // İlk ping ekran açılır açılmaz (watchPosition ilk konumu verdiğinde) gitmeli.
    await expect.poll(() => pings.length, { timeout: 20000, message: 'İlk GPS ping gönderilmedi' })
      .toBeGreaterThan(0)
    expect(Math.abs(pings[0].latitude - START.latitude)).toBeLessThan(0.01)
    expect(Math.abs(pings[0].longitude - START.longitude)).toBeLessThan(0.01)

    // Rozet "GPS açık" durumuna geçmeli (sunucu ping'i kabul etti demektir).
    await expect(page.getByText('GPS açık')).toBeVisible({ timeout: 20000 })

    // Görevli hareket edince (≥15 m) yeni ping gitmeli ve sunucu yürünen yolu döndürmeli.
    await context.setGeolocation({ latitude: START.latitude + 0.0015, longitude: START.longitude + 0.0015 })
    await expect.poll(() => pings.length, { timeout: 25000, message: 'Hareket sonrası ikinci ping gitmedi' })
      .toBeGreaterThan(1)

    // Yürünen mesafe göstergesi (km) saha dashboard'unda "Bugün Yürünen" kartında görünür.
    await expect(page.getByText('Bugün Yürünen').first()).toBeVisible({ timeout: 25000 })
    await expect(page.getByText(/\d+\.\d{2} km/).first()).toBeVisible({ timeout: 25000 })
  })

  test('konum izni reddedildiğinde takip durur ve görevli uyarılır', async ({ page, context }) => {
    await context.clearPermissions()

    let pingCount = 0
    page.on('request', (req) => {
      if (req.url().includes('/me/surveys/field/location')) pingCount++
    })

    await loginAsInterviewer(page, tckn)
    await openFieldScreen(page)

    await expect(page.getByText('Konum izni kapalı')).toBeVisible({ timeout: 25000 })
    expect(pingCount, 'İzin yokken konum gönderilmemeli').toBe(0)
  })
})
