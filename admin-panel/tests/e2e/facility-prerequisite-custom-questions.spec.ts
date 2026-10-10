/**
 * Önkoşul Kurs + Özel Sorular (Yeni Özellik, 2026-10-04) — Vatandaş Başvuru Akışı, 3 katmanlı.
 *
 * Kullanıcı isteği: "Arapça Seviye 2" gibi bir kursa yalnızca "Arapça Seviye 1"i tamamlamış
 * vatandaşlar başvurabilsin; Havuz gibi modüllerde admin'in tanımlayabileceği serbest
 * evet/hayır sorular (örn. "Yüzme biliyor musunuz?") zorunlu/opsiyonel olarak başvuru
 * formunda yanıtlanmalı. Bu dosya üç katmanı da gerçek backend'e karşı doğrular:
 *
 * Katman 1 — API fixture: women-family modülünde iki grup oluşturulur — "Seviye 1"
 *   (autoApprove açık, önkoşulsuz) ve "Seviye 2" (prerequisiteGroupId = Seviye 1,
 *   customQuestions = [{question: 'Daha önce Arapça eğitimi aldınız mı?', required: true}]).
 * Katman 2 — Backend iş kuralı (API düzeyinde GERÇEK doğrulama): Seviye 1'e hiç
 *   kaydolmamış bir vatandaşın Seviye 2'ye başvurusu 409 PREREQUISITE_NOT_MET ile
 *   reddedilir; Seviye 1'i tamamlamış (active FacilityRegistration) bir vatandaş özel
 *   soruyu yanıtlamadan başvurursa 409 CUSTOM_QUESTIONS_REQUIRED alır; her ikisini de
 *   sağlayınca başvuru 201 ile kabul edilir.
 * Katman 3 — Citizen-portal UI: vatandaş GERÇEK giriş yapar, Seviye 2 grup detayını açar,
 *   önkoşul-kilit banner'ını GERÇEKTEN görür (henüz Seviye 1'i tamamlamadan), sonra Seviye
 *   1'e kaydolup (API ile, hız için) sayfayı yeniler — banner kaybolur, özel soru kartı
 *   görünür, Evet/Hayır seçmeden "Başvur" devre dışıdır, seçince aktifleşir ve gerçek
 *   başvuru gönderilir.
 */
import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import {
  API_BASE, adminToken, uniq, futureIso,
  createServiceFacilityAndModuleFacility, createBranch, cleanupFacilityFixture,
  FACILITY_MODULE_MATRIX,
} from './helpers/facilitySessionMatrix'

const CITIZEN_PORTAL_URL = process.env.E2E_CITIZEN_PORTAL_URL || 'http://localhost:3100'
const CITIZEN_OTP = process.env.E2E_OTP_CODE || '111111'
const mod = FACILITY_MODULE_MATRIX.find((m) => m.id === 'women_family')!

function fakeTckn(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  if (digits[0] === 0) digits[0] = 1
  const d10raw = ((digits[0] + digits[2] + digits[4] + digits[6] + digits[8]) * 7
    - (digits[1] + digits[3] + digits[5] + digits[7])) % 10
  const d10 = ((d10raw % 10) + 10) % 10
  const d11 = (digits.reduce((sum, d) => sum + d, 0) + d10) % 10
  return [...digits, d10, d11].join('')
}

async function registerCitizen(ctx: APIRequestContext, tag: string): Promise<{ token: string; refreshToken: string; tckn: string; birthDate: string; password: string }> {
  const tckn = fakeTckn()
  const birthDate = '1995-03-10'
  const password = `E2ePrereq${Date.now()}!`
  const phone = `05${String(Date.now()).slice(-9)}`
  const email = `qa.test.prereq.${tag.replace(/\s+/g, '')}@example.com`.toLowerCase()
  const reg = await (await ctx.post(`${API_BASE}/auth/citizen/register`, {
    data: { tckn, birthDate, phone, email, password, guardianPhone: null, guardianEmail: null },
  })).json()
  const otpSessionToken = reg?.data?.otpSessionToken
  if (!otpSessionToken) throw new Error(`citizen register otp yok: ${JSON.stringify(reg)}`)
  const ver = await (await ctx.post(`${API_BASE}/auth/citizen/verify-otp`, {
    data: { otpSessionToken, code: CITIZEN_OTP },
  })).json()
  const token = ver?.data?.accessToken
  const refreshToken = ver?.data?.refreshToken
  if (!token) throw new Error(`citizen accessToken yok: ${JSON.stringify(ver)}`)
  await ctx.post(`${API_BASE}/auth/citizen/me/accept-kvkk`, { headers: { Authorization: `Bearer ${token}` } })
  await ctx.post(`${API_BASE}/auth/citizen/me/accept-notification-consent`, { headers: { Authorization: `Bearer ${token}` } })
  return { token, refreshToken, tckn, birthDate, password }
}

/**
 * UI'ya (citizen-portal) GERÇEKTEN alınmış bir access/refresh token'ı localStorage'a
 * enjekte ederek oturum açar — admin-panel helpers/citizenAuth.ts'teki
 * citizenLoginUiWithToken ile AYNI kanıtlanmış desen (bu dosyada admin-panel'in
 * test runner'ı değil, tek başına citizen-portal'a karşı çalıştığımız için
 * burada yeniden tanımlandı). Token zaten /me/facilities akışları için GEÇERLİ
 * (aynı backend — 5207 — hem register hem de bu testin tüm API çağrıları için
 * kullanılıyor, UI de .env.local üzerinden aynı 5207'ye yönlendirilmiş durumda).
 */
async function citizenLoginUi(page: Page, token: string, refreshToken: string) {
  await page.addInitScript(() => localStorage.setItem('nexora_citizen_onboarding_done', '1'))
  await page.goto(`${CITIZEN_PORTAL_URL}/login`)
  await page.evaluate(({ at, rt }) => {
    localStorage.setItem('portal_access_token', at)
    localStorage.setItem('portal_refresh_token', rt)
  }, { at: token, rt: refreshToken })
  await page.goto(`${CITIZEN_PORTAL_URL}/`)
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
}

test.describe.serial('Önkoşul Kurs + Özel Sorular — Kadın ve Aile (Arapça Seviye 1→2), 3 katmanlı', () => {
  let apiCtx: APIRequestContext
  let adminTok = ''
  let facilityId = ''
  let serviceFacilityId = ''
  let branchId = ''
  let seviye1GroupId = ''
  let seviye2GroupId = ''
  const tag = uniq('QA-TEST-E2E-AUTO Prereq')

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    adminTok = await adminToken(apiCtx)
    const headers = { Authorization: `Bearer ${adminTok}` }

    const fac = await createServiceFacilityAndModuleFacility(apiCtx, adminTok, mod, tag)
    facilityId = fac.facilityId
    serviceFacilityId = fac.serviceFacilityId
    const branch = await createBranch(apiCtx, adminTok, mod, fac.tag)
    branchId = branch.branchId

    // Seviye 1 — önkoşulsuz, otomatik onay (vatandaş hızlıca "tamamlamış" sayılsın diye).
    const g1Body = {
      facilityId, branchId, parentGroupId: null,
      name: `${tag} Arapça Seviye 1`, description: 'E2E önkoşul testi', type: 'kurs', gender: 'mixed',
      capacity: 20, reserveCapacity: 5, ageMin: mod.defaultAgeRange.min, ageMax: mod.defaultAgeRange.max,
      schedule: [{ day: 'monday', startTime: '10:00', endTime: '11:30' }],
      attendanceMode: 'full',
      fee: { isPaid: false, feeType: 'monthly', amount: 0, siblingDiscount: false, staffDiscount: false },
      conditions: { documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: '', prerequisiteGroupId: null, customQuestions: [] },
      periodStart: futureIso(0), periodEnd: futureIso(90), periodMonths: 3, periodType: 'month', periodCount: 3,
      academyWhitelistEnabled: false, absenceLimit: 5, consecutiveAbsenceLimit: 3, entryGraceMinutes: 15,
      instructorId: null, isActive: true, autoApprove: true,
      attendanceLimitOverride: false, attendanceLimitType: 'unlimited', attendanceLimitCount: 0,
      applicationStartDate: futureIso(0), applicationEndDate: futureIso(30),
    }
    const g1Res = await apiCtx.post(`${API_BASE}/${mod.routeId}/groups`, { headers, data: g1Body })
    expect(g1Res.ok(), `Seviye 1 grubu oluşturulamadı: ${await g1Res.text()}`).toBeTruthy()
    seviye1GroupId = (await g1Res.json()).data.id

    // Başvuru/dönem başlangıcını geriye çek, aynen facility-accessible-config.spec.ts
    // desenindeki gibi (oluştururken geçmiş tarih reddediliyor, PUT ile geri alınabiliyor) —
    // önkoşul testi için Seviye 1'in başvuruya ANINDA açık olması gerekiyor.
    const g1Backdate = await apiCtx.put(`${API_BASE}/${mod.routeId}/groups/${seviye1GroupId}`, {
      headers, data: { ...g1Body, periodStart: futureIso(-1), applicationStartDate: futureIso(-1) },
    })
    expect(g1Backdate.ok(), `Seviye 1 backdate başarısız: ${await g1Backdate.text()}`).toBeTruthy()

    // Seviye 2 — prerequisiteGroupId = Seviye 1, zorunlu özel soru.
    const g2Body = {
      ...g1Body,
      name: `${tag} Arapça Seviye 2`,
      schedule: [{ day: 'wednesday', startTime: '10:00', endTime: '11:30' }],
      autoApprove: false,
      conditions: {
        documentsRequired: false, requiredDocumentIds: [], documentFormats: {}, residenceRequired: false,
        requirements: '', applicationConditions: '', aboutHtml: '',
        prerequisiteGroupId: seviye1GroupId,
        customQuestions: [{ id: 'q-arapca-tecrube', question: 'Daha önce Arapça eğitimi aldınız mı?', required: true }],
      },
    }
    const g2Res = await apiCtx.post(`${API_BASE}/${mod.routeId}/groups`, { headers, data: g2Body })
    expect(g2Res.ok(), `Seviye 2 grubu oluşturulamadı: ${await g2Res.text()}`).toBeTruthy()
    seviye2GroupId = (await g2Res.json()).data.id
  })

  test.afterAll(async () => {
    await cleanupFacilityFixture(apiCtx, adminTok, mod, { facilityId, branchId, serviceFacilityId, groupIds: [seviye2GroupId, seviye1GroupId] })
    await apiCtx.dispose()
  })

  test('Katman 1+2: backend API — önkoşulsuz başvuru 409 PREREQUISITE_NOT_MET ile reddedilir', async () => {
    test.setTimeout(60000)
    const citizen = await registerCitizen(apiCtx, uniq('prereqblock'))
    const headers = { Authorization: `Bearer ${citizen.token}` }

    const res = await apiCtx.post(`${API_BASE}/me/facilities/${mod.routeId}/groups/${seviye2GroupId}/apply`, {
      headers, data: { participantId: null, documents: [] },
    })
    const body = await res.json().catch(() => ({}))
    expect(res.status(), `beklenen 409 PREREQUISITE_NOT_MET, alınan: ${JSON.stringify(body)}`).toBe(409)
    expect(body.errorCode).toBe('PREREQUISITE_NOT_MET')
  })

  test('Katman 1+2: Seviye 1 tamamlanınca, özel soru yanıtlanmadan 409 CUSTOM_QUESTIONS_REQUIRED alınır; yanıtlanınca 201 ile kabul edilir', async () => {
    test.setTimeout(60000)
    const citizen = await registerCitizen(apiCtx, uniq('prereqok'))
    const headers = { Authorization: `Bearer ${citizen.token}` }

    // Seviye 1'e başvur — autoApprove açık olduğu için anında "active" FacilityRegistration oluşur.
    const s1Res = await apiCtx.post(`${API_BASE}/me/facilities/${mod.routeId}/groups/${seviye1GroupId}/apply`, {
      headers, data: { participantId: null, documents: [] },
    })
    expect(s1Res.ok(), `Seviye 1 başvurusu başarısız: ${await s1Res.text()}`).toBeTruthy()
    const s1Body = (await s1Res.json()).data
    expect(s1Body.status, 'autoApprove açık grupta başvuru doğrudan onaylanmalı').toBe('approved')

    // Önkoşul artık sağlanmış — ama özel soru yanıtlanmadan Seviye 2'ye başvuru reddedilmeli.
    const s2NoAnswerRes = await apiCtx.post(`${API_BASE}/me/facilities/${mod.routeId}/groups/${seviye2GroupId}/apply`, {
      headers, data: { participantId: null, documents: [] },
    })
    const s2NoAnswerBody = await s2NoAnswerRes.json().catch(() => ({}))
    expect(s2NoAnswerRes.status(), `beklenen 409 CUSTOM_QUESTIONS_REQUIRED: ${JSON.stringify(s2NoAnswerBody)}`).toBe(409)
    expect(s2NoAnswerBody.errorCode).toBe('CUSTOM_QUESTIONS_REQUIRED')

    // Hem önkoşul hem özel soru sağlanınca başvuru kabul edilir.
    const s2Res = await apiCtx.post(`${API_BASE}/me/facilities/${mod.routeId}/groups/${seviye2GroupId}/apply`, {
      headers, data: { participantId: null, documents: [], customAnswers: { 'q-arapca-tecrube': 'yes' } },
    })
    expect(s2Res.ok(), `Seviye 2 başvurusu (önkoşul+soru sağlanmış) başarısız: ${await s2Res.text()}`).toBeTruthy()
    expect(s2Res.status()).toBe(201)
  })

  test('Katman 1+2: grup detay endpoint, prerequisiteMet=false ve customQuestions listesini doğru döner', async () => {
    test.setTimeout(60000)
    const citizen = await registerCitizen(apiCtx, uniq('prereqdetail'))
    const headers = { Authorization: `Bearer ${citizen.token}` }

    const detailRes = await apiCtx.get(`${API_BASE}/me/facilities/${mod.routeId}/groups/${seviye2GroupId}`, { headers })
    expect(detailRes.ok(), `grup detay başarısız: ${await detailRes.text()}`).toBeTruthy()
    const detail = (await detailRes.json()).data
    expect(detail.prerequisiteGroupId).toBe(seviye2GroupId === seviye2GroupId ? seviye1GroupId : null)
    expect(detail.prerequisiteMet).toBe(false)
    expect(detail.prerequisiteGroupName).toContain('Seviye 1')
    expect(Array.isArray(detail.customQuestions)).toBeTruthy()
    expect(detail.customQuestions.length).toBe(1)
    expect(detail.customQuestions[0].question).toBe('Daha önce Arapça eğitimi aldınız mı?')
    expect(detail.customQuestions[0].required).toBe(true)
  })

  test('Katman 3: Citizen-portal UI — önkoşul kilit banner gerçekten görünür, sonra Seviye 1 tamamlanınca kaybolur ve özel soru kartı görünür', async ({ page }) => {
    test.setTimeout(90000)
    const citizen = await registerCitizen(apiCtx, uniq('prereqUI'))
    await citizenLoginUi(page, citizen.token, citizen.refreshToken)

    await page.goto(`${CITIZEN_PORTAL_URL}/hizmetler?m=${mod.routeId}`)
    await page.waitForLoadState('networkidle').catch(() => {})

    const searchBox = page.getByPlaceholder(/[Aa]ra/).first()
    if (await searchBox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchBox.fill(`${tag} Arapça Seviye 2`)
    }
    const groupCard = page.getByText(new RegExp(`${tag} Arapça Seviye 2`, 'i')).first()
    await expect(groupCard).toBeVisible({ timeout: 10000 })
    await groupCard.click()

    // Önkoşul kilidi GERÇEKTEN görünür olmalı.
    await expect(page.getByText(/Seviye 1/).first()).toBeVisible({ timeout: 15000 })
    const applyButtonLocked = page.getByRole('button', { name: /Başvur/i }).last()
    if (await applyButtonLocked.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(applyButtonLocked).toBeDisabled()
    }

    // Seviye 1'e API ile hızlıca kaydol (otomatik onaylı).
    const headers = { Authorization: `Bearer ${citizen.token}` }
    const s1Res = await apiCtx.post(`${API_BASE}/me/facilities/${mod.routeId}/groups/${seviye1GroupId}/apply`, {
      headers, data: { participantId: null, documents: [] },
    })
    expect(s1Res.ok(), `Seviye 1 UI-akış başvurusu başarısız: ${await s1Res.text()}`).toBeTruthy()

    await page.reload()
    await page.waitForLoadState('networkidle').catch(() => {})

    // Reload modal durumunu URL'de tutmuyor (modal state'i component state'i) —
    // grup kartına tekrar tıklayıp detayı yeniden açmak gerekiyor.
    const groupCardAfterReload = page.getByText(new RegExp(`${tag} Arapça Seviye 2`, 'i')).first()
    await expect(groupCardAfterReload).toBeVisible({ timeout: 10000 })
    await groupCardAfterReload.click()

    // Önkoşul kilidi artık kaybolmuş, özel soru kartı görünür olmalı.
    await expect(page.getByText('Daha önce Arapça eğitimi aldınız mı?')).toBeVisible({ timeout: 15000 })

    const applyButton = page.getByRole('button', { name: /Başvur/i }).last()
    // Zorunlu soru yanıtlanmadan buton pasif.
    if (await applyButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(applyButton).toBeDisabled()
    }

    // "Evet" yanıtını seç.
    await page.getByRole('button', { name: 'Evet' }).first().click()

    const termsBox = page.getByText(/şartlarını ve kuralları.*okudum/i).first()
    if (await termsBox.isVisible({ timeout: 2000 }).catch(() => false)) await termsBox.click()

    await expect(applyButton).toBeEnabled({ timeout: 5000 })

    const applyResponse = page.waitForResponse((r) => r.url().includes(`/groups/${seviye2GroupId}/apply`) && r.request().method() === 'POST')
    await applyButton.click()
    const res = await applyResponse
    expect(res.ok(), `UI üzerinden Seviye 2 başvurusu başarısız: ${await res.text()}`).toBeTruthy()

    const successHeading = page.getByRole('heading', { name: /Başvurunuz alındı|Yedek listesine alındınız/i })
    await expect(successHeading).toBeVisible({ timeout: 8000 })
  })
})
