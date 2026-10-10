import { Page, APIRequestContext, expect } from '@playwright/test'
import { pickSelectByFieldLabel } from './designSystemControls'

export const API_BASE = process.env.E2E_API_URL || 'http://localhost:34000/api/v1'
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'superadmin@nexora.local'
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Nexora@Admin2026'
export const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'

export interface FacilityModuleSpec {
  id: string
  routeId: string
  basePath: string
  groupSingular: string
  branchSingular: string
  defaultGender: 'male' | 'female' | 'mixed'
  defaultAgeRange: { min: number; max: number }
  requiresApplicationDocuments: boolean
}

export const FACILITY_MODULE_MATRIX: FacilityModuleSpec[] = [
  { id: 'sports', routeId: 'sports', basePath: '/sports', groupSingular: 'Grup', branchSingular: 'Branş', defaultGender: 'mixed', defaultAgeRange: { min: 8, max: 65 }, requiresApplicationDocuments: false },
  { id: 'kasif_cocuk', routeId: 'kasif', basePath: '/kasif', groupSingular: 'Atölye Grubu', branchSingular: 'Ders', defaultGender: 'mixed', defaultAgeRange: { min: 6, max: 12 }, requiresApplicationDocuments: false },
  { id: 'pool', routeId: 'pool', basePath: '/pool', groupSingular: 'Grup', branchSingular: 'Seans Türü', defaultGender: 'mixed', defaultAgeRange: { min: 8, max: 80 }, requiresApplicationDocuments: false },
  { id: 'youth_camp', routeId: 'youth-camp', basePath: '/youth-camp', groupSingular: 'Kamp Grubu', branchSingular: 'Aktivite Türü', defaultGender: 'mixed', defaultAgeRange: { min: 13, max: 25 }, requiresApplicationDocuments: false },
  { id: 'scout_camp', routeId: 'scout-camp', basePath: '/scout-camp', groupSingular: 'İzci Grubu', branchSingular: 'Modül Türü', defaultGender: 'mixed', defaultAgeRange: { min: 8, max: 18 }, requiresApplicationDocuments: false },
  { id: 'science_center', routeId: 'science-center', basePath: '/science-center', groupSingular: 'Atölye Grubu', branchSingular: 'Bilim Dalı', defaultGender: 'mixed', defaultAgeRange: { min: 7, max: 18 }, requiresApplicationDocuments: false },
  { id: 'accessible', routeId: 'accessible-life', basePath: '/accessible-life', groupSingular: 'Grup', branchSingular: 'Terapi Dalı', defaultGender: 'mixed', defaultAgeRange: { min: 3, max: 65 }, requiresApplicationDocuments: true },
  { id: 'women_family', routeId: 'women-family', basePath: '/women-family', groupSingular: 'Grup', branchSingular: 'Program', defaultGender: 'mixed', defaultAgeRange: { min: 4, max: 80 }, requiresApplicationDocuments: false },
]

export function uniq(prefix: string): string {
  return `${prefix.replace(/_/g, '-')} ${Date.now()} ${Math.random().toString(16).slice(2, 7)}`
}

export function futureIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

let cachedToken: string | null = null
let cachedRefreshToken: string | null = null

export async function adminToken(ctx: APIRequestContext, forceFresh = false): Promise<string> {
  if (cachedToken && !forceFresh) return cachedToken
  const login = await (await ctx.post(`${API_BASE}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).json()
  if (login?.data?.accessToken) {
    cachedToken = login.data.accessToken
    cachedRefreshToken = login.data.refreshToken
    return cachedToken!
  }
  if (!login?.data?.otpSessionToken) throw new Error(`Admin API login başarısız: ${JSON.stringify(login)}`)
  const verify = await (await ctx.post(`${API_BASE}/auth/verify-otp`, {
    data: { otpSessionToken: login.data.otpSessionToken, code: ADMIN_OTP },
  })).json()
  if (!verify?.data?.accessToken) throw new Error(`Admin API OTP doğrulama başarısız: ${JSON.stringify(verify)}`)
  cachedToken = verify.data.accessToken
  cachedRefreshToken = verify.data.refreshToken
  return cachedToken!
}

/**
 * Gerçek tarayıcı UI login formu — yalnızca GERÇEKTEN yeni bir admin oturumu açma
 * akışının kendisini doğrulamak gereken testlerde kullanılır. Her testte formu
 * yeniden göndermek (gerçekte bulunan hata, 2026-10-03): 8 modül × birden çok test ×
 * tam login+OTP döngüsü dakikalar içinde backend rate limit'ini (429
 * RATE_LIMIT_EXCEEDED) tetikliyor. Diğer testler bunun yerine `fastLoginUi` ile
 * önbellekteki (tek seferlik gerçek login'den gelen) token'ı enjekte eder — bu
 * desen zaten kod tabanında var (bkz. gezi-sefer-ui-flow.spec.ts
 * loginPageWithFreshApiSession, library-reservation-flow.spec.ts adminLoginUi).
 */
export async function adminLoginUi(page: Page): Promise<void> {
  await page.goto('/login')
  await page.locator('#email').fill(ADMIN_EMAIL)
  await page.locator('#password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  if (await page.getByRole('button', { name: /Doğrula/ }).isVisible({ timeout: 5000 }).catch(() => false)) {
    const otpInputs = page.locator('input[inputmode="numeric"]')
    const count = await otpInputs.count()
    for (let i = 0; i < Math.min(6, count); i++) await otpInputs.nth(i).fill(ADMIN_OTP[i])
    await page.getByRole('button', { name: /Doğrula/ }).click()
  }
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
  cachedToken = await page.evaluate(() => sessionStorage.getItem('admin_access_token') || localStorage.getItem('admin_access_token')).catch(() => cachedToken)
  cachedRefreshToken = await page.evaluate(() => sessionStorage.getItem('admin_refresh_token') || localStorage.getItem('admin_refresh_token')).catch(() => cachedRefreshToken)
}

/**
 * Önbellekteki (gerçek login'den gelen) access/refresh token'ı doğrudan
 * sessionStorage'a yazarak tarayıcıyı oturum açmış duruma getirir — tekrar tekrar
 * login+OTP formu göndermeden GERÇEK bir oturumla gerçek sayfalara gidilebilir.
 *
 * GERÇEK BULGU (2026-10-04): Backend admin girişi için TEK OTURUM zorunluğu var
 * (Program.cs OnTokenValidated → auth:current-session-id:{userId} Redis anahtarı;
 * başka bir yerden/paralel süreçten aynı admin hesabına yeni bir login girişi
 * olursa önbellekteki token'ımız ANINDA "Oturum başka bir cihazdan yenilendi"
 * hatasıyla geçersiz olur ve /login'e döner). Bu, başka bir eşzamanlı sürecin aynı
 * admin hesabını kullandığı ortamlarda (bu oturumda canlı doğrulandı) rastgele
 * görünen ama gerçek bir çakışma olan bir hata. Bu yüzden HER ÇAĞRIDA
 * forceFresh=true ile GERÇEKTEN yeni bir token alınır (basit önbellek yerine) —
 * bu, testin başladığı anda "current session" biz oluruz garantisini verir; yine
 * de /login'e düşersek (test ortasında biri tekrar login olduysa) bir kez daha
 * taze token alıp deniyoruz.
 */
export async function fastLoginUi(page: Page, ctx: APIRequestContext): Promise<void> {
  const token = await adminToken(ctx, true)
  await page.goto('/login')
  await page.evaluate(({ at, rt }) => {
    sessionStorage.setItem('admin_access_token', at)
    if (rt) sessionStorage.setItem('admin_refresh_token', rt)
  }, { at: token, rt: cachedRefreshToken ?? '' })
  await page.goto('/')
  try {
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
  } catch {
    // Önbellekteki token başka bir eşzamanlı admin girişi tarafından geçersiz
    // kılınmış olabilir — GERÇEKTEN taze bir token alıp bir kez daha deniyoruz.
    const freshToken = await adminToken(ctx, true)
    await page.goto('/login')
    await page.evaluate(({ at, rt }) => {
      sessionStorage.setItem('admin_access_token', at)
      if (rt) sessionStorage.setItem('admin_refresh_token', rt)
    }, { at: freshToken, rt: cachedRefreshToken ?? '' })
    await page.goto('/')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
  }
}

export async function getFreshToken(page: Page): Promise<string> {
  const t = await page.evaluate(() => sessionStorage.getItem('admin_access_token') || localStorage.getItem('admin_access_token'))
  if (!t) throw new Error('Sayfada güncel access_token bulunamadı.')
  return t
}

export interface CreatedFacilityFixture {
  serviceFacilityId: string
  facilityId: string
  branchId: string
  branchName: string
  tag: string
}

export async function createServiceFacilityAndModuleFacility(
  ctx: APIRequestContext,
  token: string,
  mod: FacilityModuleSpec,
  tagPrefix: string,
  capacity = 500,
): Promise<{ serviceFacilityId: string; facilityId: string; tag: string }> {
  const headers = { Authorization: `Bearer ${token}` }
  const me = await (await ctx.get(`${API_BASE}/auth/me`, { headers })).json()
  const managerId = me?.data?.me?.id
  const tag = uniq(tagPrefix)

  const sfRes = await ctx.post(`${API_BASE}/service-facilities`, {
    headers,
    data: {
      name: `${tag} Tesisi`, type: mod.id, locationType: 'Indoor',
      city: 'İstanbul', district: 'Sultangazi', address: 'E2E Test Mah. No:1',
      latitude: 41.1039, longitude: 28.8674,
      managerId, weekdayOpen: '08:00', weekdayClose: '22:00',
      weekendOpen: '09:00', weekendClose: '20:00', parkingCapacity: 0, parkingType: 'Free', capacity,
    },
  })
  expect(sfRes.ok(), `service-facility oluşturulamadı (${mod.id}): ${await sfRes.text()}`).toBeTruthy()
  const serviceFacilityId = (await sfRes.json()).data.id

  const facRes = await ctx.post(`${API_BASE}/${mod.routeId}/facilities`, {
    headers,
    data: {
      name: `${tag} Tesis`, kind: 'indoor', serviceFacilityId, managerId,
      capacity, isActive: true, grantAccess: false,
    },
  })
  expect(facRes.ok(), `${mod.id} tesisi oluşturulamadı: ${await facRes.text()}`).toBeTruthy()
  const facBody = (await facRes.json()).data
  const facilityId = typeof facBody === 'string' ? facBody : facBody.id

  return { serviceFacilityId, facilityId, tag }
}

export async function createBranch(
  ctx: APIRequestContext,
  token: string,
  mod: FacilityModuleSpec,
  tag: string,
  overrides?: Record<string, unknown>,
): Promise<{ branchId: string; branchName: string }> {
  const headers = { Authorization: `Bearer ${token}` }
  const branchName = `${tag} ${mod.branchSingular}`
  const res = await ctx.post(`${API_BASE}/${mod.routeId}/branches`, {
    headers,
    data: {
      name: branchName, gender: 'mixed',
      ageMin: mod.defaultAgeRange.min, ageMax: mod.defaultAgeRange.max,
      description: 'E2E fixture branşı', periodMonths: 3, absenceLimit: 5, consecutiveAbsenceLimit: 3,
      isActive: true,
      ...overrides,
    },
  })
  expect(res.ok(), `${mod.id} branşı oluşturulamadı: ${await res.text()}`).toBeTruthy()
  return { branchId: (await res.json()).data.id, branchName }
}

/**
 * GERÇEK TESTTE BULUNAN HATA (2026-10-03, Travels modülünde bulunan aynı sınıf hatanın
 * Facility helper'ında da var olduğu tespit edildi): önceki sürüm her silme çağrısını
 * `.catch(() => {})` ile SESSİZCE yutuyordu — 429 RATE_LIMIT_EXCEEDED gibi geçici
 * hatalarda yeniden deneme yoktu. Kanıt: canlı DB'de `QA_KURAL sports ..._K12b_Branş`
 * gibi 2+ saat önceki kombine-suite koşumlarından kalma GERÇEK branş kalıntıları
 * bulundu (fresh token ile API sorgusuyla doğrulandı). Artık 429'u backoff ile 3 kez
 * yeniden deniyor (bkz. travelsSessionFixtures.ts deleteWithRetry, aynı desen).
 */
export async function deleteWithRetry(ctx: APIRequestContext, url: string, headers: Record<string, string>, maxAttempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await ctx.delete(url, { headers }).catch(() => null)
    if (!res) continue
    if (res.status() !== 429) return
    await new Promise((r) => setTimeout(r, 1500 * attempt))
  }
}

export async function cleanupFacilityFixture(
  ctx: APIRequestContext,
  token: string,
  mod: FacilityModuleSpec,
  fx: { facilityId?: string; branchId?: string; serviceFacilityId?: string; groupIds?: string[] },
): Promise<void> {
  const headers = { Authorization: `Bearer ${token}` }
  for (const id of fx.groupIds ?? []) {
    await deleteWithRetry(ctx, `${API_BASE}/${mod.routeId}/groups/${id}`, headers)
  }
  if (fx.facilityId) await deleteWithRetry(ctx, `${API_BASE}/${mod.routeId}/facilities/${fx.facilityId}`, headers)
  if (fx.branchId) await deleteWithRetry(ctx, `${API_BASE}/${mod.routeId}/branches/${fx.branchId}`, headers)
  if (fx.serviceFacilityId) await deleteWithRetry(ctx, `${API_BASE}/service-facilities/${fx.serviceFacilityId}`, headers)
}

export async function openFacilityGroupsTab(page: Page, mod: FacilityModuleSpec, facilityId: string): Promise<void> {
  await page.goto(`${mod.basePath}?f=${facilityId}&tab=groups`)
  await page.waitForLoadState('networkidle').catch(() => {})
}

export async function fillBasicGroupInfo(page: Page, drawer: import('@playwright/test').Locator, mod: FacilityModuleSpec, groupName: string, branchName: string): Promise<void> {
  await drawer.getByPlaceholder(new RegExp(`${mod.groupSingular} adını giriniz`, 'i')).fill(groupName)
  await pickSelectByFieldLabel(page, drawer, mod.branchSingular, branchName, { searchable: true })
}

export async function errorToastLocator(page: Page) {
  return page.locator('[data-sonner-toast][data-type="error"]')
}

export { pickSelectByFieldLabel }
