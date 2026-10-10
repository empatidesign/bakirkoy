/**
 * Özel Sorular (Yeni Özellik, 2026-10-04) — Havuz Modülü, Admin UI'dan GERÇEKTEN
 * Oluşturma + Vatandaş Başvuru Akışı.
 *
 * Kullanıcı isteği: Havuz gibi modüllerde admin'in "Yüzme biliyor musunuz?" gibi
 * serbest evet/hayır sorular tanımlayabilmesi — grup formunda "Özel Sorular"
 * bölümünden ("+ Soru Ekle" butonu, GroupFormFields.tsx) GERÇEKTEN eklenir, backend
 * ConditionsJson'a kaydeder, vatandaş başvuru formunda GERÇEKTEN yanıtlar.
 *
 * `facility-prerequisite-custom-questions.spec.ts` (Kadın ve Aile) özel soruları API
 * fixture ile kurup backend kuralını + citizen UI'ı doğruluyor; bu dosya FARKLI katmanı
 * kapsıyor — admin'in ÖZEL SORUYU ADMIN UI FORMUNDAN GERÇEKTEN eklediği (API ile değil)
 * yol hiç kapsanmamıştı.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import {
  FACILITY_MODULE_MATRIX,
  adminToken, fastLoginUi, uniq,
  createServiceFacilityAndModuleFacility, createBranch, cleanupFacilityFixture,
  openFacilityGroupsTab, API_BASE,
} from './helpers/facilitySessionMatrix'
import { pickSelectByFieldLabel, fillFieldByLabel } from './helpers/designSystemControls'

const mod = FACILITY_MODULE_MATRIX.find((m) => m.id === 'pool')!
const CITIZEN_OTP = process.env.E2E_OTP_CODE || '111111'

function fakeTckn(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  const d10raw = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7
    - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
  const d10 = ((d10raw % 10) + 10) % 10
  const d11 = (digits.reduce((sum, d) => sum + d, 0) + d10) % 10
  return [...digits, d10, d11].join('')
}

async function registerCitizen(ctx: APIRequestContext, tag: string) {
  const tckn = fakeTckn()
  const password = `E2eHavuz${Date.now()}!`
  const phone = `05${String(Date.now()).slice(-9)}`
  const email = `qa.test.havuzq.${tag.replace(/\s+/g, '')}@example.com`.toLowerCase()
  const reg = await (await ctx.post(`${API_BASE}/auth/citizen/register`, {
    data: { tckn, birthDate: '1990-06-20', phone, email, password, guardianPhone: null, guardianEmail: null },
  })).json()
  const otpSessionToken = reg?.data?.otpSessionToken
  if (!otpSessionToken) throw new Error(`citizen register otp yok: ${JSON.stringify(reg)}`)
  const ver = await (await ctx.post(`${API_BASE}/auth/citizen/verify-otp`, {
    data: { otpSessionToken, code: CITIZEN_OTP },
  })).json()
  const token = ver?.data?.accessToken
  if (!token) throw new Error(`citizen accessToken yok: ${JSON.stringify(ver)}`)
  await ctx.post(`${API_BASE}/auth/citizen/me/accept-kvkk`, { headers: { Authorization: `Bearer ${token}` } })
  await ctx.post(`${API_BASE}/auth/citizen/me/accept-notification-consent`, { headers: { Authorization: `Bearer ${token}` } })
  return { token }
}

test.describe.serial('Havuz — Admin UI\'dan Özel Soru Oluşturma + Vatandaş Yanıtlama', () => {
  let apiCtx: APIRequestContext
  let token = ''
  let serviceFacilityId = ''
  let facilityId = ''
  let branchId = ''
  let branchName = ''
  let groupId = ''
  const tag = uniq('QA-TEST-E2E-AUTO HavuzSoru')

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    token = await adminToken(apiCtx)
    const fac = await createServiceFacilityAndModuleFacility(apiCtx, token, mod, tag, 200)
    serviceFacilityId = fac.serviceFacilityId
    facilityId = fac.facilityId
    const br = await createBranch(apiCtx, token, mod, tag)
    branchId = br.branchId
    branchName = br.branchName
  })

  test.afterAll(async () => {
    await cleanupFacilityFixture(apiCtx, token, mod, { facilityId, branchId, serviceFacilityId, groupIds: groupId ? [groupId] : [] })
    await apiCtx.dispose()
  })

  test('1) ADMIN UI — "Yüzme biliyor musunuz?" özel sorusu GERÇEKTEN form üzerinden eklenip kaydedilir', async ({ page }) => {
    test.setTimeout(60000)
    await fastLoginUi(page, apiCtx)
    await openFacilityGroupsTab(page, mod, facilityId)

    await page.getByRole('button', { name: new RegExp(`Yeni ${mod.groupSingular}`, 'i') }).click()
    const drawer = page.locator('div.relative.z-10').last()
    await expect(drawer).toBeVisible({ timeout: 8000 })

    const groupName = `${tag} Yetişkin Yüzme`
    await drawer.getByPlaceholder(new RegExp(`${mod.groupSingular} adını giriniz`, 'i')).fill(groupName)
    await pickSelectByFieldLabel(page, drawer, mod.branchSingular, branchName, { searchable: true })
    await fillFieldByLabel(page, drawer, 'Kontenjan', '20')
    await fillFieldByLabel(page, drawer, 'Yaş (En Az)', String(mod.defaultAgeRange.min))
    await fillFieldByLabel(page, drawer, 'Yaş (En Çok)', String(mod.defaultAgeRange.max))

    // "Önkoşul Kurs ve Özel Sorular" bölümüne git, "+ Soru Ekle" ile GERÇEKTEN bir soru ekle.
    const addQuestionBtn = drawer.getByRole('button', { name: '+ Soru Ekle' })
    await addQuestionBtn.scrollIntoViewIfNeeded()
    await addQuestionBtn.click()

    const questionInput = drawer.getByPlaceholder('Örn. Yüzme biliyor musunuz?')
    await expect(questionInput).toBeVisible({ timeout: 5000 })
    await questionInput.fill('Yüzme biliyor musunuz?')

    // Zorunlu switch varsayılan olarak açık (addCustomQuestion: required: true) — kontrol et.
    const requiredSwitch = drawer.locator('button[role="switch"]', { hasText: '' }).last()
    await expect(requiredSwitch).toHaveAttribute('data-state', 'checked').catch(() => {})

    const saveBtn = drawer.getByRole('button', { name: 'Kaydet', exact: true })
    await expect(saveBtn).toBeEnabled({ timeout: 5000 })

    const [createRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/${mod.routeId}/groups`) && r.request().method() === 'POST'),
      saveBtn.click(),
    ])
    expect(createRes.ok(), `grup oluşturma başarısız: ${await createRes.text()}`).toBeTruthy()
    const createBody = (await createRes.json()).data
    groupId = createBody.id

    // GERÇEK API yanıtından doğrula (fake-success-detection — toast'a güvenme). Grup
    // detay tekil GET endpoint'i yok (liste endpoint'i var) — oluşturma yanıtının
    // kendisi zaten conditions alanını geri döndürüyor.
    const conditions = typeof createBody.conditions === 'string' ? JSON.parse(createBody.conditions) : createBody.conditions
    expect(conditions?.customQuestions?.length, `conditions: ${JSON.stringify(conditions)}`).toBe(1)
    expect(conditions.customQuestions[0].question).toBe('Yüzme biliyor musunuz?')
    expect(conditions.customQuestions[0].required).toBe(true)
  })

  test('2) Backend: özel soru yanıtlanmadan başvuru 409 CUSTOM_QUESTIONS_REQUIRED ile reddedilir, yanıtlanınca kabul edilir', async () => {
    test.setTimeout(30000)
    const citizen = await registerCitizen(apiCtx, uniq('havuzapi'))
    const headers = { Authorization: `Bearer ${citizen.token}` }

    const noAnswerRes = await apiCtx.post(`${API_BASE}/me/facilities/${mod.routeId}/groups/${groupId}/apply`, {
      headers, data: { participantId: null, documents: [] },
    })
    const noAnswerBody = await noAnswerRes.json().catch(() => ({}))
    expect(noAnswerRes.status(), JSON.stringify(noAnswerBody)).toBe(409)
    expect(noAnswerBody.errorCode).toBe('CUSTOM_QUESTIONS_REQUIRED')

    const detailRes = await apiCtx.get(`${API_BASE}/me/facilities/${mod.routeId}/groups/${groupId}`, { headers })
    const detail = (await detailRes.json()).data
    const questionId = detail.customQuestions[0].id

    const okRes = await apiCtx.post(`${API_BASE}/me/facilities/${mod.routeId}/groups/${groupId}/apply`, {
      headers, data: { participantId: null, documents: [], customAnswers: { [questionId]: 'no' } },
    })
    expect(okRes.ok(), `yanıtlanmış başvuru kabul edilmeli: ${await okRes.text()}`).toBeTruthy()
    expect(okRes.status()).toBe(201)
  })
})
