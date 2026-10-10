const API_BASE = process.env.E2E_API_URL || 'http://localhost:5207/api/v1'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!
const ADMIN_OTP = process.env.E2E_OTP_CODE!

async function apiToken(): Promise<string> {
  const login = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  }).then((r) => r.json())
  const otpToken = login?.data?.otpSessionToken
  if (!otpToken) return login?.data?.accessToken ?? ''
  const verify = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otpSessionToken: otpToken, code: ADMIN_OTP }),
  }).then((r) => r.json())
  return verify?.data?.accessToken ?? ''
}

export async function setGroupAttendanceMode(module: string, groupId: string, mode: string): Promise<void> {
  const token = await apiToken()
  const auth = { Authorization: `Bearer ${token}` }
  const g = await fetch(`${API_BASE}/${module}/groups/${groupId}`, { headers: auth }).then((r) => r.json())
  const d = g?.data
  if (!d) throw new Error(`Grup bulunamadı: ${groupId}`)

  const today = new Date().toISOString().slice(0, 10)
  const periodStart = d.periodStart && d.periodStart.slice(0, 10) >= today ? d.periodStart : today

  const body = {
    facilityId: d.facilityId,
    branchId: d.branchId,
    parentGroupId: d.parentGroupId ?? null,
    name: d.name,
    description: d.description ?? null,
    type: d.type,
    gender: d.gender,
    capacity: d.capacity,
    reserveCapacity: d.reserveCapacity,
    ageMin: d.ageMin,
    ageMax: d.ageMax,
    schedule: d.schedule ?? [],
    attendanceMode: mode,
    fee: d.fee ?? { isPaid: false },
    conditions: d.conditions ?? {},
    periodStart,
    periodEnd: d.periodEnd ?? null,
    periodMonths: 0,
    periodType: d.periodType ?? '',
    periodCount: d.periodCount ?? 0,
    applicationStartDate: d.applicationStartDate ?? null,
    applicationEndDate: d.applicationEndDate ?? null,
    academyWhitelistEnabled: d.academyWhitelistEnabled ?? false,
    absenceLimit: d.absenceLimit ?? 0,
    consecutiveAbsenceLimit: d.consecutiveAbsenceLimit ?? 0,
    entryGraceMinutes: d.entryGraceMinutes ?? 0,
    instructorId: d.instructorId ?? null,
    isActive: d.isActive,
    autoApprove: d.autoApprove ?? true,
    managerApprovalRequired: d.managerApprovalRequired ?? false,
    attendanceLimitOverride: d.attendanceLimitOverride ?? false,
    attendanceLimitType: d.attendanceLimitType ?? 'unlimited',
    attendanceLimitCount: d.attendanceLimitCount ?? 0,
  }

  const res = await fetch(`${API_BASE}/${module}/groups/${groupId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Grup güncellenemedi (${res.status}): ${await res.text()}`)
}
