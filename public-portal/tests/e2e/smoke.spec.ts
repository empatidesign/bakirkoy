/**
 * public-portal smoke test (QA gap #5 — 2026-09-04).
 *
 * Kök neden: 3 frontend'den biri (public-portal) hiçbir Playwright kurulumuna
 * sahip değildi — sıfır e2e kapsamı. Bu dosya sıfırdan ilk kapsamı kurar.
 *
 * public-portal auth gerektirmiyor (herkese açık etkinlik/tesis kataloğu),
 * bu yüzden citizen-portal/admin-panel'deki login karmaşıklığı burada yok —
 * en basit ve en güvenilir smoke test şekli.
 */
import { test, expect } from '@playwright/test'

const CRASH_MARKERS = [
  'something went wrong',
  'bir şeyler ters gitti',
  'beklenmeyen bir hata',
  'application error',
  'cannot read propert',
  'is not a function',
  'undefined is not',
]

const ROUTES: { path: string; name: string }[] = [
  { path: '/', name: 'Ana Sayfa' },
  { path: '/etkinlikler', name: 'Etkinlikler' },
  { path: '/tesisler', name: 'Hizmet Tesisleri' },
]

test.describe('public-portal — smoke', () => {
  test('tüm herkese açık sayfalar hatasız açılıyor', async ({ page }) => {
    const failures: string[] = []

    for (const route of ROUTES) {
      const pageErrors: string[] = []
      const onError = (e: Error) => pageErrors.push(`${e.name}: ${e.message}`)
      page.on('pageerror', onError)

      const resp = await page.goto(route.path)
      await page.waitForLoadState('networkidle').catch(() => {})

      if (resp && resp.status() >= 500) {
        failures.push(`${route.name} (${route.path}): HTTP ${resp.status()}`)
      }

      const body = (await page.locator('body').innerText().catch(() => '')).toLowerCase()
      for (const marker of CRASH_MARKERS) {
        if (body.includes(marker)) {
          failures.push(`${route.name} (${route.path}): çökme metni "${marker}"`)
        }
      }

      if (pageErrors.length > 0) {
        failures.push(`${route.name} (${route.path}): pageerror - ${pageErrors.join('; ')}`)
      }

      page.off('pageerror', onError)
    }

    expect(failures, failures.join('\n')).toHaveLength(0)
  })

  test('ana sayfa başlığı ve navigasyon linkleri görünür', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Sultan Şehir Portalı' })).toBeVisible()
    // Header nav'ındaki linkler spesifik: PublicLayout.tsx <nav> içinde tam bu iki
    // link var. HomePage.tsx'te de aynı metinli kart-link'ler tekrar geçiyor —
    // bu yüzden testler `nav` scope'una göre daraltılarak strict-mode ambiguity
    // önleniyor (madde 20 — navigasyon linki testi doğru elementi hedeflemeli).
    const nav = page.getByRole('navigation')
    await expect(nav.getByRole('link', { name: 'Etkinlikler' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Hizmet Tesisleri' })).toBeVisible()
  })

  test('navigasyon: Etkinlikler linkine tıklayınca /etkinlikler açılır', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation').getByRole('link', { name: 'Etkinlikler' }).click()
    await expect(page).toHaveURL(/\/etkinlikler/)
  })

  test('navigasyon: Hizmet Tesisleri linkine tıklayınca /tesisler açılır', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation').getByRole('link', { name: 'Hizmet Tesisleri' }).click()
    await expect(page).toHaveURL(/\/tesisler/)
  })

  test('geçersiz route ana sayfaya yönlendirilir (madde 86 — 404 davranışı)', async ({ page }) => {
    // App.tsx: <Route path="*" element={<Navigate to="/" replace />} /> — özel bir
    // 404 sayfası yok, kasıtlı olarak ana sayfaya yönlendiriyor. Bu davranışın
    // KENDİSİ doğrulanıyor (bir hata değil, uygulamanın tasarımı).
    await page.goto('/bu-route-hicbir-zaman-var-olmayacak')
    await expect(page).toHaveURL('/')
  })
})
