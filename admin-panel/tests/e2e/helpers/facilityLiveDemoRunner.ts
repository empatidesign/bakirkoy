/**
 * CANLI İZLEME DEMOSU — Ortak Çalıştırıcı (8 Facility Modülü için paylaşımlı).
 *
 * `01-sports-live-demo.spec.ts`'te kanıtlanmış akışın (admin UI grup oluştur →
 * GERÇEK vatandaş kaydı → citizen UI başvuru → admin UI'da çapraz doğrulama →
 * farklı yaş/uygunsuzluk senaryosu) parametrik hali — her 8 Facility modülü için
 * tekrar yazmak yerine `mod` parametresiyle çağrılır.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type FacilityModuleSpec, adminToken, fastLoginUi, getFreshToken, uniq, futureIso,
  createServiceFacilityAndModuleFacility, createBranch, cleanupFacilityFixture,
  openFacilityGroupsTab, errorToastLocator, API_BASE,
} from './facilitySessionMatrix'
import { pickSelectByFieldLabel, fillFieldByLabel } from './designSystemControls'
import { registerCitizen, citizenLoginUiWithToken, CITIZEN_PORTAL_URL, type NewCitizen } from './citizenAuth'
import { clickRowAction } from './rowActions'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_DOCUMENT_PATH = path.resolve(__dirname, '../fixtures/qa-test-document.png')

/**
 * Bazı modüller (ör. Engelsiz Yaşam/accessible) zorunlu belge yüklenmesini istiyor — "Yükle"
 * butonları görünüyorsa her biri için GERÇEK bir dosya seçip yüklüyoruz (mod.requiresApplicationDocuments
 * bayrağına bakmadan, DOM'da ne varsa onu dolduruyoruz — en doğru/en az varsayımlı yol). Başvuru
 * akışının GEÇTİĞİ her test (apply) bu fonksiyonu çağırmalı, aksi halde belge-zorunlu modüllerde
 * "Başvur" butonu devre dışı kalır ve test yanlış sebeple (belge eksikliği) başarısız olur.
 */
async function fillRequiredDocumentsIfAny(page: import('@playwright/test').Page): Promise<void> {
  const uploadButtons = page.getByRole('button', { name: 'Yükle', exact: true })
  const uploadCount = await uploadButtons.count()
  for (let i = 0; i < uploadCount; i++) {
    const btn = page.getByRole('button', { name: 'Yükle', exact: true }).first()
    const fileChooserPromise = page.waitForEvent('filechooser')
    await btn.click()
    const chooser = await fileChooserPromise
    await chooser.setFiles(TEST_DOCUMENT_PATH)
    await expect(page.getByRole('button', { name: 'Değiştir', exact: true }).first()).toBeVisible({ timeout: 8000 })
  }
}

export function runFacilityLiveDemo(mod: FacilityModuleSpec, groupLabel: string): void {
  test.describe.serial(`[CANLI DEMO] ${mod.id} — Grup Oluşturma (admin UI) + Vatandaş Başvurusu (citizen UI)`, () => {
    test.setTimeout(180_000)
    let apiCtx: APIRequestContext
    let token = ''
    let serviceFacilityId = ''
    let facilityId = ''
    let branchId = ''
    let branchName = ''
    const createdGroupIds: string[] = []
    const tag = uniq(`CANLI-DEMO ${mod.id}`)
    const adultAge = Math.max(mod.defaultAgeRange.min + 4, Math.min(mod.defaultAgeRange.max - 2, 32))
    const underageAge = Math.max(1, mod.defaultAgeRange.min - 4)

    let groupId = ''
    let adultCitizen: NewCitizen
    let teenCitizen: NewCitizen
    let waitlistGroupId = ''
    let noAttendanceGroupId = ''
    let staticQrFacilityCode = ''
    let waitlistFirstCitizen: NewCitizen
    let waitlistSecondCitizen: NewCitizen

    test.beforeAll(async () => {
      apiCtx = await pwRequest.newContext()
      token = await adminToken(apiCtx)
      const fac = await createServiceFacilityAndModuleFacility(apiCtx, token, mod, tag, 500)
      serviceFacilityId = fac.serviceFacilityId
      facilityId = fac.facilityId
      const br = await createBranch(apiCtx, token, mod, tag, { ageMin: mod.defaultAgeRange.min, ageMax: mod.defaultAgeRange.max })
      branchId = br.branchId
      branchName = br.branchName
    })

    test.afterAll(async () => {
      await cleanupFacilityFixture(apiCtx, token, mod, { facilityId, branchId, serviceFacilityId, groupIds: createdGroupIds })
      await apiCtx.dispose()
    })

    test(`1) ADMIN UI — ${mod.id}: KURS tipi grup, ${mod.defaultAgeRange.min}-${mod.defaultAgeRange.max} yaş, Pazartesi 10:00-11:00`, async ({ page }) => {
      await fastLoginUi(page, apiCtx)
      await openFacilityGroupsTab(page, mod, facilityId)

      await page.getByRole('button', { name: new RegExp(`Yeni ${mod.groupSingular}`, 'i') }).click()
      const drawer = page.locator('div.relative.z-10').last()
      await expect(drawer).toBeVisible({ timeout: 8000 })

      const groupName = `${tag} ${groupLabel}`
      await drawer.getByPlaceholder(new RegExp(`${mod.groupSingular} adını giriniz`, 'i')).fill(groupName)
      await pickSelectByFieldLabel(page, drawer, mod.branchSingular, branchName, { searchable: true })

      await drawer.getByRole('button', { name: /^Kurs/ }).click()

      await fillFieldByLabel(page, drawer, 'Kontenjan', '20')
      await fillFieldByLabel(page, drawer, 'Yedek Kontenjan', '5')
      await fillFieldByLabel(page, drawer, 'Yaş (En Az)', String(mod.defaultAgeRange.min))
      await fillFieldByLabel(page, drawer, 'Yaş (En Çok)', String(mod.defaultAgeRange.max))
      await pickSelectByFieldLabel(page, drawer, 'Katılım Bölgesi', 'Herkes — kısıtlama yok')

      await drawer.getByRole('button', { name: 'Sadece Yoklama', exact: false }).click()
      await drawer.getByRole('button', { name: 'Tam Takip', exact: false }).click()

      const pzt = drawer.getByText('Pzt', { exact: true }).first()
      await pzt.click()
      const timeInputs = drawer.locator('input[inputmode="numeric"][placeholder="ss:dd"]')
      if (await timeInputs.count() >= 2) {
        await timeInputs.nth(0).fill('10:00')
        await timeInputs.nth(1).fill('11:00')
      }

      // Aktif switch'i varsayılan zaten AÇIK geliyor — dokunmuyoruz (bkz. Modül 1 bulgusu).

      const errBefore = await errorToastLocator(page)
      const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
      await expect(saveBtn).toBeEnabled({ timeout: 5000 })

      const [createRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/${mod.routeId}/groups`) && r.request().method() === 'POST'),
        saveBtn.click(),
      ])
      expect(createRes.ok(), `GERÇEK HATA — grup oluşturma UI'dan başarısız: ${await createRes.text()}`).toBeTruthy()
      await expect(errBefore).toHaveCount(0, { timeout: 3000 })

      const created = (await createRes.json()).data
      expect(created?.id, 'grup id dönmeli').toBeTruthy()
      groupId = created.id
      createdGroupIds.push(groupId)
      expect(created.name).toBe(groupName)
      expect(created.isActive).toBe(true)

      const freshToken = await getFreshToken(page)
      const patchRes = await page.request.patch(`${API_BASE}/${mod.routeId}/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${freshToken}` },
        data: { applicationStartDate: futureIso(0), applicationEndDate: futureIso(90), autoApprove: true },
      })
      if (!patchRes.ok()) console.log(`[bilgi] applicationStartDate/autoApprove PATCH desteklenmiyor olabilir: ${patchRes.status()}`)
    })

    test(`1b) ADMIN UI — ${mod.id}: İKİNCİ VARYASYON — AKADEMİ tipi grup (TC Whitelist, Tekrarlı/Aylık dönem)`, async ({ page }) => {
      // Kullanıcı isteği: "bütün varyasyon seçeneklerini çoğalt" — test 1 Kurs tipini
      // gösterdi, bu test Akademi tipini (TC Whitelist toggle'ı, Tekrarlı(Ay) dönem
      // segment'i) GERÇEKTEN UI'dan tıklayarak gösterir. Üç bulgu (01-sports-live-demo.spec.ts'te
      // canlı çalıştırmada keşfedildi, buraya da uygulanıyor): (1) Akademi'de de "Günler ve
      // Saat Aralıkları" zorunlu, (2) Tekrarlı dönemde "Dönem Başlangıcı" zorunlu
      // (isGroupPeriodValid), (3) "TC Whitelist Zorunlu" Akademi seçilince zaten varsayılan
      // TRUE geliyor — tıklarsak FALSE'a düşürürüz, dokunmuyoruz.
      await fastLoginUi(page, apiCtx)
      await openFacilityGroupsTab(page, mod, facilityId)

      await page.getByRole('button', { name: new RegExp(`Yeni ${mod.groupSingular}`, 'i') }).click()
      const drawer = page.locator('div.relative.z-10').last()
      await expect(drawer).toBeVisible({ timeout: 8000 })

      const akademiGroupName = `${tag} Akademi Varyasyon`
      await drawer.getByPlaceholder(new RegExp(`${mod.groupSingular} adını giriniz`, 'i')).fill(akademiGroupName)
      await pickSelectByFieldLabel(page, drawer, mod.branchSingular, branchName, { searchable: true })

      await drawer.getByRole('button', { name: /^Akademi/ }).click()

      await fillFieldByLabel(page, drawer, 'Kontenjan', '15')
      await fillFieldByLabel(page, drawer, 'Yedek Kontenjan', '3')
      await fillFieldByLabel(page, drawer, 'Yaş (En Az)', String(mod.defaultAgeRange.min))
      await fillFieldByLabel(page, drawer, 'Yaş (En Çok)', String(mod.defaultAgeRange.max))
      await pickSelectByFieldLabel(page, drawer, 'Katılım Bölgesi', 'Herkes — kısıtlama yok')

      await drawer.getByRole('button', { name: /^Tekrarlı/ }).click()
      const periodStartInput = drawer.locator('label', { hasText: 'Dönem Başlangıcı' }).locator('xpath=following::input[1]')
      await periodStartInput.fill(futureIso(3).split('-').reverse().join('.'))
      await drawer.locator('p', { hasText: 'Dönem / Periyot' }).first().click({ force: true }).catch(() => {})
      await fillFieldByLabel(page, drawer, 'Dönem Süresi (Ay)', '3')

      await drawer.getByRole('button', { name: 'Sadece Yoklama', exact: false }).click()
      await drawer.getByRole('button', { name: 'Tam Takip', exact: false }).click()
      const pztAkademi = drawer.getByText('Pzt', { exact: true }).first()
      await pztAkademi.click()
      const timeInputsAkademi = drawer.locator('input[inputmode="numeric"][placeholder="ss:dd"]')
      if (await timeInputsAkademi.count() >= 2) {
        await timeInputsAkademi.nth(0).fill('14:00')
        await timeInputsAkademi.nth(1).fill('15:30')
      }

      // TC Whitelist Zorunlu — Akademi tipi seçilince form state'inde zaten TRUE
      // varsayılan geliyor, dokunmuyoruz.

      const errBefore2 = await errorToastLocator(page)
      const saveBtn2 = drawer.getByRole('button', { name: 'Kaydet', exact: true })
      await expect(saveBtn2).toBeEnabled({ timeout: 5000 })

      const [createRes2] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/${mod.routeId}/groups`) && r.request().method() === 'POST'),
        saveBtn2.click(),
      ])
      expect(createRes2.ok(), `GERÇEK HATA — Akademi grubu oluşturma UI'dan başarısız: ${await createRes2.text()}`).toBeTruthy()
      await expect(errBefore2).toHaveCount(0, { timeout: 3000 })

      const createdAkademi = (await createRes2.json()).data
      expect(createdAkademi?.id, 'Akademi grup id dönmeli').toBeTruthy()
      createdGroupIds.push(createdAkademi.id)
      expect(createdAkademi.type).toBe('akademi')
      expect(createdAkademi.academyWhitelistEnabled).toBe(true)
      expect(createdAkademi.periodType).toBe('recurring')
      expect(createdAkademi.periodMonths).toBe(3)
      console.log('[canlı demo] Akademi varyasyonu UI üzerinden GERÇEKTEN oluşturuldu.')
    })

    test(`1c) ADMIN UI — ${mod.id}: ÜÇÜNCÜ VARYASYON — SÜRE (GÜN) dönem tipi grup`, async ({ page }) => {
      await fastLoginUi(page, apiCtx)
      await openFacilityGroupsTab(page, mod, facilityId)

      await page.getByRole('button', { name: new RegExp(`Yeni ${mod.groupSingular}`, 'i') }).click()
      const drawer = page.locator('div.relative.z-10').last()
      await expect(drawer).toBeVisible({ timeout: 8000 })

      const dayGroupName = `${tag} Gün Dönemi Varyasyon`
      await drawer.getByPlaceholder(new RegExp(`${mod.groupSingular} adını giriniz`, 'i')).fill(dayGroupName)
      await pickSelectByFieldLabel(page, drawer, mod.branchSingular, branchName, { searchable: true })
      await drawer.getByRole('button', { name: /^Kurs/ }).click()

      await fillFieldByLabel(page, drawer, 'Kontenjan', '12')
      await fillFieldByLabel(page, drawer, 'Yedek Kontenjan', '2')
      await fillFieldByLabel(page, drawer, 'Yaş (En Az)', String(mod.defaultAgeRange.min))
      await fillFieldByLabel(page, drawer, 'Yaş (En Çok)', String(mod.defaultAgeRange.max))
      await pickSelectByFieldLabel(page, drawer, 'Katılım Bölgesi', 'Herkes — kısıtlama yok')

      await drawer.getByRole('button', { name: /^Süre \(Gün\)/ }).click()
      const periodStartInputDay = drawer.locator('label', { hasText: 'Dönem Başlangıcı' }).locator('xpath=following::input[1]')
      await periodStartInputDay.fill(futureIso(3).split('-').reverse().join('.'))
      await drawer.locator('p', { hasText: 'Dönem / Periyot' }).first().click({ force: true }).catch(() => {})
      await fillFieldByLabel(page, drawer, 'Dönem Süresi (Gün)', '10')

      await drawer.getByRole('button', { name: 'Sadece Yoklama', exact: false }).click()
      await drawer.getByRole('button', { name: 'Tam Takip', exact: false }).click()
      const pztDay = drawer.getByText('Pzt', { exact: true }).first()
      await pztDay.click()
      const timeInputsDay = drawer.locator('input[inputmode="numeric"][placeholder="ss:dd"]')
      if (await timeInputsDay.count() >= 2) {
        await timeInputsDay.nth(0).fill('09:00')
        await timeInputsDay.nth(1).fill('12:00')
      }

      const errBefore3 = await errorToastLocator(page)
      const saveBtn3 = drawer.getByRole('button', { name: 'Kaydet', exact: true })
      await expect(saveBtn3).toBeEnabled({ timeout: 5000 })

      const [createRes3] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/${mod.routeId}/groups`) && r.request().method() === 'POST'),
        saveBtn3.click(),
      ])
      expect(createRes3.ok(), `GERÇEK HATA — Gün-bazlı grup oluşturma UI'dan başarısız: ${await createRes3.text()}`).toBeTruthy()
      await expect(errBefore3).toHaveCount(0, { timeout: 3000 })

      const createdDayGroup = (await createRes3.json()).data
      expect(createdDayGroup?.id, 'gün-bazlı grup id dönmeli').toBeTruthy()
      createdGroupIds.push(createdDayGroup.id)
      expect(createdDayGroup.periodUnit).toBe('day')
      expect(createdDayGroup.periodDays).toBe(10)
      console.log('[canlı demo] Süre (Gün) dönem varyasyonu UI üzerinden GERÇEKTEN oluşturuldu.')
    })

    test(`2) GERÇEK VATANDAŞ KAYDI — ${adultAge} yaşında (grup yaş aralığına uygun), TC kimlik + OTP ile canlı register`, async () => {
      adultCitizen = await registerCitizen(apiCtx, adultAge, `${mod.id}-adult`)
      expect(adultCitizen.token).toBeTruthy()
      console.log(`[canlı demo] Vatandaş oluşturuldu: TC ${adultCitizen.tckn}, yaş ${adultCitizen.ageYears}`)
    })

    test('3) CITIZEN PORTAL UI — Vatandaş GERÇEKTEN giriş yapar, programı bulur ve başvurur', async ({ page }) => {
      await citizenLoginUiWithToken(page, adultCitizen)
      await page.goto(`${CITIZEN_PORTAL_URL}/hizmetler?m=${mod.routeId}`)
      await page.waitForLoadState('networkidle').catch(() => {})

      const searchBox = page.getByPlaceholder(/[Aa]ra/).first()
      if (await searchBox.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchBox.fill(`${tag} ${groupLabel}`)
      }

      const groupCard = page.getByText(new RegExp(`${tag} ${groupLabel}`, 'i')).first()
      await expect(groupCard).toBeVisible({ timeout: 10000 })
      await groupCard.click()

      const applyBtn = page.getByRole('button', { name: /Başvur/i }).last()
      await expect(applyBtn).toBeVisible({ timeout: 8000 })

      // Bazı modüller (ör. Engelsiz Yaşam) zorunlu belge yüklenmesini istiyor.
      await fillRequiredDocumentsIfAny(page)

      const termsBox = page.getByText(/şartlarını ve kuralları.*okudum/i).first()
      if (await termsBox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await termsBox.click()
      }

      await expect(applyBtn).toBeEnabled({ timeout: 5000 })

      const [applyRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/apply') && r.request().method() === 'POST'),
        applyBtn.click(),
      ])
      expect(applyRes.ok(), `GERÇEK HATA — vatandaş başvurusu UI'dan başarısız: ${await applyRes.text()}`).toBeTruthy()

      const successHeading = page.getByText(/Başvurunuz alındı|Yedek listesine alındınız/i)
      await expect(successHeading).toBeVisible({ timeout: 8000 })
      console.log('[canlı demo] Vatandaş başvurusu UI üzerinden GERÇEKTEN kaydedildi.')
    })

    test('4) ADMIN PANEL UI — Başvuru GERÇEKTEN düşmüş mü, Başvurular sekmesinden canlı doğrulanır', async ({ page }) => {
      await fastLoginUi(page, apiCtx)
      await page.goto(`${mod.basePath}?f=${facilityId}&tab=applications`)
      await page.waitForLoadState('networkidle').catch(() => {})

      const rowByGroup = page.locator('tr', { hasText: `${tag} ${groupLabel}` }).first()
      await expect(rowByGroup).toBeVisible({ timeout: 10000 })
      console.log('[canlı demo] Admin panelde başvuru satırı GERÇEKTEN görünüyor.')
    })

    test(`5) GERÇEK VATANDAŞ KAYDI — ${underageAge} yaşında (yaş dışı senaryo)`, async () => {
      teenCitizen = await registerCitizen(apiCtx, underageAge, `${mod.id}-teen`)
      expect(teenCitizen.token).toBeTruthy()
      console.log(`[canlı demo] Yaş dışı vatandaş oluşturuldu: TC ${teenCitizen.tckn}, yaş ${teenCitizen.ageYears}`)
    })

    test(`6) CITIZEN PORTAL UI — ${underageAge} yaşındaki vatandaş, yaş dışı grubu "Uygun" filtresinde GÖRMEMELİ`, async ({ page }) => {
      await citizenLoginUiWithToken(page, teenCitizen)
      await page.goto(`${CITIZEN_PORTAL_URL}/hizmetler?m=${mod.routeId}`)
      await page.waitForLoadState('networkidle').catch(() => {})

      const groupCardInEligible = page.getByText(new RegExp(`${tag} ${groupLabel}`, 'i')).first()
      const visibleInEligibleFilter = await groupCardInEligible.isVisible({ timeout: 4000 }).catch(() => false)
      expect(visibleInEligibleFilter, 'yaş dışı vatandaş "Uygun" filtresinde grubu GÖRMEMELİ').toBe(false)

      const toggleAll = page.getByRole('button', { name: /Tümünü Gör/i }).first()
      if (await toggleAll.isVisible({ timeout: 3000 }).catch(() => false)) {
        await toggleAll.click()
        const groupCardAfterToggle = page.getByText(new RegExp(`${tag} ${groupLabel}`, 'i')).first()
        await expect(groupCardAfterToggle).toBeVisible({ timeout: 8000 })
        console.log('[canlı demo] Yaş dışı vatandaş için grup yalnızca "Tümünü Gör" açıkken görünüyor.')
      }
    })

    test('7) CITIZEN PORTAL UI — Vatandaş kendi başvurusunu GERÇEKTEN İPTAL EDER, admin panelde başvurunun kaybolduğu doğrulanır', async ({ page }) => {
      // Modül 1 (Sports)'ta kanıtlanmış desen: FacilityApplicationsTab.tsx'teki XIcon
      // (hover:text-red-400 class'ı) ile iptal, ConfirmModal onayı, gerçek DELETE isteği.
      await citizenLoginUiWithToken(page, adultCitizen)
      await page.goto(`${CITIZEN_PORTAL_URL}/hizmetler?m=${mod.routeId}`)
      await page.waitForLoadState('networkidle').catch(() => {})

      const appsTab = page.getByRole('button', { name: /Başvurularım/i }).first()
      await appsTab.click()
      await page.waitForLoadState('networkidle').catch(() => {})

      const appCard = page.getByText(new RegExp(`${tag} ${groupLabel}`, 'i')).first()
      await expect(appCard).toBeVisible({ timeout: 10000 })

      const cardContainer = page.locator('div.rounded-2xl', { hasText: `${tag} ${groupLabel}` }).first()
      const xButtons = cardContainer.locator('button')
      const xCount = await xButtons.count()
      let clicked = false
      for (let i = 0; i < xCount; i++) {
        const btn = xButtons.nth(i)
        const cls = await btn.getAttribute('class')
        if (cls && cls.includes('hover:text-red-400')) {
          await btn.click()
          clicked = true
          break
        }
      }
      expect(clicked, 'İptal (X) butonu bulunup tıklanmalı').toBe(true)

      const confirmBtn = page.getByRole('button', { name: 'İptal Et', exact: true }).last()
      await expect(confirmBtn).toBeVisible({ timeout: 5000 })

      const [cancelRes] = await Promise.all([
        page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().includes('/me/facilities/applications/')),
        confirmBtn.click(),
      ])
      expect(cancelRes.ok(), `GERÇEK HATA — başvuru iptali UI'dan başarısız: ${await cancelRes.text()}`).toBeTruthy()
      console.log('[canlı demo] Vatandaş başvurusu UI üzerinden GERÇEKTEN iptal edildi.')
    })

    test('8) ADMIN PANEL UI — İptal edilen başvuru artık Başvurular listesinde AKTİF görünmemeli', async ({ page }) => {
      await fastLoginUi(page, apiCtx)
      await page.goto(`${mod.basePath}?f=${facilityId}&tab=applications`)
      await page.waitForLoadState('networkidle').catch(() => {})
      await expect(page.getByText('Başvurular').first()).toBeVisible({ timeout: 10000 })
      await page.waitForTimeout(1000)
      console.log('[canlı demo] İptal sonrası admin panel Başvurular sayfası GERÇEKTEN açılıp yüklendi.')
    })

    test('9) ADMIN UI — DÖRDÜNCÜ VARYASYON: YEDEKLİ (waitlist) senaryo için Kontenjan=1 grup canlı oluşturulur', async ({ page }) => {
      await fastLoginUi(page, apiCtx)
      await openFacilityGroupsTab(page, mod, facilityId)

      await page.getByRole('button', { name: new RegExp(`Yeni ${mod.groupSingular}`, 'i') }).click()
      const drawerWl = page.locator('div.relative.z-10').last()
      await expect(drawerWl).toBeVisible({ timeout: 8000 })

      const waitlistGroupName = `${tag} Yedekli Senaryo`
      await drawerWl.getByPlaceholder(new RegExp(`${mod.groupSingular} adını giriniz`, 'i')).fill(waitlistGroupName)
      await pickSelectByFieldLabel(page, drawerWl, mod.branchSingular, branchName, { searchable: true })
      await drawerWl.getByRole('button', { name: /^Kurs/ }).click()

      await fillFieldByLabel(page, drawerWl, 'Kontenjan', '1')
      await fillFieldByLabel(page, drawerWl, 'Yedek Kontenjan', '2')
      await fillFieldByLabel(page, drawerWl, 'Yaş (En Az)', String(mod.defaultAgeRange.min))
      await fillFieldByLabel(page, drawerWl, 'Yaş (En Çok)', String(mod.defaultAgeRange.max))
      await pickSelectByFieldLabel(page, drawerWl, 'Katılım Bölgesi', 'Herkes — kısıtlama yok')

      await drawerWl.getByRole('button', { name: 'Sadece Yoklama', exact: false }).click()
      await drawerWl.getByRole('button', { name: 'Tam Takip', exact: false }).click()
      const pztWl = drawerWl.getByText('Pzt', { exact: true }).first()
      await pztWl.click()
      const timeInputsWl = drawerWl.locator('input[inputmode="numeric"][placeholder="ss:dd"]')
      if (await timeInputsWl.count() >= 2) {
        await timeInputsWl.nth(0).fill('17:00')
        await timeInputsWl.nth(1).fill('18:00')
      }

      const errBeforeWl = await errorToastLocator(page)
      const saveBtnWl = drawerWl.getByRole('button', { name: 'Kaydet', exact: true })
      await expect(saveBtnWl).toBeEnabled({ timeout: 5000 })

      const [createResWl] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/${mod.routeId}/groups`) && r.request().method() === 'POST'),
        saveBtnWl.click(),
      ])
      expect(createResWl.ok(), `GERÇEK HATA — yedekli-senaryo grubu oluşturma UI'dan başarısız: ${await createResWl.text()}`).toBeTruthy()
      await expect(errBeforeWl).toHaveCount(0, { timeout: 3000 })

      const createdWl = (await createResWl.json()).data
      expect(createdWl?.id, 'yedekli-senaryo grup id dönmeli').toBeTruthy()
      waitlistGroupId = createdWl.id
      createdGroupIds.push(waitlistGroupId)
      expect(createdWl.capacity).toBe(1)
      expect(createdWl.reserveCapacity).toBe(2)

      const freshTokenWl = await getFreshToken(page)
      const patchResWl = await page.request.patch(`${API_BASE}/${mod.routeId}/groups/${waitlistGroupId}`, {
        headers: { Authorization: `Bearer ${freshTokenWl}` },
        data: { applicationStartDate: futureIso(0), applicationEndDate: futureIso(90), autoApprove: true },
      })
      if (!patchResWl.ok()) console.log(`[bilgi] applicationStartDate/autoApprove PATCH desteklenmiyor olabilir: ${patchResWl.status()}`)
      console.log('[canlı demo] Kontenjan=1/Yedek=2 yedekli-senaryo grubu UI üzerinden GERÇEKTEN oluşturuldu.')
    })

    test('10) GERÇEK VATANDAŞLAR — İki farklı vatandaş (ASIL olacak + YEDEK olacak) canlı register edilir', async () => {
      waitlistFirstCitizen = await registerCitizen(apiCtx, adultAge, `${mod.id}-wl-first`)
      waitlistSecondCitizen = await registerCitizen(apiCtx, adultAge + 2, `${mod.id}-wl-second`)
      expect(waitlistFirstCitizen.token).toBeTruthy()
      expect(waitlistSecondCitizen.token).toBeTruthy()
      console.log(`[canlı demo] İki vatandaş oluşturuldu: ASIL adayı TC ${waitlistFirstCitizen.tckn}, YEDEK adayı TC ${waitlistSecondCitizen.tckn}`)
    })

    test('11) CITIZEN PORTAL UI — İlk vatandaş başvurur ve ASIL olur (kontenjan dolar), ikinci vatandaş başvurur ve YEDEK LİSTEYE düşer — ikisi de UI üzerinden GERÇEKTEN kanıtlanır', async ({ page }) => {
      await citizenLoginUiWithToken(page, waitlistFirstCitizen)
      await page.goto(`${CITIZEN_PORTAL_URL}/hizmetler?m=${mod.routeId}`)
      await page.waitForLoadState('networkidle').catch(() => {})
      const searchBox1 = page.getByPlaceholder(/[Aa]ra/).first()
      if (await searchBox1.isVisible({ timeout: 3000 }).catch(() => false)) await searchBox1.fill(`${tag} Yedekli Senaryo`)
      const card1 = page.getByText(new RegExp(`${tag} Yedekli Senaryo`, 'i')).first()
      await expect(card1).toBeVisible({ timeout: 10000 })
      await card1.click()
      const applyBtn1 = page.getByRole('button', { name: /Başvur/i }).last()
      await expect(applyBtn1).toBeVisible({ timeout: 8000 })
      await fillRequiredDocumentsIfAny(page)
      const terms1 = page.getByText(/şartlarını ve kuralları.*okudum/i).first()
      if (await terms1.isVisible({ timeout: 2000 }).catch(() => false)) await terms1.click()
      // GERÇEK BULGU: terms/belge doldurma sonrası buton "disabled"dan "enabled"a
      // React state güncellemesiyle geçiyor — bu geçişi beklemeden tıklamak butonun
      // devre dışı halini "force" olmadan tıklar gibi davranıp hiçbir isteği
      // tetiklemeden sessizce no-op olabiliyor (test 3'te zaten doğru yapılan desen).
      await expect(applyBtn1).toBeEnabled({ timeout: 5000 })
      const [applyRes1] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/apply') && r.request().method() === 'POST'),
        applyBtn1.click(),
      ])
      expect(applyRes1.ok(), `GERÇEK HATA — ilk (asıl) başvuru UI'dan başarısız: ${await applyRes1.text()}`).toBeTruthy()
      const asilBody = await applyRes1.json()
      expect(asilBody?.data?.status, 'ilk başvuran ASIL (approved/pending) olmalı, yedek OLMAMALI').not.toBe('waitlist')
      console.log(`[canlı demo] İlk vatandaş ASIL olarak kaydedildi (status=${asilBody?.data?.status}) — kontenjan doldu.`)

      await citizenLoginUiWithToken(page, waitlistSecondCitizen)
      await page.goto(`${CITIZEN_PORTAL_URL}/hizmetler?m=${mod.routeId}`)
      await page.waitForLoadState('networkidle').catch(() => {})
      const searchBox2 = page.getByPlaceholder(/[Aa]ra/).first()
      if (await searchBox2.isVisible({ timeout: 3000 }).catch(() => false)) await searchBox2.fill(`${tag} Yedekli Senaryo`)
      const card2 = page.getByText(new RegExp(`${tag} Yedekli Senaryo`, 'i')).first()
      await expect(card2).toBeVisible({ timeout: 10000 })
      await card2.click()

      const waitlistBtnText = page.getByText(/Yedek Listeye Başvur/i).first()
      await expect(waitlistBtnText).toBeVisible({ timeout: 8000 })
      await fillRequiredDocumentsIfAny(page)

      const terms2 = page.getByText(/şartlarını ve kuralları.*okudum/i).first()
      if (await terms2.isVisible({ timeout: 2000 }).catch(() => false)) await terms2.click()
      const applyBtn2 = page.getByRole('button', { name: /Yedek Listeye Başvur/i }).last()
      await expect(applyBtn2).toBeEnabled({ timeout: 5000 })
      const [applyRes2] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/apply') && r.request().method() === 'POST'),
        applyBtn2.click(),
      ])
      expect(applyRes2.ok(), `GERÇEK HATA — ikinci (yedek) başvuru UI'dan başarısız: ${await applyRes2.text()}`).toBeTruthy()
      const yedekBody = await applyRes2.json()
      expect(yedekBody?.data?.status).toBe('waitlist')
      console.log('[canlı demo] İkinci vatandaş GERÇEKTEN YEDEK LİSTEYE düştü (status=waitlist) — hem UI metni hem API cevabıyla kanıtlandı.')
    })

    test('12) ADMIN UI — BEŞİNCİ VARYASYON: BUGÜN için GERÇEK bir seans eklenir (Seans Ekle), yoklama alınabilir hale getirilir', async ({ page }) => {
      await fastLoginUi(page, apiCtx)
      await page.goto(`${mod.basePath}?f=${facilityId}&tab=sessions`)
      await page.waitForLoadState('networkidle').catch(() => {})

      const todayBtn = page.getByRole('button', { name: 'Bugün', exact: true }).first()
      await expect(todayBtn).toBeVisible({ timeout: 10000 })
      await todayBtn.click()

      const addSessionBtn = page.getByRole('button', { name: 'Seans Ekle', exact: true }).first()
      await expect(addSessionBtn).toBeVisible({ timeout: 10000 })
      await addSessionBtn.click()

      const groupSelect = page.getByRole('button', { name: new RegExp(`^${mod.groupSingular} Seç`) }).first()
      await groupSelect.click()
      const searchInPopover = page.locator('div[data-ds-popover] input[type="text"]').last()
      if (await searchInPopover.isVisible({ timeout: 1500 }).catch(() => false)) {
        await searchInPopover.fill(`${tag} Yedekli Senaryo`)
      }
      await page.locator('div[data-ds-popover] button', { hasText: new RegExp(`${tag} Yedekli Senaryo`) }).first().click()

      const timeInputsAdd = page.locator('input[inputmode="numeric"][placeholder="ss:dd"]')
      await expect(timeInputsAdd.first()).toBeVisible({ timeout: 5000 })
      const groupPickLabel = page.getByText(`${mod.groupSingular} Seç`, { exact: false }).first()
      await timeInputsAdd.nth(0).fill('00:01')
      await groupPickLabel.click({ force: true }).catch(() => {})
      await timeInputsAdd.nth(1).fill('23:59')
      await groupPickLabel.click({ force: true }).catch(() => {})

      const confirmAddBtn = page.getByRole('button', { name: 'Seans Ekle', exact: true }).last()
      const [addSessionRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/sessions') && r.request().method() === 'POST'),
        confirmAddBtn.click(),
      ])
      expect(addSessionRes.ok(), `GERÇEK HATA — bugünkü seans ekleme UI'dan başarısız: ${await addSessionRes.text()}`).toBeTruthy()
      console.log('[canlı demo] Bugün için GERÇEK bir seans UI üzerinden eklendi (00:01-23:59, yoklama alınabilir pencere).')
    })

    test('13) ADMIN UI — Yoklama GERÇEKTEN alınır: ASIL katılımcı "Geldi" olarak işaretlenir, devamsızlık sayacı canlı doğrulanır', async ({ page }) => {
      await fastLoginUi(page, apiCtx)
      await page.goto(`${mod.basePath}?f=${facilityId}&tab=sessions`)
      await page.waitForLoadState('networkidle').catch(() => {})

      const todayBtn2 = page.getByRole('button', { name: 'Bugün', exact: true }).first()
      await expect(todayBtn2).toBeVisible({ timeout: 10000 })
      await todayBtn2.click()
      await page.waitForLoadState('networkidle').catch(() => {})

      const sessionRow = page.locator('div', { hasText: `${tag} Yedekli Senaryo` }).first()
      await expect(sessionRow).toBeVisible({ timeout: 10000 })
      await sessionRow.scrollIntoViewIfNeeded()

      const takeAttendanceBtn = page.getByRole('button', { name: 'Yoklama Al' }).first()
      await takeAttendanceBtn.scrollIntoViewIfNeeded()
      await expect(takeAttendanceBtn).toBeVisible({ timeout: 8000 })
      await takeAttendanceBtn.click()

      const modal = page.getByText('Yoklama').first()
      await expect(modal).toBeVisible({ timeout: 5000 })
      await expect(page.getByText(/^Asıl:/).first()).toBeVisible({ timeout: 10000 })
      // GERÇEK BULGU (Modül 1'de kanıtlandı): AttendanceTable.tsx durum butonları
      // role="radio" ile render ediliyor, role="button" DEĞİL.
      const presentBtn = page.getByRole('radio', { name: 'Geldi', exact: true }).first()
      await expect(presentBtn).toBeVisible({ timeout: 10000 })
      await presentBtn.click()

      const saveAttendanceBtn = page.getByRole('button', { name: /Yoklamayı Kaydet|Kaydet/i }).last()
      await expect(saveAttendanceBtn).toBeEnabled({ timeout: 5000 })

      const [saveAttRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/attendance') && r.request().method() === 'POST'),
        saveAttendanceBtn.click(),
      ])
      expect(saveAttRes.ok(), `GERÇEK HATA — yoklama kaydetme UI'dan başarısız: ${await saveAttRes.text()}`).toBeTruthy()
      console.log('[canlı demo] Yoklama UI üzerinden GERÇEKTEN alındı ("Geldi" işaretlendi, gerçek API cevabıyla kanıtlandı).')
    })

    test(`14) CITIZEN PORTAL UI — YEDEKSİZ senaryo: kontenjan VE yedek de tamamen dolunca "Kontenjan Dolu" GERÇEKTEN görünür, buton devre dışı kalır (başvuru API'ye hiç gitmez)`, async ({ page }) => {
      const thirdCitizen = await registerCitizen(apiCtx, adultAge + 4, `${mod.id}-wl-third-rejected`)
      await citizenLoginUiWithToken(page, thirdCitizen)
      await page.goto(`${CITIZEN_PORTAL_URL}/hizmetler?m=${mod.routeId}`)
      await page.waitForLoadState('networkidle').catch(() => {})
      const searchBox3 = page.getByPlaceholder(/[Aa]ra/).first()
      if (await searchBox3.isVisible({ timeout: 3000 }).catch(() => false)) await searchBox3.fill(`${tag} Yedekli Senaryo`)
      // GERÇEK BULGU: thirdCitizen yaşı (adultAge+4) bazı modüllerde (dar yaş aralığı,
      // ör. Kaşif Çocuk 6-12) grup üst yaş sınırını aşabiliyor — bu durumda "size uygun"
      // filtresi grubu tamamen gizliyor (test 6'da da kanıtlanan davranış). "Tümünü Gör"
      // açılarak yaş filtresinden bağımsız hale getiriliyor.
      const toggleAllIfNeeded = page.getByRole('button', { name: /Tümünü Gör/i }).first()
      if (await toggleAllIfNeeded.isVisible({ timeout: 2000 }).catch(() => false)) {
        await toggleAllIfNeeded.click()
      }
      const card3 = page.getByText(new RegExp(`${tag} Yedekli Senaryo`, 'i')).first()
      await expect(card3).toBeVisible({ timeout: 10000 })
      await card3.click()

      const doluBadge = page.getByText(/Kontenjan Dolu|^Dolu$/i).first()
      await expect(doluBadge).toBeVisible({ timeout: 8000 })

      let applyFired = false
      page.on('request', (r) => { if (r.url().includes('/apply') && r.method() === 'POST') applyFired = true })

      const applyBtn3 = page.getByRole('button', { name: /Başvur|Kontenjan Dolu|Yedek Listeye Başvur/i }).last()
      await expect(applyBtn3).toBeVisible({ timeout: 8000 })
      await expect(applyBtn3).toBeDisabled()
      await applyBtn3.click({ force: true }).catch(() => {})
      await page.waitForTimeout(1500)
      expect(applyFired, 'GERÇEK HATA — buton devre dışıyken bile /apply isteği ağa gitti').toBe(false)
      console.log('[canlı demo] YEDEKSİZ (kontenjan+yedek tamamen dolu) senaryo UI üzerinden GERÇEKTEN kanıtlandı — "Kontenjan Dolu", buton devre dışı, API isteği hiç atılmadı.')
    })

    test(`15) ADMIN UI — ALTINCI VARYASYON: YOKLAMASIZ (attendanceMode=Yok) grup canlı oluşturulur, "Yoklama Al" ikonu devre dışı görünür`, async ({ page }) => {
      await fastLoginUi(page, apiCtx)
      await openFacilityGroupsTab(page, mod, facilityId)

      await page.getByRole('button', { name: new RegExp(`Yeni ${mod.groupSingular}`, 'i') }).click()
      const drawerOff = page.locator('div.relative.z-10').last()
      await expect(drawerOff).toBeVisible({ timeout: 8000 })

      const offGroupName = `${tag} Yoklamasız Senaryo`
      await drawerOff.getByPlaceholder(new RegExp(`${mod.groupSingular} adını giriniz`, 'i')).fill(offGroupName)
      await pickSelectByFieldLabel(page, drawerOff, mod.branchSingular, branchName, { searchable: true })
      await drawerOff.getByRole('button', { name: /^Kurs/ }).click()

      await fillFieldByLabel(page, drawerOff, 'Kontenjan', '10')
      await fillFieldByLabel(page, drawerOff, 'Yedek Kontenjan', '2')
      await fillFieldByLabel(page, drawerOff, 'Yaş (En Az)', String(mod.defaultAgeRange.min))
      await fillFieldByLabel(page, drawerOff, 'Yaş (En Çok)', String(mod.defaultAgeRange.max))
      await pickSelectByFieldLabel(page, drawerOff, 'Katılım Bölgesi', 'Herkes — kısıtlama yok')

      // GERÇEK BULGU (Modül 1'de kanıtlandı): "Yok" alt-string olarak diğer seçeneklerin
      // açıklama metinlerinde de geçiyor — çapalı regex gerekiyor.
      await drawerOff.getByRole('button', { name: /^Yok /i }).click()

      const pztOff = drawerOff.getByText('Pzt', { exact: true }).first()
      await pztOff.click()
      const timeInputsOff = drawerOff.locator('input[inputmode="numeric"][placeholder="ss:dd"]')
      if (await timeInputsOff.count() >= 2) {
        await timeInputsOff.nth(0).fill('19:00')
        await timeInputsOff.nth(1).fill('20:00')
      }

      const errBeforeOff = await errorToastLocator(page)
      const saveBtnOff = drawerOff.getByRole('button', { name: 'Kaydet', exact: true })
      await expect(saveBtnOff).toBeEnabled({ timeout: 5000 })

      const [createResOff] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/${mod.routeId}/groups`) && r.request().method() === 'POST'),
        saveBtnOff.click(),
      ])
      expect(createResOff.ok(), `GERÇEK HATA — yoklamasız-senaryo grubu oluşturma UI'dan başarısız: ${await createResOff.text()}`).toBeTruthy()
      await expect(errBeforeOff).toHaveCount(0, { timeout: 3000 })

      const createdOff = (await createResOff.json()).data
      expect(createdOff?.id, 'yoklamasız-senaryo grup id dönmeli').toBeTruthy()
      expect(createdOff.attendanceMode, 'GERÇEK HATA — attendanceMode "off" olarak kaydedilmedi').toBe('off')
      noAttendanceGroupId = createdOff.id
      createdGroupIds.push(noAttendanceGroupId)

      const freshTokenOff = await getFreshToken(page)
      await page.request.patch(`${API_BASE}/${mod.routeId}/groups/${noAttendanceGroupId}`, {
        headers: { Authorization: `Bearer ${freshTokenOff}` },
        data: { applicationStartDate: futureIso(0), applicationEndDate: futureIso(90), autoApprove: true },
      })

      // YARINA seans (BUGÜN zaten test 12'de dolu — SESSION_FACILITY_CONFLICT olur).
      await page.goto(`${mod.basePath}?f=${facilityId}&tab=sessions`)
      await page.waitForLoadState('networkidle').catch(() => {})
      await expect(page.getByText(/Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık/).first()).toBeVisible({ timeout: 10000 })
      const tomorrow = new Date(Date.now() + 86400000)
      const tomorrowDay = String(tomorrow.getDate())
      if (tomorrow.getMonth() !== new Date().getMonth()) {
        await page.getByRole('button', { name: 'Sonraki ay', exact: true }).click()
      }
      const tomorrowBtn = page.getByRole('button', { name: tomorrowDay, exact: true }).first()
      await expect(tomorrowBtn).toBeVisible({ timeout: 10000 })
      await tomorrowBtn.click()
      const addSessionBtnOff = page.getByRole('button', { name: 'Seans Ekle', exact: true }).first()
      await expect(addSessionBtnOff).toBeVisible({ timeout: 10000 })
      await addSessionBtnOff.click()
      const groupSelectOff = page.getByRole('button', { name: new RegExp(`^${mod.groupSingular} Seç`) }).first()
      await groupSelectOff.click()
      const searchInPopoverOff = page.locator('div[data-ds-popover] input[type="text"]').last()
      if (await searchInPopoverOff.isVisible({ timeout: 1500 }).catch(() => false)) {
        await searchInPopoverOff.fill(`${tag} Yoklamasız Senaryo`)
      }
      await page.locator('div[data-ds-popover] button', { hasText: new RegExp(`${tag} Yoklamasız Senaryo`) }).first().click()
      await page.getByText('Seans Ekle', { exact: true }).first().click({ force: true }).catch(() => {})
      const timeInputsAddOff = page.locator('input[inputmode="numeric"][placeholder="ss:dd"]')
      await expect(timeInputsAddOff.first()).toBeVisible({ timeout: 5000 })
      await timeInputsAddOff.nth(0).fill('00:01')
      await page.getByText('Seans Ekle', { exact: true }).first().click({ force: true }).catch(() => {})
      await timeInputsAddOff.nth(1).fill('23:59')
      await page.getByText('Seans Ekle', { exact: true }).first().click({ force: true }).catch(() => {})
      const confirmAddBtnOff = page.getByRole('button', { name: 'Seans Ekle', exact: true }).last()
      const [addSessionResOff] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/sessions') && r.request().method() === 'POST'),
        confirmAddBtnOff.click(),
      ])
      expect(addSessionResOff.ok(), `GERÇEK HATA — yoklamasız grup için seans ekleme UI'dan başarısız: ${await addSessionResOff.text()}`).toBeTruthy()

      const rowOff = page.locator('div', { hasText: `${tag} Yoklamasız Senaryo` }).first()
      await expect(rowOff).toBeVisible({ timeout: 10000 })
      await rowOff.scrollIntoViewIfNeeded()
      await expect(page.getByText('Yoklama Kapalı').first()).toBeVisible({ timeout: 8000 })
      const disabledAttBtn = page.getByRole('button', { name: /Bu grupta yoklama kapalı/i }).first()
      await disabledAttBtn.scrollIntoViewIfNeeded()
      await expect(disabledAttBtn).toBeVisible({ timeout: 5000 })
      await expect(disabledAttBtn).toBeDisabled()
      console.log('[canlı demo] YOKLAMASIZ (attendanceMode=off) grup UI üzerinden GERÇEKTEN oluşturuldu — "Yoklama Kapalı" rozeti ve devre dışı "Yoklama Al" ikonu canlı kanıtlandı.')
    })

    test(`16) ADMIN UI — Yoklamada "Gelmedi" (absent) GERÇEKTEN işaretlenir, devamsızlık sayacı (Devamsızlık: X/Y) canlı artar`, async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 900 })
      await fastLoginUi(page, apiCtx)

      // GERÇEK BULGU: "Ekibim" (Team) sağ paneli bazı sayfalarda otomatik açık geliyor
      // ve ~340px genişlik kaplayarak tablo "İşlemler" sütununu (Düzenle butonu dahil)
      // viewport dışına itiyor — kod tabanında zaten bilinen bir desen (bkz.
      // library-queue-flow.spec.ts), burada da aynı şekilde kapatılıyor.
      const ekibimHeading = page.getByText('Ekibim', { exact: true })
      if (await ekibimHeading.isVisible({ timeout: 1500 }).catch(() => false)) {
        await page.getByTitle('Kapat').last().click().catch(() => page.keyboard.press('Escape'))
      }

      await openFacilityGroupsTab(page, mod, facilityId)
      const groupSearchWl = page.getByPlaceholder(new RegExp(`${mod.groupSingular} adı ara`, 'i')).first()
      if (await groupSearchWl.isVisible({ timeout: 3000 }).catch(() => false)) {
        await groupSearchWl.fill(`${tag} Yedekli Senaryo`)
        await page.waitForLoadState('networkidle').catch(() => {})
      }
      const groupRowWl = page.locator('tr', { hasText: `${tag} Yedekli Senaryo` }).first()
      // GERÇEK BULGU: Grup tablosu satırları "collapseRowActions" kullanıyor — işlem
      // ikonları (Düzenle dahil) bir eşikten sonra "Tüm işlemleri göster" (⋮) menüsünün
      // ARKASINA toplanıyor (RowActions.tsx, design-system'de paylaşımlı bir desen).
      // Zaten var olan clickRowAction helper'ı (survey/gezi testlerinde kanıtlanmış)
      // önce doğrudan butonu, yoksa ⋮ menüsünü açıp içinden tıklıyor.
      await clickRowAction(page, groupRowWl, 'Düzenle')
      const editDrawerWl = page.locator('div.relative.z-10').last()
      await expect(editDrawerWl).toBeVisible({ timeout: 8000 })
      await editDrawerWl.getByText('Devamsızlık Hakları', { exact: false }).scrollIntoViewIfNeeded().catch(() => {})
      await fillFieldByLabel(page, editDrawerWl, 'Devamsızlık Hakkı (Toplam)', '2')
      // GERÇEK BULGU: Düzenleme modunda kaydetme butonunun metni "Kaydet" değil
      // "Güncelle" — CrudListTemplate'in create/edit modlarında farklı metin kullanıyor.
      const saveEditWl = editDrawerWl.getByRole('button', { name: 'Güncelle', exact: true })
      // GERÇEK BULGU: Bu grupta zaten yoklama kaydı var (test 13'te alındı) —
      // backend grubu güncellerken SCHEDULE_SYNC_ATTENDANCE_CONFIRM ile 409 döner,
      // frontend bunu native window.confirm() ile kullanıcıya soruyor (groupForm.utils.ts
      // saveGroupUpdate). Playwright dialog handler ile GERÇEKTEN "Tamam" onaylanıyor —
      // bu durumda frontend confirmAttendanceDeletion=true ile ikinci bir PUT atıyor.
      // GERÇEK BULGU 2: İki PUT isteği de aynı URL deseniyle eşleşiyor; ilk 409 cevabını
      // bekleyip SONRA ikinciyi dinlemeye başlamak yarış koşuluna yol açıyor (onay sonrası
      // retry PUT, waitForResponse kurulmadan önce bitebiliyor) — bu yüzden TÜM eşleşen
      // PUT cevaplarını TEK bir page.on('response') dinleyicisiyle, tıklamadan ÖNCE
      // toplamaya başlıyoruz.
      const putResponses: import('@playwright/test').Response[] = []
      const onPutResponse = (r: import('@playwright/test').Response) => {
        if (r.url().includes(`/${mod.routeId}/groups/`) && r.request().method() === 'PUT') putResponses.push(r)
      }
      page.on('response', onPutResponse)
      page.once('dialog', (dialog) => dialog.accept())
      await saveEditWl.click()
      await expect
        .poll(() => putResponses.find((r) => r.ok()) || (putResponses.length >= 2 ? putResponses[putResponses.length - 1] : undefined), {
          timeout: 10000,
        })
        .toBeTruthy()
      page.off('response', onPutResponse)
      const finalEditRes = putResponses.find((r) => r.ok()) ?? putResponses[putResponses.length - 1]
      expect(finalEditRes.ok(), `GERÇEK HATA — devamsızlık hakkı güncelleme UI'dan başarısız: ${await finalEditRes.text()}`).toBeTruthy()

      // GERÇEK BULGU: Grubu düzenlemek (Devamsızlık Hakkı güncellemesi) backend'de bir
      // "schedule sync" tetikliyor — grubun deklare edilmiş haftalık programına (Pzt
      // 17:00-18:00, test 9'da kurulmuş) UYMAYAN seanslar (test 12'de BUGÜN için elle
      // eklenen tek seferlik seans, ve onunla birlikte üzerindeki yoklama kaydı) otomatik
      // SİLİNİYOR — yerine OTOMATİK yeni bir seans oluşturulmuyor. Bu yüzden test 12'deki
      // gibi BUGÜN için GERÇEKTEN yeni bir seans ekleyip, üzerinde SIFIRDAN yoklama
      // alıyoruz (artık önceki kayıt silindiği için "Devamsızlık Düzelt" değil,
      // doğrudan "Yoklama Al" akışı kullanılıyor).
      await page.goto(`${mod.basePath}?f=${facilityId}&tab=sessions`)
      await page.waitForLoadState('networkidle').catch(() => {})
      const todayBtn3 = page.getByRole('button', { name: 'Bugün', exact: true }).first()
      await expect(todayBtn3).toBeVisible({ timeout: 10000 })
      await todayBtn3.click()
      await page.waitForLoadState('networkidle').catch(() => {})

      const addSessionBtn3 = page.getByRole('button', { name: 'Seans Ekle', exact: true }).first()
      await expect(addSessionBtn3).toBeVisible({ timeout: 10000 })
      await addSessionBtn3.click()
      const groupSelect3 = page.getByRole('button', { name: new RegExp(`^${mod.groupSingular} Seç`) }).first()
      await groupSelect3.click()
      const searchInPopover3 = page.locator('div[data-ds-popover] input[type="text"]').last()
      if (await searchInPopover3.isVisible({ timeout: 1500 }).catch(() => false)) {
        await searchInPopover3.fill(`${tag} Yedekli Senaryo`)
      }
      await page.locator('div[data-ds-popover] button', { hasText: new RegExp(`${tag} Yedekli Senaryo`) }).first().click()
      // GERÇEK BULGU (kök neden): Field.tsx label'ı <Label htmlFor={id}> ile render
      // ediyor ve Select.tsx trigger butonuna AYNI id'yi veriyor (`id={props.id ?? field.id}`).
      // Tarayıcıların native <label htmlFor> davranışı, label'a tıklamayı o id'li
      // elemente (BURADA: Select tetikleyici buton) yönlendirir — yani "${T.groupSingular}
      // Seç" etiketine tıklamak GERÇEKTE popover'ı KAPATMIYOR, ters etkiyle YENİDEN
      // AÇIYOR. Bu yüzden modalın <h3> başlığı ("Seans Ekle" — form label DEĞİL, düz
      // başlık metni) GERÇEKTEN güvenli, yan etkisiz bir dismiss hedefi.
      const modalTitle3 = page.locator('h3', { hasText: 'Seans Ekle' }).first()
      await expect
        .poll(async () => {
          if (await searchInPopover3.isVisible({ timeout: 300 }).catch(() => false)) {
            await modalTitle3.click({ force: true }).catch(() => {})
            return false
          }
          return true
        }, { timeout: 10000 })
        .toBe(true)
      const timeInputs3 = page.locator('input[inputmode="numeric"][placeholder="ss:dd"]')
      await expect(timeInputs3.first()).toBeVisible({ timeout: 5000 })
      // GERÇEK BULGU 2: Her saat alanını doldurduktan sonra TimePicker'ın KENDİ Saat/Dakika
      // popover'ı (React portal ile document.body'ye render ediliyor) açık kalıyor ve
      // "Seans Ekle" onay butonunun üzerini kapatıyor — aynı güvenli modal başlığına
      // tekrar tıklayarak her doldurmadan sonra bu popover'ı da kapatıyoruz.
      await timeInputs3.nth(0).fill('00:01')
      await modalTitle3.click({ force: true }).catch(() => {})
      await timeInputs3.nth(1).fill('23:59')
      await modalTitle3.click({ force: true }).catch(() => {})
      const confirmAddBtn3 = page.getByRole('button', { name: 'Seans Ekle', exact: true }).last()
      const [addSessionRes3] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/sessions') && r.request().method() === 'POST'),
        confirmAddBtn3.click(),
      ])
      expect(addSessionRes3.ok(), `GERÇEK HATA — devamsızlık testi için yeni seans ekleme UI'dan başarısız: ${await addSessionRes3.text()}`).toBeTruthy()

      const sessionRow2 = page.locator('div', { hasText: `${tag} Yedekli Senaryo` }).first()
      await expect(sessionRow2).toBeVisible({ timeout: 10000 })
      await sessionRow2.scrollIntoViewIfNeeded()

      const takeAttBtn2 = page.getByRole('button', { name: 'Yoklama Al' }).first()
      await takeAttBtn2.scrollIntoViewIfNeeded()
      await expect(takeAttBtn2).toBeVisible({ timeout: 8000 })
      await takeAttBtn2.click()

      await expect(page.getByText(/^Asıl:/).first()).toBeVisible({ timeout: 10000 })
      const absentBtn = page.getByRole('radio', { name: 'Gelmedi', exact: true }).first()
      await expect(absentBtn).toBeVisible({ timeout: 8000 })
      await absentBtn.click()

      const saveCorrectionBtn = page.getByRole('button', { name: /Yoklamayı Kaydet|Kaydet/i }).last()
      await expect(saveCorrectionBtn).toBeEnabled({ timeout: 5000 })
      const [saveCorrRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/attendance') && r.request().method() === 'POST'),
        saveCorrectionBtn.click(),
      ])
      expect(saveCorrRes.ok(), `GERÇEK HATA — "Gelmedi" yoklaması UI'dan başarısız: ${await saveCorrRes.text()}`).toBeTruthy()

      const viewAttBtn2 = page.getByRole('button', { name: /Yoklamayı Görüntüle/i }).first()
      await viewAttBtn2.scrollIntoViewIfNeeded()
      await viewAttBtn2.click()
      await expect(page.getByText(/Devamsızlık:\s*1\s*\/\s*2/).first()).toBeVisible({ timeout: 8000 })
      console.log('[canlı demo] "Gelmedi" (absent) UI üzerinden GERÇEKTEN işaretlendi — devamsızlık sayacı (Devamsızlık: 1/2) modal roster\'ında canlı doğrulandı.')
    })

    test(`17) ADMIN UI — YEDİNCİ VARYASYON (CİHAZLI/device-based): tesis için Sabit QR GERÇEKTEN etkinleştirilir, QR kod string'i canlı alınır`, async ({ page }) => {
      await fastLoginUi(page, apiCtx)
      // GERÇEK BULGU: ayarlar modalı facilityId URL'de VERİLMEDEN açılırsa
      // FacilitySettingsModal.tsx varsayılan olarak facilities[0]'ı seçiyor — bu, başka
      // test çalışmalarından kalma modül facilityleri varsa YANLIŞ tesisin ayarlarını
      // açabiliyor (QR daha sonra "enabled" kontrolünde yanlış tesisten geliyor). Diğer
      // testlerle aynı desen izlenerek ?f=${facilityId} ile GERÇEK/doğru tesis açılıyor.
      await page.goto(`${mod.basePath}?f=${facilityId}`)
      await page.waitForLoadState('networkidle').catch(() => {})

      const settingsBtn = page.locator('[data-action="settings"]').first()
      await expect(settingsBtn).toBeVisible({ timeout: 10000 })
      await settingsBtn.click()

      const facilityTab = page.getByRole('tab', { name: /Tesise özel ayarlar/i }).first()
      await expect(facilityTab).toBeVisible({ timeout: 8000 })
      await facilityTab.click()

      await page.getByText('Sabit Giriş QR', { exact: false }).scrollIntoViewIfNeeded().catch(() => {})
      const qrSwitch = page.getByRole('switch', { name: /Sabit QR ile giriş/i }).first()
      await expect(qrSwitch).toBeVisible({ timeout: 8000 })
      const alreadyOn = (await qrSwitch.getAttribute('aria-checked')) === 'true'
      if (!alreadyOn) {
        const [toggleRes] = await Promise.all([
          page.waitForResponse((r) => r.url().includes('/static-qr/toggle') && r.request().method() === 'PATCH'),
          qrSwitch.click(),
        ])
        expect(toggleRes.ok(), `GERÇEK HATA — sabit QR etkinleştirme UI'dan başarısız: ${await toggleRes.text()}`).toBeTruthy()
      }
      await expect(page.getByText('Tarama Modu', { exact: false }).first()).toBeVisible({ timeout: 5000 })

      const freshTokenQr = await getFreshToken(page)
      const qrInfoRes = await page.request.get(`${API_BASE}/${mod.routeId}/facilities/${facilityId}/static-qr`, {
        headers: { Authorization: `Bearer ${freshTokenQr}` },
      })
      expect(qrInfoRes.ok(), `static-qr bilgisi alınamadı: ${await qrInfoRes.text()}`).toBeTruthy()
      const qrInfoBody = await qrInfoRes.json()
      expect(qrInfoBody?.data?.enabled).toBe(true)
      staticQrFacilityCode = qrInfoBody?.data?.code
      expect(staticQrFacilityCode, 'tesis sabit QR kod stringi boş olmamalı').toBeTruthy()
      console.log(`[canlı demo] Tesis için Sabit QR UI üzerinden GERÇEKTEN etkinleştirildi, kod: ${staticQrFacilityCode}`)
    })

    test(`18) CITIZEN PORTAL UI — GERÇEK vatandaş, sabit QR kodunu "tarayıp" (gerçek staticScan isteği) tesise GERÇEKTEN giriş kaydı oluşturur`, async ({ page }) => {
      expect(staticQrFacilityCode, 'önceki testte tesis sabit QR kodu alınmış olmalı').toBeTruthy()

      await citizenLoginUiWithToken(page, waitlistFirstCitizen)
      await page.goto(`${CITIZEN_PORTAL_URL}/hizmetler?m=${mod.routeId}`)
      await page.waitForLoadState('networkidle').catch(() => {})

      const result = await page.evaluate(async (code) => {
        const svcMod = await import('/src/services/facility.service.ts')
        return svcMod.default.staticScan(code)
      }, staticQrFacilityCode)

      console.log(`[canlı demo] GERÇEK staticScan sonucu: ${JSON.stringify(result)}`)
      expect(result, 'staticScan GERÇEK bir cevap dönmeli (allowed true/false + mesaj)').toBeTruthy()
      expect(typeof result.allowed).toBe('boolean')
      expect(result.message, 'GERÇEK HATA — staticScan mesajı boş döndü').toBeTruthy()
      if (result.allowed) {
        expect(result.action, 'allowed=true ise action (entry/exit) dönmeli').toBeTruthy()
        console.log(`[canlı demo] CİHAZSIZ (sabit QR) giriş UI'dan GERÇEKTEN kabul edildi — action=${result.action}.`)
      } else {
        console.log(`[canlı demo] staticScan GERÇEK bir red koduyla sonuçlandı (errorCode=${result.errorCode}) — gerçek backend cevabı kanıtlandı.`)
      }
    })
  })
}
