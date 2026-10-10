import { APIRequestContext, request as pwRequest } from '@playwright/test'
import { TEST_TCKN, TEST_PASSWORD, TEST_OTP } from './auth'

const API = process.env.E2E_API_URL || process.env.API_BASE || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

export async function newContext(): Promise<APIRequestContext> {
  return pwRequest.newContext()
}

export async function getAdminToken(rc: APIRequestContext): Promise<string> {
  const login = await rc.post(`${API}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
  const loginJson = (await login.json()).data
  if (loginJson?.accessToken) return loginJson.accessToken
  const verify = await rc.post(`${API}/auth/verify-otp`, { data: { otpSessionToken: loginJson.otpSessionToken, code: ADMIN_OTP } })
  return (await verify.json()).data.accessToken
}

export async function getCitizenToken(rc: APIRequestContext): Promise<string> {
  const login = await rc.post(`${API}/auth/citizen/login`, { data: { identifier: TEST_TCKN, password: TEST_PASSWORD } })
  const sess = (await login.json()).data.otpSessionToken
  const verify = await rc.post(`${API}/auth/citizen/verify-otp`, { data: { otpSessionToken: sess, code: TEST_OTP } })
  return (await verify.json()).data.accessToken
}

export interface Child { id: string; fullName: string; birthDate: string; gender: number }

export async function getChildren(rc: APIRequestContext, token: string): Promise<Child[]> {
  const r = await rc.get(`${API}/auth/citizen/children`, { headers: { Authorization: `Bearer ${token}` } })
  const body = await r.json()
  return (body.data ?? []) as Child[]
}

export async function switchToChild(rc: APIRequestContext, token: string, childId: string): Promise<string> {
  const r = await rc.post(`${API}/auth/citizen/children/${childId}/switch`, { headers: { Authorization: `Bearer ${token}` } })
  return (await r.json()).data.accessToken
}

export interface Group {
  id: string
  branchName: string
  name: string
  capacity: number
  registeredCount: number
  ageMin: number
  ageMax: number
  gender: string
  scheduleSummary: string
}

export async function listGroups(rc: APIRequestContext, token: string, params: Record<string, string | number | boolean> = {}): Promise<Group[]> {
  const all: Group[] = []
  let page = 1
  let total = Infinity
  while (all.length < total && page <= 20) {
    const merged: Record<string, string> = { page: String(page), limit: '100', onlySubGroups: 'true', showAll: 'true' }
    for (const [k, v] of Object.entries(params)) merged[k] = String(v)
    const qs = new URLSearchParams(merged)
    const r = await rc.get(`${API}/me/facilities/sports/discover?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
    const data = (await r.json()).data ?? {}
    const items = (data.items ?? []) as Group[]
    all.push(...items)
    total = data.totalCount ?? all.length
    if (items.length === 0) break
    page++
  }
  return all
}

export interface ApplyResult { status: number; body: any }

export async function apply(rc: APIRequestContext, token: string, groupId: string, data: unknown = {}): Promise<ApplyResult> {
  const r = await rc.post(`${API}/me/facilities/sports/groups/${groupId}/apply`, {
    headers: { Authorization: `Bearer ${token}` },
    data: data as Record<string, unknown>,
  })
  const result = { status: r.status(), body: await r.json().catch(() => ({})) }
  if ((result.status === 200 || result.status === 201) && result.body?.data?.id) {
    trackedApplicationIds.add(result.body.data.id)
  }
  return result
}

const trackedApplicationIds = new Set<string>()

export async function cleanupTrackedSportsRegistrations(rc: APIRequestContext): Promise<void> {
  if (trackedApplicationIds.size === 0) return
  const adminToken = await getAdminToken(rc)
  const adminAuth = { Authorization: `Bearer ${adminToken}` }
  for (const id of trackedApplicationIds) {
    let removedOk = false
    for (let attempt = 0; attempt < 4 && !removedOk; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 300))
      const appRes = await rc.get(`${API}/sports/applications/${id}`, { headers: adminAuth }).catch(() => null)
      if (!appRes?.ok()) continue
      const app = (await appRes.json()).data
      if (!app?.groupId || !app?.tckn) continue
      const rosterRes = await rc.get(`${API}/sports/registrations/roster?groupId=${app.groupId}`, { headers: adminAuth }).catch(() => null)
      const roster = rosterRes?.ok() ? (await rosterRes.json()).data ?? [] : []
      const waitlistRes = await rc.get(`${API}/sports/registrations/waitlist?groupId=${app.groupId}`, { headers: adminAuth }).catch(() => null)
      const waitlist = waitlistRes?.ok() ? (await waitlistRes.json()).data ?? [] : []
      const match = [...roster, ...waitlist].find((r: { tckn?: string }) => r.tckn === app.tckn)
      if (match?.id) {
        const rm = await rc.post(`${API}/sports/registrations/${match.id}/remove`, {
          headers: { ...adminAuth, 'Content-Type': 'application/json' },
          data: { reason: 'e2e suite cleanup' },
        }).catch(() => null)
        if (rm?.ok()) removedOk = true
      }
    }
  }
  trackedApplicationIds.clear()
}

export async function cancel(rc: APIRequestContext, token: string, applicationId: string): Promise<ApplyResult> {
  const r = await rc.delete(`${API}/me/facilities/applications/${applicationId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return { status: r.status(), body: await r.json().catch(() => ({})) }
}

export const ageOf = (birthDate: string): number =>
  Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))

interface AppItem { id: string; status: string; module?: string }

async function listApplications(rc: APIRequestContext, token: string): Promise<AppItem[]> {
  const r = await rc.get(`${API}/me/facilities/applications?page=1&limit=200`, { headers: { Authorization: `Bearer ${token}` } })
  const body = await r.json()
  return (body.data?.items ?? []) as AppItem[]
}

export async function cancelAllApplications(rc: APIRequestContext, token: string): Promise<number> {
  let removed = 0
  let adminToken: string | null = null
  const apps = await listApplications(rc, token)
  for (const a of apps) {
    if (a.status === 'rejected') continue
    const r = await cancel(rc, token, a.id)
    if (r.status === 200 || r.status === 204) {
      removed++
      continue
    }
    if (r.body?.errorCode === 'CANCEL_WINDOW_PASSED') {
      adminToken = adminToken ?? await getAdminToken(rc)
      const module = a.module || 'sports'
      const adminDelete = await rc.delete(`${API}/${module}/applications/${a.id}`, { headers: { Authorization: `Bearer ${adminToken}` } })
      if (adminDelete.ok()) removed++
    }
  }
  return removed
}

export async function cleanFamilyApplications(baseToken: string, childIds: string[]): Promise<void> {
  const rc = await newContext()
  await cleanupTrackedSportsRegistrations(rc)
  await cancelAllApplications(rc, baseToken)
  for (const cid of childIds) {
    const ct = await switchToChild(rc, baseToken, cid)
    await cancelAllApplications(rc, ct)
  }
  await rc.dispose()
}

async function cleanupPreviousE2eSportsFixtures(rc: APIRequestContext, auth: Record<string, string>): Promise<void> {
  const list = await (await rc.get(`${API}/sports/facilities?limit=200`, { headers: auth })).json()
  const stale = ((list?.data?.items ?? []) as Array<{ id: string; name: string }>)
    .filter((f) => f.name.startsWith('E2E SportsScenario'))
  for (const f of stale) {
    const groupsResp = await (await rc.get(`${API}/sports/groups?facilityId=${f.id}&limit=200`, { headers: auth })).json()
    const groups = (groupsResp?.data?.items ?? []) as Array<{ id: string; parentGroupId: string | null }>
    for (const g of groups.filter((x) => x.parentGroupId)) {
      await rc.delete(`${API}/sports/groups/${g.id}`, { headers: auth }).catch(() => {})
      await rc.delete(`${API}/sports/groups/${g.id}/permanent`, { headers: auth }).catch(() => {})
    }
    for (const g of groups.filter((x) => !x.parentGroupId)) {
      await rc.delete(`${API}/sports/groups/${g.id}`, { headers: auth }).catch(() => {})
      await rc.delete(`${API}/sports/groups/${g.id}/permanent`, { headers: auth }).catch(() => {})
    }
    await rc.delete(`${API}/sports/facilities/${f.id}`, { headers: auth }).catch(() => {})
    await rc.delete(`${API}/sports/facilities/${f.id}/permanent`, { headers: auth }).catch(() => {})
  }
}

export async function ensureAdultMixedGroup(): Promise<void> {
  const rc = await newContext()
  try {
    const adminToken = await getAdminToken(rc)
    const auth = { Authorization: `Bearer ${adminToken}` }
    await cleanupPreviousE2eSportsFixtures(rc, auth)
    const me = await (await rc.get(`${API}/auth/me`, { headers: auth })).json()
    const managerId = me?.data?.me?.id
    const tag = `E2E SportsScenario ${Date.now()}${Math.random().toString(36).slice(2, 6)}`

    const sf = await (await rc.post(`${API}/service-facilities`, {
      headers: auth,
      data: {
        name: `${tag} Hizmet`, type: 'sports', locationType: 'Indoor',
        city: 'İstanbul', district: 'Sultangazi', address: 'E2E No:1', latitude: 41.1039, longitude: 28.8674, managerId,
        weekdayOpen: '08:00', weekdayClose: '22:00', weekendOpen: '09:00', weekendClose: '20:00',
        parkingCapacity: 0, parkingType: 'Free', capacity: 200,
      },
    })).json()

    const facility = await (await rc.post(`${API}/sports/facilities`, {
      headers: auth,
      data: { name: `${tag} Tesis`, kind: 'indoor', serviceFacilityId: sf.data.id, managerId, capacity: 100, isActive: true, grantAccess: false },
    })).json()
    const facilityId = typeof facility.data === 'string' ? facility.data : facility.data.id

    const branch = await (await rc.post(`${API}/sports/branches`, {
      headers: auth,
      data: { name: `${tag} Branş`, description: 'e2e', periodMonths: 3, absenceLimit: 5, consecutiveAbsenceLimit: 3, isActive: true },
    })).json()
    const branchId = branch.data.id

    const today = new Date()
    const isoDate = (d: Date) => d.toISOString().slice(0, 10)
    const plusDays = (n: number) => isoDate(new Date(today.getTime() + n * 86400000))
    const todayIsoDate = () => plusDays(0)
    const periodStart = plusDays(7)
    const periodEnd = plusDays(90)
    const applicationStart = plusDays(-5)
    const applicationEnd = plusDays(60)
    const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayName = (offset: number) => WEEKDAYS[(today.getDay() + offset) % 7]

    async function createGroup(opts: {
      name: string
      gender?: string
      ageMin?: number
      ageMax?: number
      capacity?: number
      reserveCapacity?: number
      days?: string[]
      startTime?: string
      endTime?: string
      applicationStart?: string
      applicationEnd?: string
    }): Promise<void> {
      const days = opts.days ?? [dayName(0)]
      const schedule = days.map((d) => ({ day: d, startTime: opts.startTime ?? '10:00', endTime: opts.endTime ?? '11:00' }))
      const desiredStart = opts.applicationStart ?? applicationStart
      const desiredEnd = opts.applicationEnd ?? applicationEnd
      const safeCreateStart = desiredStart < todayIsoDate() ? todayIsoDate() : desiredStart
      const createResp = await rc.post(`${API}/sports/groups`, {
        headers: auth,
        data: {
          facilityId, branchId, parentGroupId: null,
          name: `${opts.name} Ana`, description: 'e2e', type: 'kurs', gender: opts.gender ?? 'mixed',
          capacity: opts.capacity ?? 50, reserveCapacity: opts.reserveCapacity ?? 10,
          ageMin: opts.ageMin ?? 6, ageMax: opts.ageMax ?? 60,
          schedule, attendanceMode: 'full',
          fee: { isPaid: false },
          conditions: { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: '' },
          periodStart, periodEnd, periodMonths: 3, periodType: 'month', periodCount: 3,
          applicationStartDate: safeCreateStart,
          applicationEndDate: desiredEnd,
          academyWhitelistEnabled: false, absenceLimit: 0, consecutiveAbsenceLimit: 0,
          entryGraceMinutes: 15, instructorId: null, isActive: true,
          autoApprove: true, attendanceLimitOverride: false, attendanceLimitType: 'unlimited', attendanceLimitCount: 0,
        },
      })
      if (!createResp.ok()) throw new Error(`Ana grup oluşturulamadı (${opts.name} Ana): ${createResp.status()} ${await createResp.text()}`)
      const list = await (await rc.get(`${API}/sports/groups?facilityId=${facilityId}&limit=100`, { headers: auth })).json()
      const parent = (list?.data?.items ?? []).find((g: { name: string }) => g.name === `${opts.name} Ana`)
      if (!parent?.id) throw new Error(`Ana grup bulunamadı (${opts.name}): ${JSON.stringify(list)}`)

      if (safeCreateStart !== desiredStart) {
        const detail = await (await rc.get(`${API}/sports/groups/${parent.id}`, { headers: auth })).json()
        const g = detail.data
        const backdate = await rc.put(`${API}/sports/groups/${parent.id}`, {
          headers: auth,
          data: {
            facilityId: g.facilityId, branchId: g.branchId, parentGroupId: g.parentGroupId ?? null,
            name: g.name, description: g.description ?? '', type: g.type, gender: g.gender,
            capacity: g.capacity, reserveCapacity: g.reserveCapacity,
            ageMin: g.ageMin, ageMax: g.ageMax,
            schedule: g.schedule ?? [], attendanceMode: g.attendanceMode ?? 'full',
            fee: g.fee ?? { isPaid: false },
            conditions: g.conditions ?? { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: '' },
            periodStart: g.periodStart, periodEnd: g.periodEnd, periodMonths: g.periodMonths, periodType: g.periodType ?? 'date_range', periodCount: g.periodCount, periodUnit: g.periodUnit ?? 'month', periodDays: g.periodDays,
            applicationStartDate: desiredStart, applicationEndDate: desiredEnd,
            academyWhitelistEnabled: g.academyWhitelistEnabled ?? false, absenceLimit: g.absenceLimit ?? 0, consecutiveAbsenceLimit: g.consecutiveAbsenceLimit ?? 0,
            entryGraceMinutes: g.entryGraceMinutes ?? 15, instructorId: g.instructorId ?? null, isActive: g.isActive,
            autoApprove: g.autoApprove ?? true, attendanceLimitOverride: g.attendanceLimitOverride ?? false, attendanceLimitType: g.attendanceLimitType ?? 'unlimited', attendanceLimitCount: g.attendanceLimitCount ?? 0,
          },
        })
        if (!backdate.ok()) throw new Error(`Ana grup geriye tarihlenemedi (${opts.name} Ana): ${backdate.status()} ${await backdate.text()}`)
      }

      await rc.post(`${API}/sports/groups/${parent.id}/sub-groups`, {
        headers: auth,
        data: {
          parentGroupId: parent.id,
          name: opts.name, description: 'e2e', gender: opts.gender ?? 'mixed',
          capacity: opts.capacity ?? 50, reserveCapacity: opts.reserveCapacity ?? 10,
          ageMin: opts.ageMin ?? 6, ageMax: opts.ageMax ?? 60,
          schedule, attendanceMode: 'full',
          fee: { isPaid: false },
          conditions: { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: '' },
          periodStart, periodEnd, periodMonths: 3,
          applicationStartDate: safeCreateStart,
          applicationEndDate: desiredEnd,
          instructorId: null, isActive: true,
        },
      })

      if (safeCreateStart !== desiredStart) {
        const subList = await (await rc.get(`${API}/sports/groups?facilityId=${facilityId}&limit=100`, { headers: auth })).json()
        const sub = (subList?.data?.items ?? []).find((g: { name: string }) => g.name === opts.name)
        if (sub?.id) {
          const subDetail = await (await rc.get(`${API}/sports/groups/${sub.id}`, { headers: auth })).json()
          const sg = subDetail.data
          await rc.put(`${API}/sports/groups/${sub.id}`, {
            headers: auth,
            data: {
              facilityId: sg.facilityId, branchId: sg.branchId, parentGroupId: sg.parentGroupId ?? null,
              name: sg.name, description: sg.description ?? '', type: sg.type, gender: sg.gender,
              capacity: sg.capacity, reserveCapacity: sg.reserveCapacity,
              ageMin: sg.ageMin, ageMax: sg.ageMax,
              schedule: sg.schedule ?? [], attendanceMode: sg.attendanceMode ?? 'full',
              fee: sg.fee ?? { isPaid: false },
              conditions: sg.conditions ?? { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: '' },
              periodStart: sg.periodStart, periodEnd: sg.periodEnd, periodMonths: sg.periodMonths, periodType: sg.periodType ?? 'date_range', periodCount: sg.periodCount, periodUnit: sg.periodUnit ?? 'month', periodDays: sg.periodDays,
              applicationStartDate: desiredStart, applicationEndDate: desiredEnd,
              academyWhitelistEnabled: sg.academyWhitelistEnabled ?? false, absenceLimit: sg.absenceLimit ?? 0, consecutiveAbsenceLimit: sg.consecutiveAbsenceLimit ?? 0,
              entryGraceMinutes: sg.entryGraceMinutes ?? 15, instructorId: sg.instructorId ?? null, isActive: sg.isActive,
              autoApprove: sg.autoApprove ?? true, attendanceLimitOverride: sg.attendanceLimitOverride ?? false, attendanceLimitType: sg.attendanceLimitType ?? 'unlimited', attendanceLimitCount: sg.attendanceLimitCount ?? 0,
            },
          })
        }
      }
    }

    await createGroup({ name: `${tag} Grup`, gender: 'mixed', ageMin: 6, ageMax: 60, capacity: 50, reserveCapacity: 10, days: [dayName(0)] })
    await createGroup({ name: `${tag} Grup B`, gender: 'mixed', ageMin: 6, ageMax: 60, capacity: 50, reserveCapacity: 10, days: [dayName(0)] })
    await createGroup({ name: `${tag} AksamAyniGun`, gender: 'mixed', ageMin: 6, ageMax: 60, capacity: 50, reserveCapacity: 10, days: [dayName(0)], startTime: '20:00', endTime: '21:00' })
    await createGroup({ name: `${tag} 2Gun`, gender: 'mixed', ageMin: 6, ageMax: 60, capacity: 50, reserveCapacity: 10, days: [dayName(1), dayName(2)] })
    await createGroup({ name: `${tag} 3Gun`, gender: 'mixed', ageMin: 6, ageMax: 60, capacity: 50, reserveCapacity: 10, days: [dayName(3), dayName(4), dayName(5)] })
    await createGroup({ name: `${tag} Cocuk`, gender: 'mixed', ageMin: 7, ageMax: 12, capacity: 50, reserveCapacity: 10, days: [dayName(0)] })
    await createGroup({ name: `${tag} Kadin`, gender: 'female', ageMin: 6, ageMax: 60, capacity: 50, reserveCapacity: 10, days: [dayName(0)] })
    await createGroup({ name: `YEDEK-TEST ${tag}`, gender: 'mixed', ageMin: 1, ageMax: 99, capacity: 1, reserveCapacity: 1, days: [dayName(1)] })
    await createGroup({ name: `KAPALI-PENCERE ${tag}`, gender: 'mixed', ageMin: 6, ageMax: 60, capacity: 50, reserveCapacity: 10, days: [dayName(0)], applicationStart: plusDays(10), applicationEnd: plusDays(40) })
  } finally {
    await rc.dispose()
  }
}
