import type { ServiceCategoryRef } from './serviceCategory.types'

export type CompanyStatus = 'Pending' | 'Approved' | 'Rejected' | 'Passive'

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  Pending: 'Onay Bekliyor',
  Approved: 'Onaylandı',
  Rejected: 'Reddedildi',
  Passive: 'Pasif',
}

export const COMPANY_STATUS_TONE: Record<CompanyStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'danger',
  Passive: 'neutral',
}

export interface CompanySocialMedia {
  facebook?: string | null
  instagram?: string | null
  twitter?: string | null
  linkedin?: string | null
}

export interface CompanyUser {
  id: string
  name: string
  taxNumber: string
  phone: string
  email: string | null
  address: string
  district: string
  status: CompanyStatus
  emailVerified: boolean
  phoneVerified: boolean
  logo?: string | null
  bannerImage?: string | null
  bannerImageMobile?: string | null
  description?: string | null
  website?: string | null
  socialMedia?: CompanySocialMedia | null
  latitude?: number | null
  longitude?: number | null
  rejectReason?: string | null
  serviceCategory: ServiceCategoryRef | null
  totalCampaigns: number
  totalUsages: number
  createdAt: string
  updatedAt?: string | null
  galleryImages?: string[] | null
  serviceDescription?: string | null
  kvkkAccepted?: boolean
  notificationConsentAccepted?: boolean
}

export interface CompanySessionConfig {
  webInactivityTimeoutMinutes: number
  mobileInactivityTimeoutMinutes: number
}

export interface CompanyLoginRequest {
  identifier: string
  password: string
}

export interface CompanyLoginChallenge {
  requiresOtp: boolean
  otpSessionToken: string
  otpChannel: string
  maskedTarget: string
  resendCooldownSeconds: number
}

export interface CompanyOtpChallenge {
  otpChannel: string
  maskedTarget: string
  resendCooldownSeconds: number
}

export interface CompanyTokenPair {
  accessToken: string
  refreshToken: string
  expiresAt: string
  company: CompanyUser
  sessionConfig: CompanySessionConfig
  mustChangePassword: boolean
}

export interface CompanyRegisterRequest {
  name: string
  taxNumber: string
  phone: string
  email?: string
  address: string
  district?: string
  password: string
  serviceCategoryId?: string
  latitude?: number
  longitude?: number
  kvkkAccepted?: boolean
  notificationConsentAccepted?: boolean
}

export interface CompanyRegisterResult {
  success: boolean
  message: string
}

export interface CompanyForgotPasswordRequest {
  identifier: string
}

export interface CompanyForgotPasswordResponse {
  otpChannel: string
  maskedTarget: string
  resendCooldownSeconds: number
}

export interface CompanyResetPasswordRequest {
  identifier: string
  otpCode: string
  newPassword: string
}

export interface CompanyChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface UpdateCompanyProfileRequest {
  name: string
  phone: string
  email?: string
  address: string
  district?: string
  logo?: string | null
  bannerImage?: string | null
  bannerImageMobile?: string | null
  description?: string | null
  website?: string | null
  socialMedia?: CompanySocialMedia | null
  latitude?: number | null
  longitude?: number | null
  galleryImages?: string[] | null
  serviceDescription?: string | null
  serviceCategoryId?: string | null
}
