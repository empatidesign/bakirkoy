import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

function uniq(prefix: string) {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`
}

function fakeTckn(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  const d10raw = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7
    - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
  const d10 = ((d10raw % 10) + 10) % 10
  const d11 = (digits.reduce((sum, d) => sum + d, 0) + d10) % 10
  return [...digits, d10, d11].join('')
}

const futureDate = (days: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

let ctx: APIRequestContext
let adminToken = ''
let managerId = ''

async function apiToken(): Promise<string> {
  if (adminToken) return adminToken
  const login1 = await (await ctx.post(`${API_BASE}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })).json()
  if (login1?.data?.accessToken) { adminToken = login1.data.accessToken; return adminToken }
  const verify = await (await ctx.post(`${API_BASE}/auth/verify-otp`, {
    data: { otpSessionToken: login1.data.otpSessionToken, code: ADMIN_OTP },
  })).json()
  adminToken = verify?.data?.accessToken ?? ''
  if (!adminToken) throw new Error(`Admin API OTP failed: ${JSON.stringify(verify)}`)
  return adminToken
}

async function apiPost<T>(path: string, body: unknown): Promise<{ status: number; ok: boolean; data: T | null; errorCode?: string; message?: string }> {
  const t = await apiToken()
  const res = await ctx.post(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${t}` }, data: body })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), ok: res.ok(), data: json?.data ?? null, errorCode: json?.errorCode, message: json?.message }
}

async function apiPut<T>(path: string, body: unknown): Promise<{ status: number; ok: boolean; data: T | null; errorCode?: string; message?: string }> {
  const t = await apiToken()
  const res = await ctx.put(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${t}` }, data: body })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), ok: res.ok(), data: json?.data ?? null, errorCode: json?.errorCode, message: json?.message }
}

async function setupFacilityGroup(module: string, tag: string) {
  const sf = await apiPost<{ id: string }>('/service-facilities', {
    name: `E2E Config ${module} Hizmet ${tag}`, type: module, locationType: 'Indoor',
    city: 'İstanbul', district: 'Sultangazi', address: `E2E ${module} Mah. No:1`, latitude: 41.1039, longitude: 28.8674, managerId,
    weekdayOpen: '08:00', weekdayClose: '22:00', weekendOpen: '09:00', weekendClose: '20:00',
    parkingCapacity: 0, parkingType: 'Free', capacity: 200,
  })
  if (!sf.ok || !sf.data) throw new Error(`service-facility create failed: ${JSON.stringify(sf)}`)

  const facility = await apiPost<{ id: string } | string>(`/${module}/facilities`, {
    name: `E2E Config ${module} Tesis ${tag}`, kind: 'indoor',
    serviceFacilityId: sf.data.id, managerId, capacity: 100, isActive: true, grantAccess: false,
  })
  const facilityId = typeof facility.data === 'string' ? facility.data : facility.data?.id
  if (!facility.ok || !facilityId) throw new Error(`${module} facility create failed: ${JSON.stringify(facility)}`)

  const branch = await apiPost<{ id: string }>(`/${module}/branches`, {
    name: `E2E Config ${module} Program ${tag}`, description: 'e2e config testi', periodMonths: 3,
    absenceLimit: 5, consecutiveAbsenceLimit: 3, isActive: true,
  })
  if (!branch.ok || !branch.data) throw new Error(`${module} branch create failed: ${JSON.stringify(branch)}`)

  const baseGroupBody = {
    facilityId, branchId: branch.data.id, parentGroupId: null,
    name: `E2E Config ${module} Grubu ${tag}`, description: 'e2e config testi', type: 'kurs', gender: 'mixed',
    capacity: 20, reserveCapacity: 5, ageMin: 7, ageMax: 65,
    schedule: [{ day: 'tuesday', startTime: '10:00', endTime: '11:30' }],
    attendanceMode: 'full',
    fee: { isPaid: false, feeType: 'monthly', amount: 0, siblingDiscount: false, staffDiscount: false },
    conditions: { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: `<p>${module} programı</p>` },
    periodStart: futureDate(1), periodEnd: futureDate(90), periodMonths: 3, periodType: 'month', periodCount: 3,
    academyWhitelistEnabled: false, absenceLimit: 5, consecutiveAbsenceLimit: 3, entryGraceMinutes: 15,
    instructorId: null, isActive: true, autoApprove: false,
    attendanceLimitOverride: false, attendanceLimitType: 'unlimited', attendanceLimitCount: 0,
  }
  const group = await apiPost<{ id: string }>(`/${module}/groups`, {
    ...baseGroupBody, applicationStartDate: futureDate(0), applicationEndDate: futureDate(30),
  })
  if (!group.ok || !group.data) throw new Error(`${module} group create failed: ${JSON.stringify(group)}`)

  const backdate = await apiPut<{ id: string }>(`/${module}/groups/${group.data.id}`, {
    ...baseGroupBody, applicationStartDate: futureDate(-1), applicationEndDate: futureDate(30),
  })
  if (!backdate.ok) throw new Error(`${module} group backdate failed: ${JSON.stringify(backdate)}`)

  return { facilityId, branchId: branch.data.id, groupId: group.data.id }
}

function applicationBody(fx: { facilityId: string; branchId: string; groupId: string }, tag: string, documents: unknown[]) {
  return {
    facilityId: fx.facilityId, branchId: fx.branchId, groupId: fx.groupId,
    participantId: null,
    fullName: `E2E Config Başvuran ${tag}`,
    tckn: fakeTckn(),
    phone: '05551234567',
    email: `e2e.config.${tag}@example.com`,
    birthDate: '1995-04-12T00:00:00Z',
    guardianPhone: null,
    documents,
  }
}

test.describe('FacilityModuleRegistry — accessible-life modül-özel evrak kuralı', () => {
  test.beforeAll(async () => {
    ctx = await pwRequest.newContext()
    const t = await apiToken()
    const me = await ctx.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.json())
    managerId = me?.data?.me?.id ?? me?.data?.id
    if (!managerId) throw new Error(`managerId alınamadı: ${JSON.stringify(me)}`)
  })
  test.afterAll(async () => {
    await ctx.dispose()
  })

  test('accessible-life: evraksız başvuru DOCUMENTS_REQUIRED ile reddedilir', async () => {
    test.setTimeout(60000)
    const tag = uniq('e2ecfgacc')
    const fx = await setupFacilityGroup('accessible-life', tag)

    const res = await apiPost('/accessible-life/applications', applicationBody(fx, tag, []))
    expect(res.ok, 'evraksız başvuru kabul edilmemeli').toBeFalsy()
    expect(res.status).toBe(409)
    expect(res.errorCode).toBe('DOCUMENTS_REQUIRED')
  })

  test('accessible-life: disability_report + health_report ile başvuru kabul edilir', async () => {
    test.setTimeout(60000)
    const tag = uniq('e2ecfgacc2')
    const fx = await setupFacilityGroup('accessible-life', tag)

    const res = await apiPost('/accessible-life/applications', applicationBody(fx, tag, [
      { type: 'disability_report', objectName: `e2e/${tag}-disability.pdf`, fileName: 'engelli_raporu.pdf' },
      { type: 'health_report', objectName: `e2e/${tag}-health.pdf`, fileName: 'saglik_raporu.pdf' },
    ]))
    expect(res.ok, `evraklı başvuru kabul edilmeli: ${JSON.stringify(res)}`).toBeTruthy()
    expect(res.status).toBe(201)
  })

  test('sports: aynı evraksız başvuru şablonu accessible-life kısıtı olmadan kabul edilir (karşılaştırma)', async () => {
    test.setTimeout(60000)
    const tag = uniq('e2ecfgsports')
    const fx = await setupFacilityGroup('sports', tag)

    const res = await apiPost('/sports/applications', applicationBody(fx, tag, []))
    expect(res.ok, 'sports modülünde evrak zorunlu değil, evraksız başvuru kabul edilmeli').toBeTruthy()
    expect(res.status).toBe(201)
  })
})
