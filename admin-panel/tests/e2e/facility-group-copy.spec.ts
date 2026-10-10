import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test'
import { apiToken } from './helpers/facilityFixture'
import { login } from './helpers/auth'

const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const MODULE = 'women-family'

function uniq(prefix: string) {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`
}

const futureDate = (days: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

let ctx: APIRequestContext
let managerId = ''

async function apiPost<T>(path: string, body: unknown) {
  const token = await apiToken()
  const res = await ctx.post(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, data: body })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), ok: res.ok(), data: (json?.data ?? null) as T | null, errorCode: json?.errorCode, message: json?.message }
}

async function apiGet<T>(path: string) {
  const token = await apiToken()
  const res = await ctx.get(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json().catch(() => ({}))
  return { status: res.status(), ok: res.ok(), data: (json?.data ?? null) as T | null }
}

async function createServiceFacility(tag: string) {
  const sf = await apiPost<{ id: string }>('/service-facilities', {
    name: `E2E Copy Hizmet ${tag}`, type: 'Sosyal Tesis', locationType: 'Indoor',
    city: 'İstanbul', district: 'Sultangazi', address: `E2E Copy Mah. No:1 ${tag}`, managerId,
    latitude: 41.1039, longitude: 28.8674,
    weekdayOpen: '08:00', weekdayClose: '22:00', weekendOpen: '09:00', weekendClose: '20:00',
    parkingCapacity: 0, parkingType: 'Free', capacity: 200,
  })
  if (!sf.ok || !sf.data) throw new Error(`service-facility create failed: ${JSON.stringify(sf)}`)
  return sf.data.id
}

async function createFacility(tag: string, capacity: number) {
  const serviceFacilityId = await createServiceFacility(tag)
  const facility = await apiPost<{ id: string } | string>(`/${MODULE}/facilities`, {
    name: `E2E Copy Tesis ${tag}`, kind: 'indoor',
    serviceFacilityId, managerId, capacity, isActive: true, grantAccess: false,
  })
  const facilityId = typeof facility.data === 'string' ? facility.data : facility.data?.id
  if (!facility.ok || !facilityId) throw new Error(`facility create failed: ${JSON.stringify(facility)}`)
  return facilityId
}

async function createBranch(tag: string) {
  const branch = await apiPost<{ id: string }>(`/${MODULE}/branches`, {
    name: `E2E Copy Program ${tag}`, description: 'e2e copy testi', periodMonths: 3,
    absenceLimit: 5, consecutiveAbsenceLimit: 3, isActive: true,
  })
  if (!branch.ok || !branch.data) throw new Error(`branch create failed: ${JSON.stringify(branch)}`)
  return branch.data.id
}

async function createGroup(facilityId: string, branchId: string, tag: string, capacity: number) {
  const group = await apiPost<{ id: string }>(`/${MODULE}/groups`, {
    facilityId, branchId, parentGroupId: null,
    name: `E2E Copy Grubu ${tag}`, description: 'e2e copy testi — program açıklaması', type: 'kurs', gender: 'mixed',
    capacity, reserveCapacity: 5, ageMin: 15, ageMax: 80,
    schedule: [{ day: 'wednesday', startTime: '14:00', endTime: '15:30' }],
    attendanceMode: 'full',
    fee: { isPaid: true, feeType: 'monthly', amount: 250, siblingDiscount: true, staffDiscount: false },
    conditions: { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: 'Spor kıyafeti', applicationConditions: '', aboutHtml: '<p>E2E kopya testi</p>' },
    periodStart: futureDate(1), periodEnd: futureDate(90), periodMonths: 3, periodType: 'date_range', periodCount: 1,
    applicationStartDate: futureDate(0), applicationEndDate: futureDate(30),
    academyWhitelistEnabled: false, absenceLimit: 5, consecutiveAbsenceLimit: 3, entryGraceMinutes: 15,
    instructorId: null, isActive: true, autoApprove: false,
    attendanceLimitOverride: false, attendanceLimitType: 'unlimited', attendanceLimitCount: 0,
  })
  if (!group.ok || !group.data) throw new Error(`group create failed: ${JSON.stringify(group)}`)
  return group.data.id
}

test.describe('Grup/Seans Kopyalama — API', () => {
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

  test('kaynak grubu tüm alanlarıyla (program, ücret, evrak şartları) pasif kopya olarak hedef tesise kopyalar', async () => {
    test.setTimeout(60000)
    const tag = uniq('e2ecopyA')
    const sourceFacilityId = await createFacility(`${tag}src`, 100)
    const targetFacilityId = await createFacility(`${tag}tgt`, 100)
    const branchId = await createBranch(tag)
    const groupId = await createGroup(sourceFacilityId, branchId, tag, 20)

    const copy = await apiPost<{ results: Array<{ facilityId: string; facilityName: string; success: boolean; groupId: string | null; error: string | null }> }>(
      `/${MODULE}/groups/${groupId}/copy`, { targetFacilityIds: [targetFacilityId] },
    )
    expect(copy.ok, `copy çağrısı başarılı olmalı: ${JSON.stringify(copy)}`).toBeTruthy()
    const result = copy.data!.results[0]
    expect(result.success).toBeTruthy()
    expect(result.facilityId).toBe(targetFacilityId)
    expect(result.groupId).toBeTruthy()

    const copied = await apiGet<Record<string, unknown>>(`/${MODULE}/groups/${result.groupId}`)
    expect(copied.ok).toBeTruthy()
    const d = copied.data!
    expect(d.name).toBe(`E2E Copy Grubu ${tag} (Kopya)`)
    expect(d.isActive).toBe(false)
    expect(d.facilityId).toBe(targetFacilityId)
    expect(d.branchId).toBe(branchId)
    expect(d.parentGroupId).toBeFalsy()
    expect(d.capacity).toBe(20)
    expect(d.gender).toBe('mixed')
    expect(d.type).toBe('kurs')
    expect((d.schedule as Array<{ day: string; startTime: string; endTime: string }>)[0]).toMatchObject({ startTime: '14:00', endTime: '15:30' })
    const fee = d.fee as { isPaid: boolean; feeType: string; amount: number; siblingDiscount: boolean }
    expect(fee.isPaid).toBe(true)
    expect(fee.amount).toBe(250)
    expect(fee.siblingDiscount).toBe(true)
    const conditions = d.conditions as { requirements: string }
    expect(conditions.requirements).toBe('Spor kıyafeti')
  })

  test('hedef tesisin kapasitesi yetersizse o hedef başarısız raporlanır ama diğer hedefler etkilenmez', async () => {
    test.setTimeout(60000)
    const tag = uniq('e2ecopyB')
    const sourceFacilityId = await createFacility(`${tag}src`, 100)
    const okFacilityId = await createFacility(`${tag}ok`, 100)
    const tooSmallFacilityId = await createFacility(`${tag}small`, 5)
    const branchId = await createBranch(tag)
    const groupId = await createGroup(sourceFacilityId, branchId, tag, 20)

    const copy = await apiPost<{ results: Array<{ facilityId: string; success: boolean; error: string | null }> }>(
      `/${MODULE}/groups/${groupId}/copy`, { targetFacilityIds: [okFacilityId, tooSmallFacilityId] },
    )
    expect(copy.ok, `copy çağrısı 200 dönmeli (kısmi başarısızlık istisna fırlatmamalı): ${JSON.stringify(copy)}`).toBeTruthy()
    const results = copy.data!.results
    expect(results).toHaveLength(2)
    const okResult = results.find((r) => r.facilityId === okFacilityId)!
    const failResult = results.find((r) => r.facilityId === tooSmallFacilityId)!
    expect(okResult.success).toBeTruthy()
    expect(failResult.success).toBeFalsy()
    expect(failResult.error).toBeTruthy()
  })

  test('alt grup (seans) doğrudan kopyalanamaz — önce ana grup kopyalanmalı', async () => {
    test.setTimeout(60000)
    const tag = uniq('e2ecopyC')
    const sourceFacilityId = await createFacility(`${tag}src`, 100)
    const targetFacilityId = await createFacility(`${tag}tgt`, 100)
    const branchId = await createBranch(tag)
    const parentGroupId = await createGroup(sourceFacilityId, branchId, tag, 20)

    const subGroup = await apiPost<{ id: string }>(`/${MODULE}/groups/${parentGroupId}/sub-groups`, {
      name: `E2E Copy Alt Grup ${tag}`, description: null, gender: 'mixed',
      capacity: 10, reserveCapacity: 2, ageMin: 15, ageMax: 80,
      schedule: [{ day: 'thursday', startTime: '10:00', endTime: '11:00' }],
      attendanceMode: 'full',
      fee: { isPaid: false, feeType: 'monthly', amount: 0, siblingDiscount: false, staffDiscount: false },
      conditions: {}, periodStart: futureDate(1), periodEnd: futureDate(90),
      applicationStartDate: futureDate(0), applicationEndDate: futureDate(30),
      absenceLimit: 5, consecutiveAbsenceLimit: 3, entryGraceMinutes: 15,
      instructorId: null, isActive: true,
    })
    expect(subGroup.ok, `sub-group create failed: ${JSON.stringify(subGroup)}`).toBeTruthy()

    const copy = await apiPost<unknown>(`/${MODULE}/groups/${subGroup.data!.id}/copy`, { targetFacilityIds: [targetFacilityId] })
    expect(copy.ok).toBeFalsy()
    expect(copy.errorCode).toBe('SUBGROUP_COPY_NOT_ALLOWED')
  })

  test('hedef tesis listesi boşsa 4xx ile açık bir hata döner (sıfır-hata ilkesi — sunucu hatası fırlatmaz)', async () => {
    test.setTimeout(60000)
    const tag = uniq('e2ecopyD')
    const facilityId = await createFacility(tag, 100)
    const branchId = await createBranch(tag)
    const groupId = await createGroup(facilityId, branchId, tag, 20)

    const copy = await apiPost<unknown>(`/${MODULE}/groups/${groupId}/copy`, { targetFacilityIds: [] })
    expect(copy.ok).toBeFalsy()
    expect(copy.status).toBeLessThan(500)
  })
  test('yeni adla, seanslarıyla ve içeriksiz aynı tesise bağımsız pasif kopya oluşturur; kayıtlar taşınmaz', async () => {
    test.setTimeout(60000)
    const tag = uniq('e2ecopyE')
    const facilityId = await createFacility(tag, 100)
    const branchId = await createBranch(tag)
    const parentGroupId = await createGroup(facilityId, branchId, tag, 20)
    const sub = await apiPost<{ id: string }>(`/${MODULE}/groups/${parentGroupId}/sub-groups`, {
      name: `E2E Seans ${tag}`, description: null, gender: 'mixed',
      capacity: 10, reserveCapacity: 2, ageMin: 15, ageMax: 80,
      schedule: [{ day: 'thursday', startTime: '10:00', endTime: '11:00' }],
      attendanceMode: 'full',
      fee: { isPaid: false, feeType: 'monthly', amount: 0, siblingDiscount: false, staffDiscount: false },
      conditions: {}, periodStart: futureDate(1), periodEnd: futureDate(90),
      applicationStartDate: futureDate(0), applicationEndDate: futureDate(30),
      absenceLimit: 5, consecutiveAbsenceLimit: 3, entryGraceMinutes: 15,
      instructorId: null, isActive: true,
    })
    expect(sub.ok, JSON.stringify(sub)).toBeTruthy()

    const newName = `Yeni Dönem ${tag}`
    const copy = await apiPost<{ results: Array<{ facilityId: string; success: boolean; groupId: string | null }> }>(
      `/${MODULE}/groups/${parentGroupId}/copy`,
      { targetFacilityIds: [facilityId], name: newName, includeSubGroups: true, includeContent: false },
    )
    expect(copy.ok, JSON.stringify(copy)).toBeTruthy()
    const result = copy.data!.results[0]
    expect(result.success).toBeTruthy()
    expect(result.groupId).not.toBe(parentGroupId)

    const copied = (await apiGet<Record<string, unknown>>(`/${MODULE}/groups/${result.groupId}`)).data!
    expect(copied.name).toBe(newName)
    expect(copied.facilityId).toBe(facilityId)
    expect(copied.isActive).toBe(false)
    expect(copied.registeredCount).toBe(0)
    expect(copied.subGroupCount).toBe(1)
    const fee = copied.fee as { amount: number }
    expect(fee.amount).toBe(250)
    const conditions = (copied.conditions ?? {}) as Record<string, unknown>
    expect(conditions.aboutHtml ?? '').toBe('')
    expect(conditions.requirements ?? '').toBe('')

    const children = await apiGet<{ items?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> }>(
      `/${MODULE}/groups?parentGroupId=${result.groupId}&limit=50`,
    )
    const kids = children.data?.items ?? children.data?.data ?? []
    expect(kids).toHaveLength(1)
    expect(kids[0].name).toBe(`E2E Seans ${tag}`)
    expect(kids[0].isActive).toBe(false)
    expect(kids[0].id).not.toBe(sub.data!.id)

    const original = (await apiGet<Record<string, unknown>>(`/${MODULE}/groups/${parentGroupId}`)).data!
    expect(original.isActive).toBe(true)
    expect((original.conditions as Record<string, unknown>).requirements).toBe('Spor kıyafeti')
  })

  test('seanssız kopya alt grup taşımaz, boş ad 4xx döner', async () => {
    test.setTimeout(60000)
    const tag = uniq('e2ecopyF')
    const facilityId = await createFacility(tag, 100)
    const branchId = await createBranch(tag)
    const groupId = await createGroup(facilityId, branchId, tag, 20)
    await apiPost(`/${MODULE}/groups/${groupId}/sub-groups`, {
      name: `E2E Seans ${tag}`, description: null, gender: 'mixed', capacity: 10, reserveCapacity: 2, ageMin: 15, ageMax: 80,
      schedule: [{ day: 'friday', startTime: '10:00', endTime: '11:00' }], attendanceMode: 'full',
      fee: { isPaid: false, feeType: 'monthly', amount: 0, siblingDiscount: false, staffDiscount: false },
      conditions: {}, periodStart: futureDate(1), periodEnd: futureDate(90),
      applicationStartDate: futureDate(0), applicationEndDate: futureDate(30),
      absenceLimit: 5, consecutiveAbsenceLimit: 3, entryGraceMinutes: 15, instructorId: null, isActive: true,
    })

    const copy = await apiPost<{ results: Array<{ success: boolean; groupId: string | null }> }>(
      `/${MODULE}/groups/${groupId}/copy`, { targetFacilityIds: [facilityId], name: `Tekil ${tag}`, includeSubGroups: false, includeContent: true },
    )
    expect(copy.ok, JSON.stringify(copy)).toBeTruthy()
    const copied = (await apiGet<Record<string, unknown>>(`/${MODULE}/groups/${copy.data!.results[0].groupId}`)).data!
    expect(copied.subGroupCount).toBe(0)
    expect((copied.conditions as Record<string, unknown>).requirements).toBe('Spor kıyafeti')

    const blank = await apiPost<unknown>(`/${MODULE}/groups/${groupId}/copy`, { targetFacilityIds: [facilityId], name: '   ' })
    expect(blank.ok).toBeFalsy()
    expect(blank.status).toBeLessThan(500)
  })
})

test.describe('Grup/Seans Kopyalama — UI (Kadın ve Aile)', () => {
  test.skip(!(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD), 'E2E_ADMIN_EMAIL/PASSWORD verilmedi')

  test('Kopyala modalı yeni ad ister, bu tesis önseçili gelir, kopya düzenleme çekmecesinde renkli bölümlerle açılır', async ({ page }) => {
    test.setTimeout(90_000)
    const tag = uniq('e2ecopyUI')
    ctx = await pwRequest.newContext()
    const token = await apiToken()
    const me = await ctx.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())
    managerId = me?.data?.me?.id ?? me?.data?.id

    const sourceFacilityId = await createFacility(`${tag}src`, 100)
    const branchId = await createBranch(tag)
    await createGroup(sourceFacilityId, branchId, tag, 20)
    await ctx.dispose()

    await login(page)
    await page.goto(`/women-family?f=${sourceFacilityId}&tab=groups`)

    const row = page.locator('tr', { hasText: `E2E Copy Grubu ${tag}` })
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.getByRole('button', { name: 'Tüm işlemleri göster' }).click()
    await page.getByRole('button', { name: /Kopyala/ }).click()

    const modal = page.locator('div.relative.z-10').filter({ hasText: 'Yeni Ad' }).last()
    await expect(modal).toBeVisible({ timeout: 5000 })
    await expect(modal.getByText(`E2E Copy Tesis ${tag}src (bu tesis)`)).toBeVisible()

    const nameInput = modal.getByPlaceholder(/adı$/)
    await expect(nameInput).toHaveValue(`E2E Copy Grubu ${tag} (Kopya)`)
    const copyButton = modal.getByRole('button', { name: 'Kopyala' })
    await expect(copyButton).toBeEnabled()
    await nameInput.fill('')
    await expect(copyButton).toBeDisabled()
    await expect(modal.getByText('Yeni grup adı zorunludur.')).toBeVisible()
    const newName = `Yeni Dönem ${tag}`
    await nameInput.fill(newName)
    await expect(modal.getByRole('switch', { name: /Seanslarıyla birlikte kopyala/ })).toBeChecked()
    await expect(modal.getByRole('switch', { name: /İçerikle birlikte kopyala/ })).toBeChecked()
    await copyButton.click()

    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0, { timeout: 3000 })
    await expect(page.getByText(/tesise kopyalandı/)).toBeVisible({ timeout: 10000 })

    const drawer = page.locator('div.relative.z-10').filter({ hasText: 'Düzenle' }).last()
    await expect(drawer).toBeVisible({ timeout: 10000 })
    await expect(drawer.locator('input').first()).toHaveValue(newName)
    await expect(drawer.getByText('İkamet ve Katılım Bölgesi')).toBeVisible()
    await expect(drawer.getByText('Evrak Şartları')).toBeVisible()
    const tones = await drawer.locator('[data-tone]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tone')))
    expect(new Set(tones).size).toBeGreaterThanOrEqual(5)
    await page.screenshot({ path: 'test-results/group-copy-colored-sections.png' })
  })
})
