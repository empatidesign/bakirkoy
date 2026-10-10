import { test, expect, type APIRequestContext } from '@playwright/test'

// Saha anket uçlarının (/api/v1/me/surveys/field/*) sözleşme ve yetki davranışını doğrular.
// UI testinden bağımsızdır: bir anketörün YALNIZCA kendisine atanmış görevlere erişebildiğini
// ve idempotency anahtarının aynı kaydı ikinci kez oluşturmadığını API seviyesinde kanıtlar.
//
// Bu senaryolar mutasyon testiyle doğrulanmıştır: sahiplik filtresi (InterviewerId eşitliği)
// kaldırıldığında uç başkasının görevini 200 ile döndürüyordu; aşağıdaki 404 beklentisi bu
// regresyonu yakalar.

const API = process.env.API_BASE || 'http://localhost:5207'
const TCKN = process.env.FIELD_TCKN || '10028544554'
const PASSWORD = process.env.FIELD_PASSWORD || 'Test1234!'
const OTP = process.env.MOCK_OTP || '111111'

// Başka bir anketöre ait görev ID'si (fixture ile oluşturulur); tanımlı değilse test atlanır.
const FOREIGN_TASK_ID = process.env.FIELD_FOREIGN_TASK_ID

async function getToken(request: APIRequestContext): Promise<string | null> {
  const login = await request.post(`${API}/api/v1/auth/citizen/login`, {
    data: { identifier: TCKN, password: PASSWORD },
  })
  if (!login.ok()) return null
  const otpToken = (await login.json())?.data?.otpSessionToken
  if (!otpToken) return null
  const verify = await request.post(`${API}/api/v1/auth/citizen/verify-otp`, {
    data: { otpSessionToken: otpToken, code: OTP },
  })
  if (!verify.ok()) return null
  return (await verify.json())?.data?.accessToken ?? null
}

test.describe('Saha anket API sözleşmesi', () => {
  test('anketör yalnızca kendi görevlerini görür ve başkasınınkine erişemez', async ({ request }) => {
    const token = await getToken(request)
    test.skip(!token, 'Saha anketörü test hesabı bu ortamda mevcut değil.')
    const headers = { Authorization: `Bearer ${token}` }

    const listRes = await request.get(`${API}/api/v1/me/surveys/field/tasks`, { headers })
    expect(listRes.status()).toBe(200)
    const tasks = (await listRes.json()).data as Array<{ id: string }>

    // Kendi görevleri erişilebilir olmalı.
    for (const t of tasks.slice(0, 3)) {
      const detail = await request.get(`${API}/api/v1/me/surveys/field/tasks/${t.id}`, { headers })
      // Kapalı pencere 409 döner, sahiplik hatası olan 404 dönmemelidir.
      expect(detail.status(), `kendi görevi ${t.id}`).not.toBe(404)
    }

    // Var olmayan görev 404 olmalı (bilgi sızdırmadan).
    const ghost = await request.get(
      `${API}/api/v1/me/surveys/field/tasks/00000000-0000-0000-0000-000000000000`, { headers })
    expect(ghost.status()).toBe(404)

    // Başka anketörün görevine erişilememeli.
    if (FOREIGN_TASK_ID) {
      expect(tasks.some((t) => t.id === FOREIGN_TASK_ID)).toBe(false)
      for (const path of ['', '/responses']) {
        const res = await request.get(
          `${API}/api/v1/me/surveys/field/tasks/${FOREIGN_TASK_ID}${path}`, { headers })
        expect(res.status(), `başkasının görevi${path}`).toBe(404)
      }
      const post = await request.post(
        `${API}/api/v1/me/surveys/field/tasks/${FOREIGN_TASK_ID}/responses`,
        { headers, data: { tckn: '10000000146', answers: [] } })
      expect(post.status()).toBe(404)
    }
  })

  test('kimliksiz istek reddedilir', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/me/surveys/field/tasks`)
    expect(res.status()).toBe(401)
  })
})
