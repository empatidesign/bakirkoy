import { test, expect } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'
import { waitIdle } from './helpers/videoProof'

// Kullanıcı isteği (2026-09-02): "anketör normal üye olacağı için ... en üstte
// vatandaş portalı ile anket yönetim sayfasına geçiş olmalı; sadece bu üyede,
// başka bir üyede çıkmamalı."
//
// Kritik olan ikinci yarısı: şerit yanlış üyeye sızmamalı. Bu yüzden hem "görevi
// olan üyede görünür" hem de "görevi olmayanda görünmez" ayrı ayrı doğrulanır.
const MIN_TOUCH = 44

/** Portal açılışındaki karşılama penceresi şeridin üstünü kapatıyor; gerçek
 *  kullanıcı da onu kapatarak devam ediyor. */
async function dismissWelcome(page: import('@playwright/test').Page) {
  // Seçici kesin olmalı: geniş bir /Kapat/ deseni mobilde menünün kapat
  // düğmesiyle eşleşip karşılama penceresini açık bırakıyordu ve şeride
  // tıklama "pointer events intercepted" ile düşüyordu.
  const cta = page.getByRole('button', { name: 'Karşılama mesajını kapat' })
    .or(page.getByRole('button', { name: 'Harika, Başlayalım!' }))
    .first()
  if (await cta.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await cta.click().catch(() => undefined)
    await expect(cta).toBeHidden({ timeout: 5_000 }).catch(() => undefined)
  }
}

test.describe('Anketör portal-saha geçiş şeridi', () => {
  test.skip(!hasCredentials(), 'E2E kimlik bilgisi yok')
  test.setTimeout(75_000)

  test('saha görevi olan üyede görünür ve anket sistemine götürür', async ({ page }) => {
    await page.route('**/api/v1/me/surveys/field-assignment', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { hasActiveAssignment: true } }) }))

    await login(page)
    await page.goto('/')
    await waitIdle(page)

    const banner = page.getByTestId('field-mode-switch')
    await expect(banner, 'anketör üyede geçiş şeridi görünmeli').toBeVisible({ timeout: 10_000 })
    await dismissWelcome(page)

    // Dokunmatik kullanım için yeterli yükseklikte olmalı.
    const box = await banner.getByRole('button').boundingBox()
    expect(Math.round(box!.height), 'geçiş şeridi 44px+ olmalı').toBeGreaterThanOrEqual(MIN_TOUCH)

    await banner.getByRole('button').click()
    await expect(page, 'anket sistemine geçmeli').toHaveURL(/\/saha/)
  })

  test('saha görevi olmayan normal üyede görünmez', async ({ page }) => {
    // Route girişten SONRA kurulur: giriş akışı da bu ucu kullanıyor ve
    // "görev yok" yanıtı mod seçim ekranını atlatıp yönlendirmeyi değiştiriyor.
    await login(page)
    await page.route('**/api/v1/me/surveys/field-assignment', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { hasActiveAssignment: false } }) }))
    await page.goto('/')
    await waitIdle(page)

    await expect(page.getByTestId('field-mode-switch'), 'normal üyede şerit çıkmamalı').toHaveCount(0)
  })

  test('yetki sorgusu başarısız olursa şerit gösterilmez', async ({ page }) => {
    // Hata durumunda "varsayılan olarak göster" davranışı, şeridi normal
    // vatandaşlara sızdırırdı; kapalı kalması doğru davranıştır.
    await login(page)
    await page.route('**/api/v1/me/surveys/field-assignment', (r) =>
      r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false }) }))
    await page.goto('/')
    await waitIdle(page)

    await expect(page.getByTestId('field-mode-switch'), 'hata durumunda şerit çıkmamalı').toHaveCount(0)
  })

  test('gerçek anketör hesabıyla (stub yok) şerit görünür ve çalışır', async ({ page, request }) => {
    // Diğer testler yanıtı route ile veriyor; bu test hiçbir şeyi taklit etmez.
    // Ön koşul: test kullanıcısına atanmış gerçek saha görevi olmalı
    // (tests/e2e/fixtures/seed-field-survey-task.mjs ile atanır).
    const API = process.env.E2E_API_BASE || 'http://localhost:5207/api/v1'
    const loginRes = await request.post(`${API}/auth/citizen/login`, {
      data: { identifier: process.env.E2E_TCKN!, password: process.env.E2E_PASSWORD! },
    })
    const body = await loginRes.json()
    let token = body.data?.accessToken
    if (!token) {
      const verify = await request.post(`${API}/auth/citizen/verify-otp`, {
        data: { otpSessionToken: body.data.otpSessionToken, code: process.env.E2E_OTP_CODE! },
      })
      token = (await verify.json()).data.accessToken
    }
    const assignment = await request.get(`${API}/me/surveys/field-assignment`, {
      headers: { authorization: `Bearer ${token}` },
    })
    const hasAssignment = (await assignment.json()).data?.hasActiveAssignment
    test.skip(!hasAssignment, 'test kullanıcısına atanmış saha görevi yok')

    await login(page)
    await page.goto('/')
    await waitIdle(page)

    const banner = page.getByTestId('field-mode-switch')
    await dismissWelcome(page)
    await expect(banner, 'gerçek anketör hesabında şerit görünmeli').toBeVisible({ timeout: 10_000 })
    await banner.getByRole('button').click()
    await expect(page, 'anket sistemine geçmeli').toHaveURL(/\/saha/)
  })
})
