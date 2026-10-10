export interface AdminMeResponseDto {
  me: MeDto
  sessionConfig: SessionConfig
}

export interface MeScopeDto {
  moduleKey: string
  refIds: string[]
}

export interface MeDto {
  id: string
  fullName: string
  email: string
  phone?: string
  role: string
  isActive: boolean
  mustChangePassword: boolean
  isTwoFactorEnabled: boolean
  lastLoginAt?: string
  isSuperAdmin?: boolean
  permissions?: string[]
  scopes?: MeScopeDto[]
  roleName?: string
  roleColor?: string
  // --- SultanŞehir Anket Platformu — anket-özel yetki alanları ---
  isSurveyUser?: boolean
  surveyAllNeighborhoods?: boolean
  surveyOwnSurveysOnly?: boolean
  surveyCanViewParticipants?: boolean
  surveyCanViewPastSurveys?: boolean
  surveyCreateOnly?: boolean
  surveyNeighborhoods?: string[]
}

export interface SessionConfig {
  inactivityTimeoutMinutes: number
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresAt: string
  user: MeDto
  sessionConfig: SessionConfig
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  requiresOtp: boolean
  otpSessionToken?: string
  otpChannel?: string
  resendCooldownSeconds?: number
  hasActiveSessions?: boolean
  accessToken?: string
  refreshToken?: string
  expiresAt?: string
  user?: MeDto
  sessionConfig?: SessionConfig
}

export interface VerifyOtpRequest {
  otpSessionToken: string
  code: string
}

export interface ResendOtpRequest {
  otpSessionToken: string
}

export interface ResendOtpResponse {
  otpSessionToken: string
  otpChannel: string
  resendCooldownSeconds: number
}

export interface RefreshRequest {
  refreshToken: string
}

export interface ForgotPasswordRequest {
  /** E-posta adresi veya telefon numarası (2026-09-07: ikisi de kabul edilir). */
  identifier: string
}

export interface ForgotPasswordResponse {
  sent: boolean
  channel: 'sms' | 'email'
  maskedTarget?: string | null
}

export type AuthState =
  | { status: 'idle' }
  | { status: 'authenticated'; user: MeDto; accessToken: string; refreshToken: string; sessionConfig: SessionConfig }
  | { status: 'unauthenticated' }
