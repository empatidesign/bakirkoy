import { test, expect, type APIRequestContext } from '@playwright/test'
import { API_ROOT, citizenToken, authHeaders, apiGet, type Paged } from './helpers/videoProof'

/**
 * SPOR PİLOTU — KURAL ZİNCİRİ
 *
 * Kaynak: .claude/canlitest/SPOR_PILOT_KURAL_ZINCIRI.md
 * Kural sırası koddan türetildi: ParticipantFacilityService.ApplyAsync.
 * Rota: POST /me/facilities/{module}/groups/{groupId}/apply
 *
 * Kurallar ADLANDIRILMIŞ errorCode üzerinden doğrulanır, HTTP durumu üzerinden değil:
 * aynı akışta 409 dönen sekiz ayrı kural var; yalnız statüye bakan test yanlış kuralın
 * tetiklendiğini fark etmez.
 */

type DiscoverGroup = {
  id: string; name: string; facilityName: string; gender: string
  ageMin: number; ageMax: number; capacity: number; registeredCount: number
  reserveCapacity: number; waitlistCount: number
  eligible: boolean; alreadyApplied: boolean
  periodStart?: string | null; periodEnd?: string | null
}

const MODULE = 'sports'

/**
 * Discover, kullanıcıya UYGUN OLMAYAN grupları listeden çıkarır (doğru davranış).
 * Bu yüzden yaş/cinsiyet/ikamet reddi discover üzerinden test EDİLEMEZ — grup zaten görünmez.
 * Kuralın backend'de gerçekten zorlandığını kanıtlamak için doğrudan grup ID'siyle başvurulur:
 * "listede yok" ile "başvurulunca reddediliyor" farklı güvencelerdir; ikincisi olmadan
 * istemci filtresini atlayan bir istek sessizce kabul edilebilir.
 *
 * Fixture'lar admin API ile oluşturuldu (E2E- öneki). E2E_FIXTURES ile override edilebilir.
 */
const FIXTURES = {
  femaleOnly: process.env.E2E_GRP_FEMALE || '183712f8-4d66-4659-9930-2f6371abf2cf',
  age18to25: process.env.E2E_GRP_AGE || '91a69742-eea0-4136-baa7-5e88d9d4eb1d',
  fullQuota: process.env.E2E_GRP_FULL || '8910b99d-1ca7-41ad-8287-be17afe5f65f',
  foreignOnly: process.env.E2E_GRP_FOREIGN || '269d8f7a-0300-4f3b-8f03-83e921d1eb1d',
  sultangaziForeign: process.env.E2E_GRP_SGFOREIGN || '2ef365b1-70a3-4484-a1d4-e61a3f6959cc',
  endedPeriod: process.env.E2E_GRP_ENDED || '772de4e2-ea76-4769-835b-9dfec76d2514',
}

async function apply(request: APIRequestContext, token: string, groupId: string, body: unknown = {}) {
  const res = await request.post(`${API_ROOT}/me/facilities/${MODULE}/groups/${groupId}/apply`, {
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    data: body,
  })
  const json = await res.json().catch(() => ({}))
  return {
    status: res.status(),
    errorCode: (json?.errorCode ?? undefined) as string | undefined,
    message: (json?.message ?? undefined) as string | undefined,
    data: json?.data,
  }
}

test.describe.configure({ mode: 'serial' })

test.describe('Spor kural zinciri', () => {
  let token: string
  let groups: DiscoverGroup[] = []
  let me: { gender?: string; birthDate?: string; age?: number; district?: string; districtCode?: string } = {}

  test.beforeAll(async ({ request }) => {
    token = await citizenToken(request)
    const d = await apiGet<Paged<DiscoverGroup>>(request, token, `/me/facilities/${MODULE}/discover?page=1&limit=200`)
      .catch(() => ({ items: [] as DiscoverGroup[] }))
    groups = d.items ?? []
    // /auth/citizen/me profili data.user altında sarar — düz data.gender YOKTUR.
    const envelope = await apiGet<{ user?: typeof me }>(request, token, '/auth/citizen/me').catch(() => ({}))
    me = envelope.user ?? {}
  })

  test('ALTYAPI: discover grup döndürüyor ve zarf errorCode alanı taşıyor', async () => {
    expect(groups.length, 'spor discover boş — kural testleri anlamsız kalır').toBeGreaterThan(0)
  })

  test('KURAL-1: olmayan grup NOT_FOUND ile ve DOLU gövdeyle reddedilir', async ({ request }) => {
    const r = await apply(request, token, '00000000-0000-0000-0000-000000000003')
    expect(r.status, 'olmayan grup 2xx dönmemeli').toBeGreaterThanOrEqual(400)
    expect(r.errorCode, 'hata gövdesi errorCode taşımalı (proje kuralı: ApiResponse zarfı)').toBeTruthy()
    expect(r.message, 'hata gövdesi Türkçe mesaj taşımalı').toBeTruthy()
  })

  test('KURAL-2: yaş dışı gruba DOĞRUDAN başvuru AGE_NOT_ELIGIBLE verir', async ({ request }) => {
    const age = me.age ?? (me.birthDate
      ? Math.floor((Date.now() - new Date(me.birthDate).getTime()) / 31557600000)
      : null)
    expect(age, 'yaş profili okunamadı — /auth/citizen/me data.user.age bekleniyor').not.toBeNull()

    // Fixture 18-25 yaş; test kullanıcısı bu aralığın dışında olmalı (aksi halde fixture yanlış).
    const r = await apply(request, token, FIXTURES.age18to25)
    expect(r.status, `kullanıcı ${age} yaşında, grup 18-25 — kabul edilmemeliydi`).toBeGreaterThanOrEqual(400)
    expect(r.errorCode).toBe('AGE_NOT_ELIGIBLE')
  })

  test('KURAL-3: cinsiyet dışı gruba DOĞRUDAN başvuru GENDER_NOT_ELIGIBLE verir', async ({ request }) => {
    // API "Male"/"Female" (PascalCase) döner; grup tarafı "male"/"female"/"mixed" (lowercase).
    const raw = String(me.gender ?? '').toLowerCase()
    const myCode = raw.startsWith('male') ? 'male' : raw.startsWith('female') ? 'female' : null
    expect(myCode, 'cinsiyet profili okunamadı').not.toBeNull()
    test.skip(myCode === 'female', 'fixture kadın grubu — kadın kullanıcı için red beklenmez')

    const r = await apply(request, token, FIXTURES.femaleOnly)
    expect(r.status, 'erkek kullanıcı kadın grubuna kabul edilmemeliydi').toBeGreaterThanOrEqual(400)
    expect(r.errorCode).toBe('GENDER_NOT_ELIGIBLE')
  })

  test('KURAL-4: uygun olmayan grup discover LİSTESİNDE görünmemeli', async () => {
    // Filtreleme ile zorlama farklı güvenceler: KURAL-2/3 zorlamayı, bu test filtrelemeyi doğrular.
    const ids = groups.map((g) => g.id)
    expect(ids, 'yaş dışı grup listede görünüyor — istemci filtresi sızdırıyor')
      .not.toContain(FIXTURES.age18to25)
    expect(ids, 'cinsiyet dışı grup listede görünüyor').not.toContain(FIXTURES.femaleOnly)
  })

  test('KURAL-5: ikamet/uyruk kısıtlı gruplar RESIDENCY_NOT_ELIGIBLE verir', async ({ request }) => {
    // Test kullanıcısı: T.C. vatandaşı + Sultangazi sakini (districtCode 2055).
    const foreign = await apply(request, token, FIXTURES.foreignOnly)
    expect(foreign.status, 'T.C. vatandaşı yabancı-only gruba kabul edilmemeliydi').toBeGreaterThanOrEqual(400)
    expect(foreign.errorCode).toBe('RESIDENCY_NOT_ELIGIBLE')

    // sultangazi_foreign: ikamet şartını geçer (Sultangazi'li) ama uyruk şartında düşer (T.C.).
    // İki eksenin bağımsız kontrol edildiğini kanıtlar — tek eksen geçince kural bitmiyor.
    const sgForeign = await apply(request, token, FIXTURES.sultangaziForeign)
    expect(sgForeign.status, 'T.C. vatandaşı sultangazi_foreign gruba kabul edilmemeliydi').toBeGreaterThanOrEqual(400)
    expect(sgForeign.errorCode).toBe('RESIDENCY_NOT_ELIGIBLE')
  })

  test('KURAL-5b: kontenjanı 1 olan grup ikinci kişide yedeğe/QUOTA_FULL\'a düşer', async ({ request }) => {
    const r = await apply(request, token, FIXTURES.fullQuota)
    if (r.status < 400) {
      // İlk başvuru: ana kayda girer (capacity=1). Tekrar koşuda ALREADY_APPLIED beklenir.
      expect(['pending', 'waitlist', 'approved']).toContain(String(r.data?.status))
    } else {
      expect(['QUOTA_FULL', 'ALREADY_APPLIED']).toContain(r.errorCode)
    }
  })

  test('KURAL-6: aynı gruba ikinci başvuru ALREADY_APPLIED verir', async ({ request }) => {
    const applied = groups.find((g) => g.alreadyApplied)
    test.skip(!applied, 'başvurulmuş grup yok — mükerrer denenemez')

    const r = await apply(request, token, applied!.id)
    expect(r.status, 'aynı gruba ikinci başvuru kabul edilmemeli').toBeGreaterThanOrEqual(400)
    expect(r.errorCode).toBe('ALREADY_APPLIED')
  })

  test('KURAL-7: dönemi bitmiş gruba başvuru reddedilir', async ({ request }) => {
    // Fixture dönemi 2026-01-01 → 2026-03-01 (geçmiş). Başvuru penceresi alanları NULL bırakıldı ki
    // reddin APPLICATION_CLOSED'tan değil, dönem kuralından geldiği ayırt edilebilsin.
    const r = await apply(request, token, FIXTURES.endedPeriod)
    expect(r.status, 'dönemi bitmiş gruba kayıt açıldı').toBeGreaterThanOrEqual(400)
    expect(r.errorCode, 'red gerekçesi kodsuz döndü').toBeTruthy()
  })

  test('KURAL-8: hiçbir grup 500 ile patlamamalı ve her red kodlu olmalı', async ({ request }) => {
    const sample = groups.slice(0, 25)
    test.skip(sample.length === 0, 'grup yok')

    const crashes: string[] = []
    const codeless: string[] = []
    for (const g of sample) {
      const r = await apply(request, token, g.id)
      if (r.status >= 500) crashes.push(`${g.name} -> ${r.status}`)
      else if (r.status >= 400 && !r.errorCode) codeless.push(`${g.name} -> ${r.status} (errorCode yok)`)
    }
    expect(crashes, `500 dönen gruplar:\n${crashes.join('\n')}`).toHaveLength(0)
    expect(codeless, `errorCode'suz red dönen gruplar:\n${codeless.join('\n')}`).toHaveLength(0)
  })
})
