import { test, expect, request as pwRequest, APIRequestContext, Page } from '@playwright/test'
import { login } from './helpers/auth'
import { clickRowAction } from './helpers/rowActions'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

type Paged<T> = { items: T[] }
type Created = { id: string; code?: string; name?: string; fullName?: string }
type EventItem = { id: string; name: string; residencyMode: string; minAge: number; maxAge: number; gender: string; participationPeriod: string; participationLimit: number; capacity: number; reserveCapacity: number }
type ApplicationItem = { id: string; status: string; eventName: string; participantName: string }

let ctx: APIRequestContext
let adminToken = ''

// NOT (2026-09-06, orphan-data bug bulundu ve düzeltildi): bu dosya daha önce hiçbir
// temizlik yapmıyordu (test 1 hariç, o kendi UI'ından siliyordu) — her koşu birkaç
// yeni event/category/participant kaydı bırakıyordu (API'de 4+ orphan etkinlik
// bulunup silindi). Artık oluşturulan her kayıt burada izleniyor ve afterAll bunları
// bağımlılık sırasına göre (event → category/participant) temizliyor.
const createdEventIds: string[] = []
const createdCategoryIds: string[] = []
const createdParticipantIds: string[] = []

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

async function field(page: Page, label: string) {
  return page.locator('label', { hasText: label }).locator('xpath=ancestor::div[contains(@class, "space-y-1.5")][1]').first()
}

async function fillField(page: Page, label: string, value: string) {
  const input = (await field(page, label)).locator('input, textarea').first()
  // Pilot modda DatePicker native <input type="date"> render ediyor (ISO yyyy-mm-dd
  // bekliyor, DDMMYYYY string'i kabul etmiyor) — 2026-10-01 denetiminde bulundu.
  const type = await input.getAttribute('type').catch(() => null)
  if (type === 'date' && /^\d{8}$/.test(value)) {
    const dd = value.slice(0, 2)
    const mm = value.slice(2, 4)
    const yyyy = value.slice(4, 8)
    await input.fill(`${yyyy}-${mm}-${dd}`)
    return
  }
  await input.fill(value)
}

async function selectField(page: Page, label: string, option: string | RegExp) {
  // Pilot modda Select bileşeni native <select> render ediyor (eski buton+popover
  // değil) — 2026-10-01 denetiminde bulundu ve düzeltildi.
  const scope = await field(page, label)
  const nativeSelect = scope.locator('select')
  if (await nativeSelect.count() > 0) {
    const opt = nativeSelect.first().locator('option').filter({ hasText: option }).first()
    const value = await opt.getAttribute('value')
    await nativeSelect.first().selectOption(value ?? '')
    return
  }
  await scope.locator('button').first().click()
  await page.locator('[data-ds-popover]').getByRole('button', { name: option, exact: typeof option === 'string' }).first().click()
}

async function searchFor(page: Page, placeholder: string, value: string) {
  await page.getByPlaceholder(placeholder).fill(value)
  await expect(page.getByText(value).first()).toBeVisible({ timeout: 20000 })
}

async function rowContaining(page: Page, text: string) {
  const row = page.locator('tr', { hasText: text }).first()
  await expect(row).toBeVisible({ timeout: 20000 })
  return row
}

function futureIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function dateDigits(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}${m}${y}`
}

async function createCategory(name = uniq('E2E Etkinlik Kategori')) {
  const c = await apiRequest<Created>('POST', '/event-categories', { name, description: 'E2E kategori fixture', color: '#2563eb', defaultPoints: 7 })
  createdCategoryIds.push(c.id)
  return c
}

async function createEvent(categoryId: string, name = uniq('E2E Etkinlik')) {
  const startDate = futureIso(14)
  const e = await apiRequest<Created>('POST', '/events', {
    name,
    categoryId,
    venueType: 'outdoor',
    facilityId: null,
    hallId: null,
    location: { name: 'E2E Açık Alan', latitude: 41.02, longitude: 28.88 },
    startDate,
    endDate: startDate,
    startTime: '09:00',
    endTime: '10:00',
    gender: 'mixed',
    capacity: 25,
    reserveCapacity: 5,
    minAge: 18,
    maxAge: 65,
    participationPeriod: 'none',
    participationLimit: 0,
    description: 'E2E etkinlik açıklaması',
    internalNote: 'E2E iç not',
    // NOT (2026-09-06): registrationMode='required' iken applicationStartDate/EndDate
    // backend'de zorunlu — event-settings.general.requireApproval=true ortamda bu artık
    // gerçek bir zorunluluk (aynı sorun UI testinde de bulundu, orada "Onaysız Katılım"
    // seçilerek çözüldü). Burada tarihleri de doldurarak API'yi doğrudan tatmin ediyoruz.
    applicationStartDate: futureIso(-1),
    applicationEndDate: futureIso(13),
    images: { web: { cover: { width: 1920, height: 720, maxSizeKb: 800 }, card: { width: 600, height: 400, maxSizeKb: 200 }, thumb: { width: 240, height: 240, maxSizeKb: 80 } }, mobile: { cover: { width: 1080, height: 1350, maxSizeKb: 600 }, card: { width: 750, height: 750, maxSizeKb: 250 }, thumb: { width: 320, height: 320, maxSizeKb: 100 } }, ratios: { '16:9': { width: 1920, height: 1080, maxSizeKb: 800 }, '4:3': { width: 1200, height: 900, maxSizeKb: 400 }, '1:1': { width: 900, height: 900, maxSizeKb: 300 }, '9:16': { width: 1080, height: 1920, maxSizeKb: 600 } }, photos: [] },
    access: { hasSessions: true, hasSeating: false, reservationType: 'none', registrationMode: 'required', attendanceEnabled: true, entryMethod: 'checkin', qrEnabled: true, qrType: 'rotating', qrRotationSeconds: 30, kioskEnabled: false, turnstileEnabled: false, publicLinkEnabled: false, publicLinkRequiresPin: false, staffIds: [], notificationTemplates: [], cancellationDeadlineHours: 24 },
    pricing: { isPaid: false, currency: 'TRY', audiences: [], siblingDiscountEnabled: false, siblingDiscounts: [], municipalityEmployeeDiscountEnabled: false, municipalityEmployeePercent: 0, disabledDiscountEnabled: false, disabledPercent: 0, veteranDiscountEnabled: false, veteranPercent: 0, combineDiscounts: false, maxDiscountPercent: 50 },
    points: { enabled: true, basePoints: 7, walkInEarnsPoints: false },
    isActive: true,
    residencyMode: 'anyone',
    sultangaziResidentOnly: false,
  })
  createdEventIds.push(e.id)
  return e
}

async function createParticipant() {
  const tag = `${Date.now()}${Math.random().toString(16).slice(2, 6)}`
  const p = await apiRequest<Created>('POST', '/participants', {
    tckn: fakeTckn(),
    birthDate: '1995-06-15',
    phone: `05${String(Date.now()).slice(-9)}`,
    email: `e2e.events.${tag}@example.com`,
    deliveryChannel: 'Email',
  })
  createdParticipantIds.push(p.id)
  return p
}

test.describe('Events admin module CRUD scenarios', () => {
  test.beforeAll(async () => { ctx = await pwRequest.newContext(); await freshAdminToken() })
  test.afterAll(async () => {
    // Silme sırası önemli: event, category'ye bağlı olduğu için önce event'ler silinir.
    for (const id of createdEventIds) await apiRequest('DELETE', `/events/${id}`).catch(() => {})
    for (const id of createdCategoryIds) await apiRequest('DELETE', `/event-categories/${id}`).catch(() => {})
    for (const id of createdParticipantIds) await apiRequest('DELETE', `/participants/${id}`).catch(() => {})
    await ctx.dispose()
  })

  test('kategori form CRUD akışını doğrular', async ({ page }) => {
    test.setTimeout(90000)
    const name = uniq('E2E Kategori')
    const updated = `${name} Güncel`
    let categoryId: string | undefined

    await login(page)
    await page.goto('/events?tab=categories')
    await expect(page.getByRole('button', { name: 'Yeni Kategori' })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Kategori' }).click()
    await expect(page.getByText('Yeni Kategori Ekle')).toBeVisible()
    await page.getByPlaceholder('Örn. Tiyatro').fill(name)
    await page.getByPlaceholder('Kategori hakkında kısa açıklama').fill('Playwright kategori açıklaması')
    await fillField(page, 'Varsayılan Katılım Puanı', '11')
    const [createCategoryResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/event-categories') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kaydet' }).click(),
    ])
    expect(createCategoryResponse.ok(), `POST /event-categories başarısız: ${await createCategoryResponse.text()}`).toBeTruthy()

    const createdCategory = (await createCategoryResponse.json()).data as { id: string; defaultPoints: number }
    categoryId = createdCategory?.id
    expect(categoryId, 'UI-created category id').toBeTruthy()
    expect(createdCategory?.defaultPoints).toBe(11)
    await searchFor(page, 'Kategori adı veya açıklama ara...', name)

    const categoryRow = await rowContaining(page, name)
    await clickRowAction(page, categoryRow, 'Düzenle')
    await expect(page.getByText('Kategori Düzenle')).toBeVisible()
    await page.getByPlaceholder('Örn. Tiyatro').fill(updated)
    await page.getByPlaceholder('Kategori hakkında kısa açıklama').fill('Playwright kategori açıklaması güncel')
    await fillField(page, 'Varsayılan Katılım Puanı', '13')
    const [updateCategoryResponse] = await Promise.all([
      page.waitForResponse((r) => categoryId ? r.url().includes(`/event-categories/${categoryId}`) && r.request().method() === 'PUT' : false),
      page.getByRole('button', { name: 'Güncelle' }).click(),
    ])
    expect(updateCategoryResponse.ok(), `PUT /event-categories başarısız: ${await updateCategoryResponse.text()}`).toBeTruthy()
    const updatedCategory = (await updateCategoryResponse.json()).data as { description?: string; defaultPoints: number }
    expect(updatedCategory?.description).toBe('Playwright kategori açıklaması güncel')
    expect(updatedCategory?.defaultPoints).toBe(13)
    await searchFor(page, 'Kategori adı veya açıklama ara...', updated)

    await clickRowAction(page, await rowContaining(page, updated), 'Sil')
    await expect(page.getByRole('heading', { name: 'Kategoriyi Sil' })).toBeVisible()
    await page.getByRole('button', { name: 'Evet, Sil' }).click()
    await expect(page.getByText(updated).first()).toBeHidden({ timeout: 20000 })
  })

  test('etkinlik form CRUD akışı tüm temel alanları ve üç residencyMode seçeneğini doğrular', async ({ page }) => {
    test.setTimeout(120000)
    const category = await createCategory()
    const eventName = uniq('E2E Etkinlik')
    const eventNameUpdated = `${eventName} Güncel`
    const start = futureIso(21)
    let eventId: string | undefined

    await login(page)
    await page.goto('/events?tab=events')
    await expect(page.getByText('Etkinlikler').first()).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Yeni Etkinlik' }).click()
    await expect(page.getByText('Yoklama ve Erişim Kurulumu')).toBeVisible()
    await page.getByText('Yoklama yok').click()
    await page.getByRole('button', { name: /Devam Et/ }).click()
    await expect(page.getByText('Yeni Etkinlik Ekle')).toBeVisible()

    await selectField(page, 'Etkinlik Kategorisi', category.name ?? '')
    await page.getByText('Açık Alan').click()
    await fillField(page, 'Konum Adı', 'E2E Açık Alan Sahnesi')
    await fillField(page, 'Etkinlik Adı', eventName)
    await fillField(page, 'Etkinlik Tarihi', dateDigits(start))
    await fillField(page, 'Başlangıç Saati', '1000')
    await fillField(page, 'Bitiş Saati', '1130')
    await selectField(page, 'Cinsiyet', 'Kadın')
    await fillField(page, 'Kontenjan', '31')
    await fillField(page, 'Yedek Kontenjan', '6')
    await fillField(page, 'En Küçük Yaş', '18')
    await fillField(page, 'En Büyük Yaş', '65')
    await selectField(page, 'Katılım Bölgesi', 'Herkes — kısıtlama yok')
    await selectField(page, 'Katılım Bölgesi', "Sultangazi'de ikamet edenler (uyruk fark etmez)")
    await selectField(page, 'Katılım Bölgesi', 'Yalnız Sultangazi dışında ikamet edenler')
    await selectField(page, 'Katılım Sınırı', 'Haftada')
    await fillField(page, 'Sınır Adedi', '2')
    await fillField(page, 'İptal Süresi', '12')
    await fillField(page, 'İç Notlar', 'Playwright iç not')
    // NOT (2026-09-06, ortam-bağlı regresyon bulundu): /event-settings.general.requireApproval
    // şu an true — bu, yeni etkinliğin "Kayıt Modu"nun varsayılan olarak "Kayıt Zorunlu"
    // (registrationMode='required') gelmesine neden oluyor, bu da applicationStartDate/
    // applicationEndDate'i zorunlu kılıyor (backend 400 VALIDATION_ERROR). Bu test
    // residencyMode'u doğruluyor, kayıt akışını değil — "Onaysız Katılım" seçilerek
    // bu zorunluluk devre dışı bırakılıyor.
    await page.getByRole('button', { name: /Onaysız Katılım/ }).click()
    const [createEventResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/events') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kaydet' }).click(),
    ])
    expect(createEventResponse.ok(), `POST /events başarısız: ${await createEventResponse.text()}`).toBeTruthy()
    const created = (await createEventResponse.json()).data as EventItem
    eventId = created?.id
    if (eventId) createdEventIds.push(eventId)
    expect(eventId, 'UI-created event id').toBeTruthy()
    expect(created).toMatchObject({ residencyMode: 'outside_only', minAge: 18, maxAge: 65, gender: 'female', participationPeriod: 'weekly', participationLimit: 2, capacity: 31, reserveCapacity: 6 })
    await searchFor(page, 'Etkinlik adı, kod, tesis, salon veya başvuran adı/TC ara...', eventName)

    const eventRow = await rowContaining(page, eventName)
    await clickRowAction(page, eventRow, 'Düzenle')
    await expect(page.getByText('Etkinlik Bilgilerini Düzenle')).toBeVisible()
    await fillField(page, 'Etkinlik Adı', eventNameUpdated)
    await selectField(page, 'Katılım Bölgesi', "Sultangazi'de ikamet edenler (uyruk fark etmez)")
    await fillField(page, 'Kontenjan', '33')
    const [updateEventResponse] = await Promise.all([
      page.waitForResponse((r) => eventId ? r.url().includes(`/events/${eventId}`) && r.request().method() === 'PUT' : false),
      page.getByRole('button', { name: 'Güncelle' }).click(),
    ])
    expect(updateEventResponse.ok(), `PUT /events başarısız: ${await updateEventResponse.text()}`).toBeTruthy()
    const updatedEvent = (await updateEventResponse.json()).data as EventItem
    expect(updatedEvent).toMatchObject({ residencyMode: 'sultangazi_only', capacity: 33 })
    await searchFor(page, 'Etkinlik adı, kod, tesis, salon veya başvuran adı/TC ara...', eventNameUpdated)
  })

  test('seans oluşturma ve başvuru onay/red akışını doğrular', async ({ page }) => {
    test.setTimeout(120000)
    const category = await createCategory()
    const event = await createEvent(category.id)
    const participantA = await createParticipant()
    const participantB = await createParticipant()
    const sessionDate = futureIso(14)

    const session = await apiRequest<Created>('POST', '/sessions', {
      eventId: event.id,
      hallId: null,
      mode: 'single',
      date: sessionDate,
      startTime: '09:00',
      endTime: '10:00',
      startDate: sessionDate,
      endDate: sessionDate,
      dayPlans: [],
      capacity: 25,
      reserveCapacity: 5,
      instructor: 'E2E Eğitmen',
      instructorId: '',
      instructorPhone: '',
      instructorEmail: '',
      emergencyPhone: '',
      isActive: true,
      grantAccess: false,
      tckn: '',
    })
    expect(session.id).toBeTruthy()

    await apiRequest<Created>('POST', '/event-applications', { participantId: participantA.id, eventId: event.id, sessionId: session.id, status: 'pending', documentStatus: 'none', paymentStatus: 'unpaid', seatNumber: '' })
    await apiRequest<Created>('POST', '/event-applications', { participantId: participantB.id, eventId: event.id, sessionId: session.id, status: 'pending', documentStatus: 'none', paymentStatus: 'unpaid', seatNumber: '' })

    await login(page)
    await page.goto('/events?tab=sessions')
    await expect(page.getByText('Seans Listesi')).toBeVisible({ timeout: 20000 })
    await searchFor(page, 'Etkinlik, salon veya eğitmen ara...', event.name ?? '')
    await expect(page.getByText('E2E Eğitmen').first()).toBeVisible({ timeout: 20000 })

    await page.goto(`/events?tab=applications&eventId=${event.id}`)
    await expect(page.getByText('Başvuru Listesi')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(event.name ?? '').first()).toBeVisible({ timeout: 20000 })

    let row = page.locator('tr', { hasText: 'Beklemede' }).first()
    await expect(row).toBeVisible({ timeout: 20000 })
    await clickRowAction(page, row, 'Onayla')
    await expect(page.getByText('Başvuru onaylandı.')).toBeVisible({ timeout: 20000 })

    row = page.locator('tr', { hasText: 'Beklemede' }).first()
    await expect(row).toBeVisible({ timeout: 20000 })
    await clickRowAction(page, row, 'Reddet')
    await expect(page.getByText('Başvuru reddedildi.')).toBeVisible({ timeout: 20000 })

    const apps = await apiRequest<Paged<ApplicationItem>>('GET', `/event-applications?page=1&limit=20&eventId=${event.id}`)
    const statuses = apps.items.map((a) => a.status)
    expect(statuses.filter((s) => s === 'approved')).toHaveLength(1)
    expect(statuses.filter((s) => s === 'rejected')).toHaveLength(1)
  })
})
