import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test'
import { apiToken } from './helpers/facilityFixture'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const MODULE = 'sports'

function uniq(p: string) { return `${p}${Date.now()}${Math.random().toString(36).slice(2, 6)}` }
function fakeTckn(): string {
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (d[0] === 0) d[0] = 1
  const d10 = ((((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10) + 10) % 10
  const d11 = (d.reduce((s, x) => s + x, 0) + d10) % 10
  return [...d, d10, d11].join('')
}
const future = (days: number) => { const x = new Date(); x.setDate(x.getDate() + days); return x.toISOString() }

let ctx: APIRequestContext

async function post<T>(path: string, body: unknown) {
  const token = await apiToken()
  const res = await ctx.post(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, data: body })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), data: (json?.data ?? null) as T | null, message: json?.message }
}
async function put(path: string, body: unknown) {
  const token = await apiToken()
  const res = await ctx.put(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, data: body })
  return { status: res.status() }
}
async function get<T>(path: string) {
  const token = await apiToken()
  const res = await ctx.get(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), data: (json?.data ?? null) as T | null }
}

test.beforeAll(async () => { ctx = await pwRequest.newContext() })
test.afterAll(async () => { await ctx.dispose() })

test.describe('Tesis roster — asıl↔yedek + yedek sıralama', () => {
  test('kapasite aşımı yedeğe düşer, demote/promote ve reorder çalışır', async () => {
    test.setTimeout(120000)

    const facRes = await get<{ items: any[] }>(`/${MODULE}/facilities?pageSize=50`)
    const facility = facRes.data?.items?.[0]
    expect(facility, 'kasif tesisi bulunmalı').toBeTruthy()
    const facilityId = facility.id

    const branch = await post<{ id: string }>(`/${MODULE}/branches`, {
      facilityId, name: uniq('E2E Branş '), gender: 'mixed', ageMin: 6, ageMax: 12, isActive: true,
    })
    expect(branch.status, branch.message).toBeLessThan(300)
    const branchId = branch.data!.id

    const groupName = uniq('E2E Grup ')
    const group = await post<{ id: string }>(`/${MODULE}/groups`, {
      facilityId, branchId, name: groupName, type: 'kurs', gender: 'mixed',
      ageMin: 6, ageMax: 12, capacity: 2, reserveCapacity: 5, attendanceMode: 'full',
      autoApprove: false, periodType: 'date_range', isActive: true,
      applicationStartDate: future(0), applicationEndDate: future(30),
      periodStart: future(1), periodEnd: future(60),
    })
    expect(group.status, group.message).toBeLessThan(300)
    const groupId = group.data!.id

    const backdate = await put(`/${MODULE}/groups/${groupId}`, {
      facilityId, branchId, name: groupName, parentGroupId: null,
      type: 'kurs', gender: 'mixed', ageMin: 6, ageMax: 12, capacity: 2, reserveCapacity: 5,
      attendanceMode: 'full', autoApprove: false, periodType: 'date_range', isActive: true,
      applicationStartDate: future(-1), applicationEndDate: future(30),
      periodStart: future(1), periodEnd: future(60),
    })
    expect(backdate.status, 'grup geriye tarihlenebilmeli').toBeLessThan(300)

    for (let i = 0; i < 4; i++) {
      const p = await post<{ id: string }>('/participants', {
        tckn: fakeTckn(), fullName: uniq('E2E Kisi '), birthDate: '2016-05-05',
        phone: `05${String(Date.now() + i).slice(-9)}`, email: `e2e.roster.${Date.now()}.${i}@ex.com`,
        guardianPhone: `05${String(Date.now() + i + 500).slice(-9)}`, deliveryChannel: 'Email',
      })
      expect(p.status, p.message).toBeLessThan(300)
      const app = await post<{ id: string }>(`/${MODULE}/applications`, {
        facilityId, branchId, groupId, participantId: p.data!.id,
        fullName: 'E2E', tckn: fakeTckn(), phone: `05${String(Date.now() + i).slice(-9)}`,
        birthDate: '2016-05-05', guardianPhone: `05${String(Date.now() + i + 700).slice(-9)}`,
      })
      expect(app.status, app.message).toBeLessThan(300)
      const appId = app.data!.id
      const appr = await post(`/${MODULE}/applications/${appId}/approve`, {})
      expect(appr.status, appr.message).toBeLessThan(300)
    }

    let roster = (await get<any[]>(`/${MODULE}/registrations/roster?groupId=${groupId}`)).data ?? []
    const mains = roster.filter((r) => r.kind === 'main' && r.status === 'active')
    const reserves = roster.filter((r) => r.kind === 'reserve' && r.status === 'active')
    expect(mains.length, 'asıl = kapasite (2)').toBe(2)
    expect(reserves.length, 'kalanlar yedek (2)').toBe(2)

    const demoteTarget = mains[0]
    const dem = await post(`/${MODULE}/registrations/${demoteTarget.id}/demote`, null)
    expect(dem.status).toBe(200)
    roster = (await get<any[]>(`/${MODULE}/registrations/roster?groupId=${groupId}`)).data ?? []
    expect(roster.find((r) => r.id === demoteTarget.id)?.kind).toBe('reserve')
    expect(roster.filter((r) => r.kind === 'main' && r.status === 'active').length).toBe(1)

    const wl = (await get<any[]>(`/${MODULE}/registrations/waitlist?groupId=${groupId}`)).data ?? []
    expect(wl.length).toBe(3)
    const reversed = [...wl].reverse().map((r) => r.id)
    const ro = await put(`/${MODULE}/registrations/waitlist/order`, { groupId, orderedIds: reversed })
    expect(ro.status).toBe(200)
    const wl2 = (await get<any[]>(`/${MODULE}/registrations/waitlist?groupId=${groupId}`)).data ?? []
    expect(wl2.map((r) => r.id)).toEqual(reversed)
    expect(wl2.map((r) => r.waitlistOrder)).toEqual([1, 2, 3])

    const prom = await post(`/${MODULE}/registrations/${demoteTarget.id}/promote`, null)
    expect(prom.status).toBe(200)
    roster = (await get<any[]>(`/${MODULE}/registrations/roster?groupId=${groupId}`)).data ?? []
    expect(roster.find((r) => r.id === demoteTarget.id)?.kind).toBe('main')

    await ctx.delete(`${API_BASE}/${MODULE}/groups/${groupId}`, { headers: { Authorization: `Bearer ${await apiToken()}` } })
  })
})
