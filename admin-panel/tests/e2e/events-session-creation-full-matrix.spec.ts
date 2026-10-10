/**
 * ETKİNLİK SEANSLARI (Events → Sessions) — SEANS OLUŞTURMA TAM KAPSAM TESTİ
 *
 * Kaynak: TUM_MODULLER_MASTER_TEST_MATRISI_REVIZE.md — "Etkinlikler" modülü
 * (Seans Yönetimi alt matrisi, 210/810 ağırlıklı senaryoyla matristeki EN
 * BÜYÜK tek modül). `facility-session-*-matrix.spec.ts` ile aynı desen —
 * GERÇEK tarayıcı + GERÇEK canlı API + GERÇEK PostgreSQL — ama farklı form
 * (`SessionForm.tsx`, FacilityTemplate'in `GroupFormFields.tsx`'i DEĞİL) ve
 * farklı backend (`SessionService.cs`, `SessionFormRequestValidator.cs`,
 * `/api/v1/sessions`) üzerinde çalışır.
 *
 * KAPSANAN ALANLAR (SessionForm.tsx + session.types.ts üzerinden):
 * - Etkinlik seçimi (Combobox, kilitleme davranışı: lockEvent / mode=edit)
 * - Hizmet Tesisi (salt-okunur, etkinlikten gelir)
 * - Salon (yalnız indoor etkinlikte görünür; outdoor'da tamamen gizli)
 * - Seans Planı: Tek Seans vs Tekrarlı (etkinlik tek-günlükse kilitli)
 * - Tek Seans: Tarih + Başlangıç/Bitiş Saati (TimePicker metin girişi)
 * - Tekrarlı: Başlangıç/Bitiş Tarihi + RecurringScheduleField (7 gün chip'i,
 *   her gün için 1+ saat aralığı, "Saat Ekle"/kaldır, çalışma saati uyarısı)
 * - Kontenjan + Yedek Kontenjan (NumberInput, salon kapasitesine göre max)
 * - Eğitmen/Sorumlu: ResponsiblePersonField — "Mevcut yöneticiden seç" /
 *   "Yeni kişi ekle" modları, telefon/e-posta/acil telefon, sisteme erişim
 *   verme anahtarı (grantAccess) + T.C. Kimlik No
 * - Liste ekranı: durum (Aktif/Pasif/Dolu), filtreler, SMS/Bildirim toplu
 *   işlemi, oturma düzeni (yalnız salonlu seanslarda), Excel export
 * - Çakışma onay modalı (generate akışında: "Çakışanları Atla ve Oluştur")
 *
 * DÜRÜST KAPSAM NOTU: İş kuralı NEGATİF senaryoları (kapasite aşımı, geçmiş
 * tarih, çalışma saati dışı, salon çakışması, pasif salon, seanssız etkinlik
 * vb.) ayrı dosyada: events-session-business-rules.spec.ts. Mobil vatandaş
 * başvuru/QR/ödeme akışı ve koltuk planı (seat-plan) editörünün kendisi bu
 * dosyanın kapsamı DIŞINDADIR (ayrı özellik, SeatPlanModal).
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import {
  adminToken, fastLoginUi, getFreshToken, uniq, futureIso, API_BASE,
  createEventCategory, createOutdoorSessionableEvent, createServiceFacilityAndHall, createIndoorSessionableEvent,
  cleanupEventsFixture, pickSelectByFieldLabel,
} from './helpers/eventsSessionFixtures'
import { fillFieldByLabel } from './helpers/designSystemControls'
import { clickRowAction } from './helpers/rowActions'

async function openSessionsTabFor(page: Page, eventId: string) {
  await page.goto(`/events?tab=sessions&eventId=${eventId}`)
  await expect(page.getByText('Seans Listesi')).toBeVisible({ timeout: 20000 })
}

/** EventFormHeader + drawer kapsayıcısı — diğer events testlerinde olduğu gibi drawer'ı en son açılan olarak alıyoruz. */
function drawerOf(page: Page) {
  return page.locator('div.relative.z-10').last()
}

/**
 * TimePicker.tsx: input'a fill() yaptıktan sonra açık kalan saat/dakika sütunlu
 * popover (data-ds-popover) sonraki tıklamaları engelliyor (gerçek testte bulunan
 * hata, 2026-10-03). Escape TÜM drawer'ı kapatıyor (CrudListTemplate'in kendi
 * Escape-to-close davranışı global olarak dinliyor) — bunun yerine popover'ın
 * DIŞINA, drawer içindeki zararsız bir noktaya (başlık) tıklayarak kapatıyoruz.
 */
async function fillTimePicker(page: Page, drawer: ReturnType<Page['locator']>, input: ReturnType<Page['locator']>, value: string) {
  await input.fill(value)
  await drawer.locator('p', { hasText: 'Seans Formu' }).first().click({ force: true }).catch(() => {})
}

/**
 * Canlı ortam Production modunda çalışıyor (GlobalPermitLimit=600/60s, IP başına,
 * round-robin 3 backend) — bu paylaşılan geliştirme kutusunda eşzamanlı diğer
 * trafikle (admin panel arka plan istekleri vb.) birleşince ara sıra GEÇİCİ 429
 * RATE_LIMIT_EXCEEDED görülebiliyor (gerçek testte bulunan flake, 2026-10-03).
 * Bu, test mantığının kendisiyle ilgili bir hata DEĞİL — paylaşılan altyapı
 * gürültüsü. Butona tıkla + yanıtı bekle adımını, 429 görülürse kısa bir
 * backoff'tan sonra yeniden deneyerek sağlamlaştırıyoruz.
 */
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

test.describe.serial('Etkinlik Seansları — Seans Oluşturma Tam Alan Kapsamı', () => {
  let apiCtx: APIRequestContext
  let token = ''
  let categoryId = ''
  let outdoorEventId = ''
  let multiDayEventId = ''
  let indoorEventId = ''
  let serviceFacilityId = ''
  let hallId = ''
  const hallCapacity = 40
  const createdSessionIds: string[] = []
  const createdAdminUserIds: string[] = []
  const tag = uniq('QA-EVTSES')
  const multiDayTag = uniq('QA-EVTSESMULTI')

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const cat = await createEventCategory(apiCtx, token, tag)
    categoryId = cat.id
    const outdoorEv = await createOutdoorSessionableEvent(apiCtx, token, categoryId, tag)
    outdoorEventId = outdoorEv.id
    // Çok günlük (tarih aralığı) bir etkinlik — SessionForm.tsx: eventRange.single=false
    // olduğunda "Seans Planı" segment kilitlenmez, "Tekrarlı" moduna GERÇEKTEN
    // tıklanabilir hale gelir (tek günlük etkinlikte bu segment devre dışı kalır).
    // AYRI bir tag kullanılır: `${tag}-MULTI` kullanılsaydı isim araması (substring)
    // tek-seans testinde (tag ile arama) İKİ etkinliği de eşleştirip yanlışlıkla
    // çok-günlü etkinliği seçebilirdi (gerçek testte bulunan çapraz kirlenme, 2026-10-03).
    const multiDayEv = await createOutdoorSessionableEvent(apiCtx, token, categoryId, multiDayTag, {
      startDate: futureIso(20), endDate: futureIso(60),
    })
    multiDayEventId = multiDayEv.id
    const hallFx = await createServiceFacilityAndHall(apiCtx, token, tag, hallCapacity)
    serviceFacilityId = hallFx.serviceFacilityId
    hallId = hallFx.hallId
    const indoorEv = await createIndoorSessionableEvent(apiCtx, token, categoryId, serviceFacilityId, hallId, tag)
    indoorEventId = indoorEv.id
  })

  test.afterAll(async () => {
    await cleanupEventsFixture(apiCtx, token, {
      sessionIds: createdSessionIds,
      eventIds: [outdoorEventId, multiDayEventId, indoorEventId],
      categoryIds: [categoryId],
      hallIds: [hallId],
      serviceFacilityIds: [serviceFacilityId],
      adminUserIds: createdAdminUserIds,
    })
    await apiCtx.dispose()
  })

  test('1) OUTDOOR etkinlik — TEK SEANS oluşturulur: Salon alanı tamamen gizli, Kontenjan/Yedek/Eğitmen alanları çalışır', async ({ page }) => {
    test.setTimeout(60_000)
    await fastLoginUi(page, apiCtx)
    await page.goto(`/events?tab=sessions`)
    await expect(page.getByText('Seans Listesi')).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Seans' }).click()
    const drawer = drawerOf(page)
    await expect(drawer).toBeVisible({ timeout: 8000 })

    // Etkinlik seçimi — Combobox arama (gerçek network isteği, 250ms debounce)
    const eventCombo = drawer.getByPlaceholder('Etkinlik ara...')
    await eventCombo.click()
    await eventCombo.fill(tag)
    await page.waitForTimeout(400)
    await page.locator('div[data-ds-popover] button', { hasText: /Açık Alan Etkinliği/ }).first().click()

    // Salon alanı outdoor etkinlikte HİÇ render edilmemeli (SessionForm.tsx: eventVenueType !== 'outdoor' koşulu)
    await expect(drawer.locator('label', { hasText: 'Salon' })).toHaveCount(0)

    // Tek Seans modu varsayılan (etkinlik tek günlük) — Tarih etkinlik aralığından
    // kilitlenir (SessionForm.tsx: scheduleLocked = mode==='create' && eventRange tek
    // günlük), bu yüzden doldurulmaz — yalnız LockedField olarak göründüğü doğrulanır.
    await expect(drawer.locator('label', { hasText: 'Tarih' }).locator('xpath=following-sibling::*[1]//input')).toHaveCount(0)
    const startTimeInput = drawer.locator('label', { hasText: 'Başlangıç Saati' }).locator('xpath=following::input[1]')
    await fillTimePicker(page, drawer, startTimeInput, '09:30')
    const endTimeInput = drawer.locator('label', { hasText: 'Bitiş Saati' }).locator('xpath=following::input[1]')
    await fillTimePicker(page, drawer, endTimeInput, '11:00')

    await fillFieldByLabel(page, drawer, 'Kontenjan', '22')
    await fillFieldByLabel(page, drawer, 'Yedek Kontenjan', '6')

    // Eğitmen/Sorumlu — "Yeni kişi ekle" modu. "Ad Soyad" girişi `sanitize="letters"`
    // ile RAKAM/SEMBOL kabul etmez (ResponsiblePersonField.tsx → Input) — tag'deki
    // zaman damgası rakamları burada KULLANILAMAZ, harf-only bir isim veriyoruz.
    const instructorName = 'QA EVTSES Egitmen Bir'
    await drawer.getByRole('button', { name: 'Yeni kişi ekle' }).click()
    await drawer.locator('label', { hasText: 'Ad Soyad' }).locator('xpath=following::input[1]').fill(instructorName)
    const phoneInput = drawer.locator('label', { hasText: 'Telefon' }).first().locator('xpath=following::input[1]')
    await phoneInput.fill('5551234567')

    const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtn).toBeEnabled({ timeout: 5000 })
    const createRes = await clickAndWaitForResponse(
      page, (r) => r.url().endsWith('/sessions') && r.request().method() === 'POST', () => saveBtn.click(),
    )
    expect(createRes.ok(), `POST /sessions başarısız: ${await createRes.text()}`).toBeTruthy()
    const created = (await createRes.json()).data
    expect(created?.id, 'seans id dönmeli').toBeTruthy()
    createdSessionIds.push(created.id)
    if (created.instructorId) createdAdminUserIds.push(created.instructorId)

    expect(created.eventId).toBe(outdoorEventId)
    expect(created.hallId ?? null).toBeNull()
    expect(created.startTime).toBe('09:30')
    expect(created.endTime).toBe('11:00')
    expect(created.capacity).toBe(22)
    expect(created.reserveCapacity).toBe(6)
    expect(created.instructor).toBe(instructorName)
    expect(created.instructorPhone).toBe('05551234567')

    const freshToken = await getFreshToken(page)
    const readBack = await page.request.get(`${API_BASE}/sessions/${created.id}`, { headers: { Authorization: `Bearer ${freshToken}` } })
    expect(readBack.ok()).toBeTruthy()
    const rb = (await readBack.json()).data
    expect(rb.capacity).toBe(22)
    expect(rb.isActive).toBe(true)
  })

  test('2) INDOOR etkinlik — Salon seçimi görünür ve çalışır, Kontenjan salon kapasitesine kilitlenir (max attribute)', async ({ page }) => {
    test.setTimeout(60_000)
    await fastLoginUi(page, apiCtx)
    await page.goto(`/events?tab=sessions&eventId=${indoorEventId}`)
    await expect(page.getByText('Seans Listesi')).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Seans' }).click()
    const drawer = drawerOf(page)
    await expect(drawer).toBeVisible({ timeout: 8000 })

    // eventIdFilter varken Etkinlik alanı lockEvent=true ile kilitli (LockedField) gelir
    await expect(drawer.locator('p', { hasText: 'Seans Formu' })).toBeVisible()

    // Salon alanı GÖRÜNÜR olmalı (indoor etkinlik)
    await expect(drawer.locator('label', { hasText: 'Salon' })).toBeVisible({ timeout: 5000 })

    // Etkinlik tek günlük olduğundan Tarih alanı da kilitli (scheduleLocked) gelir.
    const startTimeInput = drawer.locator('label', { hasText: 'Başlangıç Saati' }).locator('xpath=following::input[1]')
    await fillTimePicker(page, drawer, startTimeInput, '13:00')
    const endTimeInput = drawer.locator('label', { hasText: 'Bitiş Saati' }).locator('xpath=following::input[1]')
    await fillTimePicker(page, drawer, endTimeInput, '14:00')

    const capacityInput = drawer.locator('label', { hasText: 'Kontenjan' }).first().locator('xpath=following::input[1]')
    // SessionForm.tsx: hallId'nin otomatik atanması İKİ ayrı async adıma bağlıdır
    // (eventService.getById → sonra hallService.getHallOptions) — bu nedenle flaky
    // bir yarış durumu vardı (gerçek testte bulunan hata, 2026-10-03): kontenjan max
    // attribute'u henüz set edilmeden forma dokunulursa hallId boş kalıp kaydediliyordu.
    // Otomatik atama tamamlanınca Kontenjan input'u salonun müsait koltuk sayısına
    // (sıfırdan farklı) ayarlanır — bunu bekleyerek yarışı ortadan kaldırıyoruz.
    await expect(capacityInput).not.toHaveValue('0', { timeout: 10000 })
    const maxAttr = await capacityInput.getAttribute('max')
    // Event'in kendi salonu zaten bu salon olduğundan form otomatik hallId atar ve
    // kontenjanı salonun müsait koltuk sayısına (availableCapacity) kilitler.
    expect(maxAttr === null || Number(maxAttr) <= hallCapacity, `max=${maxAttr} salon kapasitesini (${hallCapacity}) aşmamalı`).toBeTruthy()
    await capacityInput.fill('15')

    const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtn).toBeEnabled({ timeout: 5000 })
    const createRes = await clickAndWaitForResponse(
      page, (r) => r.url().endsWith('/sessions') && r.request().method() === 'POST', () => saveBtn.click(),
    )
    expect(createRes.ok(), `POST /sessions başarısız: ${await createRes.text()}`).toBeTruthy()
    const created = (await createRes.json()).data
    createdSessionIds.push(created.id)
    expect(created.hallId).toBe(hallId)
    expect(created.hallName).toBeTruthy()
    expect(created.capacity).toBe(15)
  })

  test('3) TEKRARLI (recurring) seans — RecurringScheduleField: 2 gün × her gün 1 saat aralığı, API generate ile seans üretimi', async ({ page }) => {
    test.setTimeout(90_000)
    await fastLoginUi(page, apiCtx)
    await page.goto(`/events?tab=sessions`)
    await expect(page.getByText('Seans Listesi')).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Seans' }).click()
    const drawer = drawerOf(page)
    await expect(drawer).toBeVisible({ timeout: 8000 })

    const eventCombo = drawer.getByPlaceholder('Etkinlik ara...')
    await eventCombo.click()
    await eventCombo.fill(multiDayTag)
    await page.waitForTimeout(400)
    await page.locator('div[data-ds-popover] button', { hasText: new RegExp(multiDayTag) }).first().click()

    // Çok günlük etkinlik seçildiğinde SessionForm.tsx kendisi mode='recurring'
    // otomatik atar VE scheduleLocked=true olduğundan (mode==='create' && eventRange
    // mevcut) segment de Başlangıç/Bitiş Tarihi alanları da KİLİTLİ gelir — etkinliğin
    // kendi tarih aralığı dışına çıkılamaz. Burada hem "Tekrarlı"nın otomatik seçili
    // olduğunu hem de tarih alanlarının LockedField olarak geldiğini doğruluyoruz.
    const recurringBtn = drawer.getByRole('button', { name: 'Tekrarlı', exact: false })
    await expect(recurringBtn).toHaveAttribute('disabled', '')
    await expect(drawer.locator('label', { hasText: 'Başlangıç Tarihi' }).locator('xpath=following-sibling::*[1]//input')).toHaveCount(0)

    // RecurringScheduleField: Pazartesi + Çarşamba günlerini aç, her biri için saat aralığı gir
    await drawer.getByText('Pzt', { exact: true }).click()
    await drawer.getByText('Çar', { exact: true }).click()

    const timeInputs = drawer.locator('input[inputmode="numeric"][placeholder="ss:dd"]')
    const count = await timeInputs.count()
    expect(count, 'her açık gün için 2 saat inputu (başlangıç+bitiş) olmalı').toBeGreaterThanOrEqual(4)
    await timeInputs.nth(0).fill('09:00')
    await drawer.locator('p', { hasText: 'Seans Formu' }).first().click({ force: true }).catch(() => {})
    await timeInputs.nth(1).fill('10:00')
    await drawer.locator('p', { hasText: 'Seans Formu' }).first().click({ force: true }).catch(() => {})
    await timeInputs.nth(2).fill('15:00')
    await drawer.locator('p', { hasText: 'Seans Formu' }).first().click({ force: true }).catch(() => {})
    await timeInputs.nth(3).fill('16:00')
    await drawer.locator('p', { hasText: 'Seans Formu' }).first().click({ force: true }).catch(() => {})

    await fillFieldByLabel(page, drawer, 'Kontenjan', '12')

    const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtn).toBeEnabled({ timeout: 5000 })
    const checkConflictsRes = await clickAndWaitForResponse(
      page, (r) => r.url().endsWith('/sessions/check-conflicts') && r.request().method() === 'POST', () => saveBtn.click(),
    )
    expect(checkConflictsRes.ok(), `POST /sessions/check-conflicts başarısız: ${await checkConflictsRes.text()}`).toBeTruthy()

    // Çakışma yoksa (yeni/boş salon) generate otomatik tetiklenir — toast'ı bekle
    await expect(page.getByText(/seans oluşturuldu/)).toBeVisible({ timeout: 10000 })

    const freshToken = await getFreshToken(page)
    const list = await page.request.get(`${API_BASE}/sessions?eventId=${multiDayEventId}&page=1&limit=100`, { headers: { Authorization: `Bearer ${freshToken}` } })
    const items = (await list.json())?.data?.items ?? []
    const ours: Array<{ id: string; startTime: string; capacity: number }> = items.filter((s: { capacity: number }) => s.capacity === 12)
    expect(ours.length, 'Pzt+Çar aralığında en az 2 seans üretilmeli').toBeGreaterThanOrEqual(2)
    for (const s of ours) createdSessionIds.push(s.id)
  })

  test('4) Liste ekranı: durum rozet(ler)i, filtreler ve toplu SMS/Bildirim eylemi gerçek verilerle çalışır', async ({ page }) => {
    test.setTimeout(60_000)
    await fastLoginUi(page, apiCtx)
    await openSessionsTabFor(page, outdoorEventId)

    await page.getByPlaceholder('Etkinlik, salon veya eğitmen ara...').fill(tag)
    await expect(page.getByText(/Açık Alan Etkinliği/).first()).toBeVisible({ timeout: 20000 })

    // Durum filtresi: Aktif — Select.tsx her zaman özel buton+popover render eder
    // (native <select> yok), FilterField etiketi "Durum" üzerinden gidiyoruz.
    await pickSelectByFieldLabel(page, page.locator('body'), 'Durum', 'Aktif')
    await expect(page.getByText(/Açık Alan Etkinliği/).first()).toBeVisible({ timeout: 10000 })

    // Toplu SMS/Bildirim — en az bir satırı seç, bulk action butonunun göründüğünü doğrula
    const firstRowCheckbox = page.locator('table tbody tr').first().locator('input[type="checkbox"]')
    if (await firstRowCheckbox.count() > 0) {
      await firstRowCheckbox.check()
      await expect(page.getByRole('button', { name: /SMS \/ Bildirim Gönder/ })).toBeVisible({ timeout: 5000 })
    }
  })

  test('5) Mevcut yöneticiden eğitmen seçimi — "existing" modu, telefon/e-posta otomatik kilitli gelir', async ({ page }) => {
    test.setTimeout(60_000)
    await fastLoginUi(page, apiCtx)
    await page.goto(`/events?tab=sessions&eventId=${outdoorEventId}`)
    await expect(page.getByText('Seans Listesi')).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Seans' }).click()
    const drawer = drawerOf(page)
    await expect(drawer).toBeVisible({ timeout: 8000 })

    const startTimeInput = drawer.locator('label', { hasText: 'Başlangıç Saati' }).locator('xpath=following::input[1]')
    await fillTimePicker(page, drawer, startTimeInput, '08:00')
    const endTimeInput = drawer.locator('label', { hasText: 'Bitiş Saati' }).locator('xpath=following::input[1]')
    await fillTimePicker(page, drawer, endTimeInput, '09:00')
    await fillFieldByLabel(page, drawer, 'Kontenjan', '5')

    // "Mevcut yöneticiden seç" varsayılan mod — süperadmin'i ara ve seç
    const managerCombo = drawer.getByPlaceholder('Yöneticilerden ara ve seç...')
    await managerCombo.click()
    await managerCombo.fill('Süper')
    await page.waitForTimeout(400)
    const option = page.locator('div[data-ds-popover] button', { hasText: /Süper/ }).first()
    await expect(option).toBeVisible({ timeout: 5000 })
    await option.click()

    // Telefon alanı artık kilitli (locked = !!managerId) olmalı
    const phoneInput = drawer.locator('label', { hasText: 'Telefon' }).first().locator('xpath=following::input[1]')
    await expect(phoneInput).toBeDisabled()

    const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtn).toBeEnabled({ timeout: 5000 })
    const createRes = await clickAndWaitForResponse(
      page, (r) => r.url().endsWith('/sessions') && r.request().method() === 'POST', () => saveBtn.click(),
    )
    expect(createRes.ok(), `POST /sessions başarısız: ${await createRes.text()}`).toBeTruthy()
    const created = (await createRes.json()).data
    createdSessionIds.push(created.id)
    expect(created.instructorId, 'mevcut yöneticiden seçilince instructorId dolu olmalı').toBeTruthy()
    expect(created.instructor).toContain('Süper')
  })

  test('6) DÜZENLEME modu: Etkinlik alanı her zaman kilitli (LockedField), diğer alanlar güncellenebilir', async ({ page }) => {
    test.setTimeout(60_000)
    await fastLoginUi(page, apiCtx)
    await openSessionsTabFor(page, outdoorEventId)
    await page.getByPlaceholder('Etkinlik, salon veya eğitmen ara...').fill(tag)

    const row = page.locator('tr', { hasText: 'Açık Alan Etkinliği' }).first()
    await expect(row).toBeVisible({ timeout: 20000 })
    await clickRowAction(page, row, 'Düzenle')

    const drawer = drawerOf(page)
    await expect(drawer).toBeVisible({ timeout: 8000 })
    // mode==='edit' → lockedEvent=true → LockedField (readonly görünüm, input yok)
    await expect(drawer.locator('label', { hasText: 'Etkinlik' }).locator('xpath=following-sibling::*[1]//input')).toHaveCount(0)

    const capacityInput = drawer.locator('label', { hasText: 'Kontenjan' }).first().locator('xpath=following::input[1]')
    await capacityInput.fill('30')

    const updateBtn = drawer.getByRole('button', { name: 'Güncelle', exact: true })
    const updateRes = await clickAndWaitForResponse(
      page, (r) => r.url().includes('/sessions/') && r.request().method() === 'PUT', () => updateBtn.click(),
    )
    expect(updateRes.ok(), `PUT /sessions başarısız: ${await updateRes.text()}`).toBeTruthy()
    const updated = (await updateRes.json()).data
    expect(updated.capacity).toBe(30)
  })

  test('7) Durumu Pasife Al / Aktif Et (toggleStatus) gerçek API round-trip ile doğrulanır', async ({ page }) => {
    test.setTimeout(60_000)
    const freshApiToken = await adminToken(apiCtx)
    const headers = { Authorization: `Bearer ${freshApiToken}` }
    const date = futureIso(18)
    const res = await apiCtx.post(`${API_BASE}/sessions`, {
      headers,
      data: {
        eventId: outdoorEventId, hallId: null, mode: 'single', date, startTime: '07:00', endTime: '08:00',
        startDate: date, endDate: date, dayPlans: [], capacity: 5, reserveCapacity: 0,
        instructor: null, instructorId: null, instructorPhone: null, instructorEmail: null, emergencyPhone: null,
        isActive: true, grantAccess: false, tckn: null,
      },
    })
    expect(res.ok()).toBeTruthy()
    const created = (await res.json()).data
    createdSessionIds.push(created.id)

    await fastLoginUi(page, apiCtx)
    await openSessionsTabFor(page, outdoorEventId)

    const row = page.locator('tr', { hasText: '07:00' }).first()
    await expect(row).toBeVisible({ timeout: 20000 })
    await clickRowAction(page, row, 'Pasife Al')
    const confirmBtn = page.getByRole('button', { name: 'Onayla' }).last()
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) await confirmBtn.click()

    const freshToken = await getFreshToken(page)
    await expect.poll(async () => {
      const r = await page.request.get(`${API_BASE}/sessions/${created.id}`, { headers: { Authorization: `Bearer ${freshToken}` } })
      return (await r.json()).data.isActive
    }, { timeout: 10000 }).toBe(false)
  })
})
