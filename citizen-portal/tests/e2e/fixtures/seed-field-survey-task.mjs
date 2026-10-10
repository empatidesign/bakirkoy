#!/usr/bin/env node
// Saha anket kabul testi (tests/e2e/field-survey-acceptance.spec.ts) için ön koşul:
// test katılımcısına gerçek bir saha görevi atar. Test, görev yoksa kendini
// atlar; bu betik çalıştırılınca gerçek uçtan uca doğrulama devreye girer.
//
// Kullanım:  node tools/seed-field-survey-task.mjs
// Ortam:     E2E_API_BASE, E2E_TCKN, E2E_PASSWORD, E2E_OTP,
//            E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ADMIN_OTP
//
// Yalnızca kayıt EKLER, hiçbir şey silmez. Görev zaten varsa tekrar oluşturmaz.

const API = process.env.E2E_API_BASE || 'http://localhost:5207/api/v1'
const TCKN = process.env.E2E_TCKN
const PASSWORD = process.env.E2E_PASSWORD
const OTP = process.env.E2E_OTP_CODE
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
const ADMIN_OTP = process.env.E2E_OTP_CODE

const jsonOf = async (res) => {
  const text = await res.text()
  try { return { status: res.status, ...JSON.parse(text) } } catch { return { status: res.status, raw: text.slice(0, 300) } }
}

const post = (path, body, token) => fetch(`${API}${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
}).then(jsonOf)

const get = (path, token) => fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } }).then(jsonOf)

async function tokenFrom(loginPath, verifyPath, credentials, code) {
  const login = await post(loginPath, credentials)
  if (login.data?.accessToken) return { token: login.data.accessToken, user: login.data.user }
  if (!login.data?.otpSessionToken) throw new Error(`Giriş başarısız: ${JSON.stringify(login).slice(0, 200)}`)
  const verify = await post(verifyPath, { otpSessionToken: login.data.otpSessionToken, code })
  if (!verify.data?.accessToken) throw new Error(`OTP başarısız: ${JSON.stringify(verify).slice(0, 200)}`)
  return { token: verify.data.accessToken, user: verify.data.user }
}

const citizen = await tokenFrom('/auth/citizen/login', '/auth/citizen/verify-otp', { identifier: TCKN, password: PASSWORD }, OTP)
const participantId = citizen.user?.id
if (!participantId) throw new Error('Katılımcı kimliği alınamadı')

const existing = await get('/me/surveys/field/tasks', citizen.token)
if ((existing.data ?? []).length > 0) {
  console.log(`Zaten ${existing.data.length} saha görevi atanmış, yeni görev oluşturulmadı.`)
  process.exit(0)
}

const admin = await tokenFrom('/auth/login', '/auth/verify-otp', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, ADMIN_OTP)
const surveys = await get('/surveys?page=1&limit=50', admin.token)
const survey = (surveys.data?.items ?? []).find((s) => s.fieldEnabled)
if (!survey) throw new Error('Saha modu (fieldEnabled) açık anket bulunamadı')

const created = await post('/surveys/field-tasks', {
  surveyId: survey.id,
  interviewerId: participantId,
  interviewerType: 'participant',
  neighborhood: 'Cebeci',
  startDate: new Date(Date.now() - 86_400_000).toISOString(),
  endDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  targetCount: 50,
  dailyTarget: 10,
  note: 'E2E saha anket kabul testi görevi',
  status: 'assigned',
}, admin.token)

if (created.status !== 201) throw new Error(`Görev oluşturulamadı: ${JSON.stringify(created).slice(0, 250)}`)
console.log(`Saha görevi oluşturuldu: "${survey.title}" → ${participantId} (${created.data.id})`)
