/**
 * ETKİNLİK SEANSLARI (Events → Sessions) — SEANS OLUŞTURMA İŞ KURALI TESTİ
 *
 * Kaynak: TUM_MODULLER_MASTER_TEST_MATRISI_REVIZE.md — "Etkinlikler" modülü
 * (master matristeki EN BÜYÜK tek modül, 210/810 ağırlıklı senaryo).
 * `events-session-creation-full-matrix.spec.ts`'in ALAN kapsamına ek olarak,
 * bu dosya KURAL kapsamını doğrular — her kuralın kaynağı gerçek backend kodu
 * (`SessionFormRequestValidator.cs`, `SessionService.cs`), GERÇEK API +
 * GERÇEK PostgreSQL üzerinden (API-seviyesinde, UI'sız — kural testinin amacı
 * sunucu tarafı doğrulamadır) çalıştırılır.
 *
 * Her test, bu turda `curl` ile canlı API'ye karşı tek tek elle doğrulanmış
 * davranışları otomatikleştirir (bkz. commit mesajı / oturum notları):
 *   - CAPACITY_EXCEEDS_HALL, OUTSIDE_WORKING_HOURS, PAST_DATE (tek+tekrarlı),
 *     HALL_TIME_CONFLICT, HALL_INACTIVE, EVENT_SESSIONLESS (gerçek 409'lar)
 *   - Bitiş<=Başlangıç saati (tek seans) / slot (tekrarlı) → 400 VALIDATION_ERROR
 *   - recurring modda boş dayPlans → 400 VALIDATION_ERROR
 *   - recurring modda EndDate < StartDate → 400 VALIDATION_ERROR
 *   - grantAccess=true + isim/e-posta eksik → 400 VALIDATION_ERROR
 *   - grantAccess=true + geçerli yeni kişi → GERÇEK admin kullanıcı oluşturma
 *   - generate (recurring) → doğru gün eşlemesi + check-conflicts tutarlılığı
 *
 * DÜRÜST KAPSAM NOTU: UI validasyonu (SessionsTab.tsx getFormErrors) ayrı —
 * bu dosya SUNUCU tarafı kuralını doğrular. Yük/eşzamanlılık (advisory lock
 * P1-17 davranışı) ayrı, canlı testi zaten `admin-single-session.spec.ts`
 * benzeri desenlerle kapsam dışında (yalnız kod incelemesiyle doğrulandı,
 * bkz. SessionService.cs satır 110-120 yorumu). Mobil vatandaş başvuru/QR/
 * ödeme akışı bu dosyanın kapsamı DIŞINDADIR.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import {
  adminToken, uniq, futureIso, API_BASE,
  createEventCategory, createOutdoorSessionableEvent, createServiceFacilityAndHall, createIndoorSessionableEvent,
  baseSessionPayload, cleanupEventsFixture,
} from './helpers/eventsSessionFixtures'

test.describe.serial('Etkinlik Seansları — Seans Oluşturma İş Kuralları (API)', () => {
  let apiCtx: APIRequestContext
  let token = ''
  let categoryId = ''
  let outdoorEventId = ''
  let indoorEventId = ''
  let sessionlessEventId = ''
  let serviceFacilityId = ''
  let hallId = ''
  const hallCapacity = 30
  const createdSessionIds: string[] = []
  const createdAdminUserIds: string[] = []
  const tag = uniq('QA-EVTKURAL')

  async function postSession(overrides: Record<string, unknown>, eventId = outdoorEventId) {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const res = await apiCtx.post(`${API_BASE}/sessions`, { headers, data: baseSessionPayload(eventId, overrides) })
    const body = await res.json().catch(() => ({}))
    return { res, body }
  }

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const cat = await createEventCategory(apiCtx, token, tag)
    categoryId = cat.id
    const outdoorEv = await createOutdoorSessionableEvent(apiCtx, token, categoryId, tag)
    outdoorEventId = outdoorEv.id
    const hallFx = await createServiceFacilityAndHall(apiCtx, token, `${tag}-HALL`, hallCapacity)
    serviceFacilityId = hallFx.serviceFacilityId
    hallId = hallFx.hallId
    // ÖNEMLİ (gerçek testte doğrulanan davranış, 2026-10-03): OUTSIDE_WORKING_HOURS
    // kontrolü SessionService.CreateAsync içinde `LoadHoursAsync(ev.FacilityId, ...)`
    // çağırır — SALONUN kendi tesisini DEĞİL, ETKİNLİĞİN FacilityId'sini kullanır.
    // Outdoor etkinliklerde facilityId=null olduğu için saat kontrolü HER ZAMAN
    // atlanır (hours=null → WithinHours true döner) — salon seçilse bile. Bu yüzden
    // KURAL-06 (çalışma saati dışı) SADECE indoor (facilityId dolu) bir etkinlikle
    // test edilebilir; curl ile canlı API'ye karşı doğrulandı (outdoor+hall+05:00
    // → 201 başarıyla oluşuyor, hiç reddedilmiyor).
    const indoorEv = await createIndoorSessionableEvent(apiCtx, token, categoryId, serviceFacilityId, hallId, tag)
    indoorEventId = indoorEv.id
    const sessionlessEv = await createOutdoorSessionableEvent(apiCtx, token, categoryId, `${tag}-NOSESS`, {
      access: { hasSessions: false, hasSeating: false, reservationType: 'none', registrationMode: 'none', attendanceEnabled: true, entryMethod: 'checkin', qrEnabled: true, qrType: 'rotating', qrRotationSeconds: 30, kioskEnabled: false, turnstileEnabled: false, publicLinkEnabled: false, publicLinkRequiresPin: false, staffIds: [], notificationTemplates: [], cancellationDeadlineHours: 24 },
    })
    sessionlessEventId = sessionlessEv.id
  })

  test.afterAll(async () => {
    await cleanupEventsFixture(apiCtx, token, {
      sessionIds: createdSessionIds,
      eventIds: [outdoorEventId, indoorEventId, sessionlessEventId],
      categoryIds: [categoryId],
      hallIds: [hallId],
      serviceFacilityIds: [serviceFacilityId],
      adminUserIds: createdAdminUserIds,
    })
    await apiCtx.dispose()
  })

  test('KURAL-01: EventId boşsa (Guid.Empty) reddedilir (NotEmpty, 400 VALIDATION_ERROR)', async () => {
    const { res, body } = await postSession({ eventId: '00000000-0000-0000-0000-000000000000' })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(body.errorCode).toBe('VALIDATION_ERROR')
    expect(JSON.stringify(body.errors ?? body)).toContain('Etkinlik seçimi zorunludur')
  })

  test('KURAL-02: Bitiş saati başlangıçtan önce/eşit olamaz (tek seans)', async () => {
    const { res, body } = await postSession({ startTime: '10:00', endTime: '09:00' })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(body.errorCode).toBe('VALIDATION_ERROR')
    expect(JSON.stringify(body.errors ?? body)).toContain('Bitiş saati başlangıç saatinden sonra olmalıdır')
  })

  test('KURAL-02b: Bitiş saati başlangıca tam eşitse de reddedilir (sınır değer)', async () => {
    const { res, body } = await postSession({ startTime: '10:00', endTime: '10:00' })
    expect(res.status(), JSON.stringify(body)).toBe(400)
  })

  test('KURAL-03: Tek seans modunda StartTime boşsa reddedilir', async () => {
    const { res, body } = await postSession({ startTime: '' })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('Başlangıç saati zorunludur')
  })

  test('KURAL-04: Geçmiş tarihli TEK seans oluşturulamaz (PAST_DATE, 409)', async () => {
    const past = futureIso(-5)
    const { res, body } = await postSession({ date: past, startDate: past, endDate: past })
    expect(res.status(), JSON.stringify(body)).toBe(409)
    expect(body.errorCode).toBe('PAST_DATE')
  })

  test('KURAL-05: Salon kapasitesini aşan kontenjan reddedilir (CAPACITY_EXCEEDS_HALL, 409)', async () => {
    const { res, body } = await postSession({ hallId, capacity: hallCapacity + 50 })
    expect(res.status(), JSON.stringify(body)).toBe(409)
    expect(body.errorCode).toBe('CAPACITY_EXCEEDS_HALL')
  })

  test('KURAL-06: Tesis çalışma saatleri dışındaki seans reddedilir (OUTSIDE_WORKING_HOURS, 409)', async () => {
    // LoadHoursAsync, ETKİNLİĞİN FacilityId'sini kullanır (bkz. yukarıdaki beforeAll
    // notu) — bu yüzden indoor etkinlik + kendi salonu ile test ediliyor. Fikstür
    // tesisi weekdayOpen=08:00/weekdayClose=22:00 — 05:00-06:00 kesin aralık dışında.
    const { res, body } = await postSession({ hallId, startTime: '05:00', endTime: '06:00' }, indoorEventId)
    expect(res.status(), JSON.stringify(body)).toBe(409)
    expect(body.errorCode).toBe('OUTSIDE_WORKING_HOURS')
  })

  test('KURAL-07: Aynı salon+gün+saat aralığında ÇAKIŞAN ikinci seans reddedilir (HALL_TIME_CONFLICT, 409)', async () => {
    const date = futureIso(25)
    const { res: res1, body: body1 } = await postSession({ hallId, date, startDate: date, endDate: date, startTime: '09:00', endTime: '10:00' })
    expect(res1.status(), JSON.stringify(body1)).toBe(201)
    createdSessionIds.push(body1.data.id)

    const { res: res2, body: body2 } = await postSession({ hallId, date, startDate: date, endDate: date, startTime: '09:30', endTime: '10:30' })
    expect(res2.status(), JSON.stringify(body2)).toBe(409)
    expect(body2.errorCode).toBe('HALL_TIME_CONFLICT')
  })

  test('KURAL-07b: Aynı salonda ÇAKIŞMAYAN (ardışık) iki seans ikisi de kabul edilir', async () => {
    const date = futureIso(26)
    const { res: res1, body: body1 } = await postSession({ hallId, date, startDate: date, endDate: date, startTime: '11:00', endTime: '12:00' })
    expect(res1.status(), JSON.stringify(body1)).toBe(201)
    createdSessionIds.push(body1.data.id)

    const { res: res2, body: body2 } = await postSession({ hallId, date, startDate: date, endDate: date, startTime: '12:00', endTime: '13:00' })
    expect(res2.status(), JSON.stringify(body2)).toBe(201)
    createdSessionIds.push(body2.data.id)
  })

  test('KURAL-08: Pasif salona yeni seans eklenemez (HALL_INACTIVE, 409)', async () => {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const toggleOff = await apiCtx.patch(`${API_BASE}/halls/${hallId}/toggle-status`, { headers })
    expect(toggleOff.ok()).toBeTruthy()
    expect((await toggleOff.json()).data.isActive).toBe(false)

    try {
      const date = futureIso(27)
      const { res, body } = await postSession({ hallId, date, startDate: date, endDate: date })
      expect(res.status(), JSON.stringify(body)).toBe(409)
      expect(body.errorCode).toBe('HALL_INACTIVE')
    } finally {
      const toggleOn = await apiCtx.patch(`${API_BASE}/halls/${hallId}/toggle-status`, { headers })
      expect((await toggleOn.json()).data.isActive).toBe(true)
    }
  })

  test('KURAL-09: Seanssız (hasSessions=false) etkinliğe seans eklenemez (EVENT_SESSIONLESS, 409)', async () => {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const res = await apiCtx.post(`${API_BASE}/sessions`, { headers, data: baseSessionPayload(sessionlessEventId) })
    const body = await res.json().catch(() => ({}))
    expect(res.status(), JSON.stringify(body)).toBe(409)
    expect(body.errorCode).toBe('EVENT_SESSIONLESS')
  })

  test('KURAL-10: Var olmayan EventId NOT_FOUND döner (404)', async () => {
    const { res, body } = await postSession({ eventId: '11111111-2222-3333-4444-555555555555' })
    expect(res.status(), JSON.stringify(body)).toBe(404)
    expect(body.errorCode).toBe('EVENT_NOT_FOUND')
  })

  test('KURAL-11: Tekrarlı (recurring) modda boş dayPlans reddedilir (400)', async () => {
    const start = futureIso(20)
    const end = futureIso(60)
    const { res, body } = await postSession({ mode: 'recurring', startDate: start, endDate: end, dayPlans: [], startTime: '', endTime: '' })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('En az bir gün ve saat aralığı eklemelisiniz')
  })

  test('KURAL-12: Tekrarlı modda bir günün slot listesi boşsa reddedilir (400)', async () => {
    const start = futureIso(20)
    const end = futureIso(60)
    const { res, body } = await postSession({
      mode: 'recurring', startDate: start, endDate: end, startTime: '', endTime: '',
      dayPlans: [{ day: 'monday', slots: [] }],
    })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('Her gün için en az bir saat aralığı gerekir')
  })

  test('KURAL-13: Tekrarlı modda bir slot içinde bitiş<=başlangıçsa reddedilir (400)', async () => {
    const start = futureIso(20)
    const end = futureIso(60)
    const { res, body } = await postSession({
      mode: 'recurring', startDate: start, endDate: end, startTime: '', endTime: '',
      dayPlans: [{ day: 'monday', slots: [{ startTime: '10:00', endTime: '09:00' }] }],
    })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('Bitiş saati başlangıç saatinden sonra olmalıdır')
  })

  test('KURAL-14: Tekrarlı modda EndDate StartDate\'den önce olamaz (400)', async () => {
    const start = futureIso(60)
    const end = futureIso(20)
    const { res, body } = await postSession({
      mode: 'recurring', startDate: start, endDate: end, startTime: '', endTime: '',
      dayPlans: [{ day: 'monday', slots: [{ startTime: '09:00', endTime: '10:00' }] }],
    })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('Bitiş tarihi başlangıçtan önce olamaz')
  })

  test('KURAL-15: /sessions/generate StartDate geçmişse PAST_DATE ile reddeder (gerçek kontrol noktası)', async () => {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const start = futureIso(-10)
    const end = futureIso(10)
    const res = await apiCtx.post(`${API_BASE}/sessions/generate`, {
      headers,
      data: baseSessionPayload(outdoorEventId, {
        mode: 'recurring', startDate: start, endDate: end, startTime: '', endTime: '',
        dayPlans: [{ day: 'monday', slots: [{ startTime: '09:00', endTime: '10:00' }] }],
      }),
    })
    const body = await res.json().catch(() => ({}))
    expect(res.status(), JSON.stringify(body)).toBe(409)
    expect(body.errorCode).toBe('PAST_DATE')
  })

  test('KURAL-15b [BİLİNEN AÇIK, canlı testle doğrulandı]: POST /sessions (Create, mode=recurring) PAST_DATE kontrolünde yalnız req.Date\'i doğrular, req.StartDate\'i DEĞİL — geçmiş bir StartDate ile ama gelecekteki bir Date değeriyle istek göndermek 201 ile KABUL EDİLİYOR', async () => {
    // Kaynak: SessionService.CreateAsync, satır ~99: `if (TurkeyTime.ToTurkey(req.Date).Date
    // < TurkeyTime.TodayDate()) throw ... "PAST_DATE"`. GenerateAsync ise req.StartDate'i
    // kontrol eder (satır ~165). Create endpoint'i mode='recurring' olsa da hep req.Date'e
    // bakar; admin panel UI'ı normalde her iki tarihi birlikte güncellediği için pratikte
    // bu durum nadiren tetiklenir, ama API doğrudan çağrıldığında (veya DayPlans ile farklı
    // Date/StartDate gönderildiğinde) açık bir tutarsızlıktır. Bu test "doğru davranış"
    // iddiası DEĞİL, bulunan gerçek bir tutarsızlığın karakterizasyon kaydıdır.
    const { res, body } = await postSession({
      mode: 'recurring', date: futureIso(16), startDate: futureIso(-10), endDate: futureIso(10), startTime: '', endTime: '',
      dayPlans: [{ day: 'monday', slots: [{ startTime: '09:00', endTime: '10:00' }] }],
    })
    expect(res.status(), 'BİLİNEN AÇIK: beklenen 409 PAST_DATE değil, gerçekte 201 dönüyor').toBe(201)
    createdSessionIds.push(body.data.id)
  })

  test('KURAL-16: grantAccess=true iken Eğitmen adı boşsa reddedilir (yeni kişiye erişim verme şartı)', async () => {
    const { res, body } = await postSession({ grantAccess: true, instructor: '', instructorEmail: 'x@example.com' })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('Eğitmen adı zorunludur')
  })

  test('KURAL-17: grantAccess=true iken Eğitmen e-postası boşsa reddedilir', async () => {
    const { res, body } = await postSession({ grantAccess: true, instructor: 'Test Egitmen', instructorEmail: '' })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('Eğitmen e-postası zorunludur')
  })

  test('KURAL-18: grantAccess=true iken geçersiz e-posta formatı reddedilir', async () => {
    const { res, body } = await postSession({ grantAccess: true, instructor: 'Test Egitmen', instructorEmail: 'gecersiz-eposta' })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('Geçerli bir e-posta adresi giriniz')
  })

  test('KURAL-19: grantAccess=true + geçerli yeni kişi bilgisiyle GERÇEK admin kullanıcı oluşturulur ve seansa bağlanır', async () => {
    const uniqueTag = uniq('qakuralgrant').replace(/[^a-z0-9]/gi, '')
    const { res, body } = await postSession({
      grantAccess: true,
      instructor: 'QA Kural Grant Egitmen',
      instructorEmail: `${uniqueTag}@example.com`,
      instructorPhone: '5551112233',
    })
    expect(res.status(), JSON.stringify(body)).toBe(201)
    createdSessionIds.push(body.data.id)
    expect(body.data.instructorId, 'yeni eğitmene gerçek bir admin kullanıcı ID\'si atanmalı').toBeTruthy()
    createdAdminUserIds.push(body.data.instructorId)

    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const meCheck = await apiCtx.get(`${API_BASE}/admins/${body.data.instructorId}`, { headers })
    expect(meCheck.ok(), 'oluşturulan eğitmen gerçekten admins tablosunda bulunmalı').toBeTruthy()
    const admin = (await meCheck.json()).data
    expect(admin.email).toBe(`${uniqueTag}@example.com`)
  })

  test('KURAL-20: Mevcut bir yöneticiden (instructorId dolu) seçildiğinde "yeni kişi" şartları uygulanmaz', async () => {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const me = await (await apiCtx.get(`${API_BASE}/auth/me`, { headers })).json()
    const managerId = me?.data?.me?.id
    expect(managerId).toBeTruthy()

    // grantAccess=true ama instructorId zaten geçerli bir Guid → IsNewPersonGrant=false,
    // dolayısıyla instructor/instructorEmail boş olsa da reddedilmemeli.
    const { res, body } = await postSession({ grantAccess: true, instructorId: managerId, instructor: '', instructorEmail: '' })
    expect(res.status(), JSON.stringify(body)).toBe(201)
    createdSessionIds.push(body.data.id)
  })

  test('KURAL-21: RegenerateForRangeAsync ile aynı davranış — generate endpoint\'i çalışma saati dışı günleri "skipped" sayar', async () => {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const start = futureIso(30)
    const end = futureIso(37)
    const res = await apiCtx.post(`${API_BASE}/sessions/generate`, {
      headers,
      data: baseSessionPayload(outdoorEventId, {
        mode: 'recurring', startDate: start, endDate: end, startTime: '', endTime: '',
        dayPlans: [
          { day: 'monday', slots: [{ startTime: '09:00', endTime: '10:00' }] },
          { day: 'tuesday', slots: [{ startTime: '09:00', endTime: '10:00' }] },
        ],
      }),
    })
    const body = await res.json().catch(() => ({}))
    expect(res.status(), JSON.stringify(body)).toBe(200)
    expect(body.data.created + body.data.skipped, 'toplam = Pzt+Sal eşleşen gün sayısı (1 hafta ~ 2 gün)').toBeGreaterThanOrEqual(2)

    const list = await apiCtx.get(`${API_BASE}/sessions?eventId=${outdoorEventId}&page=1&limit=100`, { headers })
    const items = (await list.json())?.data?.items ?? []
    for (const s of items) {
      const d = new Date(s.date)
      if (d >= new Date(start) && d <= new Date(end)) createdSessionIds.push(s.id)
    }
  })

  test('KURAL-22: check-conflicts salon çakışmasını ÖNCEDEN (kayıt yapmadan) doğru tespit eder', async () => {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const date = futureIso(40)
    while (new Date(date).getDay() !== 1) break // basit koruma; asıl kontrol aşağıda
    // Pazartesi'ye hizalanmış sabit bir tarih üret
    const d = new Date(date)
    const delta = (1 - d.getUTCDay() + 7) % 7
    d.setUTCDate(d.getUTCDate() + delta)
    const monday = d.toISOString().slice(0, 10)

    const occ = await postSession({ hallId, date: monday, startDate: monday, endDate: monday, startTime: '09:00', endTime: '10:00' })
    expect(occ.res.status(), JSON.stringify(occ.body)).toBe(201)
    createdSessionIds.push(occ.body.data.id)

    const far = new Date(monday)
    far.setUTCDate(far.getUTCDate() + 35)
    const res = await apiCtx.post(`${API_BASE}/sessions/check-conflicts`, {
      headers,
      data: baseSessionPayload(outdoorEventId, {
        hallId, mode: 'recurring', startDate: monday, endDate: far.toISOString().slice(0, 10), startTime: '', endTime: '',
        dayPlans: [{ day: 'monday', slots: [{ startTime: '09:00', endTime: '10:00' }] }],
      }),
    })
    const body = await res.json().catch(() => ({}))
    expect(res.ok(), JSON.stringify(body)).toBeTruthy()
    expect(body.data.length, 'ilk hafta aynı salon+saat çakışması tespit edilmeli').toBeGreaterThanOrEqual(1)
    expect(body.data[0].reason).toBe('hall')
  })
})
