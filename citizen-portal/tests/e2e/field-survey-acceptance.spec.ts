import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { waitIdle } from './helpers/videoProof'

// Kabul testi: saha anket akışı UÇTAN UCA gerçek sistemle çalışır.
// field-survey-tablet.spec.ts görev verisini route ile sağlıyor (yerleşim
// ölçümünü veri durumundan bağımsız kılmak için); bu dosya ise hiçbir şeyi
// taklit etmez: gerçek giriş, gerçek API, gerçek veritabanı kaydı.
//
// Ön koşul: test katılımcısına bir saha görevi atanmış olmalı. Atanmamışsa
// test kendini atlar (dev veritabanı durumu testin sorumluluğu değil).
// Görev atamak için:  node tests/e2e/fixtures/seed-field-survey-task.mjs
const MIN_TOUCH = 44
const API = process.env.E2E_API_BASE || 'http://localhost:5207/api/v1'

async function citizenToken(request: import('@playwright/test').APIRequestContext) {
  const login = await request.post(`${API}/auth/citizen/login`, {
    data: { identifier: process.env.E2E_TCKN!, password: process.env.E2E_PASSWORD! },
  })
  const body = await login.json()
  if (body.data?.accessToken) return body.data.accessToken as string
  const verify = await request.post(`${API}/auth/citizen/verify-otp`, {
    data: { otpSessionToken: body.data.otpSessionToken, code: process.env.E2E_OTP_CODE! },
  })
  return (await verify.json()).data.accessToken as string
}

test.describe('Saha anket sistemi — gerçek veriyle kabul', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')
  test.setTimeout(90_000)

  test('atanmış gerçek görev tablette açılır ve anket akışı başlar', async ({ page, request }) => {
    const token = await citizenToken(request)
    const tasksRes = await request.get(`${API}/me/surveys/field/tasks`, {
      headers: { authorization: `Bearer ${token}` },
    })
    expect(tasksRes.ok(), 'saha görev ucu 200 dönmeli').toBeTruthy()
    const tasks = (await tasksRes.json()).data ?? []
    test.skip(tasks.length === 0, 'test katılımcısına atanmış saha görevi yok')

    const open = tasks.find((t: any) => t.isWindowOpen) ?? tasks[0]

    // iPad dikey: saha görevlisinin gerçek cihaz ölçüsü.
    await page.setViewportSize({ width: 820, height: 1180 })
    await login(page)
    await page.goto('/saha')
    await waitIdle(page)

    // Görev listesi "Anketler" sekmesinde; açılış sekmesi dashboard.
    await page.getByRole('button', { name: /^Anketler/ }).first().click()

    // 1) Gerçek görev, API'nin döndürdüğü başlıkla ekranda görünmeli.
    await expect(page.getByText(open.surveyTitle).first(), 'atanmış görev listede görünmeli').toBeVisible({ timeout: 10_000 })

    // 2) Tablette yatay kaydırma olmamalı ve dokunma hedefleri yeterli olmalı.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, 'gerçek veriyle de yatay taşma olmamalı').toBeLessThanOrEqual(0)

    const small = await page.evaluate((min) => {
      const bad: string[] = []
      for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        if (r.height < min) bad.push(`<${el.tagName.toLowerCase()}> "${(el.textContent || '').trim().slice(0, 30)}" ${Math.round(r.height)}px`)
      }
      return bad
    }, MIN_TOUCH)
    expect(small, 'gerçek veriyle de 44px altı dokunma hedefi olmamalı').toEqual([])

    // 3) Asıl kabul davranışı: görev başlatılabilmeli ve anket akışı açılmalı.
    test.skip(!open.isWindowOpen, 'atanmış görev şu anda kapalı')
    await page.getByRole('button', { name: /Anketi Başlat|Anket doldur/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Görüşülen kişi' }), 'kimlik adımı açılmalı').toBeVisible()

    await page.getByRole('button', { name: /İsimsiz \/ Anonim Katılım/ }).click()
    const neighborhoods = page.getByTestId('neighborhood-cards')
    await expect(neighborhoods, 'mahalle dropdown yerine seçim kartları görünmeli').toBeVisible()
    const neighborhood = neighborhoods.getByRole('button').first()
    await neighborhood.click()
    await expect(neighborhood, 'seçilen mahalle işaretlenmeli').toHaveAttribute('aria-pressed', 'true')
    // Anonim katılımda yaş ve cinsiyet zorunlu (kullanıcı isteği 2026-09-01).
    await page.getByTestId('anon-age-groups').getByRole('button', { name: '25-34', exact: true }).click()
    await page.getByTestId('anon-genders').getByRole('button', { name: 'Kadın', exact: true }).click()
    await page.getByRole('button', { name: /Ankete başla/ }).click()

    // Gerçek anketin ilk sorusu render edilmeli ve tablette taşmamalı.
    // Soru başlığı h3 olarak render ediliyor (saha tablet tasarımı).
    await expect(page.locator('main h3').first(), 'gerçek anketin sorusu görünmeli').toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Bilgileri değiştir' }).click()
    await expect(page.getByRole('heading', { name: 'Görüşülen kişi' }), 'önceki adıma dönülebilmeli').toBeVisible()
    await expect(neighborhood, 'geri dönünce mahalle seçimi korunmalı').toHaveAttribute('aria-pressed', 'true')
    const qOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(qOverflow, 'soru adımı gerçek veriyle de taşmamalı').toBeLessThanOrEqual(0)
  })
})
