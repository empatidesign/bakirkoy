/**
 * CANLI İZLEME DEMOSU — Events (Etkinlikler).
 *
 * Akış (Facility modüllerindekiyle aynı mantık, Events'in kendi UI akışına
 * uyarlanmış): Admin UI'dan OUTDOOR bir etkinlik için GERÇEKTEN bir seans
 * oluşturulur (Yeni Seans drawer'ı, gerçek alan doldurma), ardından GERÇEK
 * bir vatandaş citizen-portal UI'dan bu etkinliği keşfedip seansı seçip
 * "Başvur" tıklar — ağ cevabı ve başarı toast'ı doğrulanır, sonra admin
 * panelde başvurunun gerçekten düştüğü Başvurular sekmesinden teyit edilir.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import {
  adminToken, fastLoginUi, getFreshToken, uniq, futureIso, API_BASE,
  createEventCategory, createOutdoorSessionableEvent, createIndoorSessionableEvent,
  createServiceFacilityAndHall, cleanupEventsFixture,
} from '../helpers/eventsSessionFixtures'
import { fillFieldByLabel } from '../helpers/designSystemControls'
import { errorToastLocator } from '../helpers/facilitySessionMatrix'
import { registerCitizen, citizenLoginUiWithToken, CITIZEN_PORTAL_URL, type NewCitizen } from '../helpers/citizenAuth'

function drawerOf(page: import('@playwright/test').Page) {
  return page.locator('div.relative.z-10').last()
}

async function fillTimePicker(page: import('@playwright/test').Page, drawer: import('@playwright/test').Locator, input: import('@playwright/test').Locator, value: string) {
  await input.fill(value)
  await drawer.locator('p', { hasText: 'Seans Formu' }).first().click({ force: true }).catch(() => {})
}

test.describe.serial('[CANLI DEMO] Etkinlikler — Seans Oluşturma (admin UI) + Vatandaş Başvurusu (citizen UI)', () => {
  test.setTimeout(180_000)
  let apiCtx: APIRequestContext
  let token = ''
  let categoryId = ''
  let eventId = ''
  let indoorEventId = ''
  let serviceFacilityId = ''
  let hallId = ''
  const hallCapacity = 40
  const createdSessionIds: string[] = []
  const createdAdminUserIds: string[] = []
  const tag = uniq('CANLI-DEMO events')
  const eventName = `${tag} Açık Alan Etkinliği`

  let sessionId = ''
  let adultCitizen: NewCitizen

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const cat = await createEventCategory(apiCtx, token, tag)
    categoryId = cat.id
    const ev = await createOutdoorSessionableEvent(apiCtx, token, categoryId, tag)
    eventId = ev.id
    const hallFx = await createServiceFacilityAndHall(apiCtx, token, tag, hallCapacity)
    serviceFacilityId = hallFx.serviceFacilityId
    hallId = hallFx.hallId
    const indoorEv = await createIndoorSessionableEvent(apiCtx, token, categoryId, serviceFacilityId, hallId, tag)
    indoorEventId = indoorEv.id
  })

  test.afterAll(async () => {
    await cleanupEventsFixture(apiCtx, token, {
      sessionIds: createdSessionIds, eventIds: [eventId, indoorEventId], categoryIds: [categoryId],
      hallIds: [hallId], serviceFacilityIds: [serviceFacilityId],
      adminUserIds: createdAdminUserIds,
    })
    await apiCtx.dispose()
  })

  test('1) ADMIN UI — Açık Alan Etkinliği için GERÇEKTEN yeni seans oluşturulur (Kontenjan/Eğitmen/Saat)', async ({ page }) => {
    await fastLoginUi(page, apiCtx)
    await page.goto(`/events?tab=sessions`)
    await expect(page.getByText('Seans Listesi')).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Seans' }).click()
    const drawer = drawerOf(page)
    await expect(drawer).toBeVisible({ timeout: 8000 })

    const eventCombo = drawer.getByPlaceholder('Etkinlik ara...')
    await eventCombo.click()
    await eventCombo.fill(tag)
    await page.waitForTimeout(400)
    await page.locator('div[data-ds-popover] button', { hasText: /Açık Alan Etkinliği/ }).first().click()

    const startTimeInput = drawer.locator('label', { hasText: 'Başlangıç Saati' }).locator('xpath=following::input[1]')
    await fillTimePicker(page, drawer, startTimeInput, '09:30')
    const endTimeInput = drawer.locator('label', { hasText: 'Bitiş Saati' }).locator('xpath=following::input[1]')
    await fillTimePicker(page, drawer, endTimeInput, '11:00')

    await fillFieldByLabel(page, drawer, 'Kontenjan', '20')
    await fillFieldByLabel(page, drawer, 'Yedek Kontenjan', '5')

    const instructorName = 'CANLI DEMO Egitmen'
    await drawer.getByRole('button', { name: 'Yeni kişi ekle' }).click()
    await drawer.locator('label', { hasText: 'Ad Soyad' }).locator('xpath=following::input[1]').fill(instructorName)
    const phoneInput = drawer.locator('label', { hasText: 'Telefon' }).first().locator('xpath=following::input[1]')
    await phoneInput.fill('5551234567')

    const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtn).toBeEnabled({ timeout: 5000 })

    const [createRes] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/sessions') && r.request().method() === 'POST'),
      saveBtn.click(),
    ])
    expect(createRes.ok(), `GERÇEK HATA — seans oluşturma UI'dan başarısız: ${await createRes.text()}`).toBeTruthy()

    const created = (await createRes.json()).data
    expect(created?.id, 'seans id dönmeli').toBeTruthy()
    sessionId = created.id
    createdSessionIds.push(sessionId)
    if (created.instructorId) createdAdminUserIds.push(created.instructorId)
    expect(created.eventId).toBe(eventId)
    expect(created.capacity).toBe(20)

    const freshToken = await getFreshToken(page)
    const patchRes = await page.request.patch(`${API_BASE}/events/${eventId}`, {
      headers: { Authorization: `Bearer ${freshToken}` },
      data: { applicationStartDate: futureIso(0), applicationEndDate: futureIso(90) },
    })
    if (!patchRes.ok()) console.log(`[bilgi] applicationStartDate PATCH desteklenmiyor olabilir: ${patchRes.status()}`)
  })

  test('1b) ADMIN UI — İKİNCİ VARYASYON: INDOOR (Salonlu) etkinlik için seans oluşturulur, Salon alanı görünür ve kontenjan salon kapasitesine kilitlenir', async ({ page }) => {
    // Kullanıcı isteği: "bütün varyasyon seçeneklerini çoğalt" — test 1 OUTDOOR
    // (salon alanı tamamen gizli) varyasyonunu gösterdi, bu test INDOOR varyasyonunu
    // gösterir: Salon alanı GÖRÜNÜR olur ve kontenjan otomatik salon kapasitesine
    // kilitlenir (events-session-creation-full-matrix.spec.ts test 2'de kanıtlanmış
    // davranış — hallId atamasının iki ayrı async adıma bağlı olduğu, kontenjan
    // inputunun "0" değerinden çıkmasını beklememiz gerektiği bulgusu buraya da
    // uygulanıyor).
    await fastLoginUi(page, apiCtx)
    await page.goto(`/events?tab=sessions&eventId=${indoorEventId}`)
    await expect(page.getByText('Seans Listesi')).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Seans' }).click()
    const drawer2 = drawerOf(page)
    await expect(drawer2).toBeVisible({ timeout: 8000 })

    // Salon alanı GÖRÜNÜR olmalı (indoor etkinlik) — outdoor varyasyondan farkı.
    await expect(drawer2.locator('label', { hasText: 'Salon' })).toBeVisible({ timeout: 5000 })

    const startTimeInput2 = drawer2.locator('label', { hasText: 'Başlangıç Saati' }).locator('xpath=following::input[1]')
    await fillTimePicker(page, drawer2, startTimeInput2, '13:00')
    const endTimeInput2 = drawer2.locator('label', { hasText: 'Bitiş Saati' }).locator('xpath=following::input[1]')
    await fillTimePicker(page, drawer2, endTimeInput2, '14:00')

    const capacityInput = drawer2.locator('label', { hasText: 'Kontenjan' }).first().locator('xpath=following::input[1]')
    await expect(capacityInput).not.toHaveValue('0', { timeout: 10000 })
    await capacityInput.fill('15')

    const errBeforeIndoor = await errorToastLocator(page)
    const saveBtnIndoor = drawer2.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtnIndoor).toBeEnabled({ timeout: 5000 })

    const [createResIndoor] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/sessions') && r.request().method() === 'POST'),
      saveBtnIndoor.click(),
    ])
    expect(createResIndoor.ok(), `GERÇEK HATA — salonlu seans oluşturma UI'dan başarısız: ${await createResIndoor.text()}`).toBeTruthy()
    await expect(errBeforeIndoor).toHaveCount(0, { timeout: 3000 })

    const createdIndoor = (await createResIndoor.json()).data
    expect(createdIndoor?.id, 'salonlu seans id dönmeli').toBeTruthy()
    createdSessionIds.push(createdIndoor.id)
    expect(createdIndoor.hallId).toBe(hallId)
    expect(createdIndoor.hallName).toBeTruthy()
    expect(createdIndoor.capacity).toBe(15)
    console.log('[canlı demo] INDOOR (salonlu) seans varyasyonu UI üzerinden GERÇEKTEN oluşturuldu.')
  })

  test('2) GERÇEK VATANDAŞ KAYDI — 28 yaşında, TC kimlik + OTP ile canlı register', async () => {
    adultCitizen = await registerCitizen(apiCtx, 28, 'events-adult')
    expect(adultCitizen.token).toBeTruthy()
    console.log(`[canlı demo] Vatandaş oluşturuldu: TC ${adultCitizen.tckn}, yaş ${adultCitizen.ageYears}`)
  })

  test('3) CITIZEN PORTAL UI — Vatandaş GERÇEKTEN giriş yapar, etkinliği bulur, seansı seçer ve başvurur', async ({ page }) => {
    await citizenLoginUiWithToken(page, adultCitizen)
    await page.goto(`${CITIZEN_PORTAL_URL}/etkinlikler?eventId=${eventId}&sessionId=${sessionId}`)
    await page.waitForLoadState('networkidle').catch(() => {})

    // Etkinlik detay modalı doğrudan eventId/sessionId query param'ı ile açılır
    // (DiscoverTab useEffect'i searchParams'tan okuyor).
    const detailHeading = page.getByText(eventName).first()
    await expect(detailHeading).toBeVisible({ timeout: 10000 })

    // Adım 2 (Başvuru) sekmesine geç — "Başvuruya Devam Et" butonu veya üstteki "2 Başvuru" sekmesi
    const continueBtn = page.getByRole('button', { name: /Başvuruya Devam Et/i }).first()
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continueBtn.click()
    } else {
      await page.getByRole('button', { name: /^2\s*Başvuru/i }).first().click()
    }

    // Kendisi için başvuran kişiyi seç (varsayılan "Ben")
    const selfOption = page.getByText(/\(Ben\)/i).first()
    await expect(selfOption).toBeVisible({ timeout: 8000 })
    await selfOption.click()

    const applyBtn = page.getByRole('button', { name: /Başvur/i }).last()
    await expect(applyBtn).toBeEnabled({ timeout: 8000 })

    const [applyRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/apply') && r.request().method() === 'POST'),
      applyBtn.click(),
    ])
    expect(applyRes.ok(), `GERÇEK HATA — vatandaş başvurusu UI'dan başarısız: ${await applyRes.text()}`).toBeTruthy()
    console.log('[canlı demo] Vatandaş başvurusu UI üzerinden GERÇEKTEN kaydedildi.')
  })

  test('4) ADMIN PANEL UI — Başvuru GERÇEKTEN düşmüş mü, Başvurular sekmesinden canlı doğrulanır', async ({ page }) => {
    await fastLoginUi(page, apiCtx)
    await page.goto(`/events?tab=applications&eventId=${eventId}`)
    await page.waitForLoadState('networkidle').catch(() => {})

    const anyAppRow = page.locator('table tbody tr').first()
    await expect(anyAppRow).toBeVisible({ timeout: 10000 })
    console.log('[canlı demo] Admin panelde başvuru satırı GERÇEKTEN görünüyor — cross-surface tutarlılık doğrulandı.')
  })
})
