import { test, expect } from '@playwright/test'

// Kullanıcı bildirimi (2026-09-03): "android uygulama tablete yüklendi fakat aynı
// ağda şu anda ağa erişemiyor."
//
// İki ayrı kök neden vardı ve ikisi de sessizdi:
//   1. Paket VITE_API_URL=http://localhost:5207 ile derlenmişti; mobil cihazda
//      "localhost" sunucuyu değil CİHAZIN KENDİSİNİ gösterir.
//   2. API'nin CORS listesi yalnızca localhost adreslerini içeriyordu; ağdaki bir
//      cihazdan gelen istek tarayıcı katmanında düşüyordu.
//
// Bu test, ÜRETİLEN PAKETİ ağ adresinden servis edip gerçek giriş akışını
// çalıştırır. Böylece "derleme doğru mu" ve "ağdan gerçekten çalışıyor mu"
// sorularının ikisi birden yanıtlanır.
//
// Ön koşul (tools/build-mobile.mjs bunları zaten sınar):
//   VITE_API_URL=http://<LAN-IP>:5207 npm run build
//   npx vite preview --port 4599 --host 0.0.0.0
const PREVIEW = process.env.E2E_PREVIEW_URL || 'http://192.168.1.14:4599'
const API_HOST = new URL(process.env.E2E_API_BASE || 'http://192.168.1.14:5207').hostname

test.describe('Mobil paket ağ erişimi', () => {
  test.setTimeout(90_000)

  test('paket ağ adresinden yüklenir ve API çağrıları LAN adresine gider', async ({ page }) => {
    const apiCalls: string[] = []
    const failed: string[] = []
    const consoleErrors: string[] = []

    page.on('request', (r) => { if (r.url().includes('/api/v1')) apiCalls.push(r.url()) })
    page.on('requestfailed', (r) => { if (r.url().includes('/api/v1')) failed.push(`${r.url()} — ${r.failure()?.errorText}`) })
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })

    const res = await page.goto(`${PREVIEW}/login`).catch(() => null)
    test.skip(!res || !res.ok(), `önizleme sunucusu ${PREVIEW} adresinde çalışmıyor`)

    const tckn = page.getByPlaceholder(/05XX \/ T\.C\. Kimlik|Telefon veya T\.C\./i)
    await tckn.waitFor({ timeout: 15_000 })
    await tckn.fill(process.env.E2E_TCKN!)
    await page.getByPlaceholder(/••••••••|Şifreniz/i).fill(process.env.E2E_PASSWORD!)
    for (const id of ['#login-kvkk', '#login-notif']) {
      const box = page.locator(id)
      if (await box.isVisible().catch(() => false)) await box.check()
    }
    await page.getByRole('button', { name: 'Giriş Yap' }).click()

    // OTP adımı: gerçek kullanıcının izlediği tam akış.
    await page.waitForURL(/otp/, { timeout: 30_000 }).catch(() => undefined)
    if (/otp/.test(page.url())) {
      const code = process.env.E2E_OTP_CODE!
      const inputs = page.locator('input[inputmode="numeric"], input[maxlength="1"]')
      const count = await inputs.count()
      if (count >= 6) for (let i = 0; i < 6; i++) await inputs.nth(i).fill(code[i])
      else await page.locator('input').first().fill(code)
      await page.getByRole('button', { name: 'Doğrula & Giriş Yap' }).click()
      await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30_000 }).catch(() => undefined)
    }

    // 1) Paket gerçekten API'ye konuşmalı.
    expect(apiCalls.length, 'paket API çağrısı yapmalı').toBeGreaterThan(0)

    // 2) Hiçbir çağrı localhost'a gitmemeli: mobilde bu, cihazın kendisidir.
    const toLocalhost = apiCalls.filter((u) => /localhost|127\.0\.0\.1/.test(u))
    expect(toLocalhost, 'hiçbir çağrı localhost/127.0.0.1 adresine gitmemeli').toEqual([])

    // 3) Tüm çağrılar LAN adresine gitmeli.
    const wrongHost = apiCalls.filter((u) => new URL(u).hostname !== API_HOST)
    expect(wrongHost, `tüm çağrılar ${API_HOST} adresine gitmeli`).toEqual([])

    // 4) CORS veya ağ hatası olmamalı: bu ikisi tablette "hiç açılmıyor" olarak görünür.
    expect(failed, 'API isteği başarısız olmamalı (CORS/ağ)').toEqual([])
    expect(
      consoleErrors.filter((e) => /CORS|ERR_FAILED|YAPILANDIRMA/i.test(e)),
      'CORS / ağ / yapılandırma hatası olmamalı',
    ).toEqual([])

    // 5) Giriş gerçekten tamamlanmalı (login sayfasında takılı kalmamalı).
    expect(page.url(), 'giriş tamamlanıp login sayfasından çıkılmalı').not.toMatch(/\/login/)
  })
})
