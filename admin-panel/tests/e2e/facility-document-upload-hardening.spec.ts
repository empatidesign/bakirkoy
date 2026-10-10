/**
 * Evrak Yükleme Hattı Sertleştirme (Yeni Özellik, 2026-10-04) — Format Doğrulama +
 * Güvenlik Taraması + WebP Optimizasyon, GERÇEK multipart upload ile.
 *
 * Kullanıcı isteği: "yüklenecek pdf/jpg/png zorunluluğu olacak ve optimize edilerek
 * yüklenecek ve güvenlik kontrolünden geçirilecek" — backend artık sadece dosya
 * uzantısı/Content-Type beyanına değil, dosyanın GERÇEK baytlarındaki imzaya
 * (FileSignatureValidator, magic-byte) bakıyor; eşleşmeyen her şeyi reddediyor.
 *
 * Bu dosya `POST /me/facilities/{module}/documents` endpoint'ine GERÇEK multipart
 * istekler atarak üç senaryoyu backend'e karşı doğrular:
 *   1) Tehlikeli uzantı (.exe) → SafeUploadValidation tarafından 409 UNSAFE_FILE_TYPE.
 *   2) ".pdf" uzantılı ama içeriği düz metin olan sahte dosya (içerik imzası PDF
 *      DEĞİL) → FileSignatureValidator tarafından 409 DOCUMENT_FORMAT_INVALID
 *      (bu, "beyan edilen uzantıya güvenme" açığının GERÇEKTEN kapatıldığının kanıtı).
 *   3) Gerçek bir PNG (doğru magic-byte imzalı, 1x1 piksel) → kabul edilir (201),
 *      dönen objectName/fileName'in `.webp` uzantılı olması WebpImageConverter'ın
 *      GERÇEKTEN çalıştığının kanıtıdır.
 *   4) Gerçek bir PDF (doğru %PDF imzalı, minimal) → kabul edilir (201), PDF olduğu
 *      için webp dönüştürülmeden (passthrough) `.pdf` uzantısıyla yüklenir.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { API_BASE } from './helpers/facilitySessionMatrix'

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

async function registerCitizen(ctx: APIRequestContext, tag: string): Promise<string> {
  const tckn = fakeTckn()
  const password = `E2eUpload${Date.now()}!`
  const phone = `05${String(Date.now()).slice(-9)}`
  const email = `qa.test.upload.${tag.replace(/\s+/g, '')}@example.com`.toLowerCase()
  const reg = await (await ctx.post(`${API_BASE}/auth/citizen/register`, {
    data: { tckn, birthDate: '1992-05-15', phone, email, password, guardianPhone: null, guardianEmail: null },
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
  return token
}

// Gerçek, geçerli bir 1x1 piksel PNG — doğru 8 baytlık PNG imzasıyla başlar.
const REAL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

// Gerçek, geçerli minimal bir tek-sayfa PDF — doğru "%PDF-1.4" imzasıyla başlar.
const REAL_PDF_TEXT = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
xref
0 4
0000000000 65535 f 
trailer<</Size 4/Root 1 0 R>>
startxref
0
%%EOF`

test.describe('Evrak Yükleme Hattı — Format Doğrulama + Güvenlik Taraması + WebP Optimizasyon (GERÇEK multipart)', () => {
  let apiCtx: APIRequestContext
  let citizenToken = ''

  test.beforeAll(async () => {
    apiCtx = await pwRequest.newContext()
    citizenToken = await registerCitizen(apiCtx, 'uploadpipe')
  })

  test.afterAll(async () => {
    await apiCtx.dispose()
  })

  test('1) Tehlikeli uzantı (.exe) 409 UNSAFE_FILE_TYPE ile reddedilir (SafeUploadValidation)', async () => {
    test.setTimeout(30000)
    const res = await apiCtx.post(`${API_BASE}/me/facilities/women-family/documents`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
      multipart: {
        file: {
          name: 'rapor.exe',
          mimeType: 'application/x-msdownload',
          buffer: Buffer.from('MZ fake executable header bytes'),
        },
      },
    })
    const body = await res.json().catch(() => ({}))
    expect(res.status(), JSON.stringify(body)).toBe(409)
    expect(body.errorCode).toBe('UNSAFE_FILE_TYPE')
  })

  test('2) ".pdf" uzantılı ama içeriği düz metin olan SAHTE dosya 409 DOCUMENT_FORMAT_INVALID ile reddedilir (FileSignatureValidator — beyan edilen uzantıya güvenmiyor)', async () => {
    test.setTimeout(30000)
    const res = await apiCtx.post(`${API_BASE}/me/facilities/women-family/documents`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
      multipart: {
        file: {
          name: 'sahte-rapor.pdf',
          mimeType: 'application/pdf',
          // GERÇEKTEN bir PDF değil — düz metin. Dosya adı/Content-Type "pdf" diyor ama
          // baytlar %PDF imzasıyla BAŞLAMIYOR; FileSignatureValidator bunu yakalamalı.
          buffer: Buffer.from('Bu dosya aslında bir PDF değil, sadece düz metin içerik.'),
        },
      },
    })
    const body = await res.json().catch(() => ({}))
    expect(res.status(), JSON.stringify(body)).toBe(409)
    expect(body.errorCode).toBe('DOCUMENT_FORMAT_INVALID')
  })

  test('3) GERÇEK PNG (doğru magic-byte imzalı) kabul edilir ve WebP\'ye dönüştürülerek yüklenir', async () => {
    test.setTimeout(30000)
    const res = await apiCtx.post(`${API_BASE}/me/facilities/women-family/documents`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
      multipart: {
        file: {
          name: 'gercek-foto.png',
          mimeType: 'image/png',
          buffer: Buffer.from(REAL_PNG_BASE64, 'base64'),
        },
      },
    })
    const body = await res.json().catch(() => ({}))
    expect(res.ok(), `gerçek PNG kabul edilmeli: ${JSON.stringify(body)}`).toBeTruthy()
    // WebpImageConverter'ın GERÇEKTEN çalıştığının kanıtı: dönen dosya adı .webp uzantılı.
    expect(body.data.fileName, `WebP dönüşümü beklenirken dönen: ${JSON.stringify(body.data)}`).toMatch(/\.webp$/i)
    expect(body.data.objectName).toMatch(/\.webp$/i)
  })

  test('4) GERÇEK PDF (doğru %PDF imzalı) kabul edilir ve PDF olarak (webp dönüştürülmeden) yüklenir', async () => {
    test.setTimeout(30000)
    const res = await apiCtx.post(`${API_BASE}/me/facilities/women-family/documents`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
      multipart: {
        file: {
          name: 'gercek-belge.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from(REAL_PDF_TEXT, 'utf-8'),
        },
      },
    })
    const body = await res.json().catch(() => ({}))
    expect(res.ok(), `gerçek PDF kabul edilmeli: ${JSON.stringify(body)}`).toBeTruthy()
    expect(body.data.fileName).toMatch(/\.pdf$/i)
    expect(body.data.objectName).toMatch(/\.pdf$/i)
  })

  test('5) Grup/evrak-tipi bazında daraltılmış format listesi (documentFormats) ihlali 409 DOCUMENT_FORMAT_NOT_ALLOWED ile reddedilir', async () => {
    test.setTimeout(60000)
    // Admin olarak yalnızca "pdf" kabul eden bir evrak tipiyle grup oluştur.
    const adminLogin = await (await apiCtx.post(`${API_BASE}/auth/login`, {
      data: { email: process.env.E2E_ADMIN_EMAIL || 'superadmin@nexora.local', password: process.env.E2E_ADMIN_PASSWORD || 'Nexora@Admin2026' },
    })).json()
    let adminTok = adminLogin?.data?.accessToken
    if (!adminTok) {
      const verify = await (await apiCtx.post(`${API_BASE}/auth/verify-otp`, {
        data: { otpSessionToken: adminLogin.data.otpSessionToken, code: process.env.E2E_OTP_CODE || '111111' },
      })).json()
      adminTok = verify?.data?.accessToken
    }
    expect(adminTok, 'admin token alınamadı').toBeTruthy()
    const headers = { Authorization: `Bearer ${adminTok}` }

    const me = await (await apiCtx.get(`${API_BASE}/auth/me`, { headers })).json()
    const managerId = me?.data?.me?.id
    const tag = `QA-TEST-E2E-AUTO UploadFmt ${Date.now()}`

    const sfRes = await apiCtx.post(`${API_BASE}/service-facilities`, {
      headers, data: {
        name: `${tag} Hizmet`, type: 'women-family', locationType: 'Indoor',
        city: 'İstanbul', district: 'Sultangazi', address: 'E2E Mah. No:1', managerId,
        latitude: 41.1039, longitude: 28.8674,
        weekdayOpen: '08:00', weekdayClose: '22:00', weekendOpen: '09:00', weekendClose: '20:00',
        parkingCapacity: 0, parkingType: 'Free', capacity: 100,
      },
    })
    const sfJson = await sfRes.json()
    expect(sfRes.ok(), `service-facility oluşturulamadı: ${JSON.stringify(sfJson)}`).toBeTruthy()
    const sfId = sfJson.data.id

    const fac = await apiCtx.post(`${API_BASE}/women-family/facilities`, {
      headers, data: { name: `${tag} Tesis`, kind: 'indoor', serviceFacilityId: sfId, managerId, capacity: 100, isActive: true, grantAccess: false },
    })
    const facBody = (await fac.json()).data
    const facId = typeof facBody === 'string' ? facBody : facBody.id

    const branch = await apiCtx.post(`${API_BASE}/women-family/branches`, {
      headers, data: { name: `${tag} Program`, description: 'e2e', periodMonths: 3, absenceLimit: 5, consecutiveAbsenceLimit: 3, isActive: true },
    })
    const branchId = (await branch.json()).data.id

    // documentFormats içinde "kimlik" belge tipi için SADECE pdf kabul edilsin.
    const groupRes = await apiCtx.post(`${API_BASE}/women-family/groups`, {
      headers, data: {
        facilityId: facId, branchId, parentGroupId: null,
        name: `${tag} Grubu`, description: 'e2e', type: 'kurs', gender: 'mixed',
        capacity: 20, reserveCapacity: 5, ageMin: 7, ageMax: 65,
        schedule: [{ day: 'friday', startTime: '10:00', endTime: '11:30' }],
        attendanceMode: 'full',
        fee: { isPaid: false, feeType: 'monthly', amount: 0, siblingDiscount: false, staffDiscount: false },
        conditions: {
          documentsRequired: true, requiredDocumentIds: ['kimlik'], documentFormats: { kimlik: ['pdf'] },
          residenceRequired: false, requirements: '', applicationConditions: '', aboutHtml: '',
          prerequisiteGroupId: null, customQuestions: [],
        },
        periodStart: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        periodEnd: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
        periodMonths: 3, periodType: 'month', periodCount: 3,
        academyWhitelistEnabled: false, absenceLimit: 5, consecutiveAbsenceLimit: 3, entryGraceMinutes: 15,
        instructorId: null, isActive: true, autoApprove: false,
        attendanceLimitOverride: false, attendanceLimitType: 'unlimited', attendanceLimitCount: 0,
        applicationStartDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        applicationEndDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      },
    })
    const groupBody = await groupRes.json()
    expect(groupRes.ok(), `grup oluşturma başarısız: ${JSON.stringify(groupBody)}`).toBeTruthy()
    const groupId = groupBody.data.id

    try {
      // PNG yükle ama grup kuralı "kimlik" belgesi için sadece pdf kabul ediyor → reddedilmeli.
      const pngRes = await apiCtx.post(`${API_BASE}/me/facilities/women-family/documents`, {
        headers: { Authorization: `Bearer ${citizenToken}` },
        params: { groupId, documentType: 'kimlik' },
        multipart: {
          file: { name: 'kimlik.png', mimeType: 'image/png', buffer: Buffer.from(REAL_PNG_BASE64, 'base64') },
        },
      })
      const pngBody = await pngRes.json().catch(() => ({}))
      expect(pngRes.status(), JSON.stringify(pngBody)).toBe(409)
      expect(pngBody.errorCode).toBe('DOCUMENT_FORMAT_NOT_ALLOWED')

      // Aynı belge tipi için PDF yükleyince kabul edilmeli.
      const pdfRes = await apiCtx.post(`${API_BASE}/me/facilities/women-family/documents`, {
        headers: { Authorization: `Bearer ${citizenToken}` },
        params: { groupId, documentType: 'kimlik' },
        multipart: {
          file: { name: 'kimlik.pdf', mimeType: 'application/pdf', buffer: Buffer.from(REAL_PDF_TEXT, 'utf-8') },
        },
      })
      const pdfBody = await pdfRes.json().catch(() => ({}))
      expect(pdfRes.ok(), `kimlik.pdf kabul edilmeli: ${JSON.stringify(pdfBody)}`).toBeTruthy()
    } finally {
      await apiCtx.delete(`${API_BASE}/women-family/groups/${groupId}`, { headers }).catch(() => {})
      await apiCtx.delete(`${API_BASE}/women-family/facilities/${facId}`, { headers }).catch(() => {})
      await apiCtx.delete(`${API_BASE}/women-family/branches/${branchId}`, { headers }).catch(() => {})
      await apiCtx.delete(`${API_BASE}/service-facilities/${sfId}`, { headers }).catch(() => {})
    }
  })
})
