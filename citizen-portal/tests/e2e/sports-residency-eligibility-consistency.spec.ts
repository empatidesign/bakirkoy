import { test, expect, type APIRequestContext } from '@playwright/test'
import { API_ROOT, authHeaders } from './helpers/videoProof'

/**
 * DENETİM BULGUSU (2026-09-05) — Facility/Spor modülü canlı test görevi kapsamında bulundu.
 *
 * Kök neden: `ParticipantFacilityService.IsEligible`/`IneligibleReason` (grup detay ekranındaki
 * "uygun/uygun değil" göstergesi ve discover kart listesindeki `eligible` alanı) yalnızca
 * cinsiyet+yaş kontrol ediyordu; gerçek başvuru yolu (`ApplyAsync`) ise `FacilityEligibilityRules
 * .CheckAll` ile ikamet/uyruk (residencyMode) kısıtını da uyguluyor. Sonuç: bir grup ekranda
 * "uygun" (eligible=true) görünürken, aynı kullanıcı gerçekten başvurunca 409
 * RESIDENCY_NOT_ELIGIBLE ile reddediliyordu — UI ile gerçek davranış arasında tutarsızlık,
 * vatandaşın "neden reddedildim" şaşkınlığına yol açar.
 *
 * Düzeltme: `IsEligible`/`IneligibleReason` artık `FacilityEligibilityRules.CheckAll` çağırıyor
 * (ApplyAsync ile birebir aynı kural kaynağı). Bu test, grup-detay ve discover uçlarının
 * "eligible" alanının gerçek başvuru sonucuyla HER ZAMAN tutarlı olduğunu kanıtlar.
 *
 * Yöntem: `sultangazi_only` ikamet kısıtlı bir ZZTEST grubu + dışarıda ikamet eden bir NVI-mock
 * senaryo vatandaşı (TCKN "98" öneki = Sultangazi dışı, bkz. NviMockService.IsOutsideScenarioTckn)
 * kullanılır. Fixture bu test tarafından kurulur ve sonunda tamamen silinir (ZZTEST- öneki).
 */

const API = API_ROOT
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'superadmin@nexora.local'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'SuperAdmin2026!'
const ADMIN_OTP = process.env.E2E_OTP_CODE || '111111'
const CITIZEN_PASSWORD = 'ZzTestResidency2026!'
const CITIZEN_OTP = '111111'

async function getAdminToken(rc: APIRequestContext): Promise<string> {
  // Ortam notu: superadmin oturumu, paralel çalışan diğer ajanlar/worker'lar tarafından
  // sürekli SESSION_INVALIDATED ile düşürülüyor (bkz. docs/tesis-spor-egitim-derin-test-2026-08-31.md
  // "Test Ortamı Notu"). Basit retry ile bu gürültü aşılır; testin kendisini etkilemez.
  for (let attempt = 0; attempt < 5; attempt++) {
    const login = await rc.post(`${API}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })
    const loginJson = (await login.json()).data
    if (loginJson?.accessToken) return loginJson.accessToken
    if (loginJson?.otpSessionToken) {
      const verify = await rc.post(`${API}/auth/verify-otp`, { data: { otpSessionToken: loginJson.otpSessionToken, code: ADMIN_OTP } })
      const verifyJson = await verify.json()
      if (verifyJson?.data?.accessToken) return verifyJson.data.accessToken
    }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
  }
  throw new Error('Admin token alınamadı (5 deneme sonrası)')
}

function validTckn(prefix: string): string {
  const digits: number[] = []
  for (const c of prefix) digits.push(Number(c))
  while (digits.length < 9) digits.push(Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  const n = digits.slice(0, 9)
  const odd = n[0] + n[2] + n[4] + n[6] + n[8]
  const even = n[1] + n[3] + n[5] + n[7]
  const d10 = (((odd * 7) - even) % 10 + 10) % 10
  n.push(d10)
  const d11 = n.slice(0, 10).reduce((a, b) => a + b, 0) % 10
  n.push(d11)
  return n.join('')
}

async function registerOutsideResidentCitizen(rc: APIRequestContext): Promise<{ token: string; tckn: string }> {
  // "98" öneki -> NviMockService.IsOutsideScenarioTckn=true -> Kadıköy adresi (Sultangazi DEĞİL).
  // 3. hane çift (0) -> ScenarioGender=Male değil dikkat: kadın grubuna göndereceğiz, cinsiyet
  // testin konusu değil (residency izole test edilsin diye grup gender='mixed' kuruluyor).
  const tckn = validTckn('980')
  const phone = `555${Math.floor(1000000 + Math.random() * 8999999)}`
  const email = `zztest.residency.${Date.now()}@example.com`
  const reg = await rc.post(`${API}/auth/citizen/register`, {
    data: { tckn, birthDate: '1990-01-01T00:00:00Z', phone, email, password: CITIZEN_PASSWORD },
  })
  const regJson = (await reg.json()).data
  if (!regJson?.otpSessionToken) throw new Error(`ZZTEST vatandaş kaydı başarısız (tckn=${tckn}): ${JSON.stringify(regJson)}`)
  const verify = await rc.post(`${API}/auth/citizen/verify-otp`, {
    data: { otpSessionToken: regJson.otpSessionToken, code: CITIZEN_OTP },
  })
  const verifyJson = (await verify.json())
  if (!verifyJson?.data?.accessToken) throw new Error(`ZZTEST vatandaş OTP doğrulama başarısız: ${JSON.stringify(verifyJson)}`)
  return { token: verifyJson.data.accessToken, tckn }
}

test.describe.configure({ mode: 'serial' })

test.describe('Spor — grup detayı "uygun" göstergesi gerçek başvuru sonucuyla tutarlı olmalı (residency)', () => {
  let adminAuth: Record<string, string>
  let rc: APIRequestContext
  let facilityId: string
  let branchId: string
  let groupId: string
  let citizenToken: string

  test.beforeAll(async ({ playwright }) => {
    rc = await playwright.request.newContext()
    const adminToken = await getAdminToken(rc)
    adminAuth = { ...authHeaders(adminToken), 'Content-Type': 'application/json' }

    const tag = `ZZTEST-RESIDENCY-${Date.now()}`
    const me = await (await rc.get(`${API}/auth/me`, { headers: adminAuth })).json()
    const managerId = me?.data?.me?.id

    const sf = await (await rc.post(`${API}/service-facilities`, {
      headers: adminAuth,
      data: {
        name: `${tag} Hizmet`, type: 'sports', locationType: 'Indoor',
        city: 'İstanbul', district: 'Sultangazi', address: 'ZZTEST No:1', latitude: 41.1039, longitude: 28.8674, managerId,
        weekdayOpen: '08:00', weekdayClose: '22:00', weekendOpen: '09:00', weekendClose: '20:00',
        parkingCapacity: 0, parkingType: 'Free', capacity: 50,
      },
    })).json()

    if (!sf?.data?.id) throw new Error(`ZZTEST hizmet tesisi oluşturulamadı: ${JSON.stringify(sf)}`)

    const facility = await (await rc.post(`${API}/sports/facilities`, {
      headers: adminAuth,
      data: { name: `${tag} Tesis`, kind: 'indoor', serviceFacilityId: sf.data.id, managerId, capacity: 50, isActive: true, grantAccess: false },
    })).json()
    facilityId = typeof facility.data === 'string' ? facility.data : facility.data?.id
    if (!facilityId) throw new Error(`ZZTEST spor tesisi oluşturulamadı: ${JSON.stringify(facility)}`)

    const branch = await (await rc.post(`${API}/sports/branches`, {
      headers: adminAuth,
      data: { name: `${tag} Branş`, description: 'zztest', periodMonths: 3, absenceLimit: 0, consecutiveAbsenceLimit: 0, isActive: true },
    })).json()
    branchId = branch.data.id

    const today = new Date()
    const isoDate = (d: Date) => d.toISOString().slice(0, 10)
    const plusDays = (n: number) => isoDate(new Date(today.getTime() + n * 86400000))
    const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayName = WEEKDAYS[today.getDay()]

    const group = await (await rc.post(`${API}/sports/groups`, {
      headers: adminAuth,
      data: {
        facilityId, branchId, parentGroupId: null,
        name: `${tag} Grup`, description: 'zztest', type: 'kurs', gender: 'mixed',
        capacity: 10, reserveCapacity: 5,
        ageMin: 18, ageMax: 60,
        schedule: [{ day: dayName, startTime: '10:00', endTime: '11:00' }],
        attendanceMode: 'full',
        fee: { isPaid: false },
        conditions: { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: '' },
        periodStart: plusDays(1), periodEnd: plusDays(365), periodMonths: 12, periodType: 'month', periodCount: 12,
        applicationStartDate: plusDays(0), applicationEndDate: plusDays(300),
        academyWhitelistEnabled: false, absenceLimit: 0, consecutiveAbsenceLimit: 0,
        entryGraceMinutes: 15, instructorId: null, isActive: true,
        autoApprove: true, attendanceLimitOverride: false, attendanceLimitType: 'unlimited', attendanceLimitCount: 0,
        // Test edilen kural: yalnızca Sultangazi'de ikamet edenler başvurabilir.
        residencyMode: 'sultangazi_only',
      },
    })).json()
    if (!group?.data?.id) throw new Error(`ZZTEST grup oluşturulamadı: ${JSON.stringify(group)}`)
    groupId = group.data.id

    const citizen = await registerOutsideResidentCitizen(rc)
    citizenToken = citizen.token
  })

  test.afterAll(async () => {
    if (groupId) await rc.delete(`${API}/sports/groups/${groupId}`, { headers: adminAuth }).catch(() => {})
    if (groupId) await rc.delete(`${API}/sports/groups/${groupId}/permanent`, { headers: adminAuth }).catch(() => {})
    if (branchId) await rc.delete(`${API}/sports/branches/${branchId}`, { headers: adminAuth }).catch(() => {})
    if (facilityId) await rc.delete(`${API}/sports/facilities/${facilityId}`, { headers: adminAuth }).catch(() => {})
    if (facilityId) await rc.delete(`${API}/sports/facilities/${facilityId}/permanent`, { headers: adminAuth }).catch(() => {})
    await rc.dispose()
  })

  test('grup detayında eligible=false ve doğru ikamet gerekçesi gösterilmeli (Sultangazi dışı vatandaş)', async () => {
    const detail = await rc.get(`${API}/me/facilities/sports/groups/${groupId}`, { headers: authHeaders(citizenToken) })
    expect(detail.ok(), 'grup detayı 200 dönmeli').toBeTruthy()
    const body = (await detail.json()).data

    expect(body.eligible, 'Sultangazi dışı vatandaş için kart eligible=false göstermeli (gerçek başvuru reddedilecek)').toBe(false)

    const selfApplicant = (body.applicants ?? []).find((a: { isSelf: boolean }) => a.isSelf)
    expect(selfApplicant, 'applicants listesinde kendim (isSelf) olmalı').toBeTruthy()
    expect(selfApplicant.eligible, 'applicants[isSelf].eligible de false olmalı — kart ile applicants tutarlı olmalı').toBe(false)
    expect(selfApplicant.ineligibleReason, 'ikamet gerekçesi gösterilmeli').toContain('Sultangazi')
  })

  test('discover listesinde de aynı grup için eligible=false görünmeli', async () => {
    const discover = await rc.get(
      `${API}/me/facilities/sports/discover?page=1&limit=200&showAll=true&facilityId=${facilityId}`,
      { headers: authHeaders(citizenToken) },
    )
    expect(discover.ok()).toBeTruthy()
    const items = (await discover.json()).data.items as Array<{ id: string; eligible: boolean }>
    const card = items.find((i) => i.id === groupId)
    expect(card, 'ZZTEST grubu discover listesinde bulunmalı (showAll=true)').toBeTruthy()
    expect(card!.eligible, 'discover kartı da eligible=false göstermeli').toBe(false)
  })

  test('KANIT: gerçek başvuru da aynı gerekçeyle (RESIDENCY_NOT_ELIGIBLE) reddedilir — UI göstergesiyle tutarlı', async () => {
    const apply = await rc.post(`${API}/me/facilities/sports/groups/${groupId}/apply`, {
      headers: { ...authHeaders(citizenToken), 'Content-Type': 'application/json' },
      data: {},
    })
    expect(apply.status(), 'ikamet dışı vatandaşın başvurusu kabul edilmemeli').toBeGreaterThanOrEqual(400)
    const body = await apply.json()
    expect(body.errorCode, 'gerçek başvuru RESIDENCY_NOT_ELIGIBLE ile reddedilmeli — kart göstergesiyle aynı kural').toBe('RESIDENCY_NOT_ELIGIBLE')
  })
})
