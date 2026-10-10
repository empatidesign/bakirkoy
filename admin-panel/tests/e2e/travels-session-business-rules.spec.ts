/**
 * GEZİ SİSTEMİ — "SEFER" (TRAVEL) OLUŞTURMA İŞ KURALI TESTİ
 *
 * Kaynak: TUM_MODULLER_MASTER_TEST_MATRISI_REVIZE.md — "Kültür Gezileri" modülü
 * (100/810 ağırlıklı senaryo). "Sefer" (Travel entity), Events'teki Session'ın
 * doğrudan eşdeğeridir: bir Gezi'nin (Route) belirli tarihli somut kalkışı.
 * TravelForm.tsx içerik alanı TAŞIMAZ (isim/açıklama/kural/görsel Route'tan
 * miras alınır) — yalnızca tarih/kayıt aralığı/kapasite/araç/ekip atanır.
 *
 * Her kuralın kaynağı gerçek backend kodu (`TravelFormRequestValidator.cs`,
 * `TravelService.cs`), `curl` ile canlı API'ye karşı tek tek elle doğrulanmıştır
 * (bkz. oturum notları) — GERÇEK API + GERÇEK PostgreSQL üzerinden çalışır.
 *
 * DÜRÜST KAPSAM NOTU: UI validasyonu (`TravelsTab.tsx getFormErrors`) ayrı — bu
 * dosya SUNUCU tarafı kuralını doğrular. Koltuk planı (TravelBusSeatModal/
 * SeatReconciler), yolcu/başvuru akışı, yoklama, mesaj şablonları kapsam
 * DIŞINDADIR (ayrı alt sistemler).
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import {
  adminToken, uniq, futureIso, API_BASE,
  createTravelCategory, createTravelRoute, createTravelBus,
  baseTravelPayload, cleanupTravelsFixture, deleteWithRetry,
} from './helpers/travelsSessionFixtures'

test.describe.serial('Gezi Sistemi — Sefer Oluşturma İş Kuralları (API)', () => {
  let apiCtx: APIRequestContext
  let token = ''
  let categoryId = ''
  let routeId = ''
  let busId = ''
  const busCapacity = 15
  const createdTravelIds: string[] = []
  const createdAdminUserIds: string[] = []
  const tag = uniq('QA-TRVKURAL')

  async function postTravel(overrides: Record<string, unknown>) {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const res = await apiCtx.post(`${API_BASE}/travels`, { headers, data: baseTravelPayload(routeId, overrides) })
    const body = await res.json().catch(() => ({}))
    return { res, body }
  }

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const cat = await createTravelCategory(apiCtx, token, tag)
    categoryId = cat.id
    const route = await createTravelRoute(apiCtx, token, categoryId, tag)
    routeId = route.id
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

  test('KURAL-01: RouteId boşsa (Guid.Empty) reddedilir (400 VALIDATION_ERROR)', async () => {
    const { res, body } = await postTravel({ routeId: '00000000-0000-0000-0000-000000000000' })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(body.errorCode).toBe('VALIDATION_ERROR')
    expect(JSON.stringify(body.errors ?? body)).toContain('Gezi (rota) seçimi zorunludur')
  })

  test('KURAL-02: Var olmayan RouteId → TRAVEL_ROUTE_NOT_FOUND (404)', async () => {
    const { res, body } = await postTravel({ routeId: '11111111-2222-3333-4444-555555555555' })
    expect(res.status(), JSON.stringify(body)).toBe(404)
    expect(body.errorCode).toBe('TRAVEL_ROUTE_NOT_FOUND')
  })

  test('KURAL-03: Dönüş tarihi gidiş tarihinden önce olamaz (400)', async () => {
    const { res, body } = await postTravel({ startDate: futureIso(17), endDate: futureIso(16) })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('Dönüş tarihi gidiş tarihinden önce olamaz')
  })

  test('KURAL-04: Kayıt bitiş tarihi kayıt başlangıcından önce olamaz (400)', async () => {
    const { res, body } = await postTravel({ registrationStartDate: futureIso(15), registrationEndDate: futureIso(1) })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('Kayıt bitiş tarihi kayıt başlangıcından önce olamaz')
  })

  test('KURAL-05: Kontenjan 0 veya altı olamaz (400)', async () => {
    const { res, body } = await postTravel({ capacity: 0 })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('Kontenjan en az 1 olmalıdır')
  })

  test('KURAL-06: İptal süresi 0-720 saat aralığı dışında olamaz (400)', async () => {
    const { res, body } = await postTravel({ cancellationDeadlineHours: 800 })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('İptal süresi 0 ile 720 saat arasında olmalıdır')
  })

  test('KURAL-07: Şoför TC kimlik numarası girildiyse 11 haneli olmalıdır (400)', async () => {
    const { res, body } = await postTravel({ crew: { driver: { tckn: '123' } } })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('Şoför TC kimlik numarası girildiyse 11 haneli olmalıdır')
  })

  test('KURAL-08: Sorumlu kişi e-postası girildiyse geçerli formatta olmalıdır (400)', async () => {
    const { res, body } = await postTravel({ crew: { responsible: { email: 'gecersiz-email' } } })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('geçerli bir formatta olmalıdır')
  })

  test('KURAL-09: grantAccess=true iken sorumlu kişinin ad/e-posta eksikse reddedilir (400, validator katmanı)', async () => {
    const { res, body } = await postTravel({ crew: { responsible: { grantAccess: true } } })
    expect(res.status(), JSON.stringify(body)).toBe(400)
    expect(JSON.stringify(body.errors ?? body)).toContain('adı ve e-postası zorunludur')
  })

  test('KURAL-10: Geçmiş tarihli sefer oluşturulamaz (PAST_DATE, 409)', async () => {
    const past = futureIso(-5)
    const { res, body } = await postTravel({ startDate: past, endDate: futureIso(-4), registrationStartDate: futureIso(-10), registrationEndDate: futureIso(-6) })
    expect(res.status(), JSON.stringify(body)).toBe(409)
    expect(body.errorCode).toBe('PAST_DATE')
  })

  /**
   * KÖK SEBEP (2026-10-03, bu oturumun ikinci doğrulama turunda bulundu):
   * `TravelService.CreateAsync` şu sırayla çalışır:
   *   1. Travel.Create(...) + AddAsync + SaveChangesAsync() → SATIR DB'YE YAZILIR
   *   2. AssignBusesAsync(...) → TRAVEL_BUS_NOT_FOUND (404) VEYA CAPACITY_EXCEEDS_BUS (409)
   *      burada fırlatılabilir
   * Adım 2'deki istisna adım 1'i GERİ ALMAZ. Yani `busIds` ile ilgili HER İKİ hata da
   * (404 ve 409) — yalnız KURAL-12'de değil, KURAL-11'de de — istemciye "oluşturulamadı"
   * dedirten bir yanıtla birlikte sunucuda GERÇEK bir Travel satırı bırakır. KURAL-20 bu
   * davranışı CAPACITY_EXCEEDS_BUS için özel olarak kanıtlar; bu yardımcı ise `busIds`
   * içeren HER postTravel çağrısından sonra (hangi hata koduyla başarısız olursa olsun)
   * olası orphan'ı route'un güncel listesiyle önce/sonra FARKINI alarak (capacity gibi
   * kırılgan bir alana güvenmeden) bulur ve temizlik listesine ekler.
   */
  async function postTravelAndTrackOrphans(overrides: Record<string, unknown>) {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const before = await apiCtx.get(`${API_BASE}/travels?routeId=${routeId}&limit=500`, { headers })
    const beforeIds = new Set<string>((((await before.json()).data?.items) ?? []).map((t: { id: string }) => t.id))

    const { res, body } = await postTravel(overrides)

    const after = await apiCtx.get(`${API_BASE}/travels?routeId=${routeId}&limit=500`, { headers })
    const afterItems: Array<{ id: string }> = ((await after.json()).data?.items) ?? []
    for (const it of afterItems) if (!beforeIds.has(it.id)) createdTravelIds.push(it.id)

    return { res, body }
  }

  test('KURAL-11: Var olmayan otobüs ID\'si → TRAVEL_BUS_NOT_FOUND (404)', async () => {
    const { res, body } = await postTravelAndTrackOrphans({ busIds: ['11111111-2222-3333-4444-555555555555'] })
    expect(res.status(), JSON.stringify(body)).toBe(404)
    expect(body.errorCode).toBe('TRAVEL_BUS_NOT_FOUND')
    // NOT: Bu 404 yanıtına rağmen bir DB satırı gerçekten oluşur (KURAL-20'de belgelenen
    // orphan-satır hatasının bir başka tetikleyicisi — AssignBusesAsync'teki HERHANGİ bir
    // istisna aynı sorunu üretir). postTravelAndTrackOrphans temizliği otomatik yapar.
  })

  test('KURAL-12: Kontenjan araç kapasitesini aşamaz (CAPACITY_EXCEEDS_BUS, 409)', async () => {
    const { res, body } = await postTravelAndTrackOrphans({ busIds: [busId], capacity: busCapacity + 10 })
    expect(res.status(), JSON.stringify(body)).toBe(409)
    expect(body.errorCode).toBe('CAPACITY_EXCEEDS_BUS')
    // NOT: Bu 409 yanıtına rağmen bir DB satırı gerçekten oluşur — bkz. KURAL-20
    // (kök sebep orada detaylı belgelendi). Temizlik postTravelAndTrackOrphans ile otomatik.
  })

  test('KURAL-13: Kontenjan araç kapasitesi içindeyse kabul edilir (201)', async () => {
    const { res, body } = await postTravel({ busIds: [busId], capacity: busCapacity - 5 })
    expect(res.status(), JSON.stringify(body)).toBe(201)
    createdTravelIds.push(body.data.id)
    expect(body.data.busCount).toBe(1)
  })

  test('KURAL-14: Araçsız (kontenjan bazlı) sefer serbestçe kabul edilir — araç seçimi opsiyoneldir', async () => {
    const { res, body } = await postTravel({ busIds: [], capacity: 500 })
    expect(res.status(), JSON.stringify(body)).toBe(201)
    createdTravelIds.push(body.data.id)
    expect(body.data.busCount).toBe(0)
  })

  test('KURAL-15: Aynı şoför/rehber/sorumlu tarihleri çakışan iki sefere birden atanamaz (CREW_DOUBLE_BOOKED, 409)', async () => {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const me = await (await apiCtx.get(`${API_BASE}/auth/me`, { headers })).json()
    const managerId = me?.data?.me?.id
    expect(managerId).toBeTruthy()

    const { res: res1, body: body1 } = await postTravel({ crew: { responsible: { id: managerId } } })
    expect(res1.status(), JSON.stringify(body1)).toBe(201)
    createdTravelIds.push(body1.data.id)

    const { res: res2, body: body2 } = await postTravel({ crew: { driver: { id: managerId } } })
    expect(res2.status(), JSON.stringify(body2)).toBe(409)
    expect(body2.errorCode).toBe('CREW_DOUBLE_BOOKED')
  })

  test('KURAL-16: grantAccess=true + geçerli yeni kişi bilgisiyle GERÇEK admin kullanıcı oluşturulur', async () => {
    const uniqueTag = uniq('qatrvkuralgrant').replace(/[^a-z0-9]/gi, '')
    const { res, body } = await postTravel({
      crew: { responsible: { grantAccess: true, name: 'QA Kural Travel Grant', email: `${uniqueTag}@example.com` } },
    })
    expect(res.status(), JSON.stringify(body)).toBe(201)
    createdTravelIds.push(body.data.id)
    const responsibleId = body.data.crew?.responsible?.id
    expect(responsibleId, 'yeni sorumluya gerçek bir admin kullanıcı ID\'si atanmalı').toBeTruthy()
    createdAdminUserIds.push(responsibleId)

    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const check = await apiCtx.get(`${API_BASE}/admins/${responsibleId}`, { headers })
    expect(check.ok(), 'oluşturulan sorumlu gerçekten admins tablosunda bulunmalı').toBeTruthy()
    expect((await check.json()).data.email).toBe(`${uniqueTag}@example.com`)
  })

  test('KURAL-17: Yayınlanmış (aktif) seferin aracı PUT ile değiştirilemez (BUS_LOCKED_PUBLISHED, 409)', async () => {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const { res: createRes, body: created } = await postTravel({ busIds: [busId], capacity: 5, isActive: true })
    expect(createRes.status(), JSON.stringify(created)).toBe(201)
    createdTravelIds.push(created.data.id)

    const updateRes = await apiCtx.put(`${API_BASE}/travels/${created.data.id}`, {
      headers, data: baseTravelPayload(routeId, { busIds: [], capacity: 5, isActive: true }),
    })
    const updateBody = await updateRes.json().catch(() => ({}))
    expect(updateRes.status(), JSON.stringify(updateBody)).toBe(409)
    expect(updateBody.errorCode).toBe('BUS_LOCKED_PUBLISHED')
  })

  test('KURAL-18: Pasif seferde araç değişikliği serbesttir (BUS_LOCKED_PUBLISHED yalnız aktif seferde tetiklenir)', async () => {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const { res: createRes, body: created } = await postTravel({ busIds: [busId], capacity: 5, isActive: false })
    expect(createRes.status(), JSON.stringify(created)).toBe(201)
    createdTravelIds.push(created.data.id)

    const updateRes = await apiCtx.put(`${API_BASE}/travels/${created.data.id}`, {
      headers, data: baseTravelPayload(routeId, { busIds: [], capacity: 5, isActive: false }),
    })
    const updateBody = await updateRes.json().catch(() => ({}))
    expect(updateRes.status(), JSON.stringify(updateBody)).toBe(200)
    expect(updateBody.data.busCount).toBe(0)
  })

  /**
   * GERÇEK PRODUCTION HATASI (2026-10-03, bu oturumda bulundu): registrationStartDate/
   * registrationEndDate boş string ("") gönderildiğinde — ki gerçek UI (TravelForm.tsx)
   * kullanıcı bu alanlara hiç dokunmazsa TAM OLARAK BUNU üretebilir (emptyTravelForm'da
   * başlangıç değerleri '') — backend TEMİZ bir 400 VALIDATION_ERROR vermek yerine
   * `TurkeyDateTimeConverter.Read`'in boş stringi DateTime'a çeviremeyip attığı
   * istisnadan dolayı 500 INTERNAL_SERVER_ERROR döndürür. `TravelFormRequestValidator`
   * bu iki alan için `NotEmpty()` kontrolü YAPMIYOR. Bu test o çökmeyi tespit eden bir
   * KARAKTERİZASYON testidir — mevcut (hatalı) davranışı belgeler; backend düzeltilip
   * temiz bir 400 döndürmeye başladığında bu test KIRILACAK ve güncellenmesi gerekecektir.
   */
  test('KURAL-19 (BİLİNEN HATA): registrationStartDate/EndDate boş string gönderilirse temiz 400 yerine 500 döner', async () => {
    const { res, body } = await postTravel({ registrationStartDate: '', registrationEndDate: '' })
    // DOĞRU/BEKLENEN davranış 400 VALIDATION_ERROR olmalıydı; GERÇEKTE 500 dönüyor.
    expect(res.status(), `Beklenen: production hatası nedeniyle 500. Yanıt: ${JSON.stringify(body)}`).toBe(500)
  })

  /**
   * GERÇEK PRODUCTION HATASI (2026-10-03, ikinci doğrulama turunda bulundu —
   * KURAL-12'nin kendisi 409 dönüyor diye "hiçbir yan etkisi yok" varsayımı YANLIŞTI,
   * bu varsayım ilk turda test edilmemişti). `TravelService.CreateAsync`:
   *   1. Travel.Create(...) + uow.Travels.AddAsync(...) + SaveChangesAsync() [SATIR YAZILIR]
   *   2. AssignBusesAsync(...) → CAPACITY_EXCEEDS_BUS burada fırlatılır
   * Adım 2'deki istisna adım 1'deki SaveChanges'i GERİ ALMAZ (ayrı bir transaction/
   * SaveChanges çağrısı, EF Core otomatik rollback yapmaz). Sonuç: istemci 409
   * ("oluşturulamadı") görür ama sunucuda busId'siz, orijinal (geçersiz) kapasiteyle
   * GERÇEK bir Travel satırı kalıcı olarak oluşur — HTTP durum kodu ile DB durumu
   * arasında bir sözleşme ihlali.
   *
   * Kanıt: izole curl ile 3 kez bağımsız tekrar üretildi — her CAPACITY_EXCEEDS_BUS
   * 409'undan sonra `GET /travels?routeId=...` sorgusu fazladan bir satır gösterdi.
   * Bu sızıntı, önceki oturumda KURAL-12'nin bu satırı hiç temizlememesi yüzünden
   * gerçek DB'de QA-TRVKURAL kalıntıları (kategori+rota+sefer, 3 ayrı kombine suite
   * koşumunda 3 kez) biriktirdi — canlı API sorgusuyla doğrulandı, debug script'iyle
   * kök sebep TravelService.cs kaynak koduna kadar izlendi.
   *
   * Bu KARAKTERİZASYON testidir: mevcut (hatalı) davranışı kanıtlar. Düzeltme (muhtemel:
   * AssignBusesAsync'i SaveChanges'ten ÖNCE, ya da tüm CreateAsync'i tek bir transaction
   * içine almak) uygulandığında, orphan satır artık oluşmayacağı için
   * `expect(orphanCount).toBe(1)` → `toBe(0)` olarak güncellenmelidir.
   */
  test('KURAL-20 (BİLİNEN HATA): CAPACITY_EXCEEDS_BUS (409) dönmesine rağmen sunucuda bir Travel satırı GERÇEKTEN oluşuyor (transaction sınırı hatası)', async () => {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const before = await apiCtx.get(`${API_BASE}/travels?routeId=${routeId}&limit=500`, { headers })
    const beforeIds = new Set<string>((((await before.json()).data?.items) ?? []).map((t: { id: string }) => t.id))

    const { res, body } = await postTravel({ busIds: [busId], capacity: busCapacity + 777 })
    expect(res.status(), JSON.stringify(body)).toBe(409)
    expect(body.errorCode).toBe('CAPACITY_EXCEEDS_BUS')

    const after = await apiCtx.get(`${API_BASE}/travels?routeId=${routeId}&limit=500`, { headers })
    const afterItems: Array<{ id: string }> = ((await after.json()).data?.items) ?? []
    const orphans = afterItems.filter((t) => !beforeIds.has(t.id))
    // DOĞRU/BEKLENEN davranış: 409 dönüyorsa DB'de HİÇBİR YENİ satır olmamalıydı (orphans.length === 0).
    // GERÇEKTE: SaveChangesAsync rollback edilmediği için tam olarak 1 orphan satır oluşuyor.
    expect(orphans.length, `Beklenen: production hatası nedeniyle 1 orphan satır. Bulunan: ${JSON.stringify(orphans)}`).toBe(1)
    createdTravelIds.push(orphans[0].id)
  })

  /**
   * GERÇEK PRODUCTION HATASI — KURAL-20'DEN DAHA CİDDİ (2026-10-03, üçüncü doğrulama
   * turunda bulundu — KURAL-20 yalnız CREATE'i (yeni, henüz kullanıcıya görünmeyen bir
   * satır) etkiliyor sanılmıştı; UPDATE'in de aynı kalıba sahip olup olmadığı test
   * edilmemişti). `TravelService.UpdateAsync` da aynı sıraya sahip:
   *   1. travel.Update(...) + uow.Travels.Update(...) + SaveChangesAsync() [TÜM ALANLAR YAZILIR]
   *   2. AssignBusesAsync(...) → CAPACITY_EXCEEDS_BUS/TRAVEL_BUS_NOT_FOUND burada fırlatılabilir
   * Adım 2'deki istisna adım 1'i GERİ ALMAZ. KURAL-20'den farklı olarak bu MEVCUT,
   * GERÇEK (muhtemelen zaten yayında/kullanımda olan) bir Travel kaydını etkiler —
   * istemci 409 ("güncellenemedi, eski haliyle kaldı" varsayımıyla) görür, ama
   * GERÇEKTE kontenjan, iptal süresi, tarihler gibi İLGİSİZ alanlar bile SESSİZCE
   * kalıcı olarak değişmiş olur. Bu CREATE'teki orphan-satır sorunundan daha ciddidir:
   * veri bütünlüğü açısından "sessiz kısmi güncelleme" (silent partial write) — kullanıcı
   * hata mesajını görüp "değişiklik uygulanmadı" varsayar, ama DB'de bazı alanlar
   * değişmiş olabilir.
   *
   * Kanıt: izole curl ile tekrar üretildi — kontenjan=10, iptal süresi=24 olan bir Travel'a
   * PUT ile kontenjan=25 (araç kapasitesini aşan) + iptal süresi=99 gönderildi, yanıt 409
   * CAPACITY_EXCEEDS_BUS oldu, ama GET ile tekrar okunduğunda kontenjan=25 VE iptal
   * süresi=99 olarak GERÇEKTEN değişmiş bulundu (busCount beklendiği gibi 0 kaldı —
   * yalnız AssignBusesAsync'in kendisi atlanıyor, travel.Update() öncesi uygulanan TÜM
   * diğer alanlar kalıcılaşıyor).
   *
   * Bu KARAKTERİZASYON testidir: mevcut (hatalı) davranışı kanıtlar. Düzeltme (muhtemel:
   * UpdateAsync'i de KURAL-20'deki gibi tek transaction'a almak) uygulandığında test
   * KIRILIR — o zaman cancellationDeadlineHours'ın GÜNCELLENMEMİŞ (eski) değerde
   * kaldığını doğrulayacak şekilde güncellenmelidir.
   */
  test('KURAL-21 (BİLİNEN HATA, KURAL-20\'den DAHA CİDDİ): PUT /travels CAPACITY_EXCEEDS_BUS (409) ile başarısız olsa bile araç DIŞINDAKİ alanlar (kontenjan, iptal süresi) sessizce GERÇEKTEN güncelleniyor', async () => {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const { res: createRes, body: created } = await postTravel({ busIds: [], capacity: 5, cancellationDeadlineHours: 24, isActive: false })
    expect(createRes.status(), JSON.stringify(created)).toBe(201)
    createdTravelIds.push(created.data.id)

    const updateRes = await apiCtx.put(`${API_BASE}/travels/${created.data.id}`, {
      headers, data: baseTravelPayload(routeId, { busIds: [busId], capacity: busCapacity + 777, cancellationDeadlineHours: 99, isActive: false }),
    })
    const updateBody = await updateRes.json().catch(() => ({}))
    expect(updateRes.status(), JSON.stringify(updateBody)).toBe(409)
    expect(updateBody.errorCode).toBe('CAPACITY_EXCEEDS_BUS')

    const reread = await apiCtx.get(`${API_BASE}/travels/${created.data.id}`, { headers })
    const rereadBody = await reread.json()
    // DOĞRU/BEKLENEN davranış: 409 dönüyorsa HİÇBİR alan değişmemiş olmalıydı (eski
    // değerler: capacity=5, cancellationDeadlineHours=24).
    // GERÇEKTE: her ikisi de YENİ (geçersiz/reddedilen) değerlere sessizce güncellenmiş durumda.
    expect(rereadBody.data.capacity, 'production hatası: capacity sessizce güncellenmiş olmalı').toBe(busCapacity + 777)
    expect(rereadBody.data.cancellationDeadlineHours, 'production hatası: cancellationDeadlineHours sessizce güncellenmiş olmalı').toBe(99)
    expect(rereadBody.data.busCount, 'AssignBusesAsync atlandığı için araç ataması uygulanmamış olmalı').toBe(0)
  })

  /**
   * KURAL-21'in İKİNCİ TETİKLEYİCİSİ (2026-10-03, dördüncü doğrulama turunda bulundu —
   * KURAL-21 yalnız CAPACITY_EXCEEDS_BUS (409) ile doğrulanmıştı; AssignBusesAsync'in
   * fırlatabileceği İKİNCİ hata yolu olan TRAVEL_BUS_NOT_FOUND (404, var olmayan busId)
   * ile de aynı sessiz-kısmi-güncelleme olup olmadığı test edilmemişti). İzole curl ile
   * doğrulandı: aynı kök sebep (AssignBusesAsync, hangi istisnayı fırlatırsa fırlatsın,
   * önceki SaveChangesAsync'i geri almıyor) — kontenjan=10 olan bir Travel'a var olmayan
   * bir busId + kontenjan=77 + iptal süresi=88 ile PUT gönderildiğinde yanıt 404
   * TRAVEL_BUS_NOT_FOUND oldu, ama GET'te kontenjan=77 VE iptal süresi=88 olarak
   * GERÇEKTEN değişmiş bulundu — KURAL-21 ile birebir aynı sonuç, farklı hata kodu.
   *
   * Bu KARAKTERİZASYON testidir. KURAL-21 ile AYNI düzeltme (UpdateAsync'i tek
   * transaction'a almak) her iki testi de aynı anda KIRACAK ve pozitif beklentiye
   * (hiçbir alan değişmemeli) çevrilmesi gerekecektir.
   */
  test('KURAL-22 (BİLİNEN HATA, KURAL-21 ile AYNI KÖK SEBEP): PUT /travels TRAVEL_BUS_NOT_FOUND (404) ile başarısız olsa bile araç DIŞINDAKİ alanlar sessizce GERÇEKTEN güncelleniyor', async () => {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const { res: createRes, body: created } = await postTravel({ busIds: [], capacity: 6, cancellationDeadlineHours: 48, isActive: false })
    expect(createRes.status(), JSON.stringify(created)).toBe(201)
    createdTravelIds.push(created.data.id)

    const fakeBusId = '11111111-2222-3333-4444-555555555555'
    const updateRes = await apiCtx.put(`${API_BASE}/travels/${created.data.id}`, {
      headers, data: baseTravelPayload(routeId, { busIds: [fakeBusId], capacity: 123, cancellationDeadlineHours: 111, isActive: false }),
    })
    const updateBody = await updateRes.json().catch(() => ({}))
    expect(updateRes.status(), JSON.stringify(updateBody)).toBe(404)
    expect(updateBody.errorCode).toBe('TRAVEL_BUS_NOT_FOUND')

    const reread = await apiCtx.get(`${API_BASE}/travels/${created.data.id}`, { headers })
    const rereadBody = await reread.json()
    // DOĞRU/BEKLENEN davranış: 404 dönüyorsa HİÇBİR alan değişmemiş olmalıydı (eski
    // değerler: capacity=6, cancellationDeadlineHours=48).
    // GERÇEKTE: her ikisi de YENİ (geçersiz/reddedilen) değerlere sessizce güncellenmiş durumda.
    expect(rereadBody.data.capacity, 'production hatası: capacity sessizce güncellenmiş olmalı').toBe(123)
    expect(rereadBody.data.cancellationDeadlineHours, 'production hatası: cancellationDeadlineHours sessizce güncellenmiş olmalı').toBe(111)
    expect(rereadBody.data.busCount, 'AssignBusesAsync atlandığı için araç ataması uygulanmamış olmalı').toBe(0)
  })

  /**
   * ÜÇÜNCÜ ETKİLENEN UÇ NOKTA — AYNI KÖK SEBEP (2026-10-03, beşinci doğrulama
   * turunda bulundu — yalnız CreateAsync/UpdateAsync denetlenmişti, TravelService'teki
   * DİĞER tüm mutating metodlar [DeleteAsync, RestoreAsync, PermanentDeleteAsync,
   * ToggleStatusAsync] tek SaveChangesAsync kullandığı için güvenli bulundu, ama
   * CopyAsync atlanmıştı). `TravelService.CopyAsync`:
   *   1. Travel.Create(...) (kopya) + AddAsync + SaveChangesAsync() [KOPYA SATIRI YAZILIR]
   *   2. (CloneBuses=false ise) AssignBusesAsync(copy, sourceBusIds, ct) → kaynağın
   *      otobüsleri kopyaya atanmaya çalışılır; CAPACITY_EXCEEDS_BUS/TRAVEL_BUS_NOT_FOUND
   *      burada fırlatılabilir (ör. kaynağın atandığı andan beri otobüs kapasitesi
   *      küçültülmüş veya otobüs silinmiş olabilir)
   * Adım 2'deki istisna adım 1'i GERİ ALMAZ — KURAL-20 ile birebir aynı kalıp, farklı
   * bir API uç noktasında (POST /travels/{id}/copy).
   *
   * Kanıt: izole curl ile üretildi — kaynak sefer (kontenjan=5, otobüs kapasitesi=5
   * ile atanmış) için otobüs kapasitesi sonradan 2'ye düşürüldü, ardından CloneBuses=false
   * ile kopyalama denendi. Yanıt 409 CAPACITY_EXCEEDS_BUS oldu, ama `GET
   * /travels?routeId=...` sorgusu kopya tarihleriyle (2026-11-01) eşleşen, busCount=0
   * olan GERÇEK bir ekstra satır gösterdi — tıpkı KURAL-20'deki gibi.
   *
   * Bu KARAKTERİZASYON testidir. Düzeltme (CopyAsync'i de tek transaction'a almak)
   * uygulandığında test KIRILIR — o zaman `orphans.length` beklentisi `1`'den `0`'a
   * çevrilmelidir.
   */
  test('KURAL-23 (BİLİNEN HATA, KURAL-20 ile AYNI KÖK SEBEP — FARKLI UÇ NOKTA): POST /travels/{id}/copy CAPACITY_EXCEEDS_BUS (409) ile başarısız olsa bile sunucuda bir kopya Travel satırı GERÇEKTEN oluşuyor', async () => {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const smallBus = await createTravelBus(apiCtx, token, uniq('QA-TRVKURAL-COPYBUS'), 5)
    const { res: srcRes, body: src } = await postTravel({ busIds: [smallBus.id], capacity: 5, reserveCapacity: 0 })
    expect(srcRes.status(), JSON.stringify(src)).toBe(201)
    createdTravelIds.push(src.data.id)

    // Kaynak atandıktan SONRA otobüs kapasitesini kaynağın kontenjanının altına düşür —
    // kopyalama anında AssignBusesAsync'in CAPACITY_EXCEEDS_BUS fırlatmasını garantiler.
    const shrinkRes = await apiCtx.put(`${API_BASE}/travel-buses/${smallBus.id}`, {
      headers, data: { name: smallBus.name, plateNumber: null, templateId: '', seatStates: {}, vehicleType: 'capacity', capacity: 2 },
    })
    expect(shrinkRes.ok(), await shrinkRes.text()).toBeTruthy()

    const before = await apiCtx.get(`${API_BASE}/travels?routeId=${routeId}&limit=500`, { headers })
    const beforeIds = new Set<string>((((await before.json()).data?.items) ?? []).map((t: { id: string }) => t.id))

    const copyRes = await apiCtx.post(`${API_BASE}/travels/${src.data.id}/copy`, {
      headers, data: { startDate: futureIso(30), endDate: futureIso(31), registrationStartDate: futureIso(1), registrationEndDate: futureIso(29), cloneBuses: false },
    })
    const copyBody = await copyRes.json().catch(() => ({}))
    expect(copyRes.status(), JSON.stringify(copyBody)).toBe(409)
    expect(copyBody.errorCode).toBe('CAPACITY_EXCEEDS_BUS')

    const after = await apiCtx.get(`${API_BASE}/travels?routeId=${routeId}&limit=500`, { headers })
    const afterItems: Array<{ id: string }> = ((await after.json()).data?.items) ?? []
    const orphans = afterItems.filter((t) => !beforeIds.has(t.id))
    // DOĞRU/BEKLENEN davranış: 409 dönüyorsa DB'de HİÇBİR YENİ (kopya) satır olmamalıydı.
    // GERÇEKTE: tam olarak 1 orphan kopya satırı oluşuyor (busCount=0, kontenjan kaynaktan miras).
    expect(orphans.length, `Beklenen: production hatası nedeniyle 1 orphan kopya satırı. Bulunan: ${JSON.stringify(orphans)}`).toBe(1)
    createdTravelIds.push(orphans[0].id)
    await deleteWithRetry(apiCtx, `${API_BASE}/travel-buses/${smallBus.id}`, headers)
  })

  /**
   * KURAL-23'ÜN GENİŞ VARYANTI — CloneBuses=true (2026-10-03, altıncı doğrulama
   * turunda bulundu — KURAL-23 yalnız CloneBuses=false'u test etmişti, CloneBuses=true
   * dalının AYRICA kendi otobüs-klonlama adımı için ayrı bir SaveChangesAsync yaptığı
   * ve bunun da aynı sorunu daha geniş kapsamda tetiklediği test edilmemişti).
   * `TravelService.CopyAsync`, `CloneBuses=true` olduğunda:
   *   1. Travel.Create(...) (kopya) + AddAsync + SaveChangesAsync() [KOPYA SEFER YAZILIR]
   *   2. Her kaynak otobüs için TravelBus.Create(...) (klon) + AddAsync, SONRA TOPLU
   *      SaveChangesAsync() [TÜM KLON OTOBÜSLER YAZILIR — kaynak otobüs kapasitesini
   *      aynen miras alırlar, kaynak sonradan küçültülmüş olsa bile]
   *   3. AssignBusesAsync(copy, klonların ID'leri, ct) → toplam klon kapasitesi
   *      kopyanın kontenjanından küçükse CAPACITY_EXCEEDS_BUS burada fırlatılır
   * Adım 3'teki istisna NE adım 1'i NE adım 2'yi geri alır. Sonuç: istemci 409 görür
   * ama sunucuda GERÇEK bir kopya Travel satırı VE GERÇEK, hiçbir seferle ilişkilendirilmemiş
   * (yetim) klon otobüs satırları kalıcı olarak oluşur — KURAL-23'ten daha geniş bir
   * kalıntı yüzeyi.
   *
   * Kanıt: izole curl ile üretildi — iki otobüslü (kapasite 5+5=10) bir kaynak sefer,
   * kontenjan=10. Bir otobüsün kapasitesi 1'e düşürüldü (klon toplamı artık 1+5=6 < 10).
   * CloneBuses=true ile kopyalama denendi, yanıt 409 CAPACITY_EXCEEDS_BUS oldu. Ardından
   * `GET /travel-buses?search=...` sorgusu, `sourceBusId` dolu ve `travelName=null`
   * (hiçbir sefere bağlı değil) İKİ GERÇEK klon otobüs satırı gösterdi — kaynak
   * otobüslerin (1 ve 5 kapasiteli) birebir kopyaları.
   *
   * Bu KARAKTERİZASYON testidir. Düzeltme (CopyAsync'in tüm adımlarını — kopya seferi,
   * klon otobüsleri ve atamayı — tek transaction'a almak) uygulandığında test KIRILIR —
   * o zaman hem orphan sefer hem orphan klon otobüs sayısının `0` olduğu doğrulanmalıdır.
   */
  test('KURAL-24 (BİLİNEN HATA, KURAL-23\'ÜN GENİŞ VARYANTI): POST /travels/{id}/copy CloneBuses=true + CAPACITY_EXCEEDS_BUS (409) ile başarısız olsa bile sunucuda GERÇEK bir kopya Travel satırı VE GERÇEK yetim klon otobüs satırları oluşuyor', async () => {
    const headers = { Authorization: `Bearer ${await adminToken(apiCtx)}` }
    const tag2 = uniq('QA-TRVKURAL-CLONE2BUS')
    const bus1 = await createTravelBus(apiCtx, token, `${tag2}-1`, 5)
    const bus2 = await createTravelBus(apiCtx, token, `${tag2}-2`, 5)
    const { res: srcRes, body: src } = await postTravel({ busIds: [bus1.id, bus2.id], capacity: 10, reserveCapacity: 0 })
    expect(srcRes.status(), JSON.stringify(src)).toBe(201)
    createdTravelIds.push(src.data.id)
    expect(src.data.busCount).toBe(2)

    // Kaynak atandıktan SONRA bus1'in kapasitesini küçült — klon toplamı (1+5=6) artık
    // kopyanın kontenjanının (10) altında kalacak, AssignBusesAsync'in CAPACITY_EXCEEDS_BUS
    // fırlatmasını garantiler.
    const shrinkRes = await apiCtx.put(`${API_BASE}/travel-buses/${bus1.id}`, {
      headers, data: { name: bus1.name, plateNumber: null, templateId: '', seatStates: {}, vehicleType: 'capacity', capacity: 1 },
    })
    expect(shrinkRes.ok(), await shrinkRes.text()).toBeTruthy()

    const beforeTravels = await apiCtx.get(`${API_BASE}/travels?routeId=${routeId}&limit=500`, { headers })
    const beforeTravelIds = new Set<string>((((await beforeTravels.json()).data?.items) ?? []).map((t: { id: string }) => t.id))

    const copyRes = await apiCtx.post(`${API_BASE}/travels/${src.data.id}/copy`, {
      headers, data: { startDate: futureIso(32), endDate: futureIso(33), registrationStartDate: futureIso(1), registrationEndDate: futureIso(31), cloneBuses: true },
    })
    const copyBody = await copyRes.json().catch(() => ({}))
    expect(copyRes.status(), JSON.stringify(copyBody)).toBe(409)
    expect(copyBody.errorCode).toBe('CAPACITY_EXCEEDS_BUS')

    const afterTravels = await apiCtx.get(`${API_BASE}/travels?routeId=${routeId}&limit=500`, { headers })
    const afterTravelItems: Array<{ id: string }> = ((await afterTravels.json()).data?.items) ?? []
    const orphanTravels = afterTravelItems.filter((t) => !beforeTravelIds.has(t.id))
    // DOĞRU/BEKLENEN davranış: 409 dönüyorsa yeni kopya seferi OLUŞMAMALIYDI.
    expect(orphanTravels.length, `Beklenen: production hatası nedeniyle 1 orphan kopya seferi. Bulunan: ${JSON.stringify(orphanTravels)}`).toBe(1)
    createdTravelIds.push(orphanTravels[0].id)

    const busSearch = await apiCtx.get(`${API_BASE}/travel-buses?limit=500&search=${encodeURIComponent(tag2)}`, { headers })
    const busItems: Array<{ id: string; sourceBusId: string | null; capacity: number }> = ((await busSearch.json()).data?.items) ?? []
    const orphanClones = busItems.filter((b) => b.sourceBusId === bus1.id || b.sourceBusId === bus2.id)
    // DOĞRU/BEKLENEN davranış: 409 dönüyorsa hiçbir klon otobüs OLUŞMAMALIYDI (orphanClones.length === 0).
    // GERÇEKTE: AssignBusesAsync öncesi klonlama adımı zaten SaveChangesAsync yapmış olduğundan
    // tam olarak 2 yetim klon otobüs (kaynak otobüs sayısı kadar) kalıcı oluşuyor.
    expect(orphanClones.length, `Beklenen: production hatası nedeniyle 2 yetim klon otobüs. Bulunan: ${JSON.stringify(orphanClones)}`).toBe(2)
    for (const clone of orphanClones) await deleteWithRetry(apiCtx, `${API_BASE}/travel-buses/${clone.id}`, headers)
    await deleteWithRetry(apiCtx, `${API_BASE}/travel-buses/${bus1.id}`, headers)
    await deleteWithRetry(apiCtx, `${API_BASE}/travel-buses/${bus2.id}`, headers)
  })
})
