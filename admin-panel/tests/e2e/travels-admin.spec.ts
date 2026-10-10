import { test, expect, request as pwRequest, APIRequestContext, Page } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

type Created = { id: string; name?: string; fullName?: string }
type AttendanceRoster = { items: Array<{ passengerId: string; fullName: string; status: string; seatNumber?: string }> }
type BoardingManifest = Array<{ busId: string; busName: string; passengers: Array<{ personName: string; seatNumber?: string }> }>

let ctx: APIRequestContext
let adminToken = ''
let fixture: Awaited<ReturnType<typeof setupTravelFixture>> | undefined

// NOT (2026-09-05, orphan-data bug bulundu ve düzeltildi): bu dosya daha önce hiçbir
// temizlik yapmıyordu — her koşu 5-8 yeni travel-route/travel/travel-bus/travel-category
// kaydı bırakıyordu (bu oturumda 26 route + 26 travel + 34 bus + 26 kategori orphan
// birikmiş, API üzerinden silinip doğrulandı). Artık oluşturulan her kayıt burada
// izleniyor ve afterAll'da bağımlılık sırasına göre (travel → route/bus/category →
// participant) siliniyor.
const createdTravelIds: string[] = []
const createdRouteIds: string[] = []
const createdBusIds: string[] = []
const createdCategoryIds: string[] = []
const createdParticipantIds: string[] = []

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

function futureIso(days: number) {
  // NOT: d.toISOString() her zaman UTC'ye çevirir. TR saatinde gece 00:00-03:00
  // arası (TR ileride, UTC'de hâlâ bir önceki gün) çalıştırıldığında bu UTC çevrimi
  // yanlışlıkla bir gün ÖNCEKİ tarihi üretiyordu (canlı kanıt: TR 27 Ağustos 00:01'de
  // çalışan futureIso(0) "2026-08-26" döndürdü, API bunu haklı olarak PAST_DATE ile
  // reddetti). TR yerel takvim gününü doğrudan (Intl ile, UTC çevrimi olmadan) al.
  const d = new Date()
  d.setDate(d.getDate() + days)
  const trDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  return trDate
}

function fakeTckn() {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  const d10 = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7 - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
  const d10Pos = ((d10 % 10) + 10) % 10
  const d11 = (digits.reduce((sum, d) => sum + d, 0) + d10Pos) % 10
  return [...digits, d10Pos, d11].join('')
}

async function freshAdminToken(): Promise<string> {
  const login1 = await (await ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (login1?.data?.accessToken) { adminToken = login1.data.accessToken; return adminToken }
  const verify = await (await ctx.post(`${API_BASE}/auth/verify-otp`, { data: { otpSessionToken: login1.data.otpSessionToken, code: ADMIN_OTP } })).json()
  adminToken = verify?.data?.accessToken ?? ''
  if (!adminToken) throw new Error(`Admin API OTP failed: ${JSON.stringify(verify)}`)
  return adminToken
}

async function loginPageWithFreshApiSession(page: Page, path: string) {
  const login1 = await (await ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  const auth = login1?.data?.accessToken
    ? login1.data
    : (await (await ctx.post(`${API_BASE}/auth/verify-otp`, { data: { otpSessionToken: login1.data.otpSessionToken, code: ADMIN_OTP } })).json()).data
  if (!auth?.accessToken || !auth?.refreshToken) throw new Error(`Admin UI API auth failed: ${JSON.stringify(auth)}`)
  adminToken = auth.accessToken
  await page.goto('/login')
  await page.evaluate(({ accessToken, refreshToken }) => {
    sessionStorage.setItem('admin_access_token', accessToken)
    sessionStorage.setItem('admin_refresh_token', refreshToken)
  }, { accessToken: auth.accessToken, refreshToken: auth.refreshToken })
  await page.goto(path)
  await expect(page).not.toHaveURL(/\/login/)
}

async function apiRequest<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, retried = false): Promise<T> {
  const token = adminToken || await freshAdminToken()
  const res = await ctx.fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status() === 401 && !retried) {
    await freshAdminToken()
    return apiRequest(method, path, body, true)
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok()) throw new Error(`${method} ${path} failed ${res.status()}: ${JSON.stringify(json)}`)
  return json.data as T
}

async function createCategory(name = uniq('E2E Gezi Kategori')) {
  const c = await apiRequest<Created>('POST', '/travel-categories', { name, description: 'Playwright gezi kategorisi', color: '#d97706', isActive: true })
  createdCategoryIds.push(c.id)
  return c
}

async function createBus(name = uniq('E2E Otobüs')) {
  const b = await apiRequest<Created>('POST', '/travel-buses', { name, plateNumber: `34 E2E ${String(Date.now()).slice(-3)}`, templateId: 'standard-46', seatStates: {} })
  createdBusIds.push(b.id)
  return b
}

async function createParticipant() {
  const tag = `${Date.now()}${Math.random().toString(16).slice(2, 6)}`
  const p = await apiRequest<Created>('POST', '/participants', {
    tckn: fakeTckn(), birthDate: '1995-06-15', phone: `05${String(Date.now()).slice(-9)}`,
    email: `e2e.travels.${tag}@example.com`, deliveryChannel: 'Email',
  })
  createdParticipantIds.push(p.id)
  return p
}

async function createTravelRoute(categoryId: string, name = uniq('E2E Gezi')) {
  const r = await apiRequest<Created>('POST', '/travel-routes', {
    name, categoryId, destination: 'Çanakkale', description: 'Playwright gezi açıklaması', conditions: 'E2E koşullar', internalNote: 'E2E iç not',
    gender: 'mixed', minAge: 18, maxAge: 75,
    restrictions: { residencyMode: 'anyone', sultangaziResidentOnly: false, allowOutsideSultangazi: true, requiresGuardianConsent: false, maxCompanions: 0, documentRequired: false },
    images: { web: {}, mobile: {}, ratios: {}, photos: [] },
    pricing: { isPaid: false, currency: 'TRY', audiences: [], depositEnabled: false, depositAmount: 0, refundPolicy: 'partial' },
    points: { enabled: false, basePoints: 0 },
    isActive: true, sultangaziResidentOnly: false,
  })
  createdRouteIds.push(r.id)
  return r
}

async function createTravel(categoryId: string, busId: string, name = uniq('E2E Gezi')) {
  const route = await createTravelRoute(categoryId, name)
  const startDate = futureIso(0)
  const endDate = futureIso(2)
  const travel = await apiRequest<Created>('POST', '/travels', {
    routeId: route.id,
    startDate, endDate, registrationStartDate: futureIso(-10), registrationEndDate: futureIso(1),
    capacity: 40, reserveCapacity: 5, participationPeriod: 'none', participationLimit: 0, cancellationDeadlineHours: 24,
    crew: { driver: { id: '', name: 'E2E Şoför', phone: '05000000000', tckn: fakeTckn() }, guide: { id: '', name: 'E2E Rehber', phone: '05000000001' }, responsible: { id: '', name: '', role: '', roleKey: '', phone: '', email: '', emergencyPhone: '', grantAccess: false, tckn: '' } },
    busIds: [busId], isActive: true,
  })
  createdTravelIds.push(travel.id)
  // UI/asserting testleri route içeriğine (isim/hedef) bağlı; Travel'a denormalize edilmiş
  // olarak da geldiği için travel.name/route.name aynıdır — testler travel objesini kullanır.
  return { ...travel, name: route.name } as Created
}

async function setupTravelFixture() {
  const category = await createCategory()
  const bus = await createBus()
  const travel = await createTravel(category.id, bus.id)
  const participant = await createParticipant()
  const application = await apiRequest<Created>('POST', '/travel-applications', {
    travelId: travel.id, participantId: participant.id, status: 'approved', documentStatus: 'complete', paymentStatus: 'waived',
    busId: bus.id, seatNumber: '1', notes: 'E2E onaylı başvuru',
    emergencyContactName: null, emergencyContactPhone: null, passengers: null,
  })
  return { category, bus, travel, participant, application }
}

test.describe('Travels admin panel — otobüs, biniş ve yoklama', () => {
  test.beforeAll(async () => { ctx = await pwRequest.newContext(); await freshAdminToken() })
  test.afterAll(async () => {
    // Silme sırası önemli: travel-routes/travel-buses, bağlı travel/başvuru varsa
    // 409 TRAVEL_ROUTE_IN_USE ile reddediyor — önce travels, sonra route/bus/category.
    for (const id of createdTravelIds) await apiRequest('DELETE', `/travels/${id}`).catch(() => {})
    for (const id of createdRouteIds) await apiRequest('DELETE', `/travel-routes/${id}`).catch(() => {})
    for (const id of createdBusIds) await apiRequest('DELETE', `/travel-buses/${id}`).catch(() => {})
    for (const id of createdCategoryIds) await apiRequest('DELETE', `/travel-categories/${id}`).catch(() => {})
    for (const id of createdParticipantIds) await apiRequest('DELETE', `/participants/${id}`).catch(() => {})
    await ctx.dispose()
  })

  test('otobüs yönetiminde koltuk şablonlu otobüs oluşturur', async ({ page }) => {
    test.setTimeout(90000)
    const name = uniq('E2E UI Otobüs')
    const plate = `34 TST ${String(Date.now()).slice(-3)}`
    await loginPageWithFreshApiSession(page, '/travels?tab=buses')
    await expect(page.getByText('Araç Yönetimi').first()).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Araç' }).click()
    await page.getByPlaceholder('Örn: 1 Numaralı Otobüs').fill(name)
    await page.getByPlaceholder('34 ABC 123').fill(plate)
    await expect(page.getByText('Koltuk Düzeni')).toBeVisible()
    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/travel-buses') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kaydet' }).click(),
    ])
    expect(createResponse.ok(), `POST /travel-buses başarısız: ${createResponse.status()}`).toBeTruthy()
    const createdBus = await createResponse.json().catch(() => null)
    if (createdBus?.data?.id) createdBusIds.push(createdBus.data.id)
    await page.getByPlaceholder('Araç adı, plaka veya şoför ara...').fill(name)
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(plate).first()).toBeVisible()
  })

  test('geziyi API ile oluşturur ve admin geziler sekmesinde listeler', async ({ page }) => {
    test.setTimeout(90000)
    const category = await createCategory()
    const bus = await createBus()
    const travel = await createTravel(category.id, bus.id, uniq('E2E UI Gezi'))

    await loginPageWithFreshApiSession(page, '/travels?tab=travels')
    await expect(page.getByText('Geziler').first()).toBeVisible({ timeout: 20000 })
    await page.getByPlaceholder('Gezi adı veya hedef ara...').fill(travel.name!)
    await expect(page.getByText(travel.name!).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('Çanakkale').first()).toBeVisible()
  })

  test('gerçek başvuru ile biniş listesini gösterir', async ({ page }) => {
    test.setTimeout(90000)
    fixture = fixture ?? await setupTravelFixture()
    const manifest = await apiRequest<BoardingManifest>('GET', `/travels/${fixture.travel.id}/boarding/manifest`)
    expect(manifest[0]?.passengers.length, 'Biniş manifest yolcusu').toBeGreaterThan(0)

    // NOT (2026-09-05, gerçek testte bulunan mimari değişiklik): Kullanıcı isteği
    // (2026-08-05, TravelPassengerListModal içindeki not) ile ayrı `tab=boarding`
    // sekmesi/URL'i kaldırıldı — TravelsPage artık sadece 6 sekme sunuyor
    // (Başvurular/Geziler/Araç Yönetimi/Kategoriler/Raporlar/Genel Ayarlar).
    // Yolcu listesi artık "Geziler" sekmesindeki "Kayıtlı" sayısına tıklanınca
    // açılan TravelPassengerListModal üzerinden (Liste↔Araç görünüm anahtarlı,
    // export/yazdır seçenekli) gösteriliyor.
    await loginPageWithFreshApiSession(page, '/travels?tab=travels')
    // NOT: "Geziler" ana listesi aslında Gezi/Rota (RoutesTab) listesi — "Sefer Sayısı"/
    // "Aktif Sefer" sütunları var, "Kayıtlı" yok. Gezi adına tıklanınca (loadOne drill-down)
    // o Gezi'ye bağlı Seferler (TravelsTab, "Kayıtlı" sütunlu) alt görünümde açılıyor.
    await page.getByPlaceholder('Gezi adı veya hedef ara...').fill(fixture.travel.name!)
    await page.getByRole('button', { name: fixture.travel.name! }).click()
    const row = page.locator('tr', { hasText: fixture.travel.name! }).first()
    await expect(row).toBeVisible({ timeout: 20000 })
    // NOT: Buton içeriği sadece rakam (registeredCount) olduğu için accessible name
    // "Yolcu listesini görüntüle" (title attribute) değil, görünen sayı metni oluyor.
    await row.locator('button[title="Yolcu listesini görüntüle"]').click()
    // NOT: Modal başlığı "Yolcu ve koltuk yönetimi" (alt başlık) — otobüs adı ise
    // "Araç Görünümü" sekmesinde gösteriliyor, varsayılan "Liste" sekmesinde değil.
    await expect(page.getByText('Yolcu ve koltuk yönetimi').first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(manifest[0].passengers[0].personName).first()).toBeVisible({ timeout: 20000 })
    await page.getByRole('button', { name: 'Araç Görünümü' }).click()
    await expect(page.getByText(fixture.bus.name!).first()).toBeVisible({ timeout: 20000 })
  })

  test('devamsızlık kaydını API ile kaydeder — frontend UI\'sı kaldırıldığı için sadece API doğrulanır', async ({}) => {
    test.setTimeout(90000)
    // NOT (2026-09-05, gerçek testte bulunan mimari boşluk): `/travels/{id}/attendance/*`
    // backend endpoint'leri hâlâ tam işlevsel (roster/save/reopen/export) ve bu test
    // bunu API üzerinden doğruluyor. AMA admin panelin frontend kodunda ("Yoklama",
    // "Gelmedi", "attendance" aramaları) HİÇBİR referans yok — eski `tab=attendance`
    // URL'i kaldırılmış, yerine gelen bir UI eklenmemiş. Bu, kullanılamaz (dead) bir
    // backend API yüzeyi — devamsızlık kaydı yapılabiliyor ama hiçbir admin ekranından
    // görüntülenemiyor/işaretlenemiyor. Backend'in kendisi çalıştığı için sadece API
    // katmanı doğrulanıyor; UI kısmı GERÇEKTEN mevcut değil (test-authoring hatası değil).
    fixture = fixture ?? await setupTravelFixture()
    const roster = await apiRequest<AttendanceRoster>('GET', `/travels/${fixture.travel.id}/attendance/roster`)
    const passenger = roster.items[0]
    expect(passenger?.passengerId, 'Yoklama yolcusu').toBeTruthy()
    await apiRequest('POST', `/travels/${fixture.travel.id}/attendance/save`, { marks: [{ passengerId: passenger.passengerId, status: 'absent' }] })

    const updatedRoster = await apiRequest<AttendanceRoster>('GET', `/travels/${fixture.travel.id}/attendance/roster`)
    const updatedPassenger = updatedRoster.items.find((i) => i.passengerId === passenger.passengerId)
    expect(updatedPassenger?.status, 'API üzerinden devamsız olarak işaretlenmeli').toBe('absent')
  })
})
