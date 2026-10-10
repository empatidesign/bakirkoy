/**
 * RBAC / Permission Matrix (QA gap #6, #25-27 — 2026-09-04).
 *
 * Kök neden: `e2e-scenarios/full-audit/admin-panel-tam-denetim/perm-test.mjs`
 * doğru fikri kanıtlıyordu (iki farklı rolle giriş yapıp menü/URL erişimini
 * karşılaştırmak) ama tek seferlik bir script'ti — Playwright suite'ine entegre
 * değildi, CI'da çalışmıyordu.
 *
 * Bu dosya aynı senaryoyu kalıcı bir Playwright spec'i olarak kurar (madde 25-27):
 *   - madde 27 (URL bypass testi): kısıtlı rolün menüde görmediği bir route'a
 *     DOĞRUDAN URL ile gitmeyi dener — RequirePermission.tsx'in gerçekten
 *     `/dashboard`'a geri attığını doğrular (menüde gizli olması yeterli değil).
 *
 * Permission Matrix TABLOSU (madde 26) ayrı bir script'te üretilir
 * (`tests/discovery/generatePermissionMatrix.mjs`, doğrudan DB'den — API üzerinden
 * denemek her rol için ayrı GetById çağrısı gerektirip kırılgan bir bağımlılık
 * zinciri oluşturuyordu, DB sorgusu tek kaynaktan gerçeği veriyor).
 *
 * `demo.etkinlik@nexora.local` (Etkinlik Yöneticisi, sadece events.* yetkisi) ve
 * `superadmin@nexora.local` karşılaştırılıyor — bu ikili zaten
 * `e2e-scenarios/full-audit/.../perm-test.mjs`'te manuel doğrulanmıştı.
 */
import { test, expect } from '@playwright/test'

const LIMITED_EMAIL = process.env.E2E_LIMITED_ROLE_EMAIL || 'demo.etkinlik@nexora.local'
const LIMITED_PASSWORD = process.env.E2E_LIMITED_ROLE_PASSWORD || 'Demo2026!'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const OTP = process.env.E2E_OTP_CODE || '111111'

const hasCredentials = () => !!(ADMIN_EMAIL && ADMIN_PASSWORD)

async function loginAs(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#email').waitFor()
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  await page
    .waitForFunction(
      () => !window.location.pathname.startsWith('/login') || window.location.pathname === '/login/otp',
      { timeout: 15000 },
    )
    .catch(() => {})
  if (/\/login\/otp/.test(page.url())) {
    const otpInputs = page.locator('input[inputmode="numeric"]')
    await otpInputs.first().waitFor()
    const count = await otpInputs.count()
    for (let i = 0; i < Math.min(6, count); i++) await otpInputs.nth(i).fill(OTP[i])
    await page.getByRole('button', { name: /Doğrula/ }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 })
  }
  await expect(page).not.toHaveURL(/\/login/)
}

// `admins.view` yetkisi gerektiren, superadmin'in erişebildiği ama demo.etkinlik'in
// KESİNLİKLE erişememesi gereken bir ekran — mevcut e2e-scenarios/perm-test.mjs'teki
// senaryoyla aynı hedef (bkz. dosya üstü açıklama).
const RESTRICTED_ROUTE = '/admin'
const RESTRICTED_ROUTE_LABEL = 'Yönetici Hesapları'

test.describe('RBAC — yetki matrisi ve URL bypass testi', () => {
  test.skip(!hasCredentials(), 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD verilmedi — atlandı')

  test('kısıtlı rol menüde görmediği ekrana DOĞRUDAN URL ile de giremez (madde 27)', async ({
    page,
  }) => {
    // Menünün gizli olması yetki testi SAYILMAZ (madde 27) — asıl kanıt, URL'yi
    // elle yazıp backend/route-guard'ın gerçekten reddettiğini görmek.
    await loginAs(page, LIMITED_EMAIL, LIMITED_PASSWORD)

    // Önce menüde gerçekten görünmediğini doğrula (beklenen ön koşul).
    await expect(page.getByRole('link', { name: RESTRICTED_ROUTE_LABEL })).toHaveCount(0)

    // Şimdi asıl test: doğrudan URL ile git.
    await page.goto(RESTRICTED_ROUTE)
    // RequirePermission.tsx: <Navigate to="/dashboard" replace /> önce /dashboard'a
    // atıyor, ama DashboardPage.tsx'in kendi `useSingleModuleRedirect` mantığı
    // (yalnızca TEK modüle yetkili kullanıcıyı doğrudan o modüle yönlendirme
    // kısayolu — gerçek, kasıtlı bir davranış, bu testte KEŞFEDİLDİ) demo.etkinlik'i
    // (sadece events.* yetkisi var) bir adım daha ileri götürüp /events'e düşürüyor.
    // Asıl kanıtlanması gereken şey /admin'e ULAŞAMAMASI — nihai URL /admin
    // OLMAMALI, hangi zararsız sayfaya düştüğü ikincil.
    await page.waitForURL((url) => url.pathname !== RESTRICTED_ROUTE, { timeout: 10000 })
    await expect(page).not.toHaveURL(new RegExp(RESTRICTED_ROUTE.replace('/', '\\/') + '$'))
    await expect(page.getByText(RESTRICTED_ROUTE_LABEL)).toHaveCount(0)
  })

  test('superadmin aynı ekrana normal şekilde erişebilir (kontrol grubu)', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'E2E_ADMIN_EMAIL/PASSWORD yok')
    await loginAs(page, ADMIN_EMAIL!, ADMIN_PASSWORD!)
    await page.goto(RESTRICTED_ROUTE)
    // Kontrol grubu: guard'ın kendisi bozuk değil, gerçekten role'e göre ayrım
    // yapıyor — superadmin aynı route'a erişebiliyor olmalı.
    await expect(page).not.toHaveURL(/\/dashboard$/, { timeout: 10000 })
  })

  test('kısıtlı rol oturum değiştirdiğinde önceki rolün API çağrıları sızmaz', async ({ page }) => {
    // e2e-scenarios/full-audit/admin-panel-tam-denetim/perm-test.mjs'teki ikinci
    // senaryonun Playwright karşılığı: superadmin çıkış yapıp demo.etkinlik girdiğinde,
    // superadmin'e özel bir isteğin (gift-requests) tekrar atılmadığını doğrular
    // (stale-permission/cache sızıntısı riskine karşı regresyon testi).
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'E2E_ADMIN_EMAIL/PASSWORD yok')

    const staleRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('gift-requests')) staleRequests.push(req.url())
    })

    await loginAs(page, ADMIN_EMAIL!, ADMIN_PASSWORD!)
    await page.waitForTimeout(1500)
    staleRequests.length = 0 // superadmin girişinin kendi isteklerini sıfırla

    await page.getByText('Çıkış Yap').click()
    await page.waitForURL(/\/login/, { timeout: 10000 })

    await loginAs(page, LIMITED_EMAIL, LIMITED_PASSWORD)
    await page.waitForTimeout(2000)

    // demo.etkinlik'in gift-requests yetkisi yok — bu endpoint'e HİÇ istek
    // atılmamalı (önceki oturumdan kalan bir cache/stale-permission sızıntısı yoksa).
    expect(staleRequests, `Sızan istekler: ${JSON.stringify(staleRequests)}`).toHaveLength(0)
  })
})
