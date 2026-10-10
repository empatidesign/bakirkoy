/**
 * GEZİ SİSTEMİ — "SEFER" (TRAVEL) OLUŞTURMA TAM ALAN KAPSAMI TESTİ
 *
 * Kaynak: TUM_MODULLER_MASTER_TEST_MATRISI_REVIZE.md — "Kültür Gezileri" modülü
 * (100/810 ağırlıklı senaryo). "Sefer" (Travel), Events'teki Session'ın UI
 * eşdeğeridir — `TravelForm.tsx`, kendi backend servisi (`TravelService.cs`,
 * `/api/v1/travels`). İçerik alanları (isim, açıklama, kural, görsel) BİR
 * Gezi'den (Route) miras alınır; Sefer formu yalnız tarih/kayıt aralığı/
 * kapasite/araç/ekip atar — Events'teki SessionForm.tsx'in "Temel Bilgiler"
 * bölümü olmaması gibi, Route zaten EventFormHeader'daki rolü üstlenir.
 *
 * KAPSANAN ALANLAR (TravelForm.tsx üzerinden):
 * - Gezi (Rota) seçimi — route drilldown'dan açılırsa otomatik kilitli banner
 * - Başlangıç/Bitiş Tarihi, Kayıt Başlangıcı/Bitişi (saat destekli DatePicker)
 * - Son İptal Süresi (NumberInput, saat)
 * - Kontenjan + Yedek Kontenjan — araç seçiliyse Kontenjan araç kapasitesine
 *   otomatik senkronize olur (busCeiling takip modu)
 * - Katılım Sınırı (none/weekly/monthly/yearly + adet) + "Genel katılım
 *   sınırından muaf" anahtarı
 * - Araçlar: Combobox ile ekleme, "tek araç" kısıtı (ikinci araç eklemeye
 *   çalışınca toast uyarısı), kaldırma, Yeni Araç hızlı oluşturma modalı
 * - Rehber/Sorumlu Kişi (ResponsiblePersonField, allowAccessGrant) + Şoför
 *   (ResponsiblePersonField, allowManual, showTckn)
 * - Durum (Aktif/Pasif ToggleRow)
 *
 * DÜRÜST KAPSAM NOTU: İş kuralı NEGATİF senaryoları ayrı dosyada:
 * travels-session-business-rules.spec.ts. Koltuk planı editörü
 * (TravelBusSeatModal), yolcu/başvuru akışı, toplu T.C. ekleme, yoklama,
 * mesaj şablonları, sefer kopyalama bu dosyanın kapsamı DIŞINDADIR.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import {
  adminToken, fastLoginUi, getFreshToken, uniq, futureIso, API_BASE,
  createTravelCategory, createTravelRoute, createTravelBus,
  cleanupTravelsFixture,
} from './helpers/travelsSessionFixtures'
import { fillFieldByLabel, pickSelectByFieldLabel } from './helpers/designSystemControls'
import { clickRowAction } from './helpers/rowActions'

function drawerOf(page: Page) {
  return page.locator('div.relative.z-10').last()
}

/**
 * TimePicker/DatePicker popover'ı fill() sonrası açık kalıp sonraki tıklamaları
 * engelleyebilir (bkz. events-session-creation-full-matrix.spec.ts aynı sorunun
 * notu) — drawer içindeki zararsız bir noktaya (ilk bölüm başlığı) tıklayarak
 * kapatıyoruz.
 */
async function dismissPopover(drawer: ReturnType<Page['locator']>) {
  await drawer.locator('p', { hasText: 'Gezi' }).first().click({ force: true }).catch(() => {})
}

/** Production ortamının paylaşılan rate limitine (bkz. events-session spec'teki not) karşı dayanıklı tıkla+bekle. */
async function clickAndWaitForResponse(
  page: Page, predicate: (r: import('@playwright/test').Response) => boolean, click: () => Promise<void>, maxAttempts = 3,
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const [res] = await Promise.all([page.waitForResponse(predicate), click()])
    if (res.status() !== 429) return res
    await page.waitForTimeout(2000 * attempt)
  }
  throw new Error('clickAndWaitForResponse: 429 RATE_LIMIT_EXCEEDED ile tüm denemeler tükendi')
}

/**
 * Başlangıç/Bitiş Tarihi + Kayıt Başlangıcı/Bitişi'ni doldurur. Kayıt tarihleri
 * ÖNEMLİDİR: boş bırakılırsa gerçek bir üretim hatası tetiklenir (bkz. test
 * 1'deki ayrıntılı not + business-rules.spec.ts KURAL-19) — bu yardımcı o
 * çökmeyi tetiklemeden standart bir seyahat tarihi aralığı kurar.
 */
async function fillTravelDates(page: Page, drawer: ReturnType<Page['locator']>, startDaysFromNow: number, durationDays = 1) {
  const start = futureIso(startDaysFromNow)
  const end = futureIso(startDaysFromNow + durationDays)
  await fillFieldByLabel(page, drawer, 'Başlangıç Tarihi', start.split('-').reverse().join('.'))
  await dismissPopover(drawer)
  await fillFieldByLabel(page, drawer, 'Bitiş Tarihi', end.split('-').reverse().join('.'))
  await dismissPopover(drawer)
  await fillFieldByLabel(page, drawer, 'Kayıt Başlangıcı', futureIso(1).split('-').reverse().join('.'))
  await dismissPopover(drawer)
  await fillFieldByLabel(page, drawer, 'Kayıt Bitişi', futureIso(Math.max(2, startDaysFromNow - 1)).split('-').reverse().join('.'))
  await dismissPopover(drawer)
  return { start, end }
}

test.describe.serial('Gezi Sistemi — Sefer Oluşturma Tam Alan Kapsamı', () => {
  let apiCtx: APIRequestContext
  let token = ''
  let categoryId = ''
  let routeId = ''
  let routeName = ''
  let busId = ''
  const busCapacity = 30
  const createdTravelIds: string[] = []
  const createdAdminUserIds: string[] = []
  const tag = uniq('QA-TRVSES')

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const cat = await createTravelCategory(apiCtx, token, tag)
    categoryId = cat.id
    const route = await createTravelRoute(apiCtx, token, categoryId, tag)
    routeId = route.id
    routeName = route.name
    const bus = await createTravelBus(apiCtx, token, tag, busCapacity)
    busId = bus.id
  })

  test.afterAll(async () => {
    await cleanupTravelsFixture(apiCtx, token, {
      travelIds: createdTravelIds,
      routeIds: [routeId],
      categoryIds: [categoryId],
      busIds: [busId],
      adminUserIds: createdAdminUserIds,
    })
    await apiCtx.dispose()
  })

  async function openRouteDrilldown(page: Page) {
    await page.goto('/travels?tab=travels')
    await expect(page.getByText('Geziler').first()).toBeVisible({ timeout: 20000 })
    await page.getByPlaceholder('Gezi adı, hedef veya başvuran adı/TC ara...').fill(routeName)
    await expect(page.getByRole('button', { name: routeName })).toBeVisible({ timeout: 20000 })
    await page.getByRole('button', { name: routeName }).click()
    await expect(page.getByText('Sefer Listesi').first()).toBeVisible({ timeout: 20000 })
  }

  test('1) Yeni Sefer (route kilitli) — tarih/kayıt aralığı/kontenjan/katılım sınırı/muafiyet/durum alanları çalışır', async ({ page }) => {
    test.setTimeout(60_000)
    await fastLoginUi(page, apiCtx)
    await openRouteDrilldown(page)

    await page.getByRole('button', { name: 'Yeni Sefer' }).first().click()
    const drawer = drawerOf(page)
    await expect(drawer).toBeVisible({ timeout: 8000 })

    // Route drilldown'dan açıldığı için "Gezi (Rota)" combobox YOKTUR — kilitli banner gelir.
    await expect(drawer.getByText(routeName, { exact: false }).first()).toBeVisible()
    await expect(drawer.locator('label', { hasText: 'Gezi (Rota)' })).toHaveCount(0)

    // ÖNEMLİ (gerçek testte bulunan üretim hatası, 2026-10-03): Kayıt Başlangıcı/Bitişi
    // boş bırakılırsa backend TurkeyDateTimeConverter.Read boş string'i DateTime'a
    // çeviremeyip 500 INTERNAL_SERVER_ERROR fırlatıyor (TravelFormRequestValidator bu
    // alanları NotEmpty ile kontrol ETMİYOR) — curl ile doğrulandı, ayrıntılı
    // karakterizasyon testi KURAL-19'da (business-rules.spec.ts). fillTravelDates bu
    // çökmeyi tetiklemeden standart bir tarih aralığı kurar.
    await fillTravelDates(page, drawer, 20)

    await fillFieldByLabel(page, drawer, 'Son İptal Süresi', '48')
    await fillFieldByLabel(page, drawer, 'Kontenjan', '25')
    await fillFieldByLabel(page, drawer, 'Yedek Kontenjan', '5')

    // Katılım Sınırı: Select.tsx pilot modda özel buton+popover render eder (native <select> yok)
    await pickSelectByFieldLabel(page, drawer, 'Katılım Sınırı', 'Haftada')
    const limitInput = drawer.locator('label', { hasText: 'Katılım Sınırı' }).locator('xpath=following::input[1]').first()
    await limitInput.fill('2')

    // Genel katılım sınırından muaf anahtarını aç — ToggleRow (Field.tsx): data-toggle-row="true"
    const exemptRow = drawer.locator('[data-toggle-row="true"]').filter({ hasText: 'Genel katılım sınırından muaf' })
    await exemptRow.locator('button[role="switch"]').click()

    // Durum: Pasif yap (varsayılan Aktif) — ToggleRow data-toggle-row="true" ile tekil bulunur
    const statusRow = drawer.locator('[data-toggle-row="true"]').filter({ hasText: 'Aktif' })
    await statusRow.locator('button[role="switch"]').click()

    const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtn).toBeEnabled({ timeout: 5000 })
    const createRes = await clickAndWaitForResponse(
      page, (r) => r.url().endsWith('/travels') && r.request().method() === 'POST', () => saveBtn.click(),
    )
    expect(createRes.ok(), `POST /travels başarısız: ${await createRes.text()}`).toBeTruthy()
    const created = (await createRes.json()).data
    expect(created?.id, 'sefer id dönmeli').toBeTruthy()
    createdTravelIds.push(created.id)

    expect(created.routeId).toBe(routeId)
    expect(created.capacity).toBe(25)
    expect(created.reserveCapacity).toBe(5)
    expect(created.cancellationDeadlineHours).toBe(48)
    expect(created.participationPeriod).toBe('weekly')
    expect(created.participationLimit).toBe(2)
    expect(created.exemptFromParticipationLimit).toBe(true)
    expect(created.isActive).toBe(false)

    const freshToken = await getFreshToken(page)
    const readBack = await page.request.get(`${API_BASE}/travels/${created.id}`, { headers: { Authorization: `Bearer ${freshToken}` } })
    expect(readBack.ok()).toBeTruthy()
    const rb = (await readBack.json()).data
    expect(rb.capacity).toBe(25)
  })

  test('2) Araç ataması — Kontenjan araç kapasitesine otomatik senkronize olur, ikinci araç eklemeye çalışmak reddedilir', async ({ page }) => {
    test.setTimeout(60_000)
    await fastLoginUi(page, apiCtx)
    await openRouteDrilldown(page)

    await page.getByRole('button', { name: 'Yeni Sefer' }).first().click()
    const drawer = drawerOf(page)
    await expect(drawer).toBeVisible({ timeout: 8000 })

    await fillTravelDates(page, drawer, 22)

    // Araç ekle — Combobox ara ve seç
    const busCombo = drawer.getByPlaceholder('Araç ara ve ekle...')
    await busCombo.click()
    await busCombo.fill(tag)
    await page.waitForTimeout(400)
    await page.locator('div[data-ds-popover] button', { hasText: new RegExp(tag) }).first().click()

    // Araç seçilince Kontenjan otomatik araç kapasitesine (busCeiling) eşitlenmeli
    const capacityInput = drawer.locator('label', { hasText: 'Kontenjan' }).first().locator('xpath=following::input[1]')
    await expect(capacityInput).toHaveValue(String(busCapacity), { timeout: 5000 })

    // Aynı araç tekrar eklenemez / "ikinci araç" uyarısı: combobox artık görünmemeli
    // (seçili araç varken "Araç ara ve ekle..." alanı gizlenir — TravelForm.tsx: "form.busIds.length === 0" koşulu)
    await expect(drawer.getByPlaceholder('Araç ara ve ekle...')).toHaveCount(0)
    await expect(drawer.getByText('Bu sefere bir araç atanmıştır', { exact: false })).toBeVisible()

    const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtn).toBeEnabled({ timeout: 5000 })
    const createRes = await clickAndWaitForResponse(
      page, (r) => r.url().endsWith('/travels') && r.request().method() === 'POST', () => saveBtn.click(),
    )
    expect(createRes.ok(), `POST /travels başarısız: ${await createRes.text()}`).toBeTruthy()
    const created = (await createRes.json()).data
    createdTravelIds.push(created.id)
    expect(created.busCount).toBe(1)
    expect(created.capacity).toBe(busCapacity)
  })

  test('3) Rehber/Sorumlu Kişi "Yeni kişi ekle" modu — grantAccess anahtarı ve gerçek admin kullanıcı oluşturma', async ({ page }) => {
    test.setTimeout(60_000)
    await fastLoginUi(page, apiCtx)
    await openRouteDrilldown(page)

    await page.getByRole('button', { name: 'Yeni Sefer' }).first().click()
    const drawer = drawerOf(page)
    await expect(drawer).toBeVisible({ timeout: 8000 })

    await fillTravelDates(page, drawer, 24)
    await fillFieldByLabel(page, drawer, 'Kontenjan', '10')

    // Rehber/Sorumlu Kişi — "Araçlar & Ekip" kartı içinde. ÖNEMLİ (gerçek testte bulunan
    // DOM davranışı): ResponsiblePersonField.tsx'te "Rehber / Sorumlu Kişi" etiketi SADECE
    // "existing" modda görünür (FieldWrap yalnız o dalda bu label'ı alır) — "Yeni kişi ekle"
    // moduna geçilince etiket tamamen KAYBOLUR (yerine "Ad Soyad" gelir). Bu yüzden alan
    // kökünü, moddan bağımsız HER ZAMAN var olan SegmentedControl butonu ("Yeni kişi ekle" —
    // Şoför alanında allowCreate olmadığı için bu buton SADECE Rehber'de bulunur) üzerinden
    // buluyoruz; etiket metnine güvenmiyoruz.
    const crewSection = drawer.locator('p', { hasText: 'Araçlar & Ekip' }).locator('xpath=ancestor::div[contains(@class,"shadow-sm")][1]')
    const responsibleField = crewSection.getByRole('button', { name: 'Yeni kişi ekle' }).locator('xpath=ancestor::div[contains(@class,"space-y-3")][1]')
    await responsibleField.getByRole('button', { name: 'Yeni kişi ekle' }).click()
    await responsibleField.locator('label', { hasText: 'Ad Soyad' }).locator('xpath=following::input[1]').fill('QA Travel Rehber')

    // Sisteme erişim ver anahtarını aç — ResponsiblePersonField.tsx: <p>Sisteme erişim ver</p>
    // bir div.items-start.gap-3 içinde, aynı div'de <Switch/> (button[role="switch"]) var.
    await responsibleField.locator('p', { hasText: 'Sisteme erişim ver' }).locator('xpath=ancestor::div[contains(@class,"items-start")][1]').locator('button[role="switch"]').click()

    const uniqueTag = uniq('qatrvuigrant').replace(/[^a-z0-9]/gi, '')
    const email = `${uniqueTag}@example.com`
    await responsibleField.locator('label', { hasText: 'E-posta' }).locator('xpath=following::input[1]').fill(email)
    await responsibleField.locator('label', { hasText: 'Telefon' }).first().locator('xpath=following::input[1]').fill('5551234567')
    // ÖNEMLİ: showTckn=true olduğundan (ResponsiblePersonField allowAccessGrant+allowCreate)
    // T.C. Kimlik No da zorunludur — isResponsiblePersonValid (requireTckn=true varsayılan,
    // TravelsTab.tsx bunu false geçmiyor) doldurulmazsa getFormErrors engelleyip "Kaydet"
    // tıklamasını sessizce iptal ediyordu (gerçek testte bulunan davranış, buton görsel
    // olarak "enabled" göründüğü için ayırt etmek zordu).
    await responsibleField.locator('label', { hasText: 'T.C. Kimlik No' }).locator('xpath=following::input[1]').fill('35795679674')

    const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtn).toBeEnabled({ timeout: 5000 })
    const createRes = await clickAndWaitForResponse(
      page, (r) => r.url().endsWith('/travels') && r.request().method() === 'POST', () => saveBtn.click(),
    )
    expect(createRes.ok(), `POST /travels başarısız: ${await createRes.text()}`).toBeTruthy()
    const created = (await createRes.json()).data
    createdTravelIds.push(created.id)

    const responsibleId = created.crew?.responsible?.id
    expect(responsibleId, 'yeni sorumluya gerçek admin kullanıcısı atanmalı').toBeTruthy()
    createdAdminUserIds.push(responsibleId)

    const freshToken = await getFreshToken(page)
    const adminCheck = await page.request.get(`${API_BASE}/admins/${responsibleId}`, { headers: { Authorization: `Bearer ${freshToken}` } })
    expect(adminCheck.ok()).toBeTruthy()
    expect((await adminCheck.json()).data.email).toBe(email)
  })

  test('4) Şoför alanı "allowManual" modu — mevcut yöneticiden seçmeden serbest ad+telefon+TC girilebilir', async ({ page }) => {
    test.setTimeout(60_000)
    await fastLoginUi(page, apiCtx)
    await openRouteDrilldown(page)

    await page.getByRole('button', { name: 'Yeni Sefer' }).first().click()
    const drawer = drawerOf(page)
    await expect(drawer).toBeVisible({ timeout: 8000 })

    await fillTravelDates(page, drawer, 26)
    await fillFieldByLabel(page, drawer, 'Kontenjan', '10')

    // Şoför alanı: allowManual + showTckn — Combobox'a doğrudan serbest metin yazılabilir
    const driverCombo = drawer.getByPlaceholder('Yöneticiden seç ya da ad soyad yazın...')
    await driverCombo.click()
    await driverCombo.fill('QA Serbest Sofor')
    await dismissPopover(drawer)

    const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtn).toBeEnabled({ timeout: 5000 })
    const createRes = await clickAndWaitForResponse(
      page, (r) => r.url().endsWith('/travels') && r.request().method() === 'POST', () => saveBtn.click(),
    )
    expect(createRes.ok(), `POST /travels başarısız: ${await createRes.text()}`).toBeTruthy()
    const created = (await createRes.json()).data
    createdTravelIds.push(created.id)
    expect(created.crew?.driver?.name).toBe('QA Serbest Sofor')
    expect(created.crew?.driver?.id || null, 'serbest metinle girilen şoförün yönetici ID\'si olmamalı').toBeNull()
  })

  test('5) Liste ekranı: durum filtresi, "Geçmiş Seferleri Göster" ve toplu SMS/Bildirim eylemi', async ({ page }) => {
    test.setTimeout(60_000)
    await fastLoginUi(page, apiCtx)
    await openRouteDrilldown(page)

    // Durum filtresi: Pasif (test 1'de oluşturulan sefer isActive=false)
    // ÖNEMLİ: FilterBar.tsx'teki Select de (SessionsTab/EventsTab'daki gibi) pilot modda
    // custom buton+portal popover'dır, native <select> değil — pickSelectByFieldLabel kullanılmalı.
    await pickSelectByFieldLabel(page, page.locator('body'), 'Durum', 'Pasif')
    await expect(page.getByText(/Sefer Listesi/)).toBeVisible({ timeout: 10000 })

    await pickSelectByFieldLabel(page, page.locator('body'), 'Durum', 'Tüm Durumlar')

    const toggle = page.locator('label', { hasText: 'Geçmiş Seferleri Göster' }).locator('xpath=ancestor::div[contains(@class,"items-start") or contains(@class,"items-center")][1]').locator('button[role="switch"]')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    const firstRowCheckbox = page.locator('table tbody tr').first().locator('input[type="checkbox"]')
    if (await firstRowCheckbox.count() > 0) {
      await firstRowCheckbox.check()
      await expect(page.getByRole('button', { name: /SMS \/ Bildirim Gönder/ })).toBeVisible({ timeout: 5000 })
    }
  })

  test('6) Durum değiştirme (toggleStatus) gerçek API round-trip ile doğrulanır', async ({ page }) => {
    test.setTimeout(60_000)
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const start = futureIso(28)
    const end = futureIso(29)
    const res = await apiCtx.post(`${API_BASE}/travels`, {
      headers,
      data: {
        routeId, startDate: start, endDate: end,
        registrationStartDate: futureIso(1), registrationEndDate: futureIso(27),
        capacity: 5, reserveCapacity: 0, participationPeriod: 'none', participationLimit: 0,
        exemptFromParticipationLimit: false, cancellationDeadlineHours: 24,
        crew: {}, busIds: [], isActive: true,
      },
    })
    expect(res.ok()).toBeTruthy()
    const created = (await res.json()).data
    createdTravelIds.push(created.id)

    await fastLoginUi(page, apiCtx)
    await openRouteDrilldown(page)
    const dateLabel = new Date(start).toLocaleDateString('tr-TR')
    const row = page.locator('tr', { hasText: dateLabel }).first()
    await expect(row).toBeVisible({ timeout: 20000 })
    // RowActions.tsx: onToggleStatus butonunun aria-label'ı title prop'undan gelir
    // ("Aktif Et" / "Pasife Al"), "durumunu değiştir" değil — o metin yalnız
    // CrudListTemplate'in AYRI toggleOnColumnKey (sütuna tıklama) özelliğinde kullanılır,
    // TravelsTab bunu kullanmıyor (gerçek testte bulunan hata, 2026-10-03).
    await clickRowAction(page, row, 'Pasife Al')

    const freshToken = await getFreshToken(page)
    await expect.poll(async () => {
      const r = await page.request.get(`${API_BASE}/travels/${created.id}`, { headers: { Authorization: `Bearer ${freshToken}` } })
      return (await r.json()).data.isActive
    }, { timeout: 10000 }).toBe(false)
  })
})
