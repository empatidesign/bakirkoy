import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test'
import { apiToken } from './helpers/facilityFixture'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'

type FacilityModule = 'kasif' | 'pool' | 'youth-camp' | 'scout-camp' | 'science-center'

const MODULES: Array<{ module: FacilityModule; kind: 'indoor' | 'outdoor' | 'mixed'; ageMin: number; ageMax: number }> = [
  { module: 'kasif', kind: 'indoor', ageMin: 6, ageMax: 12 },
  { module: 'pool', kind: 'indoor', ageMin: 8, ageMax: 80 },
  { module: 'youth-camp', kind: 'outdoor', ageMin: 13, ageMax: 25 },
  { module: 'scout-camp', kind: 'outdoor', ageMin: 8, ageMax: 18 },
  { module: 'science-center', kind: 'indoor', ageMin: 7, ageMax: 18 },
]

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
let managerId = ''

async function apiPost<T>(path: string, body: unknown): Promise<{ status: number; ok: boolean; data: T | null; errorCode?: string; message?: string }> {
  const token = await apiToken()
  const res = await ctx.post(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, data: body })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), ok: res.ok(), data: json?.data ?? null, errorCode: json?.errorCode, message: json?.message }
}

async function apiGet<T>(path: string): Promise<{ status: number; ok: boolean; data: T | null }> {
  const token = await apiToken()
  const res = await ctx.get(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), ok: res.ok(), data: json?.data ?? null }
}

async function apiPut<T>(path: string, body: unknown): Promise<{ status: number; ok: boolean; data: T | null; errorCode?: string; message?: string }> {
  const token = await apiToken()
  const res = await ctx.put(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, data: body })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), ok: res.ok(), data: json?.data ?? null, errorCode: json?.errorCode, message: json?.message }
}

async function setupFacilityGroup(config: (typeof MODULES)[number], tag: string) {
  const { module, kind, ageMin, ageMax } = config
  const sf = await apiPost<{ id: string }>('/service-facilities', {
    name: `E2E Variants ${module} Hizmet ${tag}`, type: module, locationType: kind === 'outdoor' ? 'Outdoor' : 'Indoor',
    city: 'İstanbul', district: 'Sultangazi', address: `E2E ${module} Mah. No:1`, latitude: 41.1039, longitude: 28.8674, managerId,
    weekdayOpen: '08:00', weekdayClose: '22:00', weekendOpen: '09:00', weekendClose: '20:00',
    parkingCapacity: 0, parkingType: 'Free', capacity: 200,
  })
  if (!sf.ok || !sf.data) throw new Error(`service-facility create failed: ${JSON.stringify(sf)}`)

  const facility = await apiPost<{ id: string } | string>(`/${module}/facilities`, {
    name: `E2E Variants ${module} Tesis ${tag}`, kind,
    serviceFacilityId: sf.data.id, managerId, capacity: 100, isActive: true, grantAccess: false,
  })
  const facilityId = typeof facility.data === 'string' ? facility.data : facility.data?.id
  if (!facility.ok || !facilityId) throw new Error(`${module} facility create failed: ${JSON.stringify(facility)}`)

  const branch = await apiPost<{ id: string }>(`/${module}/branches`, {
    name: `E2E Variants ${module} Program ${tag}`, description: 'e2e variants crud testi', periodMonths: 3,
    absenceLimit: 5, consecutiveAbsenceLimit: 3, isActive: true,
  })
  if (!branch.ok || !branch.data) throw new Error(`${module} branch create failed: ${JSON.stringify(branch)}`)

  const group = await apiPost<{ id: string }>(`/${module}/groups`, {
    facilityId, branchId: branch.data.id, parentGroupId: null,
    name: `E2E Variants ${module} Grubu ${tag}`, description: 'e2e variants crud testi', type: 'kurs', gender: 'mixed',
    capacity: 20, reserveCapacity: 5, ageMin, ageMax,
    schedule: [{ day: 'tuesday', startTime: '10:00', endTime: '11:30' }],
    attendanceMode: 'full',
    fee: { isPaid: false, feeType: 'monthly', amount: 0, siblingDiscount: false, staffDiscount: false },
    conditions: { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: `<p>${module} programı</p>` },
    periodStart: futureDate(1), periodEnd: futureDate(90), periodMonths: 3, periodType: 'month', periodCount: 3,
    applicationStartDate: futureDate(0), applicationEndDate: futureDate(30),
    academyWhitelistEnabled: false, absenceLimit: 5, consecutiveAbsenceLimit: 3, entryGraceMinutes: 15,
    instructorId: null, isActive: true, autoApprove: false,
    attendanceLimitOverride: false, attendanceLimitType: 'unlimited', attendanceLimitCount: 0,
  })
  if (!group.ok || !group.data) throw new Error(`${module} group create failed: ${JSON.stringify(group)}`)

  const backdate = await apiPut<{ id: string }>(`/${module}/groups/${group.data.id}`, {
    facilityId, branchId: branch.data.id, parentGroupId: null,
    name: `E2E Variants ${module} Grubu ${tag}`, description: 'e2e variants crud testi', type: 'kurs', gender: 'mixed',
    capacity: 20, reserveCapacity: 5, ageMin, ageMax,
    schedule: [{ day: 'tuesday', startTime: '10:00', endTime: '11:30' }],
    attendanceMode: 'full',
    fee: { isPaid: false, feeType: 'monthly', amount: 0, siblingDiscount: false, staffDiscount: false },
    conditions: { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: `<p>${module} programı</p>` },
    periodStart: futureDate(1), periodEnd: futureDate(90), periodMonths: 3, periodType: 'month', periodCount: 3,
    applicationStartDate: futureDate(-1), applicationEndDate: futureDate(30),
    academyWhitelistEnabled: false, absenceLimit: 5, consecutiveAbsenceLimit: 3, entryGraceMinutes: 15,
    instructorId: null, isActive: true, autoApprove: false,
    attendanceLimitOverride: false, attendanceLimitType: 'unlimited', attendanceLimitCount: 0,
  })
  if (!backdate.ok) throw new Error(`${module} group backdate failed: ${JSON.stringify(backdate)}`)

  return { facilityId, branchId: branch.data.id, groupId: group.data.id }
}

function applicationBody(fx: { facilityId: string; branchId: string; groupId: string }, tag: string, ageMin: number) {
  const birthYear = new Date().getUTCFullYear() - Math.max(ageMin + 1, 10)
  return {
    facilityId: fx.facilityId, branchId: fx.branchId, groupId: fx.groupId,
    participantId: null,
    fullName: `E2E Variants Başvuran ${tag}`,
    tckn: fakeTckn(),
    phone: '05551234567',
    email: `e2e.variants.${tag}@example.com`,
    birthDate: `${birthYear}-04-12T00:00:00Z`,
    guardianPhone: '05557654321',
    documents: [],
  }
}

test.describe('FacilityTemplate varyantları — gerçek modül endpoint CRUD akışı', () => {
  test.beforeAll(async () => {
    ctx = await pwRequest.newContext()
    const token = await apiToken()
    const me = await ctx.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())
    managerId = me?.data?.me?.id ?? me?.data?.id
    if (!managerId) throw new Error(`managerId alınamadı: ${JSON.stringify(me)}`)
  })

  test.afterAll(async () => {
    await ctx.dispose()
  })

  for (const config of MODULES) {
    test(`${config.module}: grup oluşturur, başvuru alır ve onaylar`, async () => {
      test.setTimeout(60000)
      const tag = uniq(`e2e${config.module.replace(/-/g, '')}`)
      const fx = await setupFacilityGroup(config, tag)

      const application = await apiPost<{ id: string; status?: string }>(
        `/${config.module}/applications`,
        applicationBody(fx, tag, config.ageMin),
      )
      expect(application.ok, `${config.module} başvuru oluşturulmalı: ${JSON.stringify(application)}`).toBeTruthy()
      expect(application.status).toBe(201)
      expect(application.data?.id).toBeTruthy()

      const approve = await apiPost<{ id: string; status?: string; registrationId?: string }>(
        `/${config.module}/applications/${application.data!.id}/approve`,
        { groupId: fx.groupId },
      )
      expect(approve.ok, `${config.module} başvuru onaylanmalı: ${JSON.stringify(approve)}`).toBeTruthy()
      expect(approve.status).toBe(200)

      const fetched = await apiGet<{ id: string; status?: string }>(`/${config.module}/applications/${application.data!.id}`)
      expect(fetched.ok, `${config.module} onay sonrası başvuru okunmalı: ${JSON.stringify(fetched)}`).toBeTruthy()
      expect(fetched.data?.status?.toLowerCase()).toBe('approved')
    })
  }
})
