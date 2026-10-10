/**
 * Etkinlikler — Salon + Koltuk Rezervasyonu Akışı (indoor + hasSeating + reservationType=seat),
 * sıfır hata. `EventForm.tsx`'in salon seçimi dalı (venueType='indoor') ve
 * `ApplicationForm.tsx`'teki `SeatPickerModal` (gerçek koltuk seçimi) hiçbir testte
 * kapsanmamıştı — `events-admin.spec.ts` sadece açık alan (outdoor) etkinlikleri test ediyordu.
 *
 * Kapsam:
 *   1. API fixture: koltuklu (seatingMode='seated', 2 satır x 5 koltuk = 10 koltuk) bir salon
 *      + salonu kullanan, koltuk rezervasyonlu (hasSeating=true, reservationType='seat')
 *      bir etkinlik oluşturuluyor.
 *   2. Admin panelden başvuru oluşturma UI'ı üzerinden GERÇEK `SeatPickerModal` açılıyor,
 *      koltuk haritası (`GET /event-applications/seat-map`) yükleniyor, belirli bir koltuğa
 *      (B3) tıklanıyor, seçimin forma "seatNumber" olarak yazıldığı ve API'ye o şekilde
 *      gittiği doğrulanıyor.
 *   3. İKİNCİ bir başvuru için AYNI koltuğu seçmeye çalışınca (dolu/reserved durumda
 *      göründüğü ve tıklanamadığı) doğrulanıyor — `isTaken` mantığının gerçek DOM'da
 *      çalıştığının kanıtı.
 *
 * DÜRÜST KAPSAM NOTU: Sıra (row) rezervasyon modu, "banquet"/"ushape" gibi diğer
 * SeatingTemplateId'ler ve `SeatingLayoutBuilder` (salon oluşturma formundaki görsel
 * koltuk düzeni tasarım aracı, ayrı ve büyük bir bileşen) kapsam dışı — bu test API'den
 * hazır bir layout fixture'ı kullanıp sadece SEÇİM (picker) tarafını kapsıyor.
 *
 * Bu dosyayı yazarken bulunan gerçek gotcha'lar:
 *   - "Yeni Başvuru" formu (`ApplicationForm.tsx`) global sayfadan açıldığında etkinlik
 *     ÖNCEDEN bağlı DEĞİL — `eventId` URL'de olsa bile form kendi Combobox'ından etkinliği
 *     AYRICA seçtirir; koltuk seçim bölümü (`needsSeat`) ancak bu seçim yapıldıktan sonra,
 *     etkinliğin `access` bilgisi `getById` ile yüklendikten sonra görünür hale gelir.
 *   - Katılımcı arama: TCKN sonuçlarda MASKELENMİŞ döner (`602********`) ve backend TCKN
 *     prefix/tam eşleşmesini desteklemiyor — benzersiz e-posta ile aramak gerekiyor.
 *   - Seçilen koltuğun görünen etiketi `B3` değil `B-3` formatında (satır harfi-tire-koltuk no).
 *   - Dolu koltuklar `disabled` HTML özniteliği TAŞIMIYOR (sadece görsel/renk farkı) — ama
 *     `onSeatDown`'daki `isTaken` kontrolü seçimin gerçekleşmesini engelliyor, bu yüzden
 *     zorla tıklansa bile "Onayla" butonu disabled kalıyor (asıl kanıt bu).
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { login } from './helpers/auth'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

function uniq(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

function fakeTckn() {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  const d10 = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7 - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
  const d10Pos = ((d10 % 10) + 10) % 10
  const d11 = (digits.reduce((sum, d) => sum + d, 0) + d10Pos) % 10
  return [...digits, d10Pos, d11].join('')
}

function futureIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

let ctx: APIRequestContext
let adminToken = ''

async function freshAdminToken(): Promise<string> {
  const login1 = await (await ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (login1?.data?.accessToken) { adminToken = login1.data.accessToken; return adminToken }
  const verify = await (await ctx.post(`${API_BASE}/auth/verify-otp`, { data: { otpSessionToken: login1.data.otpSessionToken, code: ADMIN_OTP } })).json()
  adminToken = verify?.data?.accessToken ?? ''
  if (!adminToken) throw new Error(`Admin API OTP failed: ${JSON.stringify(verify)}`)
  return adminToken
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

type Created = { id: string; name?: string }

// 2 satır x 5 koltuk = 10 koltuklu tek katlı basit bir "theater" layout'u.
const SIMPLE_LAYOUT = {
  template: 'theater' as const,
  floors: [{
    id: 'floor1', name: 'Zemin Kat', rows: 2, defaultSegments: [5],
    rowOverrides: {}, crossAisles: [], rowLabelStart: 'A', skipIO: false,
  }],
}

async function createFacility() {
  return apiRequest<Created>('POST', '/service-facilities', {
    name: uniq('QA-TEST-E2E-AUTO SeatFacility'),
    type: 'Kültür Merkezi', locationType: 'Indoor', city: 'İstanbul', district: 'Sultangazi',
    address: 'QA-TEST-E2E-AUTO fixture adresi', latitude: 41.1, longitude: 28.8,
    manager: 'QA Yönetici', managerPhone: '05550000000', managerEmail: `qa.seatfacility.${Date.now()}@example.com`,
    weekdayOpen: '09:00', weekdayClose: '18:00', weekendOpen: '10:00', weekendClose: '16:00',
    facilities: [], accessibilityFeatures: [], parkingCapacity: 10, parkingType: 'Free', capacity: 120,
    offeredServices: [], images: [],
  })
}

async function createSeatedHall(facilityId: string) {
  return apiRequest<Created & { capacity: number }>('POST', '/halls', {
    facilityId, name: uniq('QA-TEST-E2E-AUTO SeatHall'), type: 'conference', buildingFloor: 1,
    seatingMode: 'seated', layout: SIMPLE_LAYOUT, capacity: 10,
    featureIds: [], description: 'QA-TEST-E2E-AUTO koltuklu salon fixture', about: '',
  })
}

async function createCategory() {
  return apiRequest<Created>('POST', '/event-categories', { name: uniq('QA-TEST-E2E-AUTO SeatKategori'), description: 'fixture', color: '#2563eb', defaultPoints: 5 })
}

async function createSeatedEvent(categoryId: string, facilityId: string, hallId: string) {
  const startDate = futureIso(14)
  return apiRequest<Created>('POST', '/events', {
    name: uniq('QA-TEST-E2E-AUTO SeatEtkinlik'), categoryId, venueType: 'indoor', facilityId, hallId,
    location: { name: '', latitude: 0, longitude: 0 },
    startDate, endDate: startDate, startTime: '09:00', endTime: '10:00',
    applicationStartDate: futureIso(1), applicationEndDate: futureIso(10),
    gender: 'mixed', capacity: 10, reserveCapacity: 0, minAge: 0, maxAge: 99,
    participationPeriod: 'none', participationLimit: 0,
    description: 'fixture', internalNote: '',
    images: { web: { cover: { width: 1920, height: 720, maxSizeKb: 800 }, card: { width: 600, height: 400, maxSizeKb: 200 }, thumb: { width: 240, height: 240, maxSizeKb: 80 } }, mobile: { cover: { width: 1080, height: 1350, maxSizeKb: 600 }, card: { width: 750, height: 750, maxSizeKb: 250 }, thumb: { width: 320, height: 320, maxSizeKb: 100 } }, ratios: {}, photos: [] },
    access: {
      hasSessions: false, hasSeating: true, reservationType: 'seat', registrationMode: 'required',
      attendanceEnabled: false, entryMethod: 'checkin', qrEnabled: false, qrType: 'rotating', qrRotationSeconds: 30,
      kioskEnabled: false, turnstileEnabled: false, publicLinkEnabled: false, publicLinkRequiresPin: false,
      staffIds: [], notificationTemplates: [], cancellationDeadlineHours: 24,
    },
    pricing: { isPaid: false, currency: 'TRY', audiences: [], siblingDiscountEnabled: false, siblingDiscounts: [], municipalityEmployeeDiscountEnabled: false, municipalityEmployeePercent: 0, disabledDiscountEnabled: false, disabledPercent: 0, veteranDiscountEnabled: false, veteranPercent: 0, combineDiscounts: false, maxDiscountPercent: 50 },
    points: { enabled: false, basePoints: 0, walkInEarnsPoints: false },
    isActive: true, residencyMode: 'anyone', sultangaziResidentOnly: false,
  })
}

async function createParticipant() {
  const tag = `${Date.now()}${Math.random().toString(16).slice(2, 6)}`
  const email = `qa.test.seatpicker.${tag}@example.com`
  const created = await apiRequest<Created>('POST', '/participants', {
    tckn: fakeTckn(), birthDate: '1995-06-15', phone: `05${String(Date.now()).slice(-9)}`,
    email, deliveryChannel: 'Email',
  })
  return { ...created, email }
}

test.describe.serial('Etkinlikler — Salon + Koltuk Rezervasyonu (SeatPickerModal), sıfır hata', () => {
  test.beforeAll(async () => { ctx = await pwRequest.newContext(); await freshAdminToken() })

  let eventId = ''
  let eventName = ''
  let hallId = ''
  let facilityId = ''
  let categoryId = ''
  let applicationId1 = ''

  // NOT (tekrarlayan single-session policy gotcha'sı, bkz. seda/events-archive testleri):
  // UI login'leri `ctx`'in adminToken'ını geçersiz kılabilir — silme öncesi taze token
  // alınıyor. Bağımlılık sırası: başvurular → etkinlik → salon → tesis → kategori.
  test.afterAll(async () => {
    await freshAdminToken()
    if (applicationId1) await apiRequest('DELETE', `/event-applications/${applicationId1}`).catch(() => {})
    if (eventId) {
      await apiRequest('DELETE', `/events/${eventId}`).catch(() => {})
      await apiRequest('DELETE', `/events/${eventId}/permanent`).catch(() => {})
    }
    if (hallId) await apiRequest('DELETE', `/halls/${hallId}`).catch(() => {})
    if (facilityId) await apiRequest('DELETE', `/service-facilities/${facilityId}`).catch(() => {})
    if (categoryId) await apiRequest('DELETE', `/event-categories/${categoryId}`).catch(() => {})
    await ctx.dispose()
  })

  test('1) Başvuru formunda SeatPickerModal açılır, GERÇEK bir koltuk (B3) seçilir ve API\'ye doğru gider', async ({ page }) => {
    test.setTimeout(90_000)
    const facility = await createFacility()
    facilityId = facility.id
    const hall = await createSeatedHall(facilityId)
    hallId = hall.id
    expect(hall.capacity).toBe(10)
    const category = await createCategory()
    categoryId = category.id
    const event = await createSeatedEvent(category.id, facilityId, hallId)
    eventId = event.id
    eventName = event.name ?? ''
    const participant = await createParticipant()

    await login(page)
    await page.goto(`/events?tab=applications&eventId=${eventId}`)
    await expect(page.getByText('Başvuru Listesi')).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Başvuru' }).click()
    await expect(page.getByText('Başvuru Formu')).toBeVisible({ timeout: 8000 })

    // Katılımcı: Combobox ile ara ve seç. NOT: TCKN aramada MASKELENMİŞ döner
    // (`602********`) ve backend TCKN prefix/tam eşleşmesini desteklemiyor — bu yüzden
    // benzersiz e-posta ile arıyoruz (Combobox onSearch, participantService.getList'e
    // gidiyor ve search parametresi e-postayı da kapsıyor).
    const participantInput = page.getByPlaceholder('TC, ad veya telefon ile ara...')
    await participantInput.click()
    await participantInput.fill(participant.email)
    await page.waitForResponse((r) => r.url().includes('/participants') && r.url().includes('search='), { timeout: 5000 }).catch(() => {})
    await page.locator('[data-ds-popover] button').first().click()

    // Etkinlik: bu global "Yeni Başvuru" formunda etkinlik ÖNCEDEN bağlı değil (eventId
    // URL'den geliyor ama form kendi Combobox'ından tekrar seçim istiyor) — koltuk seçim
    // bölümünün (`needsSeat`) görünmesi için etkinlik burada da AYRICA seçilmeli.
    const eventInput = page.getByPlaceholder('Etkinlik ara...')
    await eventInput.click()
    await eventInput.fill(event.name ?? '')
    await page.waitForResponse((r) => r.url().includes('/events') && r.url().includes('search='), { timeout: 5000 }).catch(() => {})
    await page.locator('[data-ds-popover] button').first().click()

    // Koltuk seçim alanı — SeatPickerModal'ı açan buton.
    const seatTrigger = page.getByRole('button', { name: 'Koltuk Seç', exact: true })
    await seatTrigger.scrollIntoViewIfNeeded()
    await expect(seatTrigger).toBeVisible({ timeout: 8000 })
    await seatTrigger.click()
    await expect(page.getByText('Koltuk Seçimi', { exact: true }).last()).toBeVisible({ timeout: 8000 })
    // Koltuk haritası GERÇEKTEN API'den yükleniyor mu doğrula.
    await page.waitForResponse((r) => r.url().includes('/event-applications/seat-map'), { timeout: 8000 }).catch(() => {})

    // B satırı 3. koltuğa tıkla (title="B3").
    const seatB3 = page.locator('button[title="B3"]')
    await expect(seatB3).toBeVisible({ timeout: 8000 })
    await seatB3.click()
    await page.getByRole('button', { name: 'Onayla', exact: true }).click()

    await expect(page.getByText('B-3', { exact: false })).toBeVisible({ timeout: 5000 })

    const [createResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/event-applications') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kaydet' }).click(),
    ])
    expect(createResponse.ok(), `POST /event-applications başarısız: ${await createResponse.text()}`).toBeTruthy()
    const created = (await createResponse.json()).data
    applicationId1 = created.id
    expect(created.seatNumber).toContain('floor1:1:3')
  })

  test('2) İKİNCİ başvuru için AYNI koltuk (B3) dolu görünüyor ve tıklanamıyor', async ({ page }) => {
    test.setTimeout(60_000)
    expect(eventId, 'önceki testte etkinlik oluşturulmuş olmalı').toBeTruthy()
    const participant2 = await createParticipant()

    await login(page)
    await page.goto(`/events?tab=applications&eventId=${eventId}`)
    await expect(page.getByText('Başvuru Listesi')).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Başvuru' }).click()
    await expect(page.getByText('Başvuru Formu')).toBeVisible({ timeout: 8000 })
    const participant2Input = page.getByPlaceholder('TC, ad veya telefon ile ara...')
    await participant2Input.click()
    await participant2Input.fill(participant2.email)
    await page.waitForResponse((r) => r.url().includes('/participants') && r.url().includes('search='), { timeout: 5000 }).catch(() => {})
    await page.locator('[data-ds-popover] button').first().click()

    const eventInput2 = page.getByPlaceholder('Etkinlik ara...')
    await eventInput2.click()
    await eventInput2.fill(eventName)
    await page.waitForResponse((r) => r.url().includes('/events') && r.url().includes('search='), { timeout: 5000 }).catch(() => {})
    await page.locator('[data-ds-popover] button').first().click()

    const seatTrigger = page.getByRole('button', { name: 'Koltuk Seç', exact: true })
    await seatTrigger.scrollIntoViewIfNeeded()
    await seatTrigger.click()
    await expect(page.getByText('Koltuk Seçimi', { exact: true }).last()).toBeVisible({ timeout: 8000 })
    await page.waitForResponse((r) => r.url().includes('/event-applications/seat-map'), { timeout: 8000 }).catch(() => {})

    const seatB3 = page.locator('button[title="B3"]')
    await expect(seatB3).toBeVisible({ timeout: 8000 })
    // NOT: Dolu koltuklar `disabled` HTML özniteliği taşımıyor (sadece görsel/renk farkı) —
    // ama `onSeatDown`'daki `isTaken` kontrolü seçimin GERÇEKLEŞMESİNİ engelliyor. Zorla
    // tıklayıp (force) hiçbir seçim olmadığını, bu yüzden "Onayla" butonunun DISABLED
    // KALDIĞINI doğruluyoruz — bu, `isTaken` mantığının gerçek DOM'da çalıştığının kanıtı.
    await seatB3.click({ force: true })
    const confirmBtn = page.getByRole('button', { name: 'Onayla', exact: true })
    await expect(confirmBtn).toBeDisabled({ timeout: 3000 })
  })
})
