import { apiToken } from './facilityFixture'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'

const uniq = () => Math.random().toString(36).slice(2, 10)
const iso = (d: Date) => d.toISOString()
const isoDate = (d: Date) => d.toISOString().slice(0, 10)

async function post(path: string, body: unknown, _retried = false): Promise<any> {
  const token = await apiToken()
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (r.status === 401 && !_retried) {
    await apiToken(true)
    return post(path, body, true)
  }
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}: ${JSON.stringify(json)}`)
  return json.data ?? json
}

async function get(path: string, _retried = false): Promise<any> {
  const token = await apiToken()
  const r = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (r.status === 401 && !_retried) {
    await apiToken(true)
    return get(path, true)
  }
  const json = await r.json().catch(() => ({}))
  return json.data ?? json
}

const WEEKDAY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export const FACILITY_MODULES = ['sports', 'pool', 'youth-camp', 'scout-camp', 'science-center', 'kasif'] as const
export type FacilityModule = (typeof FACILITY_MODULES)[number]

export interface ModGatingFixture {
  module: FacilityModule
  facilityId: string
  sessionDate: string
  fullGroupId: string
  offGroupId: string
}

function makeGroup(facilityId: string, branchId: string, name: string, day: string, attendanceMode: string, _managerId: string | null) {
  const today = new Date()
  const periodStart = isoDate(today)
  const periodEnd = isoDate(new Date(today.getTime() + 90 * 86400000))
  return {
    facilityId, branchId, parentGroupId: null, name,
    description: 'E2E mod-gating test grubu', type: 'kurs', gender: 'mixed',
    capacity: 20, reserveCapacity: 5, ageMin: 6, ageMax: 60,
    schedule: [{ day, startTime: '10:00', endTime: '11:00' }],
    attendanceMode,
    fee: { isPaid: false },
    conditions: { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: '' },
    periodStart, periodEnd, periodMonths: 3, periodType: 'month', periodCount: 3,
    applicationStartDate: periodStart, applicationEndDate: periodEnd,
    academyWhitelistEnabled: false, absenceLimit: 0, consecutiveAbsenceLimit: 0,
    entryGraceMinutes: 15, instructorId: null, isActive: true,
    autoApprove: true, attendanceLimitOverride: false, attendanceLimitType: 'unlimited', attendanceLimitCount: 0,
  }
}

export async function setupModGatingFixture(module: FacilityModule = 'sports'): Promise<ModGatingFixture> {
  const tag = uniq()
  const me = await get('/auth/me')
  const managerId = me?.me?.id ?? me?.id ?? null

  const serviceFacility = await post('/service-facilities', {
    name: `E2E ModGating Hizmet ${module} ${tag}`, type: module, locationType: 'Indoor',
    city: 'İstanbul', district: 'Sultangazi', address: 'E2E No:1', latitude: 41.1039, longitude: 28.8674, managerId,
    weekdayOpen: '08:00', weekdayClose: '22:00', weekendOpen: '09:00', weekendClose: '20:00',
    parkingCapacity: 0, parkingType: 'Free', capacity: 200,
  })

  const facility = await post(`/${module}/facilities`, {
    name: `E2E ModGating Tesis ${module} ${tag}`, kind: 'indoor',
    serviceFacilityId: serviceFacility.id, managerId, capacity: 100, isActive: true, grantAccess: false,
  })
  const facilityId = facility.id ?? facility

  const branch = await post(`/${module}/branches`, {
    name: `E2E ModGating Branş ${module} ${tag}`, description: 'e2e', periodMonths: 3,
    absenceLimit: 5, consecutiveAbsenceLimit: 3, isActive: true,
  })
  const branchId = branch.id

  const target = new Date()
  target.setDate(target.getDate() + 2)
  const sessionDate = isoDate(target)
  const day = WEEKDAY[target.getDay()]

  const fullGroup = await post(`/${module}/groups`, makeGroup(facilityId, branchId, `FULL ${module} ${tag}`, day, 'full', managerId))
  const offGroup = await post(`/${module}/groups`, makeGroup(facilityId, branchId, `OFF ${module} ${tag}`, day, 'off', managerId))

  for (const gid of [fullGroup.id, offGroup.id]) {
    await post(`/${module}/sessions`, {
      facilityId, groupId: gid, date: sessionDate, startTime: '10:00', endTime: '11:00',
    })
  }

  return { module, facilityId, sessionDate, fullGroupId: fullGroup.id, offGroupId: offGroup.id }
}

export { iso, isoDate }

const fakeTckn = () => {
  let s = '1'
  for (let i = 0; i < 10; i++) s += Math.floor(Math.random() * 10)
  return s
}

export interface AbsenceFixture {
  module: FacilityModule
  facilityId: string
  groupId: string
  sessionId: string
  sessionDate: string
  participantName: string
}

export async function setupAbsenceFixture(module: FacilityModule = 'sports'): Promise<AbsenceFixture> {
  const tag = uniq()
  const me = await get('/auth/me')
  const managerId = me?.me?.id ?? me?.id ?? null

  const serviceFacility = await post('/service-facilities', {
    name: `E2E Absence Hizmet ${module} ${tag}`, type: module, locationType: 'Indoor',
    city: 'İstanbul', district: 'Sultangazi', address: 'E2E No:1', latitude: 41.1039, longitude: 28.8674, managerId,
    weekdayOpen: '08:00', weekdayClose: '22:00', weekendOpen: '09:00', weekendClose: '20:00',
    parkingCapacity: 0, parkingType: 'Free', capacity: 200,
  })
  const facility = await post(`/${module}/facilities`, {
    name: `E2E Absence Tesis ${module} ${tag}`, kind: 'indoor',
    serviceFacilityId: serviceFacility.id, managerId, capacity: 100, isActive: true, grantAccess: false,
  })
  const facilityId = facility.id ?? facility
  const branch = await post(`/${module}/branches`, {
    name: `E2E Absence Branş ${module} ${tag}`, description: 'e2e', periodMonths: 3,
    absenceLimit: 5, consecutiveAbsenceLimit: 3, isActive: true,
  })

  const today = new Date()
  const day = WEEKDAY[today.getDay()]
  const groupBody = makeGroup(facilityId, branch.id, `ABS ${module} ${tag}`, day, 'full', managerId)
  groupBody.absenceLimit = 5
  groupBody.consecutiveAbsenceLimit = 3
  const group = await post(`/${module}/groups`, groupBody)

  const participantName = `E2E Katılımcı ${module} ${tag}`
  const reg = await post(`/${module}/registrations`, {
    groupId: group.id, fullName: participantName, tckn: fakeTckn(),
    phone: '05551112233', birthDate: '2000-05-15T00:00:00Z', guardianPhone: '05559998877',
  })

  const sessionDate = isoDate(today)
  const session = await post(`/${module}/sessions`, {
    facilityId, groupId: group.id, date: sessionDate, startTime: '10:00', endTime: '11:00',
  })

  await post(`/${module}/attendance/save`, {
    sessionId: session.id,
    marks: [{ registrationId: reg.id, status: 'absent' }],
    confirm: true,
  })

  return { module, facilityId, groupId: group.id, sessionId: session.id, sessionDate, participantName }
}
