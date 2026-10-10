export type CitizenStatus = 'Active' | 'Passive' | 'Blocked'

export interface CitizenUser {
  id: string
  fullName: string
  tckn: string
  email?: string
  phone?: string
  photoUrl?: string
  isMinor: boolean
  status: CitizenStatus
  mustChangePassword: boolean
  lastLoginAt?: string
  birthDate: string
  gender: Gender
  address?: string
  city?: string
  district?: string
  neighborhood?: string
  districtCode?: string
  age: number
  kvkkAccepted: boolean
  notificationConsentAccepted: boolean
}

export interface CitizenLoginRequest {
  identifier: string
  password: string
}

export interface CitizenLoginChallenge {
  requiresOtp: boolean
  otpSessionToken: string
  otpChannel: string
  maskedTarget: string
  resendCooldownSeconds: number
}

export interface CitizenOtpChallenge {
  otpChannel: string
  maskedTarget: string
  resendCooldownSeconds: number
}

export interface CitizenSession {
  sessionId: string
  deviceType: string
  ipAddress: string | null
  createdAt: string
  isCurrent: boolean
}

export interface CitizenSessionConfig {
  webInactivityTimeoutMinutes: number
  mobileInactivityTimeoutMinutes: number
}

export interface CitizenTokenPair {
  accessToken: string
  refreshToken: string
  expiresAt: string
  user: CitizenUser
  sessionConfig: CitizenSessionConfig
}

export interface CitizenMeResponse {
  user: CitizenUser
  sessionConfig: CitizenSessionConfig
}

export interface CitizenForgotPasswordRequest {
  identifier: string
  /** Yalnız telefonsuz kayıtta (BIRTHDATE_REQUIRED) gönderilir. */
  birthDate?: string
}

export interface CitizenForgotPasswordResponse {
  otpChannel: string
  maskedTarget: string
  resendCooldownSeconds: number
  /** true: kayıtta iletişim yok, OTP gönderilmedi; kişi Kayıt Ol adımına yönlendirilir. */
  registrationRequired?: boolean
  registration?: NviLookupResult | null
}

export interface CitizenResetPasswordRequest {
  identifier: string
  otpCode: string
  newPassword: string
}

export interface CitizenChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// F04 (denetim 2026-09-16): Eski tek-adımlı PATCH /me/contact ucu backend'den
// kaldırılmış (IDN-11 güvenlik düzeltmesi, 2026-09-01) — artık iki adımlı OTP
// akışı var: request-change (yeni değere kod gönderir) + confirm-change (kod
// doğrulanınca uygular). Frontend hâlâ eski uca gidiyordu (404). Bu tipler
// backend'in CitizenRequestContactChangeRequest/CitizenConfirmContactChangeRequest
// DTO'larıyla eşleşir.
export interface CitizenRequestContactChangeRequest {
  email?: string | null
  phone?: string | null
  currentPassword: string
}

export interface CitizenConfirmContactChangeRequest {
  code: string
}

export type Gender = 'Unknown' | 'Male' | 'Female'

export const GENDER_LABELS: Record<Gender, string> = {
  Unknown: 'Belirtilmemiş',
  Male: 'Erkek',
  Female: 'Kadın',
}

export interface NviChild {
  tckn: string
  fullName: string
  birthDate: string
  gender: Gender
  address?: string
  city?: string
  district?: string
  neighborhood?: string
  districtCode?: string
}

export interface NviLookupResult {
  tckn: string
  fullName: string
  birthDate: string
  gender: Gender
  address?: string
  city?: string
  district?: string
  neighborhood?: string
  districtCode?: string
  isMinor: boolean
  children: NviChild[]
}

export interface CitizenRegisterRequest {
  tckn: string
  birthDate: string
  phone: string
  email: string | null
  password: string
  guardianPhone?: string
  guardianEmail?: string
}
