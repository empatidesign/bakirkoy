import { test, expect } from '@playwright/test'
import { hasCredentials } from './helpers/auth'
import {
  newContext, getCitizenToken, getChildren, switchToChild,
  listGroups, apply, cancel, cleanFamilyApplications, ensureAdultMixedGroup, Group, Child,
} from './helpers/sportsApi'

const str = (o: unknown) => JSON.stringify(o)

// Backend kuralı (FacilityScheduleHelper.SlotsOverlap): çakışma için AYNI GÜN **ve**
// SAAT ARALIĞININ KESİŞMESİ gerekir. Aynı gün farklı saat (09:00-10:00 vs 10:00-11:00)
// çakışma DEĞİLDİR. Test eşleştirmesi bu kuralın aynısını uygulamalı.
const dayTokens = (x: Group) =>
  (x.scheduleSummary || '').toLowerCase().split('·')[0].split(',').map(s => s.trim()).filter(Boolean)

const timeRange = (x: Group): [number, number] | null => {
  const parts = (x.scheduleSummary || '').split('·')
  if (parts.length < 2) return null
  const m = parts[1].trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])]
}

const schedulesOverlap = (a: Group, b: Group): boolean => {
  const aDays = dayTokens(a)
  if (!dayTokens(b).some(d => aDays.includes(d))) return false
  const ra = timeRange(a)
  const rb = timeRange(b)
  if (!ra || !rb) return false
  return ra[0] < rb[1] && rb[0] < ra[1]
}

test.describe.serial('Spor — başvuru senaryoları (API)', () => {
  test.skip(!hasCredentials(), 'E2E creds yok')
  test.describe.configure({ retries: 0 })

  let token: string
  let children: Child[] = []

  test.beforeAll(async () => {
    const rc = await newContext()
    token = await getCitizenToken(rc)
    children = await getChildren(rc, token)
    await rc.dispose()
    await ensureAdultMixedGroup()
  })

  test.beforeEach(async () => {
    await cleanFamilyApplications(token, children.map(c => c.id))
  })
  test.afterAll(async () => {
    await cleanFamilyApplications(token, children.map(c => c.id))
  })

  test('1) Boş uygun gruba başvuru onaylanır (36y erkek → yetişkin/karma erkek)', async () => {
    const rc = await newContext()
    const groups = await listGroups(rc, token)
    const g = groups.find(x =>
      x.registeredCount < x.capacity && x.capacity > 1 &&
      (x.gender === 'male' || x.gender === 'mixed') &&
      x.ageMin <= 36 && x.ageMax >= 36 &&
      !x.name.startsWith('KAPALI-PENCERE') && !x.name.startsWith('YEDEK-TEST'))
    expect(g, 'uygun boş grup bulunmalı').toBeTruthy()
    const res = await apply(rc, token, g!.id)
    expect([200, 201], str(res.body)).toContain(res.status)
    expect(str(res.body)).toMatch(/approved|Onaylandı|waitlist|Bekleme|pending|İnceleniyor/i)
    await rc.dispose()
  })

  test('2-3-4) YEDEK-TEST: dolu→yedek→(red)→iptal→terfi', async () => {
    expect(children.length, 'en az 1 çocuk profili gerekli').toBeGreaterThan(0)
    const rc = await newContext()
    const groups = await listGroups(rc, token)
    const yt = groups.find(x => x.name.startsWith('YEDEK-TEST'))
    expect(yt, 'YEDEK-TEST grubu görünür olmalı (cap=1,res=1,age 1-99,mixed)').toBeTruthy()

    const a1 = await apply(rc, token, yt!.id)
    expect([200, 201], str(a1.body)).toContain(a1.status)
    const app1Id = a1.body.data?.id
    expect(app1Id, 'başvuru id dönmeli').toBeTruthy()

    const childToken = await switchToChild(rc, token, children[0].id)
    const rcChild = await newContext()
    const a2 = await apply(rcChild, childToken, yt!.id)
    expect([200, 201], str(a2.body)).toContain(a2.status)
    expect(str(a2.body), 'kapasite dolunca yedek olmalı').toMatch(/waitlist|Bekleme/i)
    const app2Id = a2.body.data?.id
    await rcChild.dispose()

    if (children.length > 1) {
      const child2Token = await switchToChild(rc, token, children[1].id)
      const rcC2 = await newContext()
      const a3 = await apply(rcC2, child2Token, yt!.id)
      expect(a3.status, 'yedek de dolunca red (409)').toBe(409)
      expect(a3.body.message, 'Türkçe dolu mesajı').toMatch(/dolu|kontenjan/i)
      await rcC2.dispose()
    }

    const c = await cancel(rc, token, app1Id)
    expect([200, 204], str(c.body)).toContain(c.status)

    const rcVerify = await newContext()
    const childTok2 = await switchToChild(rcVerify, token, children[0].id)
    const appsRes = await rcVerify.get(`${process.env.E2E_API_URL || process.env.API_BASE || 'http://localhost:5207/api/v1'}/me/facilities/applications?page=1&limit=100`, {
      headers: { Authorization: `Bearer ${childTok2}` },
    })
    const apps = (await appsRes.json()).data?.items ?? []
    const promoted = apps.find((a: any) => a.id === app2Id)
    expect(promoted, 'çocuğun başvurusu bulunmalı').toBeTruthy()
    expect(promoted.status, `iptal sonrası yedekten terfi bekleniyor, status=${promoted?.status}`).not.toBe('waitlist')
    await rcVerify.dispose()
    await rc.dispose()
  })

  test('5) Yaş uyumsuz başvuru reddedilir (36y → çocuk 7-12 grubu)', async () => {
    const rc = await newContext()
    const groups = await listGroups(rc, token)
    const g = groups.find(x =>
      x.ageMax > 0 && x.ageMax < 18 && x.registeredCount < x.capacity && x.capacity > 1 &&
      !x.name.startsWith('KAPALI-PENCERE') && !x.name.startsWith('YEDEK-TEST'))
    expect(g, 'çocuk yaş grubu bulunmalı').toBeTruthy()
    const res = await apply(rc, token, g!.id)
    expect([400, 403, 409], `36y kullanıcı ${g!.ageMin}-${g!.ageMax} grubuna alınmamalı — status=${res.status} ${str(res.body)}`).toContain(res.status)
    await rc.dispose()
  })

  test('6) Cinsiyet uyumsuz başvuru reddedilir (erkek → kadın grubu)', async () => {
    const rc = await newContext()
    const groups = await listGroups(rc, token)
    const g = groups.find(x =>
      x.gender === 'female' && x.ageMin <= 36 && x.ageMax >= 36 &&
      x.registeredCount < x.capacity && x.capacity > 1 &&
      !x.name.startsWith('KAPALI-PENCERE') && !x.name.startsWith('YEDEK-TEST'))
    expect(g, 'kadın grubu bulunmalı').toBeTruthy()
    const res = await apply(rc, token, g!.id)
    expect([400, 403, 409], `erkek kullanıcı kadın grubuna alınmamalı — status=${res.status} ${str(res.body)}`).toContain(res.status)
    await rc.dispose()
  })

  test('8) Başvuru penceresi kapalı grupta hata', async () => {
    const rc = await newContext()
    const groups = await listGroups(rc, token)
    const g = groups.find(x => x.name.startsWith('KAPALI-PENCERE'))
    if (!g) {
      test.info().annotations.push({ type: 'note', description: 'KAPALI-PENCERE grubu discover listesinde yok (beklenen: kapalı gruplar gizli)' })
      return
    }
    const res = await apply(rc, token, g.id)
    expect([400, 403, 409], `kapalı pencere başvuru reddedilmeli — ${res.status} ${str(res.body)}`).toContain(res.status)
    expect(str(res.body)).toMatch(/başvuru|süre|kapa|sona/i)
    await rc.dispose()
  })

  test('9) Aynı gruba mükerrer başvuru engellenir', async () => {
    const rc = await newContext()
    const groups = await listGroups(rc, token)
    const g = groups.find(x =>
      x.registeredCount < x.capacity && x.capacity > 2 &&
      (x.gender === 'male' || x.gender === 'mixed') && x.ageMin <= 36 && x.ageMax >= 36 &&
      !x.name.startsWith('KAPALI-PENCERE') && !x.name.startsWith('YEDEK-TEST'))
    expect(g, 'uygun grup bulunmalı').toBeTruthy()
    const first = await apply(rc, token, g!.id)
    expect([200, 201], str(first.body)).toContain(first.status)
    const dup = await apply(rc, token, g!.id)
    expect([400, 409], `mükerrer başvuru engellenmeli — ${dup.status} ${str(dup.body)}`).toContain(dup.status)
    await rc.dispose()
  })

  test('7) Aynı gün çakışan ikinci gruba başvuru engellenir (SCHEDULE_CONFLICT)', async () => {
    const rc = await newContext()
    const groups = await listGroups(rc, token)
    const eligible = (x: Group) =>
      x.registeredCount < x.capacity && x.capacity > 2 &&
      (x.gender === 'male' || x.gender === 'mixed') && x.ageMin <= 36 && x.ageMax >= 36 &&
      !x.name.startsWith('KAPALI-PENCERE') && !x.name.startsWith('YEDEK-TEST')
    const eligibleGroups = groups.filter(eligible)
    let a: Group | undefined
    let b: Group | undefined
    outer: for (const candidateA of eligibleGroups) {
      for (const candidateB of eligibleGroups) {
        if (candidateB.id === candidateA.id) continue
        if (schedulesOverlap(candidateA, candidateB)) {
          a = candidateA; b = candidateB
          break outer
        }
      }
    }
    expect(a, 'uygun grup bulunmalı').toBeTruthy()
    expect(b, 'gün VE saat çakışan ikinci grup bulunmalı').toBeTruthy()
    const r1 = await apply(rc, token, a!.id)
    expect([200, 201], str(r1.body)).toContain(r1.status)
    const r2 = await apply(rc, token, b!.id)
    expect(r2.status, `aynı gün ikinci başvuru engellenmeli — ${r2.status} ${str(r2.body)}`).toBe(409)
    expect(str(r2.body)).toMatch(/çakış|aynı gün|SCHEDULE_CONFLICT/i)
    await rc.dispose()
  })

  test('7b) Aynı gün AMA farklı saatteki gruba başvuru SERBEST (çakışma değildir)', async () => {
    const rc = await newContext()
    const groups = await listGroups(rc, token)
    const aksam = groups.find(x => x.name.endsWith(' AksamAyniGun') && x.registeredCount < x.capacity)
    const sabah = groups.find(x =>
      x.name.endsWith(' Grup B') && x.registeredCount < x.capacity &&
      dayTokens(x).some(d => dayTokens(aksam!).includes(d)))
    expect(sabah, '10:00-11:00 grubu bulunmalı').toBeTruthy()
    expect(aksam, '20:00-21:00 grubu bulunmalı').toBeTruthy()
    expect(dayTokens(sabah!).some(d => dayTokens(aksam!).includes(d)), 'iki grup aynı günde olmalı').toBe(true)
    expect(schedulesOverlap(sabah!, aksam!), 'saatler kesişmemeli').toBe(false)

    const r1 = await apply(rc, token, sabah!.id)
    expect([200, 201], str(r1.body)).toContain(r1.status)
    const r2 = await apply(rc, token, aksam!.id)
    expect(r2.status, `aynı gün farklı saat engellenmemeli — ${r2.status} ${str(r2.body)}`).not.toBe(409)
    expect([200, 201], str(r2.body)).toContain(r2.status)
    await rc.dispose()
  })

  test('10) 2-gün ve 3-gün varyantları başvurulabilir (farklı günlerde, çakışmasız)', async () => {
    const rc = await newContext()
    const groups = await listGroups(rc, token)
    const eligible = (x: Group) =>
      x.registeredCount < x.capacity && x.capacity > 1 &&
      (x.gender === 'male' || x.gender === 'mixed') && x.ageMin <= 36 && x.ageMax >= 36 &&
      !x.name.startsWith('KAPALI-PENCERE') && !x.name.startsWith('YEDEK-TEST')
    const dayTokens = (x: Group) => x.scheduleSummary.toLowerCase().split('·')[0].split(',').map(s => s.trim()).filter(Boolean)
    const daysCount = (x: Group) => dayTokens(x).length
    const two = groups.find(x => eligible(x) && daysCount(x) === 2)
    expect(two, '2-gün grup bulunmalı').toBeTruthy()
    const twoDays = dayTokens(two!)
    const three = groups.find(x => eligible(x) && x.id !== two!.id && daysCount(x) === 3 &&
      !dayTokens(x).some(d => twoDays.includes(d)))
    expect(three, 'gün paylaşmayan 3-gün grup bulunmalı').toBeTruthy()
    const r2 = await apply(rc, token, two!.id)
    const r3 = await apply(rc, token, three!.id)
    expect([200, 201], `2-gün başvuru — ${str(r2.body)}`).toContain(r2.status)
    expect([200, 201], `3-gün başvuru (farklı gün) — ${str(r3.body)}`).toContain(r3.status)
    await rc.dispose()
  })
})
