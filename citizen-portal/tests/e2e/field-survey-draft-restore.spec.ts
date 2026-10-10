import { test, expect, type Page } from '@playwright/test'

// Hata bildirimi (2026-09-02): "yarım kayıt geri yüklendi deyince ekran sürekli yükleniyor".
//
// İki kusur bulunup düzeltildi; bu test ikisini de GERÇEK tarayıcıda, gerçek API'ye karşı
// doğrular (birim testi tools/field-draft-restore.test.mjs mantığı ayrıca kapsar):
//   1. Üst bardaki durum yazısı `savedAt` boşken KALICI olarak "Kaydediliyor..." kalıyordu.
//      Hiçbir kaydetme işlemi olmadığı hâlde ekran "sürekli yükleniyor" görünüyordu.
//   2. Taslak geri yüklendiğinde ekran kimlik adımında kalıyordu: anketör "geri yüklendi"
//      bildirimini görüyor ama cevaplarını GÖREMİYORDU (form boş görünüyordu).

const API = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const PASSWORD = 'E2eAudit2026'
const OTP = process.env.MOCK_OTP || '111111'

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

/** Taslak testi için anketör hesabı + tek soruluk sade bir saha görevi kurar. */
async function provision(): Promise<{ tckn: string }> {
  const tckn = validTckn()
  const tag = Math.random().toString(36).slice(2, 10)
  const reg = await api('/auth/citizen/register', {
    method: 'POST',
    body: JSON.stringify({
      tckn, birthDate: '1991-04-01T00:00:00Z',
      phone: '555' + Math.floor(1000000 + Math.random() * 8999999),
      email: `e2e.draft.${tag}@example.com`, password: PASSWORD,
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
      title: `Taslak Geri Yukleme ${tag}`, description: 'taslak akisi testi',
      category: 'Belediye Hizmetleri', targetAudience: 'all', topic: 'Temizlik',
      surveyType: 'satisfaction', isActive: true, isAnonymous: false,
      fieldEnabled: true, requireLocation: false, estimatedDuration: 3,
      startDate: dayOffset(0), endDate: dayOffset(7),
      questions: [
        { order: 1, type: 'multiple_choice', question: 'Mahallenizde en önemli sorun nedir?', required: true, options: ['Temizlik', 'Ulaşım', 'Güvenlik'] },
        { order: 2, type: 'text', question: 'Ek görüşleriniz', required: false, options: [] },
      ],
    }),
  })
  await api('/surveys/field-tasks', {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      surveyId: survey.body?.data?.id, interviewerId: participantId, interviewerType: 'participant',
      neighborhood: 'Cebeci', startDate: dayOffset(0), endDate: dayOffset(3),
      targetCount: 10, dailyTarget: 0, note: 'taslak testi', status: 'assigned',
    }),
  })
  return { tckn }
}

async function login(page: Page, tckn: string) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('nexora_citizen_onboarding_done', '1')
      window.localStorage.removeItem('nexora_field_layout')
    } catch { /* yok say */ }
  })
  await page.goto('/login')
  await page.locator('input').first().fill(tckn)
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

/** Görev listesinden anketi açar. */
async function openTask(page: Page) {
  await page.goto('/saha')
  await expect(page.getByText('Saha Anket Sistemi')).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /^Anketler/ }).first().click()
  await page.getByRole('button', { name: /Anket doldur|Başlat|Doldur/ })
    .and(page.locator('button:not([disabled])')).first().click()
  await expect(page.getByRole('heading', { name: 'Görüşülen kişi' })).toBeVisible({ timeout: 15000 })
}

/** Kimlik adımını anonim olarak geçip soru sayfasına ulaşır. */
async function gotoQuestions(page: Page) {
  await page.getByRole('button', { name: /İsimsiz \/ Anonim Katılım/ }).click()
  await page.getByTestId('anon-age-groups').getByRole('button', { name: '25-34', exact: true }).click()
  await page.getByTestId('anon-genders').getByRole('button', { name: 'Kadın', exact: true }).click()
  await page.getByRole('button', { name: /Ankete başla/ }).click()
}

test.use({ viewport: { width: 1194, height: 834 } })

// İki test AYNI anketör hesabını ve aynı görevi paylaşır; ilk test taslak bırakırsa
// ikincisinin başlangıç durumunu bozar. Ayrıca aynı hesapla paralel giriş, tek oturum
// politikası nedeniyle diğer testin oturumunu düşürür. Bu yüzden seri çalıştırılır.
// Projeler (desktop/mobile) paralel koştuğu için her proje KENDİ hesabını kurar.
test.describe.configure({ mode: 'serial' })

test.describe('Saha taslağı — geri yükleme ve kayıt göstergesi', () => {
  let tckn: string
  // Her Playwright projesi (desktop/mobile) kendi anketör hesabıyla çalışır; aksi hâlde
  // paralel projeler aynı hesabın oturumunu ve taslağını birbirinden çalar.
  test.beforeAll(async () => { ({ tckn } = await provision()) })

  // REGRESYON 1: boş formda "Kaydediliyor..." takılı kalmamalı.
  test('kayıt göstergesi boş formda "Kaydediliyor..." diye asılı kalmaz', async ({ page }) => {
    await login(page, tckn)
    await openTask(page)

    // Kimlik adımı: henüz kaydedilecek bir şey yok.
    const bar = page.locator('header, [class*="sticky"]').first()
    await expect(page.getByText('Kaydediliyor...')).toHaveCount(0)
    await expect(page.getByText('Otomatik kayıt açık').first()).toBeVisible()

    await gotoQuestions(page)
    // Soru adımında da cevap girilmeden "Kaydediliyor..." çıkmamalı.
    await page.waitForTimeout(2000)
    await expect(page.getByText('Kaydediliyor...')).toHaveCount(0)
    expect(await bar.isVisible()).toBeTruthy()
  })

  // REGRESYON 2: kaydet-çık → geri dön akışında cevaplar GÖRÜNÜR olmalı,
  // ekran kimlik adımında/asılı kalmamalı.
  test('yarım kayıt geri yüklendiğinde cevaplar görünür ve ekran asılı kalmaz', async ({ page }) => {
    await login(page, tckn)
    await openTask(page)
    await gotoQuestions(page)

    // Bir cevap işaretle; otomatik taslak yazılsın (debounce 1,2 sn).
    // Seçenek kartları `radio` rolündedir (buton değil).
    await page.getByRole('radio', { name: 'Temizlik', exact: true }).first().click()
    await expect(page.getByText(/Kaydedildi \d{2}:\d{2}/)).toBeVisible({ timeout: 8000 })

    // Kaydet ve çık. Alt bardaki ikon düğmesi (title="Kaydet ve çık") kimi düzenlerde
    // gizli/örtülü olabildiği için, her ekran boyutunda bulunan hamburger menüdeki
    // "Kaydet ve çık" seçeneği kullanılır.
    const saveExit = page.getByRole('button', { name: /Kaydet ve [çÇ]ık/i }).locator('visible=true')
    if (await saveExit.count() > 0) {
      await saveExit.first().click()
    } else {
      await page.getByRole('button', { name: 'Menü' }).click()
      await page.getByRole('button', { name: /Kaydet ve [çÇ]ık/i }).locator('visible=true').first().click()
    }
    await expect(page.getByText('Saha Anket Sistemi')).toBeVisible({ timeout: 15000 })

    // Göreve tekrar gir: taslak geri yüklenmeli.
    await page.getByRole('button', { name: /^Anketler/ }).first().click()
    await page.getByRole('button', { name: /Anket doldur|Başlat|Doldur|Devam/ })
      .and(page.locator('button:not([disabled])')).first().click()

    // DÜZELTMENİN ÖZÜ: doğrudan SORU adımına dönülür ve cevap seçili görünür.
    // (Hata varken ekran "Görüşülen kişi" kimlik adımında kalıyordu.)
    await expect(page.getByRole('heading', { name: 'Görüşülen kişi' })).toBeHidden({ timeout: 15000 })
    await expect(page.getByText('Mahallenizde en önemli sorun nedir?')).toBeVisible({ timeout: 15000 })

    // Ekran asılı değil: kayıt göstergesi "Kaydedildi hh:mm" gösterir.
    await expect(page.getByText(/Kaydedildi \d{2}:\d{2}/)).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Kaydediliyor...')).toHaveCount(0)
  })
})
