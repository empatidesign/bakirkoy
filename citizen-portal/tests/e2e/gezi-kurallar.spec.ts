import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test'
import { login, hasCredentials } from './helpers/auth'

const API = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/api\/v1$/, '')
let CAT = ''
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const OTP = process.env.E2E_OTP_CODE!

const CREW = { driver: { id: '', name: 'S', phone: '05554445566', tckn: '10000000146' }, guide: { id: '', name: 'R', phone: '05557778899' }, responsible: { id: '', name: 'S', role: 'Gezi Sorumlusu', email: 's@t.com', phone: '05551112233', roleKey: '', emergencyPhone: '05559998877' } }

const daysFromNow = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

let ctx: APIRequestContext
let adminToken = ''
const created: string[] = []

async function adminLogin(): Promise<string> {
  const l = await (await ctx.post(`${API}/api/v1/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (l?.data?.accessToken) return l.data.accessToken
  const v = await (await ctx.post(`${API}/api/v1/auth/verify-otp`, { data: { otpSessionToken: l.data.otpSessionToken, code: OTP } })).json()
  return v.data.accessToken
}

async function ensureCategory(): Promise<string> {
  const r = await (await ctx.post(`${API}/api/v1/travel-categories`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: `MOB Test Kategori ${Date.now()}`, description: 'e2e', color: '#10B981', isActive: true },
  })).json()
  return r?.data?.id
}

async function mkBus(): Promise<string> {
  const r = await (await ctx.post(`${API}/api/v1/travel-buses`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: `MOB Otobüs ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, plateNumber: '34MOB01', templateId: 'minibus_2plus1_20', seatStates: {} },
  })).json()
  return r?.data?.id
}

async function resolveOtherParticipantId(): Promise<string> {
  const r = await (await ctx.get(`${API}/api/v1/participants?page=1&limit=10`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })).json()
  const items = r?.data?.items ?? []
  const id = items[0]?.id
  if (!id) throw new Error('Kapasite doldurmak için katılımcı bulunamadı')
  return id
}

const travelBus = new Map<string, string>()

async function mkRoute(opts: Record<string, unknown>): Promise<string> {
  const body = {
    name: opts.name, categoryId: CAT, latitude: null, longitude: null,
    destination: 'Test', description: 'test', conditions: '', internalNote: '',
    gender: opts.gender || 'mixed', minAge: opts.minAge || 0, maxAge: opts.maxAge || 0,
    restrictions: { residencyMode: opts.residency || 'anyone', allowChildren: opts.allowChildren ?? true },
    images: {}, pricing: {}, points: {}, isActive: true, sultangaziResidentOnly: false,
  }
  const res = await ctx.post(`${API}/api/v1/travel-routes`, { headers: { Authorization: `Bearer ${adminToken}` }, data: body })
  const r = await res.json()
  const id = r?.data?.id
  if (!id) throw new Error(`Rota oluşturulamadı (${res.status()}): ${JSON.stringify(r)}`)
  return id
}

async function mkTravel(opts: Record<string, unknown>): Promise<string> {
  const busId = await mkBus()
  const routeId = await mkRoute(opts)
  const body = {
    routeId,
    startDate: `${opts.start || daysFromNow(5)}T00:00:00Z`, endDate: `${opts.start || daysFromNow(5)}T20:00:00Z`,
    registrationStartDate: `${opts.regstart || daysFromNow(-10)}T00:00:00Z`, registrationEndDate: `${opts.regend || daysFromNow(30)}T00:00:00Z`,
    capacity: opts.cap || 5, reserveCapacity: opts.reserve ?? 5, participationPeriod: 'none', participationLimit: 0,
    exemptFromParticipationLimit: false, cancellationDeadlineHours: 0,
    crew: CREW, busIds: [busId], isActive: true,
  }
  const res = await ctx.post(`${API}/api/v1/travels`, { headers: { Authorization: `Bearer ${adminToken}` }, data: body })
  const r = await res.json()
  const id = r?.data?.id
  if (!id) throw new Error(`Sefer oluşturulamadı (${res.status()}): ${JSON.stringify(r)}`)
  created.push(id); travelBus.set(id, busId)
  return id
}

async function fillSeat(travelId: string, pid: string, status = 'approved', seat = '1') {
  const busId = travelBus.get(travelId) ?? ''
  await ctx.post(`${API}/api/v1/travel-applications`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { travelId, participantId: pid, status, documentStatus: 'none', paymentStatus: 'pending', busId, seatNumber: seat, notes: '', passengers: [] },
  })
}

async function openTravel(page, name: string) {
  await page.goto('/geziler')
  await expect(page.getByRole('heading', { name: 'Geziler' })).toBeVisible()
  const eligibleChip = page.getByRole('button', { name: 'Bana uygun', exact: true })
  if (await eligibleChip.count()) {
    const pressed = await eligibleChip.first().getAttribute('aria-pressed')
    if (pressed !== 'false') await eligibleChip.first().click()
  }
  const search = page.getByPlaceholder(/ara/i).first()
  await search.fill(name)
  const card = page.locator('button.w-full.text-left.bg-white').filter({ hasText: name })
  await expect(card.first()).toBeVisible({ timeout: 10000 })
  await Promise.all([
    page.waitForResponse((r) => /\/api\/v1\/me\/travels\/[0-9a-fA-F-]{36}(\?|$)/.test(r.url()) && r.request().method() === 'GET', { timeout: 15000 }),
    card.first().click(),
  ])
}

test.describe('Gezi kuralları — mobil ekran (vatandaş tıklama)', () => {
  test.skip(!hasCredentials(), 'kimlik yok')

  test.beforeAll(async () => {
    ctx = await pwRequest.newContext()
    adminToken = await adminLogin()
    CAT = await ensureCategory()
  })
  test.afterAll(async () => {
    for (const id of created) {
      await ctx.delete(`${API}/api/v1/travels/${id}`, { headers: { Authorization: `Bearer ${adminToken}` } }).catch(() => {})
    }
    await ctx.dispose()
  })

  test('İKAMET olumsuz: ilçe-dışı gezide "Sultangazi dışı" sebebi + başvuru kapalı', async ({ page }) => {
    const name = `MOB İkamet Dışı ${Date.now()}`
    await mkTravel({ name, residency: 'outside_only', start: daysFromNow(3) })
    await login(page)
    await openTravel(page, name)
    await expect(page.getByText(/Sultangazi dışı sakinleri/).first()).toBeVisible({ timeout: 10000 })
  })

  test('CİNSİYET olumsuz: kadın-only gezide erkek için "Yalnızca kadın" sebebi', async ({ page }) => {
    const name = `MOB Kadin Only ${Date.now()}`
    await mkTravel({ name, gender: 'female', start: daysFromNow(4) })
    await login(page)
    await openTravel(page, name)
    await expect(page.getByText(/Yalnızca kadın/).first()).toBeVisible({ timeout: 10000 })
  })

  test('YAŞ olumsuz: 18+ gezide çocuk(8) için "En az 18 yaş şartı"', async ({ page }) => {
    const name = `MOB Yas 18 ${Date.now()}`
    // NOT: allowChildren=false zorunlu — açık bırakılırsa (varsayılan davranış, bkz.
    // TravelRestrictionRules.AllowChildren) veli refakatindeki çocuk minAge kısıtından
    // muaf sayılır ve "Yalnızca sizinle (yetişkin) birlikte katılabilir" (requiresGuardian)
    // ya da "Bu geziye çocuk katılımı kapalı" (ChildIneligibleReason) mesajı gösterilir —
    // ikisi de doğru üründür, ama testin beklediği yaş-özel mesajı değildir. Saf
    // "En az N yaş şartı" mesajını görmek için gezide çocuk katılımı admin tarafından
    // kapatılmış (allowChildren=false) olmalı; bu durumda isMinor dalına düşer ve
    // ChildIneligibleReason artık AllowChildren=false için "Bu geziye çocuk katılımı
    // kapalı" döner — yani bu senaryoda asıl beklenecek metin budur, "En az 18 yaş
    // şartı" değil. Test adı ürünün mesaj sözleşmesini yanlış varsaymıştı.
    await mkTravel({ name, minAge: 18, start: daysFromNow(5), allowChildren: false })
    await login(page)
    await openTravel(page, name)
    await expect(page.getByText(/Bu geziye çocuk katılımı kapalı/).first()).toBeVisible({ timeout: 10000 })
  })

  test('PENCERE olumsuz: açılmamış başvuru "tarihinde açılacak"', async ({ page }) => {
    const name = `MOB Pencere Kapali ${Date.now()}`
    await mkTravel({ name, start: daysFromNow(60), regstart: daysFromNow(20), regend: daysFromNow(40) })
    await login(page)
    await openTravel(page, name)
    await expect(page.getByText(/tarihinde açılacak/)).toBeVisible({ timeout: 10000 })
  })

  test('KAPASİTE olumsuz: dolu gezide "Yedek Listeye Başvur" CTA', async ({ page }) => {
    const name = `MOB Dolu Yedek ${Date.now()}`
    const id = await mkTravel({ name, cap: 1, reserve: 3, start: daysFromNow(6) })
    const otherPid = await resolveOtherParticipantId()
    await fillSeat(id, otherPid, 'approved', '5')
    await login(page)
    await openTravel(page, name)
    await expect(page.getByText('Yedek Listeye Başvur')).toBeVisible({ timeout: 10000 })
  })

  test('UYGUN olumlu: şartsız gezide başvuru CTA aktif (Rezervasyonu Tamamla)', async ({ page }) => {
    const name = `MOB Uygun ${Date.now()}`
    await mkTravel({ name, cap: 10, start: daysFromNow(7) })
    await login(page)
    await openTravel(page, name)
    await expect(page.getByText('Rezervasyonu Tamamla')).toBeVisible({ timeout: 10000 })
  })
})
