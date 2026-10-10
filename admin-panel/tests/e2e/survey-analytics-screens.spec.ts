import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers/auth'

// Kullanıcı isteği (2026-09-02): "içerikler[in] de analizleri EKRANDA görelim."
//
// Bu test, Sultangazi anket verisinin yönetici analiz EKRANLARINDA gerçekten göründüğünü
// doğrular. Daha önce yalnızca API uçları kontrol edilmişti; ekranın veriyi doğru
// bağlayıp bağlamadığı (boş tablo / "veri yok" durumu) ancak burada anlaşılır.
//
// Kapsanan ekranlar (Anketler modülü sekmeleri):
//   - Başkanlık Paneli    : memnuniyet endeksi, kritik gündem, mahalle tablosu
//   - Mahalle Analizi     : mahalle bazlı memnuniyet + talep kırılımı
//   - Anketör Performansı : saha ortalaması ve anketör satırları
// Not: "Yanıtlar" sekmesi bir ANALİZ ekranı değil, tekil kayıt görüntüleyicidir ve önce
// anket seçimi ister; analiz doğrulaması kapsamına alınmamıştır.

const SHOT = process.env.ANALYTICS_SHOT_DIR

async function openSurveyTab(page: Page, tabLabel: string) {
  await page.goto('/survey')
  // Modül yüklenene kadar sekme çubuğu hazır olmalı.
  await expect(page.getByRole('button', { name: /^Dashboard$/ }).first()).toBeVisible({ timeout: 25000 })
  // Sekme çubuğu yatay kayan bir liste; hedef sekme görünür alanın dışında olabilir.
  const tab = page.getByRole('button', { name: tabLabel, exact: false }).first()
  await tab.scrollIntoViewIfNeeded()
  await tab.click()
  // Analitik uçları birkaç saniye sürebiliyor; ekran veriyle dolana kadar beklenir
  // (aksi hâlde "0 / veri yok" iskeleti okunur ve test yanlış sonuç verir).
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1200)
}

/** Ekranda en az bir "anlamlı sayı" olduğunu doğrular (hepsi 0 / boş olmamalı). */
async function expectNonEmptyNumbers(page: Page, context: string) {
  const body = await page.locator('body').innerText()
  const numbers = [...body.matchAll(/\d[\d.,]*/g)].map((m) => Number(m[0].replace(/\./g, '').replace(',', '.')))
  const meaningful = numbers.filter((n) => Number.isFinite(n) && n > 0)
  expect(meaningful.length, `${context}: ekranda anlamlı sayı yok (veri bağlanmamış olabilir)`).toBeGreaterThan(3)
}

// Yönetici hesabında TEK OTURUM politikası var: her testte yeniden giriş yapmak önceki
// oturumu düşürür. Bu yüzden bir kez giriş yapılıp oturum durumu (storageState) tüm
// testlerde yeniden kullanılır.
// Yönetici hesabında TEK OTURUM politikası var: her test yeniden giriş yaparsa önceki
// oturum düşer ve sonraki testler login ekranında kalır. Bu yüzden tüm analiz ekranları
// TEK testte, tek oturumda sırayla gezilir.
test('tüm analiz ekranları gerçek veriyle dolu gelir', async ({ page }) => {
  test.setTimeout(180000)
  await login(page)

  // --- Başkanlık Paneli ---
  await openSurveyTab(page, 'Başkanlık Paneli')
  await expect(page.getByText(/Memnuniyet|Endeks/i).first()).toBeVisible({ timeout: 25000 })
  await expectNonEmptyNumbers(page, 'Başkanlık Paneli')
  await expect(page.getByText(/Henüz veri yok|Kayıt bulunamadı/i)).toHaveCount(0)
  if (SHOT) await page.screenshot({ path: `${SHOT}/baskanlik.png`, fullPage: true })

  // Kullanıcı isteği (2026-09-02): "toplam katılımcılar genel anket[ler] ... tek ekranda
  // herşeyi görebilmeli". Başkanlık Paneli artık 06.png tarzı tek-ekran rapor: toplam
  // anket/katılımcı KPI'ları + 5 alt sekme (Genel Bakış/Konu/Mahalle/Yaş/Cinsiyet Analizi).
  await expect(page.getByText('Toplam Katılımcı')).toBeVisible()
  await expect(page.getByText('Toplam Anket')).toBeVisible()
  const subTabs = ['Genel Bakış', 'Konu Analizi', 'Yaş Analizi', 'Cinsiyet Analizi']
  for (const label of subTabs) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible()
  }
  // Cinsiyet Analizi'ne geçip gerçekten veri geldiğini doğrula (sekme boş kalabiliyordu).
  await page.getByRole('button', { name: 'Cinsiyet Analizi', exact: true }).click()
  await page.waitForTimeout(600)
  await expect(page.getByText('Cinsiyet Dağılımı')).toBeVisible()
  await expectNonEmptyNumbers(page, 'Başkanlık Paneli — Cinsiyet Analizi')
  if (SHOT) await page.screenshot({ path: `${SHOT}/baskanlik-cinsiyet.png`, fullPage: true })

  // --- Mahalle Analizi ---
  await openSurveyTab(page, 'Mahalle Analizi')
  const known = ['Cebeci', 'Habibler', 'Cumhuriyet', 'Gazi', 'Esentepe']
  let found = 0
  for (const n of known) {
    if (await page.getByText(n, { exact: false }).first().isVisible().catch(() => false)) found++
  }
  expect(found, 'Mahalle Analizi ekranında hiçbir mahalle görünmüyor').toBeGreaterThan(0)

  // Kullanıcı isteği (2026-09-02): rapor GERÇEKÇİ olmalı. Bulgu: sistemdeki resmî 15
  // mahalleyle eşleşmeyen kayıtlar ("Hürriyet Mahallesi" gibi eski/hatalı veri) "Diğer /
  // Belirsiz" başlığı altında toplanır ama YÖNETİCİYE "En Problemli Mahalle" olarak asla
  // gösterilmemeli (haritada bulunamayan bir yer hakkında yanlış izlenim verir).
  const worstCard = page.locator('div', { hasText: 'En Problemli Mahalle' }).last()
  await expect(worstCard).not.toContainText('Diğer / Belirsiz')
  await expectNonEmptyNumbers(page, 'Mahalle Analizi')

  // Kullanıcı isteği (2026-09-02): "docs/ankettema/06.png bu resimdeki gibi sultangazi
  // mahallerin genel olarak renklendirmeli". Kutu grid değil, GERÇEK coğrafi sınırlarla
  // (SVG polygon) çizilen ısı haritası render olmalı.
  const mapPolygons = page.locator('svg polygon')
  await expect(mapPolygons.first()).toBeVisible({ timeout: 15000 })
  expect(await mapPolygons.count(), 'Coğrafi harita 15 mahalle poligonu içermeli').toBeGreaterThanOrEqual(15)
  if (SHOT) await page.screenshot({ path: `${SHOT}/mahalle.png`, fullPage: true })

  // --- Anketör Performansı ---
  await openSurveyTab(page, 'Anketör Performansı')
  await expect(page.getByText('Saha Ort. Puan')).toBeVisible({ timeout: 25000 })
  await expect(page.getByText('Saha Olumlu Oranı')).toBeVisible()
  const table = page.locator('table').first()
  await expect(table).toBeVisible({ timeout: 20000 })
  expect((await table.innerText()).length, 'Performans tablosu boş').toBeGreaterThan(50)
  await expectNonEmptyNumbers(page, 'Anketör Performansı')
  if (SHOT) await page.screenshot({ path: `${SHOT}/performans.png`, fullPage: true })
})

// Kullanıcı isteği (2026-09-03): "her anketin (soruna) tıkladığımızda ... her soru(da)
// katılımcıların raporları olacak detaylı bir şekilde hangi soruya hangi mahalle ne cevap
// vermiş, her soruyu detaylı analiz raporu da versin." Bu test, Analizler sekmesinde bir
// anket seçilince her sorunun altında "Mahalle bazlı detay" açılıp o soruya mahalle mahalle
// verilen cevap dağılımının GERÇEKTEN ekrana geldiğini doğrular.
test('soru analizinde mahalle bazlı kırılım açılır ve gerçek veri gösterir', async ({ page }) => {
  test.setTimeout(120000)
  await login(page)

  // Yanıtı VE mahalle bilgisi olan bir anket doğrudan surveyId ile açılır (Analizler sekmesi
  // anket seçilmeden boş gelir). Varsayılan, 106 gerçek yanıt / 6 mahalle içeren seed anketi;
  // farklı ortamda ANALYTICS_SURVEY_ID ile değiştirilebilir.
  const surveyId = process.env.ANALYTICS_SURVEY_ID || '74623aa9-beae-4ecd-84d7-0067a45d829d'
  await page.goto(`/survey?tab=analizler&surveyId=${surveyId}`)
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(1200)

  // Ekranda "Soru Analizleri" bölümü görününce veri bağlanmış demektir.
  await expect(page.getByText(/Soru Analizleri/i).first()).toBeVisible({ timeout: 25000 })

  // Kullanıcı isteği (2026-09-03): "her sorunun genel ortalamasını ve sorun tespiti olsun,
  // bunu da global anket değerlendirme kıstaslarına göre olsun." Üstte genel sorun tespiti
  // özeti + skorlanabilen sorularda kişi sayısı ve seviye etiketi görünür.
  await expect(page.getByText(/Sorun Tespiti/i).first()).toBeVisible({ timeout: 20000 })
  await expect(page.getByText(/kişi katıldı/).first()).toBeVisible()
  await expect(page.getByText(/Kritik|Zayıf|Orta|İyi|Çok İyi/).first()).toBeVisible()

  // En az bir soruda "Mahalle bazlı detay" düğmesi olmalı (yanıtlarda mahalle bilgisi var).
  const detayButton = page.getByRole('button', { name: /Mahalle bazlı detay/ }).first()
  await expect(detayButton).toBeVisible({ timeout: 20000 })

  // Tıklayınca en az bir mahalle adı + o mahalleye ait kişi sayısı + karşılaştırma grafiği görünür.
  await detayButton.click()
  await page.waitForTimeout(600)
  const knownHoods = ['Cebeci', 'Habibler', 'Cumhuriyet', 'Gazi', 'Esentepe', 'Zübeyde', 'Malkoç', 'Yayla', 'Yunus', 'Uğur']
  let hoodFound = 0
  for (const h of knownHoods) {
    if (await page.getByText(h, { exact: false }).first().isVisible().catch(() => false)) hoodFound++
  }
  expect(hoodFound, 'Mahalle bazlı detay açıldı ama hiçbir mahalle görünmüyor').toBeGreaterThan(0)
  // Mahalle satırında kişi sayısı geçer (ör. "21 kişi").
  await expect(page.getByText(/\d+\s*kişi/).first()).toBeVisible()
  // Grafik başlığı görünür (mahalle memnuniyet karşılaştırması yatay barları).
  await expect(page.getByText(/Mahalle memnuniyet karşılaştırması/).first()).toBeVisible()
  if (SHOT) await page.screenshot({ path: `${SHOT}/soru-mahalle-kirilim.png`, fullPage: true })
})
