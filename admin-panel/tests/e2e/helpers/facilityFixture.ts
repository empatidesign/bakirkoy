
const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

let _token: string | null = null

async function freshLogin(): Promise<string> {
  const login = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  }).then((r) => r.json())
  if (login?.data?.accessToken) { _token = login.data.accessToken; return _token! }
  const otpToken = login?.data?.otpSessionToken
  if (!otpToken) throw new Error(`Login başarısız: ${JSON.stringify(login)}`)
  const verify = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otpSessionToken: otpToken, code: ADMIN_OTP }),
  }).then((r) => r.json())
  _token = verify?.data?.accessToken ?? ''
  if (!_token) throw new Error(`OTP doğrulama başarısız: ${JSON.stringify(verify)}`)
  return _token
}

export async function apiToken(forceFresh = false): Promise<string> {
  if (_token && !forceFresh) return _token
  return freshLogin()
}

async function authGet(path: string, _retried = false): Promise<any> {
  const token = await apiToken()
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401 && !_retried) {
    await apiToken(true)
    return authGet(path, true)
  }
  return res.json()
}

export interface SportsFixture {
  facilityId: string
  subGroupId: string
}

export async function resolveFacilityFixture(module: string): Promise<SportsFixture> {
  const facRes = await authGet(`/${module}/facilities?pageSize=50`)
  const facilities: any[] = facRes?.data?.items ?? facRes?.data ?? []
  for (const f of facilities) {
    const facilityId = f.id ?? f.Id
    if (!facilityId) continue
    const grpRes = await authGet(`/${module}/groups?facilityId=${facilityId}&pageSize=50`)
    const groups: any[] = grpRes?.data?.items ?? grpRes?.data ?? []
    const sub = groups.find((g) => g.parentGroupId)
    if (sub) return { facilityId, subGroupId: sub.id }
  }
  const anyGroups = await authGet(`/${module}/groups?pageSize=100`)
  const items: any[] = anyGroups?.data?.items ?? []
  const sub = items.find((g) => g.parentGroupId && g.facilityId)
  if (sub) return { facilityId: sub.facilityId, subGroupId: sub.id }
  throw new Error(`Uygun ${module} tesisi/alt grubu bulunamadı (E2E fixture çözümlenemedi).`)
}

export async function resolveSportsFixture(): Promise<SportsFixture> {
  return resolveFacilityFixture('sports')
}
