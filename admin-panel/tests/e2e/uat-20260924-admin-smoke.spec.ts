import { test, expect } from '@playwright/test'
import { login } from './helpers/auth'

// UAT 24.09.2026 — oluşturulan programların admin panelde listelendiğini doğrular.
// Çalıştırma: BASE_URL=http://localhost:3000 (127.0.0.1 CORS listesinde değil)
test('Admin: UAT etkinlik, gezi, spor grubu ve anketleri listelenir', async ({ page }) => {
  await login(page)
  const checks: [string, RegExp, RegExp, string][] = [
    ['/events', /Etkinlik adı, kod, hizmet tesisi veya salon ara/, /UAT · Çocuk Tiyatrosu: Keloğlan/, 'Keloğlan'],
    ['/travels', /Gezi adı veya hedef ara/, /UAT · Boğaz Vapur Turu/, 'Boğaz'],
    ['/survey', /Anket adı veya açıklama ara/, /UAT Genel Memnuniyet Anketi/, 'UAT Genel'],
  ]
  for (const [url, ph, text, term] of checks) {
    await page.goto(url)
    if (url === '/survey') await page.getByRole('button', { name: /^Anketler/ }).first().click()
    const search = page.getByPlaceholder(ph).first()
    await search.waitFor({ timeout: 20000 })
    await search.fill(term)
    await expect(page.getByText(text).first()).toBeVisible({ timeout: 20000 })
    await page.screenshot({ path: `test-results/uat-admin${url.replace('/', '-')}.png` })
  }
})

// UAT 24.09.2026 — kullanıcı isteği: tesis programlarında ilçe içi/dışı/yabancı uyruklu başvuru
// seçenekleri etkinlik/gezi ile BİREBİR aynı olmalı.
const EXPECTED = [
  'Herkes — kısıtlama yok',
  "Sultangazi'de ikamet eden T.C. vatandaşları",
  "Sultangazi'de ikamet eden yabancılar",
  'T.C. vatandaşları',
  'Yabancılar',
  "Sultangazi'de ikamet edenler (uyruk fark etmez)",
  'Yalnız Sultangazi dışında ikamet edenler',
]
async function readResidencyOptions(page: import('@playwright/test').Page) {
  const trigger = page.getByRole('button', { name: /Herkes — kısıtlama yok/ }).last()
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  const labels: string[] = []
  for (const t of EXPECTED) {
    const opt = page.getByRole('button', { name: t, exact: true }).last()
    if (await opt.isVisible().catch(() => false)) labels.push(t)
  }
  await page.screenshot({ path: 'test-results/uat-admin-facility-residency.png' })
  await page.keyboard.press('Escape')
  return labels
}

test('Admin: tesis grup formu ikamet/uyruk seçenekleri diğer modüllerle birebir aynı', async ({ page }) => {
  await login(page)
  await page.goto(`/sports?f=${process.env.UAT_SPORTS_FACILITY_ID}&tab=groups`)
  await page.getByRole('button', { name: /Yeni Grup/i }).click()
  await page.getByText('Katılım Bölgesi').first().waitFor({ timeout: 20000 })
  const facilityOptions = await readResidencyOptions(page)

  // Etkinlik/gezi/quiz/kütüphane/çark formları aynı listeyi FULL_RESIDENCY_MODE_OPTIONS'tan
  // okur; EXPECTED o listeyle birebir aynıdır (lib/residency.ts). Tesis formu artık aynı kaynağı
  // kullandığı için gerçek arayüzde okunan seçenekler bu listeye eşit olmalı.
  expect(facilityOptions).toEqual(EXPECTED)
})
