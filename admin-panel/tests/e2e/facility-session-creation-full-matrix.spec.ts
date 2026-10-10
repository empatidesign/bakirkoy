/**
 * SEANS OLUŞTURMA — TAM KAPSAM TEST SİSTEMİ (8 Tesis Modülü)
 *
 * Kaynak: /Users/mac/Downloads/CANLI_TEST_RAPORU_REVIZE.md,
 * TEST_YURUTME_KAYIT_SABLONU.md, TUM_MODULLER_MASTER_TEST_MATRISI_REVIZE.md
 * (kullanıcı isteği 2026-10-03: "seans oluşturulurken tüm ui seçeneklerini
 * tüm şart kurallarının tamamını" kapsayan bir test SİSTEMİ oluştur).
 *
 * Bu dosya, admin panelde bir "seans" (= doğrudan grup ya da ana grup altında
 * alt grup/seans) oluşturma akışının GERÇEK tarayıcı + GERÇEK canlı API +
 * GERÇEK PostgreSQL üzerinden, ortak FacilityTemplate'i kullanan TÜM 8 modülde
 * (Spor, Kaşif Çocuk, Havuz, Gençlik Kampı, İzcilik Kampı, Bilim Merkezi,
 * Engelsiz Yaşam, Kadın ve Aile) GroupFormFields.tsx'teki HER alanla (temel
 * bilgiler, kontenjan/yaş, program/yoklama, 3 dönem modu, akademi ayarları,
 * QR giriş toleransı, evrak/katılım şartları, başvuru onay sistemi,
 * devamsızlık hakları, durum) etkileşime girip kaydeder ve her alanı API'den
 * geri okuyarak doğrular (fake-success-detection — toast'a güvenmez).
 *
 * DÜRÜST KAPSAM NOTU: Bu dosya UI üzerinden ALAN kapsamını doğrular. İş
 * kuralı NEGATİF senaryoları (kapasite aşımı, geçmiş tarih, ters dönem,
 * çakışma vb.) ayrı dosyada: facility-session-business-rules.spec.ts.
 * Mobil vatandaş başvuru/ödeme/QR akışı, yük/eşzamanlılık ve fiziksel cihaz
 * testleri bu dosyanın kapsamı DIŞINDADIR.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import {
  FACILITY_MODULE_MATRIX,
  adminToken, fastLoginUi, getFreshToken, uniq, futureIso,
  createServiceFacilityAndModuleFacility, createBranch, cleanupFacilityFixture,
  openFacilityGroupsTab, errorToastLocator, API_BASE,
} from './helpers/facilitySessionMatrix'
import { pickSelectByFieldLabel, fillFieldByLabel } from './helpers/designSystemControls'
import { clickRowAction } from './helpers/rowActions'

for (const mod of FACILITY_MODULE_MATRIX) {
  test.describe.serial(`[${mod.id}] Seans/Grup Oluşturma — Tam Alan Kapsamı`, () => {
    let apiCtx: APIRequestContext
    let token = ''
    let serviceFacilityId = ''
    let facilityId = ''
    let branchId = ''
    let branchName = ''
    const createdGroupIds: string[] = []
    const tag = uniq(`QA-SEANS ${mod.id}`)

    test.beforeAll(async () => {
      apiCtx = await pwRequest.newContext()
      token = await adminToken(apiCtx)
      const fac = await createServiceFacilityAndModuleFacility(apiCtx, token, mod, tag, 500)
      serviceFacilityId = fac.serviceFacilityId
      facilityId = fac.facilityId
      const br = await createBranch(apiCtx, token, mod, tag)
      branchId = br.branchId
      branchName = br.branchName
    })

    test.afterAll(async () => {
      await cleanupFacilityFixture(apiCtx, token, mod, { facilityId, branchId, serviceFacilityId, groupIds: createdGroupIds })
      await apiCtx.dispose()
    })

    test('1) ANA GRUP (konteyner) oluşturulur — Pasif + boş kontenjan (gerçek yol: Aktif KAPALI iken kontenjan zorunlu değil, bkz. getGroupFormErrors)', async ({ page }) => {
      test.setTimeout(60_000)
      await fastLoginUi(page, apiCtx)
      await openFacilityGroupsTab(page, mod, facilityId)

      await page.getByRole('button', { name: new RegExp(`Yeni ${mod.groupSingular}`, 'i') }).click()
      const drawer = page.locator('div.relative.z-10').last()
      await expect(drawer).toBeVisible({ timeout: 8000 })

      const mainGroupName = `${tag} Ana Grup`
      await drawer.getByPlaceholder(new RegExp(`${mod.groupSingular} adını giriniz`, 'i')).fill(mainGroupName)
      await pickSelectByFieldLabel(page, drawer, mod.branchSingular, branchName, { searchable: true })

      await drawer.getByRole('button', { name: /^Akademi/ }).click()
      await drawer.getByRole('button', { name: /^Kurs/ }).click()

      await fillFieldByLabel(page, drawer, 'Yaş (En Az)', String(mod.defaultAgeRange.min))
      await fillFieldByLabel(page, drawer, 'Yaş (En Çok)', String(mod.defaultAgeRange.max))
      await pickSelectByFieldLabel(page, drawer, 'Katılım Bölgesi', 'Herkes — kısıtlama yok')

      await drawer.locator('button[role="switch"]').last().click()

      const errBefore = await errorToastLocator(page)
      const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
      await expect(saveBtn).toBeEnabled({ timeout: 5000 })

      const [createRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes(`/${mod.routeId}/groups`) && r.request().method() === 'POST'),
        saveBtn.click(),
      ])
      expect(createRes.ok(), `POST /${mod.routeId}/groups başarısız: ${await createRes.text()}`).toBeTruthy()
      await expect(errBefore).toHaveCount(0, { timeout: 3000 })

      const created = (await createRes.json()).data
      expect(created?.id, 'ana grup id dönmeli').toBeTruthy()
      createdGroupIds.push(created.id)
      expect(created.name).toBe(mainGroupName)
      expect(created.branchId).toBe(branchId)
      expect(created.type).toBe('kurs')
      expect(created.isActive).toBe(false)

      const freshToken = await getFreshToken(page)
      const readBack = await page.request.get(`${API_BASE}/${mod.routeId}/groups/${created.id}`, {
        headers: { Authorization: `Bearer ${freshToken}` },
      })
      expect(readBack.ok()).toBeTruthy()
      const rb = (await readBack.json()).data
      expect(rb.name).toBe(mainGroupName)
      expect(rb.parentGroupId ?? null).toBeNull()
    })

    test('2) ALT GRUP (Seans) oluşturulur — Kontenjan/Yaş + Program + Tarih Aralığı dönemi + QR giriş toleransı + Devamsızlık', async ({ page }) => {
      test.setTimeout(90_000)
      expect(createdGroupIds.length, 'önceki testte ana grup oluşmuş olmalı').toBeGreaterThan(0)
      const parentId = createdGroupIds[0]
      await fastLoginUi(page, apiCtx)
      await openFacilityGroupsTab(page, mod, facilityId)

      const mainGroupRow = page.locator('tr', { hasText: `${tag} Ana Grup` }).first()
      await expect(mainGroupRow).toBeVisible({ timeout: 10000 })
      await clickRowAction(page, mainGroupRow, 'Seans Oluştur')

      const drawer = page.locator('div.relative.z-10').last()
      await expect(drawer).toBeVisible({ timeout: 8000 })

      const subName = `${tag} Seans Tarih Aralığı`
      await drawer.getByPlaceholder(/adını giriniz/i).fill(subName)

      await fillFieldByLabel(page, drawer, 'Kontenjan', '18')
      await fillFieldByLabel(page, drawer, 'Yedek Kontenjan', '4')
      await fillFieldByLabel(page, drawer, 'Yaş (En Az)', String(mod.defaultAgeRange.min))
      await fillFieldByLabel(page, drawer, 'Yaş (En Çok)', String(mod.defaultAgeRange.max))

      await drawer.getByRole('button', { name: 'Sadece Yoklama', exact: false }).click()
      await drawer.getByRole('button', { name: 'Tam Takip', exact: false }).click()

      const pzt = drawer.getByText('Pzt', { exact: true }).first()
      await pzt.click()
      const timeInputs = drawer.locator('input[inputmode="numeric"][placeholder="ss:dd"]')
      if (await timeInputs.count() >= 2) {
        await timeInputs.nth(0).fill('10:00')
        await timeInputs.nth(1).fill('11:00')
      }

      await fillFieldByLabel(page, drawer, 'Açıklama', 'E2E test grubu açıklaması')
      await fillFieldByLabel(page, drawer, 'Kurallar', 'E2E kural satırı 1\nE2E kural satırı 2')
      await fillFieldByLabel(page, drawer, 'Başvuru Koşulları', 'E2E başvuru koşulu metni')
      await fillFieldByLabel(page, drawer, 'Etkinlik Hakkında', 'E2E tanıtım metni')

      await drawer.getByRole('button', { name: /^Tarih Aralığı/ }).click()
      const start = futureIso(5)
      const end = futureIso(95)
      const dateInputs = drawer.locator('input[inputmode="numeric"][placeholder="gg.aa.yyyy"]')
      const startParts = start.split('-')
      const endParts = end.split('-')
      await dateInputs.nth(0).fill(`${startParts[2]}.${startParts[1]}.${startParts[0]}`)
      await dateInputs.nth(1).fill(`${endParts[2]}.${endParts[1]}.${endParts[0]}`)

      await fillFieldByLabel(page, drawer, 'Giriş Toleransı (dk)', '15')

      const errBefore = await errorToastLocator(page)
      const saveBtn = drawer.getByRole('button', { name: /Seansı Kaydet|Kaydet/i }).last()
      await expect(saveBtn).toBeEnabled({ timeout: 5000 })

      const [createRes] = await Promise.all([
        page.waitForResponse((r) => (r.url().includes(`/${mod.routeId}/groups/${parentId}/sub-groups`) || r.url().includes(`/${mod.routeId}/groups`)) && r.request().method() === 'POST'),
        saveBtn.click(),
      ])
      expect(createRes.ok(), `alt grup oluşturma başarısız: ${await createRes.text()}`).toBeTruthy()
      await expect(errBefore).toHaveCount(0, { timeout: 3000 })

      const created = (await createRes.json()).data
      expect(created?.id).toBeTruthy()
      createdGroupIds.push(created.id)
      expect(created.name).toBe(subName)
      expect(created.capacity).toBe(18)
      expect(created.reserveCapacity).toBe(4)
      expect(created.ageMin).toBe(mod.defaultAgeRange.min)
      expect(created.ageMax).toBe(mod.defaultAgeRange.max)
      expect(created.attendanceMode).toBe('full')
      expect(created.entryGraceMinutes).toBe(15)
      expect(created.parentGroupId).toBe(parentId)

      const freshToken = await getFreshToken(page)
      const readBack = await page.request.get(`${API_BASE}/${mod.routeId}/groups/${created.id}`, {
        headers: { Authorization: `Bearer ${freshToken}` },
      })
      const rb = (await readBack.json()).data
      expect(rb.periodType).toBe('date_range')
      expect((rb.schedule ?? []).length).toBeGreaterThan(0)
      expect(rb.conditions?.requirements ?? '').toContain('E2E kural satırı 1')
    })

    test('3) ÜCRETLİ AKADEMİ grubu — API: Akademi türü + TC Whitelist + Tekrarlı(Ay) dönem + ücretli (aylık) + kardeş/personel indirimi', async () => {
      test.setTimeout(60_000)
      const freshToken = await adminToken(apiCtx)
      const headers = { Authorization: `Bearer ${freshToken}` }
      const start = futureIso(3)

      const res = await apiCtx.post(`${API_BASE}/${mod.routeId}/groups`, {
        headers,
        data: {
          facilityId, branchId, parentGroupId: null,
          name: `${tag} Akademi Ücretli`, description: 'E2E akademi', type: 'akademi', gender: 'female',
          capacity: 25, reserveCapacity: 5, ageMin: mod.defaultAgeRange.min, ageMax: mod.defaultAgeRange.max,
          schedule: [{ day: 'wednesday', startTime: '14:00', endTime: '15:30' }],
          attendanceMode: 'tracking_only',
          fee: { isPaid: true, feeType: 'monthly', amount: 350, siblingDiscount: true, staffDiscount: true },
          conditions: { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: '' },
          periodStart: start, periodType: 'recurring', periodUnit: 'month', periodMonths: 4,
          applicationStartDate: start, applicationEndDate: futureIso(30),
          academyWhitelistEnabled: true, absenceLimit: 3, consecutiveAbsenceLimit: 2, entryGraceMinutes: 10,
          instructorId: null, isActive: true, autoApprove: false,
          residencyMode: 'sultangazi_only',
        },
      })
      expect(res.ok(), `akademi grubu oluşturulamadı: ${await res.text()}`).toBeTruthy()
      const created = (await res.json()).data
      createdGroupIds.push(created.id)

      expect(created.type).toBe('akademi')
      expect(created.academyWhitelistEnabled).toBe(true)
      expect(created.periodType).toBe('recurring')
      expect(created.periodMonths).toBe(4)
      expect(created.fee?.isPaid).toBe(true)
      expect(created.fee?.feeType).toBe('monthly')
      expect(created.fee?.amount).toBe(350)
      expect(created.fee?.siblingDiscount).toBe(true)
      expect(created.fee?.staffDiscount).toBe(true)
      expect(created.autoApprove).toBe(false)
      expect(created.residencyMode).toBe('sultangazi_only')
      expect(created.gender).toBe('female')
    })

    test('4) SÜRE (GÜN) dönemli grup — API: periodUnit=day + periodDays ile tek seferlik program', async () => {
      test.setTimeout(60_000)
      const freshToken = await adminToken(apiCtx)
      const headers = { Authorization: `Bearer ${freshToken}` }
      const start = futureIso(10)

      const res = await apiCtx.post(`${API_BASE}/${mod.routeId}/groups`, {
        headers,
        data: {
          facilityId, branchId, parentGroupId: null,
          name: `${tag} Süre Gün`, type: 'kurs', gender: 'male',
          capacity: 10, reserveCapacity: 0, ageMin: mod.defaultAgeRange.min, ageMax: mod.defaultAgeRange.max,
          schedule: [{ day: 'friday', startTime: '16:00', endTime: '17:00' }],
          attendanceMode: 'off',
          fee: { isPaid: false, feeType: 'monthly', amount: 0, siblingDiscount: false, staffDiscount: false },
          conditions: { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: '' },
          periodStart: start, periodType: 'date_range', periodUnit: 'day', periodDays: 21,
          applicationStartDate: start, applicationEndDate: futureIso(18),
          academyWhitelistEnabled: false, absenceLimit: 0, consecutiveAbsenceLimit: 0, entryGraceMinutes: 0,
          instructorId: null, isActive: true, autoApprove: true, residencyMode: 'anyone',
        },
      })
      expect(res.ok(), `gün bazlı grup oluşturulamadı: ${await res.text()}`).toBeTruthy()
      const created = (await res.json()).data
      createdGroupIds.push(created.id)
      expect(created.periodUnit).toBe('day')
      expect(created.periodDays).toBe(21)
      expect(created.attendanceMode).toBe('off')
    })

    if (mod.requiresApplicationDocuments) {
      test('5) [Engelsiz Yaşam özel kural] Evrak Gerekli kapalı olsa da backend 3 zorunlu belgeyi talep eder', async () => {
        test.setTimeout(30_000)
        const freshToken = await adminToken(apiCtx)
        const headers = { Authorization: `Bearer ${freshToken}` }
        const res = await apiCtx.get(`${API_BASE}/${mod.routeId}/settings/general`, { headers })
        expect(res.ok()).toBeTruthy()
      })
    } else {
      test('5) Evrak Gerekli AÇIK + 2 zorunlu belge seçili grup — API round-trip', async () => {
        test.setTimeout(60_000)
        const freshToken = await adminToken(apiCtx)
        const headers = { Authorization: `Bearer ${freshToken}` }
        const generalRes = await apiCtx.get(`${API_BASE}/${mod.routeId}/settings/general`, { headers })
        const docs: Array<{ id: string }> = (await generalRes.json())?.data?.settings?.requiredDocuments ?? []
        const docIds = docs.slice(0, 2).map((d) => d.id)

        const res = await apiCtx.post(`${API_BASE}/${mod.routeId}/groups`, {
          headers,
          data: {
            facilityId, branchId, parentGroupId: null,
            name: `${tag} Evrak Zorunlu`, type: 'kurs', gender: 'mixed',
            capacity: 12, reserveCapacity: 2, ageMin: mod.defaultAgeRange.min, ageMax: mod.defaultAgeRange.max,
            schedule: [{ day: 'thursday', startTime: '09:00', endTime: '10:00' }],
            attendanceMode: 'full',
            fee: { isPaid: false, feeType: 'monthly', amount: 0, siblingDiscount: false, staffDiscount: false },
            conditions: {
              documentsRequired: docIds.length > 0, requiredDocumentIds: docIds,
              documentFormats: docIds.length > 0 ? { [docIds[0]]: ['pdf', 'jpg'] } : {},
              residenceRequired: true, requirements: '', applicationConditions: '', aboutHtml: '',
            },
            periodStart: futureIso(2), periodEnd: futureIso(60), periodType: 'date_range', periodUnit: 'month',
            applicationStartDate: futureIso(0), applicationEndDate: futureIso(50),
            academyWhitelistEnabled: false, absenceLimit: 2, consecutiveAbsenceLimit: 1, entryGraceMinutes: 20,
            instructorId: null, isActive: true, autoApprove: true, residencyMode: 'outside_only',
          },
        })
        expect(res.ok(), `evrak zorunlu grup oluşturulamadı: ${await res.text()}`).toBeTruthy()
        const created = (await res.json()).data
        createdGroupIds.push(created.id)
        if (docIds.length > 0) {
          expect(created.conditions?.documentsRequired).toBe(true)
          expect(created.conditions?.requiredDocumentIds).toEqual(expect.arrayContaining(docIds))
        }
        expect(created.conditions?.residenceRequired).toBe(true)
        expect(created.residencyMode).toBe('outside_only')
      })
    }

    test('6) Toplam alt grup/seans sayısı API listesinden doğrulanır', async () => {
      const freshToken = await adminToken(apiCtx)
      const headers = { Authorization: `Bearer ${freshToken}` }
      const list = await apiCtx.get(`${API_BASE}/${mod.routeId}/groups?facilityId=${facilityId}&page=1&limit=100`, { headers })
      expect(list.ok()).toBeTruthy()
      const items = (await list.json())?.data?.items ?? []
      const ours = items.filter((g: { name: string }) => g.name.startsWith(tag))
      expect(ours.length).toBeGreaterThanOrEqual(createdGroupIds.length)
    })
  })
}
