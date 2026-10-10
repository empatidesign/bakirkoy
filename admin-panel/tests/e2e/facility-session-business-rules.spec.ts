/**
 * SEANS OLUŞTURMA — İŞ KURALI TEST SİSTEMİ (8 Tesis Modülü)
 *
 * Kaynak: /Users/mac/Downloads/CANLI_TEST_RAPORU_REVIZE.md,
 * TEST_YURUTME_KAYIT_SABLONU.md, TUM_MODULLER_MASTER_TEST_MATRISI_REVIZE.md
 * ve `docs/seans-grup-audit-2026-10-03/` denetim raporları.
 *
 * Bu dosya, `facility-session-creation-full-matrix.spec.ts`'in ALAN kapsamına
 * ek olarak, seans/grup oluşturmanın KURAL kapsamını doğrular — her kuralın
 * kaynağı gerçek backend kodu (`FacilityGroupValidators.cs`,
 * `FacilityGroupService.cs`, `FacilitySessionService.cs`), GERÇEK API +
 * GERÇEK PostgreSQL üzerinden çalıştırılır. Testler ya kuralın DOĞRU
 * reddettiğini (pozitif güvence) ya da önceki denetimde bulunan bilinen bir
 * açığı karakterize eder (characterization — "bu hata hâlâ var" kaydı,
 * "bu davranış doğrudur" iddiası DEĞİL — bkz. ilgili test içindeki not).
 *
 * DÜRÜST KAPSAM NOTU: UI validasyonu (`groupForm.utils.ts getGroupFormErrors`)
 * ayrı — bu dosya SUNUCU tarafı kuralını doğrular. Yük/eşzamanlılık,
 * gerçek SMS/e-posta teslimi, fiziksel cihaz testleri kapsam DIŞINDADIR.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import {
  FACILITY_MODULE_MATRIX, type FacilityModuleSpec,
  adminToken, uniq, futureIso,
  createServiceFacilityAndModuleFacility, createBranch, cleanupFacilityFixture, deleteWithRetry,
  API_BASE,
} from './helpers/facilitySessionMatrix'

function baseGroupPayload(mod: FacilityModuleSpec, facilityId: string, branchId: string, tag: string, overrides: Record<string, unknown> = {}) {
  return {
    facilityId, branchId, parentGroupId: null,
    name: `${tag} Kural Testi`, type: 'kurs', gender: 'mixed',
    capacity: 10, reserveCapacity: 2, ageMin: mod.defaultAgeRange.min, ageMax: mod.defaultAgeRange.max,
    schedule: [{ day: 'monday', startTime: '09:00', endTime: '10:00' }],
    attendanceMode: 'full',
    fee: { isPaid: false, feeType: 'monthly', amount: 0, siblingDiscount: false, staffDiscount: false },
    conditions: { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: '' },
    periodStart: futureIso(2), periodEnd: futureIso(60), periodType: 'date_range', periodUnit: 'month',
    applicationStartDate: futureIso(0), applicationEndDate: futureIso(50),
    academyWhitelistEnabled: false, absenceLimit: 0, consecutiveAbsenceLimit: 0, entryGraceMinutes: 0,
    instructorId: null, isActive: true, autoApprove: true, residencyMode: 'anyone',
    ...overrides,
  }
}

for (const mod of FACILITY_MODULE_MATRIX) {
  test.describe.serial(`[${mod.id}] Seans/Grup İş Kuralları`, () => {
    let apiCtx: APIRequestContext
    let token = ''
    let serviceFacilityId = ''
    let facilityId = ''
    let branchId = ''
    const facilityCapacity = 50
    const createdGroupIds: string[] = []
    const createdBranchIds: string[] = []
    const tag = uniq(`QA-KURAL ${mod.id}`)

    test.beforeAll(async () => {
      apiCtx = await pwRequest.newContext()
      token = await adminToken(apiCtx)
      const fac = await createServiceFacilityAndModuleFacility(apiCtx, token, mod, tag, facilityCapacity)
      serviceFacilityId = fac.serviceFacilityId
      facilityId = fac.facilityId
      const br = await createBranch(apiCtx, token, mod, tag)
      branchId = br.branchId
    })

    test.afterAll(async () => {
      const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
      // GERÇEK TESTTE BULUNAN HATA (2026-10-03): `.catch(() => {})` ile sessizce yutulan
      // silme hataları (ör. 429 RATE_LIMIT_EXCEEDED uzun kombine koşumlarda) gerçek DB
      // kalıntılarına yol açtı (bkz. helpers/facilitySessionMatrix.ts deleteWithRetry notu).
      for (const id of createdBranchIds) {
        await deleteWithRetry(apiCtx, `${API_BASE}/${mod.routeId}/branches/${id}`, headers)
      }
      await cleanupFacilityFixture(apiCtx, token, mod, { facilityId, branchId, serviceFacilityId, groupIds: createdGroupIds })
      await apiCtx.dispose()
    })

    async function postGroup(overrides: Record<string, unknown>) {
      const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
      const res = await apiCtx.post(`${API_BASE}/${mod.routeId}/groups`, {
        headers,
        data: baseGroupPayload(mod, facilityId, branchId, tag, overrides),
      })
      const body = await res.json().catch(() => ({}))
      return { res, body }
    }

    test('KURAL-01: Kontenjan tesis kapasitesini (CAPACITY_EXCEEDS_FACILITY) aşamaz', async () => {
      const { res, body } = await postGroup({ name: `${tag} Kapasite Aşımı`, capacity: facilityCapacity + 1 })
      expect(res.status(), JSON.stringify(body)).toBe(409)
      expect(body.errorCode).toBe('CAPACITY_EXCEEDS_FACILITY')
    })

    test('KURAL-02: Aktif grupta kontenjan 0 veya negatif olamaz', async () => {
      const { res, body } = await postGroup({ name: `${tag} Sıfır Kontenjan`, capacity: 0, isActive: true })
      expect(res.status(), JSON.stringify(body)).toBe(400)
    })

    test('KURAL-03: Yaş En Az, Yaş En Çok\'tan büyük olamaz (ters yaş aralığı reddedilir)', async () => {
      const { res, body } = await postGroup({ name: `${tag} Ters Yaş`, ageMin: 30, ageMax: 10 })
      expect(res.status(), JSON.stringify(body)).toBe(400)
    })

    test('KURAL-04: Yaş 120\'den büyük olamaz (doğum yılı karışıklığına karşı koruma)', async () => {
      const { res, body } = await postGroup({ name: `${tag} Aşırı Yaş`, ageMin: 5, ageMax: 1990 })
      expect(res.status(), JSON.stringify(body)).toBe(400)
    })

    test('KURAL-05: Dönem başlangıcı bugünden önce olamaz (geçmiş tarih reddedilir)', async () => {
      const { res, body } = await postGroup({ name: `${tag} Geçmiş Dönem`, periodStart: futureIso(-30), periodEnd: futureIso(30) })
      expect(res.status(), JSON.stringify(body)).toBe(400)
    })

    test('KURAL-06 [BİLİNEN AÇIK — SP-06/HP-06, henüz düzeltilmedi]: Bitişi başlangıcından önce olan dönem backend\'de de kabul ediliyor', async () => {
      const start = futureIso(30)
      const end = futureIso(5)
      const { res, body } = await postGroup({ name: `${tag} Ters Dönem`, periodStart: start, periodEnd: end })
      expect(res.ok(), `Bu karakterizasyon testi KIRILDI (muhtemelen DÜZELTİLDİ): ${JSON.stringify(body)}`).toBeTruthy()
      createdGroupIds.push(body.data.id)
      expect(body.data.periodStart > body.data.periodEnd, 'ters dönem (başlangıç > bitiş) hâlâ sessizce kabul ediliyor').toBe(true)
    })

    test('KURAL-07: Ücretli grupta tutar 0 veya ücret tipi boşsa reddedilir', async () => {
      const { res, body } = await postGroup({
        name: `${tag} Ücretli Boş Tutar`,
        fee: { isPaid: true, feeType: 'monthly', amount: 0, siblingDiscount: false, staffDiscount: false },
      })
      expect(res.status(), JSON.stringify(body)).toBe(400)
    })

    test('KURAL-08: Tekrarlı(Ay) dönemde periodMonths en az 1 olmalı', async () => {
      const { res, body } = await postGroup({
        name: `${tag} Geçersiz Tekrarlı`,
        periodType: 'recurring', periodUnit: 'month', periodMonths: 0, periodEnd: null,
      })
      expect(res.status(), JSON.stringify(body)).toBe(400)
    })

    test('KURAL-09: Gün bazlı dönemde periodDays en az 1 olmalı', async () => {
      const { res, body } = await postGroup({
        name: `${tag} Geçersiz Gün`,
        periodType: 'date_range', periodUnit: 'day', periodDays: 0, periodEnd: null,
      })
      expect(res.status(), JSON.stringify(body)).toBe(400)
    })

    test('KURAL-10: Program (schedule) bitiş saati başlangıçtan önce/eşit olamaz', async () => {
      const { res, body } = await postGroup({
        name: `${tag} Ters Saat`,
        schedule: [{ day: 'tuesday', startTime: '11:00', endTime: '10:00' }],
      })
      expect(res.status(), JSON.stringify(body)).toBe(400)
    })

    test('KURAL-11: Aynı gün için birden fazla saat aralığı (çoklu slot) reddedilir', async () => {
      const { res, body } = await postGroup({
        name: `${tag} Çoklu Slot`,
        schedule: [
          { day: 'wednesday', startTime: '09:00', endTime: '10:00' },
          { day: 'wednesday', startTime: '14:00', endTime: '15:00' },
        ],
      })
      expect(res.status(), JSON.stringify(body)).toBe(400)
    })

    test('KURAL-12: Branş adı aynı modülde ikinci kez eklenirse DUPLICATE_BRANCH döner', async () => {
      const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
      const freshName = `${tag} ${mod.branchSingular} Kural12`
      const first = await apiCtx.post(`${API_BASE}/${mod.routeId}/branches`, {
        headers,
        data: { name: freshName, gender: 'mixed', ageMin: mod.defaultAgeRange.min, ageMax: mod.defaultAgeRange.max, description: 'k12-first', periodMonths: 3, absenceLimit: 0, consecutiveAbsenceLimit: 0, isActive: true },
      })
      expect(first.ok(), await first.text()).toBeTruthy()
      createdBranchIds.push((await first.json()).data.id)

      const dup = await apiCtx.post(`${API_BASE}/${mod.routeId}/branches`, {
        headers,
        data: { name: freshName, gender: 'mixed', ageMin: mod.defaultAgeRange.min, ageMax: mod.defaultAgeRange.max, description: 'k12-dup', periodMonths: 3, absenceLimit: 0, consecutiveAbsenceLimit: 0, isActive: true },
      })
      expect(dup.status()).toBe(409)
      const body = await dup.json()
      expect(body.errorCode).toBe('DUPLICATE_BRANCH')
    })

    test('KURAL-12b [BİLİNEN AÇIK — yeni bulgu 2026-10-03]: Ad içinde alt çizgi (_) varsa DUPLICATE_BRANCH kontrolü sessizce atlanıyor', async () => {
      const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
      const underscoreName = `${tag.replace(/-/g, '_')}_K12b_${mod.branchSingular}`
      const first = await apiCtx.post(`${API_BASE}/${mod.routeId}/branches`, {
        headers,
        data: { name: underscoreName, gender: 'mixed', ageMin: mod.defaultAgeRange.min, ageMax: mod.defaultAgeRange.max, description: 'k12b-first', periodMonths: 3, absenceLimit: 0, consecutiveAbsenceLimit: 0, isActive: true },
      })
      expect(first.ok(), await first.text()).toBeTruthy()
      createdBranchIds.push((await first.json()).data.id)

      const dup = await apiCtx.post(`${API_BASE}/${mod.routeId}/branches`, {
        headers,
        data: { name: underscoreName, gender: 'mixed', ageMin: mod.defaultAgeRange.min, ageMax: mod.defaultAgeRange.max, description: 'k12b-dup', periodMonths: 3, absenceLimit: 0, consecutiveAbsenceLimit: 0, isActive: true },
      })
      expect(dup.ok(), `Bu karakterizasyon testi KIRILDI (muhtemelen DÜZELTİLDİ): ${await dup.text()}`).toBeTruthy()
      if (dup.ok()) createdBranchIds.push((await dup.json()).data.id)
    })

    test('KURAL-13: Aynı tesiste fiziksel çakışan manuel seans (farklı grup) reddedilir — SESSION_FACILITY_CONFLICT', async () => {
      const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
      const groupA = await postGroup({ name: `${tag} Grup A`, schedule: [] })
      expect(groupA.res.ok(), JSON.stringify(groupA.body)).toBeTruthy()
      createdGroupIds.push(groupA.body.data.id)
      const groupB = await postGroup({ name: `${tag} Grup B`, schedule: [] })
      expect(groupB.res.ok(), JSON.stringify(groupB.body)).toBeTruthy()
      createdGroupIds.push(groupB.body.data.id)

      const day = futureIso(10)
      const sessionA = await apiCtx.post(`${API_BASE}/${mod.routeId}/sessions`, {
        headers, data: { facilityId, groupId: groupA.body.data.id, date: day, startTime: '09:00', endTime: '10:00' },
      })
      expect(sessionA.ok(), await sessionA.text()).toBeTruthy()

      const sessionB = await apiCtx.post(`${API_BASE}/${mod.routeId}/sessions`, {
        headers, data: { facilityId, groupId: groupB.body.data.id, date: day, startTime: '09:30', endTime: '10:30' },
      })
      expect(sessionB.status()).toBe(409)
      const bodyB = await sessionB.json()
      expect(bodyB.errorCode).toBe('SESSION_FACILITY_CONFLICT')
    })

    test('KURAL-14: Aynı grup+tarih+saat seansı tekrar eklenemez — SESSION_ALREADY_EXISTS', async () => {
      const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
      const group = await postGroup({ name: `${tag} Tekrar Seans Grubu`, schedule: [] })
      expect(group.res.ok(), JSON.stringify(group.body)).toBeTruthy()
      createdGroupIds.push(group.body.data.id)

      const day = futureIso(11)
      const first = await apiCtx.post(`${API_BASE}/${mod.routeId}/sessions`, {
        headers, data: { facilityId, groupId: group.body.data.id, date: day, startTime: '13:00', endTime: '14:00' },
      })
      expect(first.ok(), await first.text()).toBeTruthy()

      const dupSession = await apiCtx.post(`${API_BASE}/${mod.routeId}/sessions`, {
        headers, data: { facilityId, groupId: group.body.data.id, date: day, startTime: '13:00', endTime: '14:00' },
      })
      expect(dupSession.status()).toBe(409)
      const dupBody = await dupSession.json()
      expect(dupBody.errorCode).toBe('SESSION_ALREADY_EXISTS')
    })

    test('KURAL-15: Geçmiş tarihe manuel seans eklenemez (FluentValidation 400 — CreateManualSessionRequestValidator.BeNotPast)', async () => {
      const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
      const group = await postGroup({ name: `${tag} Geçmiş Seans Grubu`, schedule: [] })
      expect(group.res.ok(), JSON.stringify(group.body)).toBeTruthy()
      createdGroupIds.push(group.body.data.id)

      const past = futureIso(-5)
      const res = await apiCtx.post(`${API_BASE}/${mod.routeId}/sessions`, {
        headers, data: { facilityId, groupId: group.body.data.id, date: past, startTime: '09:00', endTime: '10:00' },
      })
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.errorCode).toBe('VALIDATION_ERROR')
    })

    test('KURAL-16: Dönem bitişinden sonraki tarihe manuel seans eklenemez — SESSION_OUT_OF_PERIOD', async () => {
      const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
      const group = await postGroup({
        name: `${tag} Dönem Dışı Grup`, schedule: [],
        periodStart: futureIso(1), periodEnd: futureIso(5),
      })
      expect(group.res.ok(), JSON.stringify(group.body)).toBeTruthy()
      createdGroupIds.push(group.body.data.id)

      const afterPeriod = futureIso(20)
      const res = await apiCtx.post(`${API_BASE}/${mod.routeId}/sessions`, {
        headers, data: { facilityId, groupId: group.body.data.id, date: afterPeriod, startTime: '09:00', endTime: '10:00' },
      })
      expect(res.status()).toBe(409)
      const body = await res.json()
      expect(body.errorCode).toBe('SESSION_OUT_OF_PERIOD')
    })

    test('KURAL-17 [BİLİNEN AÇIK — SP-03/HP-03, henüz düzeltilmedi]: Aynı GRUBA kısmen çakışan manuel seans kabul ediliyor', async () => {
      const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
      const group = await postGroup({ name: `${tag} Aynı Grup Çakışma`, schedule: [] })
      expect(group.res.ok(), JSON.stringify(group.body)).toBeTruthy()
      createdGroupIds.push(group.body.data.id)

      const day = futureIso(12)
      const first = await apiCtx.post(`${API_BASE}/${mod.routeId}/sessions`, {
        headers, data: { facilityId, groupId: group.body.data.id, date: day, startTime: '09:00', endTime: '10:00' },
      })
      expect(first.ok(), await first.text()).toBeTruthy()

      const overlapping = await apiCtx.post(`${API_BASE}/${mod.routeId}/sessions`, {
        headers, data: { facilityId, groupId: group.body.data.id, date: day, startTime: '09:30', endTime: '10:30' },
      })
      expect(overlapping.ok(), `Bu karakterizasyon testi KIRILDI (muhtemelen DÜZELTİLDİ): ${await overlapping.text()}`).toBeTruthy()
    })

    if (mod.requiresApplicationDocuments) {
      test('KURAL-18 [Engelsiz Yaşam modülüne özgü taban kural]: "Evrak Gerekli" KAPALI olsa da backend Rules katmanı 3 belgeyi döner (FacilityModuleRegistry)', async () => {
        const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
        const group = await postGroup({
          name: `${tag} Evraksız İstek`,
          conditions: { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: '' },
        })
        expect(group.res.ok(), JSON.stringify(group.body)).toBeTruthy()
        createdGroupIds.push(group.body.data.id)

        const app = await apiCtx.post(`${API_BASE}/${mod.routeId}/applications`, {
          headers,
          data: {
            facilityId, branchId, groupId: group.body.data.id,
            fullName: `${tag} Başvuran`, tckn: '10000000146', phone: '05551234567',
            birthDate: '1990-01-01T00:00:00Z', guardianPhone: '05559998877', documents: [],
          },
        })
        expect(app.status(), await app.text()).toBe(409)
        const appBody = await app.json()
        expect(appBody.errorCode).toBe('DOCUMENTS_REQUIRED')
      })
    } else {
      test('KURAL-18: Evraksız başvuru (documentsRequired=false) kabul edilir', async () => {
        const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
        const group = await postGroup({ name: `${tag} Evraksız Başvuru Grubu` })
        expect(group.res.ok(), JSON.stringify(group.body)).toBeTruthy()
        createdGroupIds.push(group.body.data.id)

        const app = await apiCtx.post(`${API_BASE}/${mod.routeId}/applications`, {
          headers,
          data: {
            facilityId, branchId, groupId: group.body.data.id,
            fullName: `${tag} Başvuran`, tckn: '10000000146', phone: '05551234567',
            birthDate: `${new Date().getUTCFullYear() - mod.defaultAgeRange.min - 1}-01-01T00:00:00Z`, guardianPhone: '05559998877', documents: [],
          },
        })
        expect(app.ok(), await app.text()).toBeTruthy()
      })
    }

    test('KURAL-19: Yaş uygunsuzluğu olan başvuru reddedilir', async () => {
      const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
      const group = await postGroup({ name: `${tag} Yaş Kontrollü Grup` })
      expect(group.res.ok(), JSON.stringify(group.body)).toBeTruthy()
      createdGroupIds.push(group.body.data.id)

      const tooYoungBirthYear = new Date().getUTCFullYear() - Math.max(0, mod.defaultAgeRange.min - 5)
      const app = await apiCtx.post(`${API_BASE}/${mod.routeId}/applications`, {
        headers,
        data: {
          facilityId, branchId, groupId: group.body.data.id,
          fullName: `${tag} Çok Küçük Başvuran`, tckn: '10000000146', phone: '05551234567',
          birthDate: `${tooYoungBirthYear}-01-01T00:00:00Z`, guardianPhone: '05559998877', documents: [],
        },
      })
      expect(app.status()).toBeGreaterThanOrEqual(400)
    })

    test('KURAL-20: Dolu grup için asıl kontenjan reddeder, yedeğe (waitlist) alır', async () => {
      const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
      const group = await postGroup({ name: `${tag} Tek Kişilik Grup`, capacity: 1, reserveCapacity: 1, autoApprove: true })
      expect(group.res.ok(), JSON.stringify(group.body)).toBeTruthy()
      createdGroupIds.push(group.body.data.id)
      const groupId = group.body.data.id

      const fakeTckn = (seed: number) => {
        const digits = [1, 2, 3, 4, 5, 6, 7, 8, (seed % 9) + 1]
        const d10raw = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7 - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
        const d10 = ((d10raw % 10) + 10) % 10
        const d11 = (digits.reduce((s, d) => s + d, 0) + d10) % 10
        return [...digits, d10, d11].join('')
      }
      const birthYear = new Date().getUTCFullYear() - mod.defaultAgeRange.min - 2
      const docs = mod.requiresApplicationDocuments
        ? [{ type: 'disability_report', fileName: 'r.pdf', objectName: 'e2e/r.pdf' }, { type: 'health_report', fileName: 'h.pdf', objectName: 'e2e/h.pdf' }, { type: 'residence', fileName: 'i.pdf', objectName: 'e2e/i.pdf' }]
        : []

      const appA = await apiCtx.post(`${API_BASE}/${mod.routeId}/applications`, {
        headers, data: { facilityId, branchId, groupId, fullName: `${tag} Başvuran A`, tckn: fakeTckn(1), phone: '05551111111', birthDate: `${birthYear}-01-01T00:00:00Z`, guardianPhone: '05559998877', documents: docs },
      })
      expect(appA.ok(), await appA.text()).toBeTruthy()
      const appABody = (await appA.json()).data
      if (appABody.status !== 'approved') {
        const approveA = await apiCtx.post(`${API_BASE}/${mod.routeId}/applications/${appABody.id}/approve`, { headers, data: { groupId } })
        expect(approveA.ok(), await approveA.text()).toBeTruthy()
      }

      const appB = await apiCtx.post(`${API_BASE}/${mod.routeId}/applications`, {
        headers, data: { facilityId, branchId, groupId, fullName: `${tag} Başvuran B`, tckn: fakeTckn(2), phone: '05552222222', birthDate: `${birthYear}-01-01T00:00:00Z`, guardianPhone: '05559998877', documents: docs },
      })
      expect(appB.ok(), await appB.text()).toBeTruthy()
      const appBBody = (await appB.json()).data
      if (appBBody.status === 'waitlist') {
        expect(appBBody.status).toBe('waitlist')
        return
      }
      const approveB = await apiCtx.post(`${API_BASE}/${mod.routeId}/applications/${appBBody.id}/approve`, { headers, data: { groupId } })
      expect(approveB.ok(), await approveB.text()).toBeTruthy()
      const approveBBody = await approveB.json()
      expect((approveBBody.message ?? '').toLowerCase()).toMatch(/yedek|waitlist/)
    })
  })
}
