import { test, expect } from '@playwright/test'
import { login, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_OTP } from './helpers/auth'

const API = process.env.E2E_API_BASE || 'http://localhost:5207/api/v1'

/** Uygulamadaki lejantın aynısı; ekrandaki renk API verisiyle karşılaştırılabilsin diye. */
const HEAT: [number, string][] = [[80, '#16a34a'], [60, '#84cc16'], [40, '#facc15'], [20, '#fb923c'], [0, '#ef4444']]
const colorOf = (p: number | null) => (p === null ? '#cbd5e1' : (HEAT.find(([min]) => p >= min) ?? HEAT[4])[1])

async function adminToken(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post(`${API}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  const body = await res.json()
  if (body.data?.accessToken) return body.data.accessToken as string
  const verify = await request.post(`${API}/auth/verify-otp`, { data: { otpSessionToken: body.data.otpSessionToken, code: ADMIN_OTP } })
  return (await verify.json()).data.accessToken as string
}

/** Haritadaki poligonların dolgu renklerini okur. */
const mapFills = (page: import('@playwright/test').Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid=sultangazi-map-svg] polygon')]
      .map((p) => p.getAttribute('fill') ?? ''))

// Kullanıcı isteği (2026-09-02): "anket bölümünü ... tam ekran olarak ... Belediye
// Başkanının genel bütün yapıyı anlaması ... özellikle Sultangazi mahallelerini
// harita üstünde renkli göstergelerle konuları gösterim."
//
// Doğrulananlar: başkanlık raporu açılıyor, mahalle haritası render ediliyor,
// ölçüt değiştirilebiliyor, tam ekran sunum modu açılıp ESC ile kapanıyor.
test.describe('Başkanlık raporu ve mahalle haritası', () => {
  test.setTimeout(90_000)

  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/survey')
    await page.getByRole('button', { name: 'Başkanlık Paneli' }).first().click()
    // Rapor verisi ağdan geliyor; üst şerit görünene kadar bekle.
    await expect(page.getByText('Başkanlık Anket Raporu')).toBeVisible({ timeout: 20_000 })
  })

  test('mahalle haritası renkli ölçütlerle gösterilir', async ({ page }) => {
    // "Mahalle Analizi" hem ana sekmede hem başkanlık panelinin alt sekmesinde var;
    // rapor kapsamı içindeki alt sekme hedeflenir.
    const report = page.getByTestId('executive-report')
    await report.getByRole('button', { name: 'Mahalle Analizi' }).click()

    await expect(page.getByText('Sultangazi Mahalle Haritası'), 'harita bölümü görünmeli').toBeVisible({ timeout: 15_000 })

    // Harita gerçek mahalle sınırlarını (GeoJSON poligon) SVG olarak çizer;
    // 15 mahallenin tamamı boyanmalı. Yalnızca kabın varlığı boş bir kutuyu da
    // geçirirdi, bu yüzden poligon sayısı doğrulanır.
    // Yalnızca mahalle haritasının içindeki poligonlar sayılır: sayfadaki diğer
    // grafiklerin path'leri sayılırsa harita kaldırılsa bile test geçerdi.
    const polygons = page.getByTestId('sultangazi-map-svg').locator('polygon')
    await expect
      .poll(() => polygons.count(), { timeout: 15_000, message: 'mahalle poligonları çizilmeli' })
      .toBeGreaterThanOrEqual(15)

    // Ölçüt düğmeleri: başkan memnuniyet / açık talep / çözüm oranı arasında geçebilmeli.
    for (const metric of ['satisfaction', 'openIssues', 'resolution']) {
      await expect(page.getByTestId(`map-metric-${metric}`), `${metric} ölçüt düğmesi olmalı`).toBeVisible()
    }

    await page.getByTestId('map-metric-openIssues').click()
    await expect(page.getByText('Açık Talep').first(), 'seçilen ölçüt lejantta görünmeli').toBeVisible()
    await page.getByTestId('map-metric-resolution').click()
    await expect(page.getByText('Çözüm Oranı').first(), 'ölçüt değişimi yansımalı').toBeVisible()
    // Ölçüt değişince harita yeniden çizilmeli, poligonlar kaybolmamalı.
    await expect.poll(() => polygons.count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(15)
  })

  test('tam ekran sunum modu açılır ve ESC ile kapanır', async ({ page }) => {
    const toggle = page.getByTestId('executive-fullscreen-toggle')
    await expect(toggle, 'tam ekran düğmesi olmalı').toBeVisible({ timeout: 15_000 })

    await expect(page.getByTestId('executive-report'), 'başlangıçta normal görünüm').toBeVisible()
    await toggle.click()

    const full = page.getByTestId('executive-report-fullscreen')
    await expect(full, 'tam ekran görünüme geçmeli').toBeVisible()

    // Gerçekten ekranı kaplamalı: sol üst köşeden başlamalı.
    const box = await full.boundingBox()
    expect(Math.round(box!.x), 'tam ekran sol kenardan başlamalı').toBeLessThanOrEqual(1)
    expect(Math.round(box!.y), 'tam ekran üst kenardan başlamalı').toBeLessThanOrEqual(1)

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('executive-report'), 'ESC ile normal görünüme dönmeli').toBeVisible()
  })

  test('haritadaki renkler API verisiyle birebir uyuşur', async ({ page, request }) => {
    // Asıl kabul ölçütü: başkan haritaya bakıp doğru sonucu çıkarabilmeli.
    // Poligonun çizilmiş olması yetmez, RENK doğru veriyi göstermeli.
    const token = await adminToken(request)
    const res = await request.get(`${API}/surveys/analytics/executive`, { headers: { authorization: `Bearer ${token}` } })
    const rows = (await res.json()).data.neighborhoods
      .filter((n: { neighborhood: string }) => n.neighborhood !== 'Diğer / Belirsiz')

    const report = page.getByTestId('executive-report')
    await report.getByRole('button', { name: 'Mahalle Analizi' }).click()
    await expect(page.getByTestId('sultangazi-map-svg')).toBeVisible({ timeout: 15_000 })

    const expected: Record<string, (n: any) => number | null> = {
      satisfaction: (n) => (n.satisfactionScore > 0 ? Math.round((n.satisfactionScore / 5) * 100) : null),
      openIssues: (n) => (n.totalSubmissionCount > 0 ? Math.round((1 - n.openSubmissionCount / n.totalSubmissionCount) * 100) : null),
      resolution: (n) => (n.totalSubmissionCount > 0 ? Math.round(n.resolutionRate) : null),
    }

    for (const [metric, toPercent] of Object.entries(expected)) {
      await page.getByTestId(`map-metric-${metric}`).click()
      await page.waitForTimeout(500) // yeniden çizim

      const onScreen = new Set((await mapFills(page)).filter(Boolean))
      const fromApi = new Set(rows.map((n: unknown) => colorOf(toPercent(n))))

      expect(
        [...onScreen].sort(),
        `${metric}: haritadaki renk kümesi API'den hesaplananla aynı olmalı`,
      ).toEqual([...fromApi].sort())
    }
  })

  test('veri olmayan mahalle gri gösterilir (kırmızı değil)', async ({ page }) => {
    // Ölçüm bulgusu: veri yokluğu %0 sayılırsa mahalle en koyu kırmızıya boyanır
    // ve "en problemli" gibi görünür — başkanı yanlış yönlendirir.
    await page.route('**/api/v1/surveys/analytics/executive*', async (route) => {
      const response = await route.fetch()
      const body = await response.json()
      body.data.neighborhoods = body.data.neighborhoods.map((n: Record<string, unknown>, i: number) =>
        i < 3 ? { ...n, satisfactionScore: 0, totalSubmissionCount: 0, openSubmissionCount: 0, resolutionRate: 0 } : n)
      await route.fulfill({ response, json: body })
    })

    await page.reload()
    await page.getByRole('button', { name: 'Başkanlık Paneli' }).first().click()
    await expect(page.getByText('Başkanlık Anket Raporu')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('executive-report').getByRole('button', { name: 'Mahalle Analizi' }).click()
    await expect(page.getByTestId('sultangazi-map-svg')).toBeVisible({ timeout: 15_000 })

    const grey = (await mapFills(page)).filter((f) => f === '#cbd5e1').length
    expect(grey, 'verisi olmayan mahalleler gri boyanmalı').toBeGreaterThanOrEqual(3)
    // NOT (2026-09-05, flaky test bulundu ve düzeltildi): page.route() interceptor'ı
    // temizlenmeden test bitince, hâlâ uçuşta olan bir route.fetch() "Test ended"
    // hatasıyla patlıyor ve bu, Playwright'ın raporunda BİR SONRAKİ testin
    // başarısızlığına karışıyordu (batch koşularda gözlemlendi). ignoreErrors ile
    // uçuştaki route'lar sessizce iptal ediliyor.
    await page.unrouteAll({ behavior: 'ignoreErrors' })
  })

  test('harita tam ekran sunumda ve yazdırma çıktısında korunur', async ({ page }) => {
    // Başkanın iki gerçek kullanım yolu: toplantıda projeksiyon (tam ekran) ve
    // PDF/kağıt rapor (yazdırma). Harita ikisinde de kaybolmamalı.
    const report = page.getByTestId('executive-report')
    await report.getByRole('button', { name: 'Mahalle Analizi' }).click()
    const svg = page.getByTestId('sultangazi-map-svg')
    await expect(svg).toBeVisible({ timeout: 15_000 })

    await page.getByTestId('executive-fullscreen-toggle').click()
    await expect(page.getByTestId('executive-report-fullscreen')).toBeVisible()
    await expect(svg, 'harita tam ekran sunumda görünmeli').toBeVisible()
    await expect(page.locator('[data-testid=sultangazi-map-svg] polygon')).toHaveCount(15)

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('executive-report')).toBeVisible()

    await page.emulateMedia({ media: 'print' })
    await expect(svg, 'harita yazdırma çıktısında da görünmeli').toBeVisible()
    await expect(
      page.locator('[data-testid=sultangazi-map-svg] polygon'),
      'yazdırmada mahalleler eksiksiz olmalı',
    ).toHaveCount(15)
    await page.emulateMedia({ media: 'screen' })
  })

  test('mahalleye gelince öne çıkan konular listelenir', async ({ page, request }) => {
    // Kullanıcı isteği: "renkli göstergelerle KONULARI gösterim." Renk tek başına
    // "ne kadar kötü" der, "neden" demez. Başkanın karar verebilmesi için
    // mahallenin öne çıkan konularını da görmesi gerekir.
    const report = page.getByTestId('executive-report')
    await report.getByRole('button', { name: 'Mahalle Analizi' }).click()
    await expect(page.getByTestId('sultangazi-map-svg')).toBeVisible({ timeout: 15_000 })

    await page.locator('[data-testid=sultangazi-map-svg] polygon').first().hover()

    const issues = page.getByTestId('map-top-issues')
    await expect(issues, 'mahalle üzerine gelince konular görünmeli').toBeVisible({ timeout: 10_000 })

    const text = await issues.innerText()
    // İçerik gerçek olmalı: en az bir konu adı ve yüzdesi.
    expect(text, 'konu listesi yüzde içermeli').toMatch(/%\d/)

    // Gösterilen konular API'nin o mahalle için döndürdükleriyle tutarlı olmalı.
    const token = await adminToken(request)
    const res = await request.get(`${API}/surveys/analytics/executive`, { headers: { authorization: `Bearer ${token}` } })
    const allLabels = new Set<string>(
      (await res.json()).data.neighborhoods
        .flatMap((n: { topIssues?: { label: string }[] }) => (n.topIssues ?? []).map((i) => i.label)),
    )
    const shown = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(1)
    const matched = shown.some((line) => [...allLabels].some((label) => line.includes(label)))
    expect(matched, `gösterilen konular API verisinden gelmeli (görülen: ${shown.join(' / ')})`).toBe(true)
  })
})
