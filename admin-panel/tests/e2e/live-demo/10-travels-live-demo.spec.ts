/**
 * CANLI İZLEME DEMOSU — Travels (Geziler).
 *
 * Akış (diğer modüllerle aynı mantık, Travels'ın kendi UI akışına uyarlanmış):
 * Admin UI'dan bir rota için GERÇEKTEN bir sefer oluşturulur (route-kilitli
 * drawer, tarih/kontenjan alanları gerçekten doldurulur, Aktif durumda
 * bırakılır), ardından GERÇEK bir vatandaş citizen-portal UI'dan bu seferi
 * arayıp bulup "Başvur" tıklar (araçsız/kontenjan bazlı basit sefer —
 * koltuk/araç seçimi gerektirmez), ağ cevabı ve başarı ekranı doğrulanır,
 * sonra admin panelde başvurunun gerçekten düştüğü Başvurular sekmesinden
 * teyit edilir.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import {
  adminToken, fastLoginUi, uniq, futureIso,
  createTravelCategory, createTravelRoute, cleanupTravelsFixture,
} from '../helpers/travelsSessionFixtures'
import { fillFieldByLabel } from '../helpers/designSystemControls'
import { registerCitizen, citizenLoginUiWithToken, CITIZEN_PORTAL_URL, type NewCitizen } from '../helpers/citizenAuth'

function drawerOf(page: Page) {
  return page.locator('div.relative.z-10').last()
}

async function dismissPopover(drawer: ReturnType<Page['locator']>) {
  await drawer.locator('p', { hasText: 'Gezi' }).first().click({ force: true }).catch(() => {})
}

async function fillTravelDates(page: Page, drawer: ReturnType<Page['locator']>, startDaysFromNow: number, durationDays = 1) {
  const start = futureIso(startDaysFromNow)
  const end = futureIso(startDaysFromNow + durationDays)
  await fillFieldByLabel(page, drawer, 'Başlangıç Tarihi', start.split('-').reverse().join('.'))
  await dismissPopover(drawer)
  await fillFieldByLabel(page, drawer, 'Bitiş Tarihi', end.split('-').reverse().join('.'))
  await dismissPopover(drawer)
  await fillFieldByLabel(page, drawer, 'Kayıt Başlangıcı', futureIso(0).split('-').reverse().join('.'))
  await dismissPopover(drawer)
  await fillFieldByLabel(page, drawer, 'Kayıt Bitişi', futureIso(Math.max(2, startDaysFromNow - 1)).split('-').reverse().join('.'))
  await dismissPopover(drawer)
}

test.describe.serial('[CANLI DEMO] Geziler — Sefer Oluşturma (admin UI) + Vatandaş Başvurusu (citizen UI)', () => {
  test.setTimeout(180_000)
  let apiCtx: APIRequestContext
  let token = ''
  let categoryId = ''
  let routeId = ''
  let routeName = ''
  const createdTravelIds: string[] = []
  const tag = uniq('CANLI-DEMO travels')

  let travelId = ''
  let adultCitizen: NewCitizen

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const cat = await createTravelCategory(apiCtx, token, tag)
    categoryId = cat.id
    const route = await createTravelRoute(apiCtx, token, categoryId, tag)
    routeId = route.id
    routeName = route.name
  })

  test.afterAll(async () => {
    await cleanupTravelsFixture(apiCtx, token, {
      travelIds: createdTravelIds, routeIds: [routeId], categoryIds: [categoryId],
    })
    await apiCtx.dispose()
  })

  test('1) ADMIN UI — Rota için GERÇEKTEN yeni sefer oluşturulur (tarih/kontenjan, araçsız — kontenjan bazlı)', async ({ page }) => {
    await fastLoginUi(page, apiCtx)
    await page.goto('/travels?tab=travels')
    await expect(page.getByText('Geziler').first()).toBeVisible({ timeout: 20000 })
    await page.getByPlaceholder('Gezi adı, hedef veya başvuran adı/TC ara...').fill(routeName)
    await expect(page.getByRole('button', { name: routeName })).toBeVisible({ timeout: 20000 })
    await page.getByRole('button', { name: routeName }).click()
    await expect(page.getByText('Sefer Listesi').first()).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Sefer' }).first().click()
    const drawer = drawerOf(page)
    await expect(drawer).toBeVisible({ timeout: 8000 })

    await fillTravelDates(page, drawer, 20)
    await fillFieldByLabel(page, drawer, 'Son İptal Süresi', '48')
    await fillFieldByLabel(page, drawer, 'Kontenjan', '25')
    await fillFieldByLabel(page, drawer, 'Yedek Kontenjan', '5')

    // Durum: varsayılan Aktif geliyor (bkz. Facility modüllerindeki bulgu), dokunmuyoruz.

    const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtn).toBeEnabled({ timeout: 5000 })
    const [createRes] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/travels') && r.request().method() === 'POST'),
      saveBtn.click(),
    ])
    expect(createRes.ok(), `GERÇEK HATA — sefer oluşturma UI'dan başarısız: ${await createRes.text()}`).toBeTruthy()

    const created = (await createRes.json()).data
    expect(created?.id, 'sefer id dönmeli').toBeTruthy()
    travelId = created.id
    createdTravelIds.push(travelId)
    expect(created.routeId).toBe(routeId)
    expect(created.capacity).toBe(25)
    expect(created.isActive).toBe(true)
  })

  test('2) GERÇEK VATANDAŞ KAYDI — 30 yaşında, TC kimlik + OTP ile canlı register', async () => {
    adultCitizen = await registerCitizen(apiCtx, 30, 'travels-adult')
    expect(adultCitizen.token).toBeTruthy()
    console.log(`[canlı demo] Vatandaş oluşturuldu: TC ${adultCitizen.tckn}, yaş ${adultCitizen.ageYears}`)
  })

  test('3) CITIZEN PORTAL UI — Vatandaş GERÇEKTEN giriş yapar, seferi bulur ve başvurur', async ({ page }) => {
    await citizenLoginUiWithToken(page, adultCitizen)
    await page.goto(`${CITIZEN_PORTAL_URL}/geziler`)
    await page.waitForLoadState('networkidle').catch(() => {})

    const searchBox = page.getByPlaceholder(/Gezi veya destinasyon ara/i).first()
    await expect(searchBox).toBeVisible({ timeout: 10000 })
    await searchBox.fill(routeName)

    const travelCard = page.getByText(routeName).first()
    await expect(travelCard).toBeVisible({ timeout: 10000 })
    await travelCard.click()

    // Kendisi için başvuran kişiyi seç (varsayılan "Ben")
    const selfOption = page.getByText(/\(Ben\)/i).first()
    await expect(selfOption).toBeVisible({ timeout: 8000 })
    await selfOption.click()

    const applyBtn = page.getByRole('button', { name: /Rezervasyonu Tamamla|Başvur/i }).last()
    await expect(applyBtn).toBeEnabled({ timeout: 8000 })

    const [applyRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/reserve') && r.request().method() === 'POST'),
      applyBtn.click(),
    ])
    expect(applyRes.ok(), `GERÇEK HATA — vatandaş başvurusu UI'dan başarısız: ${await applyRes.text()}`).toBeTruthy()

    const successHeading = page.getByText(/Başvurunuz|başvuru/i).first()
    await expect(successHeading).toBeVisible({ timeout: 8000 })
    console.log('[canlı demo] Vatandaş başvurusu UI üzerinden GERÇEKTEN kaydedildi.')
  })

  test('4) ADMIN PANEL UI — Başvuru GERÇEKTEN düşmüş mü, Başvurular sekmesinden canlı doğrulanır', async ({ page }) => {
    await fastLoginUi(page, apiCtx)
    await page.goto(`/travels?tab=applications&travelId=${travelId}`)
    await page.waitForLoadState('networkidle').catch(() => {})

    const anyAppRow = page.locator('table tbody tr').first()
    await expect(anyAppRow).toBeVisible({ timeout: 10000 })
    console.log('[canlı demo] Admin panelde başvuru satırı GERÇEKTEN görünüyor — cross-surface tutarlılık doğrulandı.')
  })
})
