import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test'
import { apiToken } from './helpers/facilityFixture'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const MODULE = 'sports'

function uniq(p: string) { return `${p}${Date.now()}${Math.random().toString(36).slice(2, 6)}` }
const future = (days: number) => {
  const x = new Date()
  x.setUTCDate(x.getUTCDate() + days)
  return `${x.toISOString().slice(0, 10)}T12:00:00.000Z`
}
const dayOnly = (iso: string) => iso.slice(0, 10)

let ctx: APIRequestContext
async function post<T>(path: string, body: unknown, _retried = false): Promise<{ status: number; data: T | null; message?: string }> {
  const token = await apiToken()
  const res = await ctx.post(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, data: body })
  if (res.status() === 401 && !_retried) {
    await apiToken(true)
    return post<T>(path, body, true)
  }
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), data: (json?.data ?? null) as T | null, message: json?.message }
}
async function get<T>(path: string, _retried = false): Promise<{ status: number; data: T | null }> {
  const token = await apiToken()
  const res = await ctx.get(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status() === 401 && !_retried) {
    await apiToken(true)
    return get<T>(path, true)
  }
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), data: (json?.data ?? null) as T | null }
}
async function del(path: string) {
  const token = await apiToken()
  await ctx.delete(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
}

test.beforeAll(async () => { ctx = await pwRequest.newContext() })
test.afterAll(async () => { await ctx.dispose() })

async function makeBranch(facilityId: string) {
  const b = await post<{ id: string }>(`/${MODULE}/branches`, {
    facilityId, name: uniq('E2E Branş '), gender: 'mixed', ageMin: 6, ageMax: 60, isActive: true,
  })
  expect(b.status, b.message).toBeLessThan(300)
  return b.data!.id
}

async function makeFacility(): Promise<string> {
  const me = await get<{ me: { id: string } }>('/auth/me')
  const managerId = me.data?.me?.id
  const tag = uniq('E2E PeriodUnit ')
  const sf = await post<{ id: string }>('/service-facilities', {
    name: `${tag}Hizmet`, type: 'Sosyal Tesis', locationType: 'Indoor',
    city: 'İstanbul', district: 'Sultangazi', address: 'E2E No:1', latitude: 41.1039, longitude: 28.8674, managerId,
    weekdayOpen: '08:00', weekdayClose: '22:00', weekendOpen: '09:00', weekendClose: '20:00',
    parkingCapacity: 0, parkingType: 'Free', capacity: 200,
  })
  expect(sf.status, sf.message).toBeLessThan(300)
  const facility = await post<{ id: string } | string>(`/${MODULE}/facilities`, {
    name: `${tag}Tesis`, kind: 'indoor',
    serviceFacilityId: sf.data!.id, managerId, capacity: 100, isActive: true, grantAccess: false,
  })
  expect(facility.status, facility.message).toBeLessThan(300)
  const facilityId = typeof facility.data === 'string' ? facility.data : facility.data!.id
  return facilityId
}

test.describe('Grup periyot birimi (ay/gün) + akademi periyot serbestisi', () => {
  test('gün-bazlı grup: periodType=date_range, periodEnd = start + N gün', async () => {
    test.setTimeout(90000)
    const facilityId = await makeFacility()
    const branchId = await makeBranch(facilityId)

    const start = future(2)
    const g = await post<any>(`/${MODULE}/groups`, {
      facilityId, branchId, name: uniq('E2E Gün '), type: 'kurs', gender: 'mixed',
      ageMin: 6, ageMax: 60, capacity: 10, reserveCapacity: 5, attendanceMode: 'full',
      isActive: true, periodType: 'date_range', periodUnit: 'day', periodDays: 30,
      periodStart: start,
    })
    expect(g.status, g.message).toBeLessThan(300)
    expect(g.data.periodType).toBe('date_range')
    expect(g.data.periodUnit).toBe('day')
    expect(g.data.periodDays).toBe(30)
    const ps = new Date(dayOnly(g.data.periodStart) + 'T00:00:00Z')
    const expectedEnd = new Date(ps.getTime() + 30 * 86400000).toISOString().slice(0, 10)
    expect(dayOnly(g.data.periodEnd)).toBe(expectedEnd)

    await del(`/${MODULE}/groups/${g.data.id}`)
  })

  test('akademi grubu tekrarlı-ay periyotla oluşturulabilir (12-ay zorlaması yok)', async () => {
    test.setTimeout(90000)
    const facilityId = await makeFacility()
    const branchId = await makeBranch(facilityId)

    const g = await post<any>(`/${MODULE}/groups`, {
      facilityId, branchId, name: uniq('E2E Akademi '), type: 'akademi', gender: 'mixed',
      ageMin: 6, ageMax: 60, capacity: 10, reserveCapacity: 5, attendanceMode: 'full',
      isActive: true, academyWhitelistEnabled: true,
      periodType: 'recurring', periodUnit: 'month', periodMonths: 3, periodStart: future(2),
    })
    expect(g.status, g.message).toBeLessThan(300)
    expect(g.data.type).toBe('akademi')
    expect(g.data.periodType).toBe('recurring')
    expect(g.data.periodMonths).toBe(3)

    await del(`/${MODULE}/groups/${g.data.id}`)
  })

  test('mevcut tarih-aralığı grubu bozulmadan çalışır (regresyon)', async () => {
    test.setTimeout(90000)
    const facilityId = await makeFacility()
    const branchId = await makeBranch(facilityId)

    const g = await post<any>(`/${MODULE}/groups`, {
      facilityId, branchId, name: uniq('E2E Aralık '), type: 'kurs', gender: 'mixed',
      ageMin: 6, ageMax: 60, capacity: 10, reserveCapacity: 5, attendanceMode: 'full',
      isActive: true, periodType: 'date_range', periodUnit: 'month',
      periodStart: future(2), periodEnd: future(60),
    })
    expect(g.status, g.message).toBeLessThan(300)
    expect(g.data.periodType).toBe('date_range')
    expect(g.data.periodUnit).toBe('month')
    expect(g.data.periodEnd).toBeTruthy()
    expect(dayOnly(g.data.periodEnd) > dayOnly(g.data.periodStart)).toBe(true)

    await del(`/${MODULE}/groups/${g.data.id}`)
  })
})
