import { expect, type Page, type Locator, type APIRequestContext } from '@playwright/test'
import { TEST_TCKN, TEST_PASSWORD, TEST_OTP } from './auth'

export const API_ROOT = (process.env.E2E_API_URL || 'http://localhost:5207/api/v1').replace(/\/$/, '')
export const ARTIFACT_DIR = 'tests/e2e/artifacts/video-proof'
export type ApiEnvelope<T> = { data: T; message?: string; errorCode?: string }
export type Paged<T> = { items: T[]; totalCount?: number }
export type Child = { id: string; fullName: string; birthDate: string; gender: number | string; age?: number }
export type Applicant = { participantId: string; fullName: string; isSelf: boolean; eligible: boolean; alreadyApplied?: boolean; age?: number; gender?: string; ineligibleReason?: string | null }

export async function citizenToken(request: APIRequestContext): Promise<string> {
  const login = await request.post(`${API_ROOT}/auth/citizen/login`, { data: { identifier: TEST_TCKN, password: TEST_PASSWORD } })
  expect(login.ok(), 'citizen login API should accept E2E credentials').toBeTruthy()
  const loginJson = await login.json()
  if (loginJson.data?.accessToken) return loginJson.data.accessToken
  const verify = await request.post(`${API_ROOT}/auth/citizen/verify-otp`, { data: { otpSessionToken: loginJson.data.otpSessionToken, code: TEST_OTP } })
  expect(verify.ok(), 'citizen OTP API should accept E2E OTP').toBeTruthy()
  return (await verify.json()).data.accessToken
}
export const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` })
export async function apiGet<T>(request: APIRequestContext, token: string, path: string): Promise<T> {
  const response = await request.get(`${API_ROOT}${path}`, { headers: authHeaders(token) })
  expect(response.ok(), `${path} should return OK`).toBeTruthy()
  return ((await response.json()) as ApiEnvelope<T>).data
}
export async function apiPost<T>(request: APIRequestContext, token: string, path: string, data: unknown = {}): Promise<{ status: number; body: ApiEnvelope<T> }> {
  const response = await request.post(`${API_ROOT}${path}`, { headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, data })
  return { status: response.status(), body: await response.json().catch(() => ({ data: null as T })) as ApiEnvelope<T> }
}
export async function cancelStaleE2eApplications(request: APIRequestContext, token: string, module: string, namePrefix: string): Promise<void> {
  const apps = await apiGet<Paged<{ id: string; module?: string; groupName?: string; facilityName?: string; canCancel?: boolean }>>(
    request, token, `/me/facilities/applications?page=1&limit=200&scope=family`,
  ).catch(() => ({ items: [] }))
  const stale = apps.items.filter((a) =>
    a.module === module && a.canCancel && (a.groupName?.startsWith(namePrefix) || a.facilityName?.startsWith(namePrefix)))
  for (const a of stale) {
    await request.delete(`${API_ROOT}/me/facilities/applications/${a.id}`, { headers: authHeaders(token) }).catch(() => {})
  }
}

/**
 * Video spec'leri UI'dan başvuru gönderirken ADI E2E öneki taşımayan GERÇEK gruplara da
 * kayıt bırakabiliyor; `cancelStaleE2eApplications` yalnız ada göre süzdüğü için bunlar
 * temizlenmiyordu. Kalan kayıt bir sonraki koşuda o grubu `alreadyApplied` yapıp
 * "Başvurunuz alındı" toast'ının hiç çıkmamasına — yani ürün hatası olmadan kırmızıya —
 * yol açıyordu. Bu yüzden modüldeki iptal edilebilir TÜM başvurular temizlenir.
 */
export async function cancelAllCancellableApplications(request: APIRequestContext, token: string, module: string): Promise<void> {
  const apps = await apiGet<Paged<{ id: string; module?: string; canCancel?: boolean }>>(
    request, token, `/me/facilities/applications?page=1&limit=200&scope=family`,
  ).catch(() => ({ items: [] }))
  for (const a of apps.items.filter((x) => x.module === module && x.canCancel)) {
    await request.delete(`${API_ROOT}/me/facilities/applications/${a.id}`, { headers: authHeaders(token) }).catch(() => {})
  }
}
export async function ensureChild(request: APIRequestContext, token: string): Promise<Child> {
  const getChildren = async () => apiGet<Child[]>(request, token, '/auth/citizen/children')
  let current = await getChildren()
  if (current.length > 0) return current[0]
  const preview = await apiPost<{ children: Array<{ tckn: string; alreadyAdded?: boolean }> }>(request, token, '/auth/citizen/family-members/fetch-from-nvi', {})
  expect(preview.status, 'NVI child preview should be available in dev/test').toBe(200)
  const selectable = preview.body.data.children.filter((c) => !c.alreadyAdded).map((c) => c.tckn)
  if (selectable.length > 0) {
    const confirm = await apiPost(request, token, '/auth/citizen/family-members/confirm-from-nvi', { selectedTckns: selectable })
    expect([200, 201], `NVI confirm should add test children: ${JSON.stringify(confirm.body)}`).toContain(confirm.status)
  }
  current = await getChildren()
  expect(current.length, 'test citizen should have at least one child after NVI sync').toBeGreaterThan(0)
  return current[0]
}
export async function screenshot(page: Page, name: string) { await page.screenshot({ path: `${ARTIFACT_DIR}/${name}.png`, fullPage: true }) }
export async function waitIdle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.keyboard.press('Escape').catch(() => {})
  // Hata bulgusu (2026-09-02): `name: 'Kapat'` varsayılan olarak SUBSTRING eşleşir;
  // sayfada "Kapatılan anketler" gibi bir metin içeren tıklanabilir bir öğe varsa
  // (ör. bir dashboard kartı) o da eşleşip yanlışlıkla tıklanıyordu. `exact: true`
  // ile yalnızca tam "Kapat" adlı gerçek kapatma düğmeleri hedeflenir.
  const close = page.getByRole('button', { name: 'Kapat', exact: true }).first()
  if (await close.isVisible().catch(() => false)) await close.click({ force: true }).catch(() => {})
}
export async function chooseApplicant(page: Page, namePattern: string | RegExp, scope?: Locator) {
  const root = scope ?? page
  const applicant = root.getByRole('button').filter({ hasText: namePattern }).first()
  await expect(applicant, `eligible applicant ${String(namePattern)} should be visible`).toBeVisible({ timeout: 10000 })
  await expect(applicant).toBeEnabled()
  const alreadySelected = await applicant.getAttribute('aria-pressed') === 'true'
  if (!alreadySelected) await applicant.click()
}
export async function assertIneligibleApplicant(page: Page) {
  const disabled = page.getByRole('button').filter({ hasText: /uygun değil|Yaş|Yalnızca|En az|En fazla|cinsiyet/i }).first()
  await expect(disabled, 'at least one applicant should show clear ineligibility reason').toBeVisible({ timeout: 10000 })
  await expect(disabled).toBeDisabled()
}
export async function acceptTermsIfPresent(page: Page) {
  const checkbox = page.getByRole('checkbox').first()
  if (await checkbox.isVisible().catch(() => false)) {
    await checkbox.check({ force: true }).catch(() => {})
    return
  }
  const terms = page.getByLabel(/okudum|kabul|onay/i).first()
  if (await terms.isVisible().catch(() => false)) await terms.check({ force: true }).catch(async () => terms.click({ force: true }))
  const textTerms = page.getByText(/okudum|kabul ediyorum|şartları/i).first()
  if (await textTerms.isVisible().catch(() => false)) await textTerms.click({ force: true }).catch(() => {})
}
export function firstName(fullName: string): string { return fullName.trim().split(/\s+/)[0] }
export function cleanProgramName(name: string): string {
  return name
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\b\d+\s*g[üu]n\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
